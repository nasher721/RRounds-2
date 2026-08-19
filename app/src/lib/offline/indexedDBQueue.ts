import { db, type QueuedMutationDB } from './database';
import { logInfo } from '../observability/logger';
import {
  recordOfflineQueueHealth,
  type OfflineQueueMetricOutcome,
} from '../observability/operationalMetrics';
import { safeLocalStorage } from '../../utils/safeStorage';
import {
  offlineOwnerTransitionBarrier,
} from './ownerTransitionBarrier';
import { pendingQueueSignature } from './queueSignature';

export { OwnerTransitionBarrier } from './ownerTransitionBarrier';

export type { QueuedMutationDB };
export type QueuedMutation = QueuedMutationDB;
export type QueuedMutationInput = Omit<
  QueuedMutation,
  'id' | 'timestamp' | 'retryCount' | 'maxRetries' | 'ownerId' | 'status'
>;
export interface ConflictData {
  id: string;
  table: string;
  operation: 'create' | 'update' | 'delete';
  clientData: Record<string, unknown>;
  serverData: Record<string, unknown> | null;
  originalData: Record<string, unknown>;
}

const MAX_RETRIES = 3;
const QUEUE_STORAGE_KEY = 'offline-mutation-queue';
const QUEUE_CHANGE_CHANNEL = 'rolling-rounds-offline-queue-v1';
let inMemoryFallbackQueue: QueuedMutation[] = [];

/**
 * Serializes owner transitions while allowing already-accepted queue writes to
 * finish. New writes are rejected as soon as a transition is requested so an
 * event from the quarantined UI cannot be replayed under the next identity.
 */
function readMemoryQueue(): QueuedMutation[] {
  return [...inMemoryFallbackQueue];
}

function writeMemoryQueue(queue: QueuedMutation[]): void {
  inMemoryFallbackQueue = [...queue];
  // Remove data written by older builds. Mutation payloads may contain PHI and
  // must not survive a browser/auth session boundary in unscoped Web Storage.
  safeLocalStorage.removeItem(QUEUE_STORAGE_KEY);
}

/** Select only records that belong to the authenticated owner after hydration. */
export function selectOwnedMutations(
  queue: readonly QueuedMutation[],
  ownerId: string | null,
): QueuedMutation[] {
  if (!ownerId) return [];
  return queue
    .filter(mutation => mutation.ownerId === ownerId)
    .sort((left, right) => left.timestamp - right.timestamp);
}

function coalesceMutation(
  existing: QueuedMutation,
  incoming: QueuedMutation,
): QueuedMutation | null {
  if (incoming.operation === 'delete' && existing.operation === 'create') {
    return null;
  }

  if (incoming.operation === 'update' && existing.operation === 'create') {
    return {
      ...existing,
      payload: { ...existing.payload, ...incoming.payload },
      conflictData: incoming.conflictData ?? existing.conflictData,
      timestamp: incoming.timestamp,
      retryCount: 0,
      status: 'pending',
    };
  }

  if (incoming.operation === 'create' && existing.operation === 'create') {
    return {
      ...existing,
      payload: { ...existing.payload, ...incoming.payload },
      timestamp: incoming.timestamp,
      retryCount: 0,
      status: 'pending',
    };
  }

  if (incoming.operation === 'update' && existing.operation === 'update') {
    return {
      ...incoming,
      id: existing.id,
      payload: { ...existing.payload, ...incoming.payload },
      // Compare replay against the oldest server snapshot, not against a
      // later optimistic value produced while this row was still queued.
      conflictData: existing.conflictData ?? incoming.conflictData,
    };
  }

  return {
    ...incoming,
    id: existing.id,
  };
}

class IndexedDBQueueManager {
  private listeners: Set<(queue: QueuedMutation[]) => void> = new Set();
  private initialized = false;
  private initialization: Promise<void>;
  private ownerId: string | null = null;
  private notificationVersion = 0;
  private queueChangeChannel: BroadcastChannel | null = null;
  
  constructor() {
    safeLocalStorage.removeItem(QUEUE_STORAGE_KEY);
    this.initialization = this.initialize();
    this.setupOnlineListener();
    this.setupCrossTabListener();
  }
  
  private async initialize(): Promise<void> {
    try {
      await db.open();
      const fallbackQueue = readMemoryQueue();
      if (fallbackQueue.length > 0) {
        await db.mutations.bulkPut(fallbackQueue);
        writeMemoryQueue([]);
      }
      this.initialized = true;
      const count = await db.mutations.count();
      logInfo(`[IndexedDBQueue] Initialized with ${count} pending mutations`);
    } catch (error) {
      console.error('[IndexedDBQueue] Failed to initialize:', error);
      this.useMemoryFallback();
    }
  }
  
