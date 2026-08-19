/**
 * IndexedDB Database using Dexie.js
 * Replaces localStorage for offline data persistence
 * 
 * Schema:
 * - mutations: Offline mutation queue (replaces localStorage queue)
 * - patients: Cached patient data for offline access
 * - phrases: Cached clinical phrases for offline access
 * - guidelines: Cached clinical guidelines
 * - syncMetadata: Track last sync timestamps and conflict state
 * - roundSessions: Today’s Round continuity cache (position, filters, drafts)
 * - roundOutbox: Round state + chart draft outbox for reconnect drain
 * - todoSnapshots: Owner-scoped Todo map for cold offline review/export
 * - patientImportAttempts: Owner-scoped idempotency records for ambiguous imports
 */

import Dexie, { type EntityTable } from 'dexie';
import { logInfo } from '../observability/logger';
import type { CachedRoundSession, RoundOutboxEntry } from '../round/sync/types';

// ============================================
// Type Definitions
// ============================================

export interface QueuedMutationDB {
  id: string;
  type: 'patient' | 'autotext' | 'phrase' | 'todo' | 'template' | 'dictionary';
  operation: 'create' | 'update' | 'delete';
  table: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  status?: 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict';
  entityId?: string;
  conflictResolution?: 'server-wins' | 'client-wins' | 'manual';
  conflictData?: Record<string, unknown>;
  conflictServerData?: Record<string, unknown> | null;
  /** The authenticated user that owns this mutation. */
  ownerId?: string;
}

export interface CachedPatient {
  id: string;
  data: Record<string, unknown>;
  cachedAt: number;
  lastModified: number;
  syncStatus: 'synced' | 'pending' | 'conflict';
  version: number;
}

export interface CachedPhrase {
  id: string;
  data: Record<string, unknown>;
  cachedAt: number;
  lastModified: number;
  syncStatus: 'synced' | 'pending' | 'conflict';
  version: number;
}

export interface CachedGuideline {
  id: string;
  category: string;
  data: Record<string, unknown>;
  cachedAt: number;
}

export interface SyncMetadata {
  id: string;
  tableName: string;
  lastSyncAt: number;
  lastSuccessfulSyncAt: number;
  pendingChanges: number;
  conflictCount: number;
  checksum?: string;
  ownerId?: string;
}

export interface CachedTodoSnapshot {
  id: string;
  ownerId: string;
  data: Record<string, unknown>;
  cachedAt: number;
}

export interface PatientImportAttemptRecord {
  id: string;
  ownerId: string;
  fingerprint: string;
  patientIds: string[];
  createdAt: number;
}

export type { CachedRoundSession, RoundOutboxEntry };

// ============================================
// Database Class
// ============================================

class RoundRobinDatabase extends Dexie {
  mutations!: EntityTable<QueuedMutationDB, 'id'>;
  patients!: EntityTable<CachedPatient, 'id'>;
  phrases!: EntityTable<CachedPhrase, 'id'>;
  guidelines!: EntityTable<CachedGuideline, 'id'>;
  syncMetadata!: EntityTable<SyncMetadata, 'id'>;
  roundSessions!: EntityTable<CachedRoundSession, 'id'>;
  roundOutbox!: EntityTable<RoundOutboxEntry, 'id'>;
  todoSnapshots!: EntityTable<CachedTodoSnapshot, 'id'>;
  patientImportAttempts!: EntityTable<PatientImportAttemptRecord, 'id'>;

  constructor() {
    super('RoundRobinNotesDB');
    
    this.version(2).stores({
      mutations: 'id, type, timestamp, entityId, status, [table+entityId]',
      patients: 'id, cachedAt, lastModified, syncStatus',
      phrases: 'id, cachedAt, lastModified, syncStatus',
      guidelines: 'id, category, cachedAt',
      syncMetadata: 'id, tableName, lastSyncAt',
      aiCache: 'id, queryHash, feature, cachedAt, expiresAt'
    });

    // Raw AI prompts and responses were cached by older builds. The cache is
    // unused and can contain clinical text, so remove its object store.
    this.version(3).stores({
      aiCache: null,
    });

    // Today’s Round continuity + outbox (Step 5).
    this.version(4).stores({
      roundSessions: 'id, userId, lastModified, syncStatus',
      roundOutbox: 'id, ownerId, kind, entityKey, timestamp, status, [kind+entityKey]',
    });

    // Owner-scoped Todo snapshot used by End Round and print/export after a
    // cold offline reload. Pending mutations remain in the separate queue.
    this.version(5).stores({
      todoSnapshots: 'id, ownerId, cachedAt',
    });

    // Stable client-generated IDs make patient-list import retry idempotent
    // when the server commits but its response is lost.
    this.version(6).stores({
      patientImportAttempts: 'id, ownerId, fingerprint, createdAt',
    });
  }
}

// ============================================
// Singleton Instance
// ============================================

export const db = new RoundRobinDatabase();

export const AUTH_OWNER_METADATA_ID = '__auth_owner__';

export type DataOwnerTransition = 'preserved' | 'cleared' | 'claimed';
export type DataOwnerAction = 'preserve' | 'clear' | 'clear-and-claim';

export function decideDataOwnerAction(
  currentOwnerId: string | null,
  nextOwnerId: string | null,
): DataOwnerAction {
  if (nextOwnerId !== null && currentOwnerId === nextOwnerId) return 'preserve';
  return nextOwnerId === null ? 'clear' : 'clear-and-claim';
}

const ownerBoundDataTables = () => [
  db.mutations,
  db.patients,
  db.phrases,
  db.guidelines,
  db.syncMetadata,
  db.roundSessions,
  db.roundOutbox,
  db.todoSnapshots,
];

const allDataTables = () => [
  ...ownerBoundDataTables(),
  db.patientImportAttempts,
];

async function clearOwnerBoundData(): Promise<void> {
  await Promise.all([
    db.mutations.clear(),
    db.patients.clear(),
    db.phrases.clear(),
    db.guidelines.clear(),
    db.syncMetadata.clear(),
    db.roundSessions.clear(),
    db.roundOutbox.clear(),
    db.todoSnapshots.clear(),
  ]);
}

async function clearAllTables(): Promise<void> {
  await Promise.all([
    clearOwnerBoundData(),
    db.patientImportAttempts.clear(),
  ]);
}

/**
 * Keep the browser database bound to exactly one authenticated user.
 *
 * The ownership check, purge, and claim run in one IndexedDB transaction, so a
 * crash cannot leave another user's records associated with the new identity.
 * Data created before ownership markers existed is deliberately quarantined by
 * clearing it before the first user claims the database.
 */
export async function transitionDatabaseOwner(
  nextOwnerId: string | null,
): Promise<DataOwnerTransition> {
  await db.open();

  return db.transaction('rw', ownerBoundDataTables(), async (): Promise<DataOwnerTransition> => {
    const ownerRecord = await db.syncMetadata.get(AUTH_OWNER_METADATA_ID);
    const currentOwnerId = ownerRecord?.ownerId ?? null;
    const action = decideDataOwnerAction(currentOwnerId, nextOwnerId);

    if (action === 'preserve') {
      return 'preserved';
    }

    // Retry identities contain no patient content and can represent a server
    // commit whose response was lost. Retain them across auth transitions so
    // the original owner can reconcile safely after signing back in.
    await clearOwnerBoundData();

    if (nextOwnerId === null) {
      return 'cleared';
    }

    await db.syncMetadata.put({
      id: AUTH_OWNER_METADATA_ID,
      tableName: AUTH_OWNER_METADATA_ID,
      lastSyncAt: Date.now(),
      lastSuccessfulSyncAt: Date.now(),
      pendingChanges: 0,
      conflictCount: 0,
      ownerId: nextOwnerId,
    });

    return 'claimed';
  });
}

export async function getDatabaseOwner(): Promise<string | null> {
  await db.open();
  return (await db.syncMetadata.get(AUTH_OWNER_METADATA_ID))?.ownerId ?? null;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Initialize database and verify connection
 */
export async function initializeDatabase(): Promise<boolean> {
  try {
    await db.open();
    logInfo('[IndexedDB] Database initialized successfully');
    return true;
  } catch (error) {
    console.error('[IndexedDB] Failed to initialize database:', error);
    return false;
  }
}

/**
 * Clear all data from the database (use with caution)
 */
export async function clearAllData(): Promise<void> {
  try {
    await db.transaction('rw', allDataTables(), clearAllTables);
    logInfo('[IndexedDB] All data cleared');
  } catch (error) {
    console.error('[IndexedDB] Failed to clear data:', error);
    throw error;
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  mutations: number;
  patients: number;
  phrases: number;
  guidelines: number;
  roundSessions: number;
  roundOutbox: number;
  todoSnapshots: number;
  patientImportAttempts: number;
}> {
  const [mutations, patients, phrases, guidelines, roundSessions, roundOutbox, todoSnapshots, patientImportAttempts] = await Promise.all([
    db.mutations.count(),
    db.patients.count(),
    db.phrases.count(),
    db.guidelines.count(),
    db.roundSessions.count(),
    db.roundOutbox.count(),
    db.todoSnapshots.count(),
    db.patientImportAttempts.count(),
  ]);
  
  return { mutations, patients, phrases, guidelines, roundSessions, roundOutbox, todoSnapshots, patientImportAttempts };
}