  private useMemoryFallback(): void {
    console.warn('[IndexedDBQueue] Falling back to memory-only mode');
    this.initialized = false;
  }
  
  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      logInfo('[IndexedDBQueue] Connection restored');
      this.notifyListeners();
    });
    
    window.addEventListener('offline', () => {
      logInfo('[IndexedDBQueue] Connection lost');
      this.notifyListeners();
    });
  }

  private setupCrossTabListener(): void {
    if (typeof window === 'undefined' || typeof window.BroadcastChannel === 'undefined') return;
    this.queueChangeChannel = new window.BroadcastChannel(QUEUE_CHANGE_CHANNEL);
    this.queueChangeChannel.addEventListener('message', (event) => {
      if (event.data === 'queue-changed') {
        this.notifyListeners();
      }
    });
  }
  
  private notifyListeners(): void {
    const version = ++this.notificationVersion;
    this.getQueue().then(queue => {
      if (version !== this.notificationVersion) return;
      this.listeners.forEach(callback => callback(queue));
    }).catch(() => {/* notify listeners of empty queue on error */});
  }

  /** Notify this tab and other same-origin tabs without broadcasting PHI. */
  private notifyQueueChanged(): void {
    this.notifyListeners();
    this.queueChangeChannel?.postMessage('queue-changed');
  }
  
  enqueue(mutation: QueuedMutationInput): Promise<string> {
    const acceptedOwnerId = this.ownerId;
    return offlineOwnerTransitionBarrier.runOperation(async () => {
      if (!acceptedOwnerId) {
        throw new Error('Cannot queue an offline mutation without an authenticated owner');
      }
      await this.initialization;

      const id = `mutation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const queuedMutation: QueuedMutation = {
        ...mutation,
        id,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: MAX_RETRIES,
        status: 'pending',
        ownerId: acceptedOwnerId,
      };

      let persistedId = id;
      if (this.initialized) {
        const existingMutation = mutation.entityId
          ? await db.mutations
            .where('[table+entityId]')
            .equals([mutation.table, mutation.entityId])
            .filter(item => item.ownerId === acceptedOwnerId && item.type === mutation.type)
            .first()
          : undefined;

        if (!existingMutation) {
          await db.mutations.add(queuedMutation);
        } else {
          persistedId = existingMutation.id;
          const coalesced = coalesceMutation(existingMutation, queuedMutation);
          if (coalesced) {
            await db.mutations.put(coalesced);
          } else {
            await db.mutations.delete(existingMutation.id);
          }
        }
      } else {
        persistedId = this.enqueueToMemory(queuedMutation, acceptedOwnerId);
      }

      this.notifyQueueChanged();
      logInfo(`[IndexedDBQueue] Queued: ${mutation.type}/${mutation.operation}`);
      void this.recordHealthMetrics('enqueued');
      return persistedId;
    });
  }
  
  private enqueueToMemory(mutation: QueuedMutation, acceptedOwnerId: string): string {
    const queue = readMemoryQueue();
    const existingIndex = mutation.entityId
      ? queue.findIndex(item => (
        item.ownerId === acceptedOwnerId
        && item.table === mutation.table
        && item.entityId === mutation.entityId
        && item.type === mutation.type
      ))
      : -1;

    if (existingIndex === -1) {
      queue.push(mutation);
      writeMemoryQueue(queue);
      return mutation.id;
    }

    const existing = queue[existingIndex];
    const coalesced = coalesceMutation(existing, mutation);
    if (coalesced) {
      queue[existingIndex] = coalesced;
    } else {
      queue.splice(existingIndex, 1);
    }
    writeMemoryQueue(queue);
    return existing.id;
  }
  
  async dequeue(mutationId: string): Promise<void> {
    if (this.initialized) {
      const mutation = await db.mutations.get(mutationId);
      if (mutation?.ownerId === this.ownerId) {
        await db.mutations.delete(mutationId);
      }
    } else {
      const queue = readMemoryQueue();
      writeMemoryQueue(queue.filter(m => m.id !== mutationId || m.ownerId !== this.ownerId));
    }
    this.notifyQueueChanged();
  }
  
  async markFailed(mutationId: string, configuredMaxRetries?: number): Promise<boolean> {
    if (this.initialized) {
      const mutation = await db.mutations.get(mutationId);
      if (mutation?.ownerId === this.ownerId) {
        const newRetryCount = mutation.retryCount + 1;
        const maxRetries = Math.min(
          mutation.maxRetries,
          configuredMaxRetries ?? mutation.maxRetries,
        );
        
        if (newRetryCount >= maxRetries) {
          console.warn(`[IndexedDBQueue] Mutation ${mutationId} exceeded max retries`);
          await db.mutations.update(mutationId, {
            retryCount: newRetryCount,
            status: 'failed',
          });
          this.notifyQueueChanged();
          return false;
        }
        
        await db.mutations.update(mutationId, { retryCount: newRetryCount });
        this.notifyQueueChanged();
        return true;
      }
    } else {
      const queue = readMemoryQueue();
      const mutation = queue.find(item => item.id === mutationId && item.ownerId === this.ownerId);
      if (mutation) {
        mutation.retryCount += 1;
        const maxRetries = Math.min(
          mutation.maxRetries,
          configuredMaxRetries ?? mutation.maxRetries,
        );
        if (mutation.retryCount >= maxRetries) {
          mutation.status = 'failed';
          writeMemoryQueue(queue);
          this.notifyQueueChanged();
          return false;
        }
        writeMemoryQueue(queue);
        this.notifyQueueChanged();
        return true;
      }
    }
    return false;
  }
  
  async getQueue(): Promise<QueuedMutation[]> {
    if (!this.ownerId) return [];
    if (this.initialized) {
      return selectOwnedMutations(await db.mutations.toArray(), this.ownerId);
    }
    return selectOwnedMutations(readMemoryQueue(), this.ownerId);
  }
  
  async getByType(type: QueuedMutation['type']): Promise<QueuedMutation[]> {
    if (this.initialized) {
      return db.mutations
        .where('type')
        .equals(type)
        .filter(mutation => mutation.ownerId === this.ownerId)
        .toArray();
    }
    const queue = await this.getQueue();
    return queue.filter(m => m.type === type);
  }
  
  async getLength(): Promise<number> {
    if (!this.ownerId) return 0;
    if (this.initialized) {
      return db.mutations.filter(mutation => mutation.ownerId === this.ownerId).count();
    }
    return (await this.getQueue()).length;
  }
  
  async hasPendingMutations(): Promise<boolean> {
    return (await this.getPendingCount()) > 0;
  }
  
  async clear(): Promise<void> {
    if (!this.ownerId) {
      writeMemoryQueue([]);
      this.notifyQueueChanged();
      void this.recordHealthMetrics('cleared');
      return;
    }
    if (this.initialized) {
      const ids = await db.mutations
        .filter(mutation => mutation.ownerId === this.ownerId)
        .primaryKeys();
      await db.mutations.bulkDelete(ids);
    } else {
      writeMemoryQueue(readMemoryQueue().filter(mutation => mutation.ownerId !== this.ownerId));
    }
    this.notifyQueueChanged();
    void this.recordHealthMetrics('cleared');
  }

  /**
   * Delete only the exact owner-scoped queue that was exported for recovery.
   * The IndexedDB read, signature comparison, and delete share one transaction,
   * so a concurrent write either invalidates the signature or survives after
   * the deletion. The memory fallback performs the same steps synchronously.
   */
  discardIfUnchanged(expectedSignature: string): Promise<boolean> {
    const acceptedOwnerId = this.ownerId;
    return offlineOwnerTransitionBarrier.runOperation(async () => {
      if (!acceptedOwnerId) return false;
      await this.initialization;

      let discarded = false;
      if (this.initialized) {
        discarded = await db.transaction('rw', db.mutations, async () => {
          const ownedMutations = selectOwnedMutations(
            await db.mutations.toArray(),
            acceptedOwnerId,
          );
          if (pendingQueueSignature(ownedMutations) !== expectedSignature) {
            return false;
          }
          await db.mutations.bulkDelete(ownedMutations.map((mutation) => mutation.id));
          return true;
        });
      } else {
        const queue = readMemoryQueue();
        const ownedMutations = selectOwnedMutations(queue, acceptedOwnerId);
        if (pendingQueueSignature(ownedMutations) === expectedSignature) {
          writeMemoryQueue(queue.filter((mutation) => mutation.ownerId !== acceptedOwnerId));
          discarded = true;
        }
      }

      if (!discarded) {
        this.notifyListeners();
        return false;
      }

      this.notifyQueueChanged();
      void this.recordHealthMetrics('cleared');
      return true;
    });
  }

  /**
   * Report aggregate queue pressure without reading or emitting mutation
   * payloads. Failures are intentionally ignored: metrics cannot block writes.
   */
  async recordHealthMetrics(outcome: OfflineQueueMetricOutcome): Promise<void> {
    try {
      const queue = await this.getQueue();
      const oldestTimestamp = queue.reduce<number | null>(
        (oldest, mutation) => oldest === null
          ? mutation.timestamp
          : Math.min(oldest, mutation.timestamp),
        null,
      );
      recordOfflineQueueHealth({
        queueLength: queue.length,
        oldestAgeMs: oldestTimestamp === null ? 0 : Date.now() - oldestTimestamp,
        outcome,
      });
    } catch {
      // Observability is best-effort and must never make queue operations fail.
    }
  }
  
  subscribe(callback: (queue: QueuedMutation[]) => void): () => void {
    let active = true;
    const version = this.notificationVersion;
    this.listeners.add(callback);
    this.getQueue()
      .then(queue => {
        if (active && version === this.notificationVersion) callback(queue);
      })
      .catch(() => {/* silently fail initial queue load */});
    return () => {
      active = false;
      this.listeners.delete(callback);
    };
  }
  
  /** Bind queue reads and writes after a serialized owner transition. */
  private setOwner(nextOwnerId: string | null): void {
    if (this.ownerId === nextOwnerId) return;
    inMemoryFallbackQueue = [];
    this.ownerId = nextOwnerId;
    this.notifyQueueChanged();
  }

  /**
   * Drain accepted writes, perform persistent cleanup, then publish the next
   * owner as one serialized boundary. Enqueues remain blocked for the duration.
   */
  transitionOwner<T>(
    nextOwnerId: string | null,
    transition: () => Promise<T>,
  ): Promise<T> {
    return offlineOwnerTransitionBarrier.runTransition(() =>
      this.transitionOwnerWithinBarrier(nextOwnerId, transition),
    );
  }

  /** Complete an owner change after the shared barrier is already held. */
  async transitionOwnerWithinBarrier<T>(
    nextOwnerId: string | null,
    transition: () => Promise<T>,
  ): Promise<T> {
    await this.initialization;
    const result = await transition();
    this.setOwner(nextOwnerId);
    return result;
  }
  
  async migrateFromLocalStorage(): Promise<number> {
    // Legacy unscoped queues cannot be attributed safely to the active user.
    safeLocalStorage.removeItem(QUEUE_STORAGE_KEY);
    inMemoryFallbackQueue = [];
    return 0;
  }

  async getQueueSize(): Promise<number> {
    return this.getLength();
  }

  async getPendingBatch(batchSize: number): Promise<QueuedMutation[]> {
    if (this.initialized) {
      return db.mutations
        .orderBy('timestamp')
        .filter(mutation => (
          mutation.ownerId === this.ownerId
          && (!mutation.status || mutation.status === 'pending')
        ))
        .limit(batchSize)
        .toArray();
    }
    const queue = await this.getQueue();
    return queue.filter(m => !m.status || m.status === 'pending').slice(0, batchSize);
  }

  async remove(mutationId: string): Promise<void> {
    return this.dequeue(mutationId);
  }

  async updateStatus(
    mutationId: string,
    status: 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict',
    conflictSnapshot?: {
      originalData: Record<string, unknown>;
      serverData: Record<string, unknown> | null;
    },
  ): Promise<void> {
    const patch = {
      status,
      ...(conflictSnapshot
        ? {
            conflictData: conflictSnapshot.originalData,
            conflictServerData: conflictSnapshot.serverData,
          }
        : {}),
    };
    if (this.initialized) {
      const mutation = await db.mutations.get(mutationId);
      if (mutation?.ownerId === this.ownerId) {
        await db.mutations.update(mutationId, patch);
      }
    } else {
      const queue = readMemoryQueue();
      const mutation = queue.find(item => item.id === mutationId && item.ownerId === this.ownerId);
      if (mutation?.ownerId === this.ownerId) {
        Object.assign(mutation, patch);
        writeMemoryQueue(queue);
      }
    }
    this.notifyQueueChanged();
  }

  async incrementRetry(mutationId: string): Promise<number> {
    if (this.initialized) {
      const mutation = await db.mutations.get(mutationId);
      if (mutation?.ownerId === this.ownerId) {
        const newCount = mutation.retryCount + 1;
        await db.mutations.update(mutationId, { retryCount: newCount });
        return newCount;
      }
    } else {
      const queue = readMemoryQueue();
      const mutation = queue.find(item => item.id === mutationId && item.ownerId === this.ownerId);
      if (mutation) {
        mutation.retryCount += 1;
        writeMemoryQueue(queue);
        return mutation.retryCount;
      }
    }
    return 0;
  }

  async getByStatus(status: 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict'): Promise<QueuedMutation[]> {
    if (this.initialized) {
      return db.mutations
        .where('status')
        .equals(status)
        .filter(mutation => mutation.ownerId === this.ownerId)
        .toArray();
    }
    const queue = await this.getQueue();
    return queue.filter(m => m.status === status);
  }

  async getPendingCount(): Promise<number> {
    if (this.initialized) {
      return db.mutations
        .filter(mutation => (
          mutation.ownerId === this.ownerId
          && (!mutation.status || mutation.status === 'pending')
        ))
        .count();
    }
    const queue = await this.getQueue();
    return queue.filter(m => !m.status || m.status === 'pending').length;
  }
}

export const indexedDBQueue = new IndexedDBQueueManager();
