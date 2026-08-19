import type { PatientTodo } from '@/types/todo';
import type { PatientTodosMap } from '@/hooks/useAllPatientTodos';
import { logInfo } from '@/lib/observability/logger';
import {
  AUTH_OWNER_METADATA_ID,
  db,
  type CachedTodoSnapshot,
} from './database';
import { offlineOwnerTransitionBarrier } from './ownerTransitionBarrier';

const PATIENT_TODO_SNAPSHOT_ID = '__patient_todo_snapshot__';
let todoSnapshotWriteTail: Promise<void> = Promise.resolve();

function isPatientTodo(value: unknown, ownerId: string): value is PatientTodo {
  if (!value || typeof value !== 'object') return false;
  const todo = value as Partial<PatientTodo>;
  return typeof todo.id === 'string'
    && typeof todo.patientId === 'string'
    && todo.userId === ownerId
    && (typeof todo.section === 'string' || todo.section === null)
    && typeof todo.content === 'string'
    && typeof todo.completed === 'boolean'
    && typeof todo.createdAt === 'string'
    && typeof todo.updatedAt === 'string'
    && (todo.syncStatus === undefined || [
      'queued',
      'sync_failed',
      'conflict',
    ].includes(todo.syncStatus))
    && (todo.localOnly === undefined || typeof todo.localOnly === 'boolean');
}

/** Strip rows outside the active owner and ensure map keys match row patients. */
export function normalizePatientTodoSnapshot(
  ownerId: string,
  value: unknown,
): PatientTodosMap | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const normalized: PatientTodosMap = {};
  for (const [patientId, candidateTodos] of Object.entries(value)) {
    if (!Array.isArray(candidateTodos)) return null;
    const todos = candidateTodos.filter((todo) => isPatientTodo(todo, ownerId));
    if (todos.length !== candidateTodos.length) return null;
    if (todos.some((todo) => todo.patientId !== patientId)) return null;
    normalized[patientId] = todos;
  }
  return normalized;
}

export function buildPatientTodoSnapshot(
  ownerId: string,
  todosMap: PatientTodosMap,
  cachedAt: number,
): CachedTodoSnapshot | null {
  const normalized = normalizePatientTodoSnapshot(ownerId, todosMap);
  if (!normalized) return null;
  return {
    id: PATIENT_TODO_SNAPSHOT_ID,
    ownerId,
    data: normalized as unknown as Record<string, unknown>,
    cachedAt,
  };
}

/** Persist one atomic, owner-bound UI Todo map for offline End/Export. */
export async function writePatientTodoSnapshot(
  ownerId: string,
  todosMap: PatientTodosMap,
): Promise<boolean> {
  if (typeof globalThis.indexedDB === 'undefined') return false;
  const snapshot = buildPatientTodoSnapshot(ownerId, todosMap, Date.now());
  if (!snapshot) return false;

  try {
    const write = todoSnapshotWriteTail.then(() => (
      offlineOwnerTransitionBarrier.runOperation(async () => {
        await db.open();
        return db.transaction('rw', db.todoSnapshots, db.syncMetadata, async () => {
          const owner = await db.syncMetadata.get(AUTH_OWNER_METADATA_ID);
          if (owner?.ownerId !== ownerId) return false;
          await db.todoSnapshots.put(snapshot);
          return true;
        });
      })
    ));
    todoSnapshotWriteTail = write.then(() => undefined, () => undefined);
    return await write;
  } catch (error) {
    logInfo(`[PatientTodoSnapshot] Snapshot unavailable: ${error instanceof Error ? error.name : 'storage_error'}`);
    return false;
  }
}

/** Return null when no trustworthy owner-scoped snapshot exists. */
export async function readPatientTodoSnapshot(
  ownerId: string,
): Promise<PatientTodosMap | null> {
  if (typeof globalThis.indexedDB === 'undefined') return null;

  try {
    return await offlineOwnerTransitionBarrier.runOperation(async () => {
      await db.open();
      return db.transaction('r', db.todoSnapshots, db.syncMetadata, async () => {
        const [owner, snapshot] = await Promise.all([
          db.syncMetadata.get(AUTH_OWNER_METADATA_ID),
          db.todoSnapshots.get(PATIENT_TODO_SNAPSHOT_ID),
        ]);
        if (owner?.ownerId !== ownerId || snapshot?.ownerId !== ownerId) return null;
        return normalizePatientTodoSnapshot(ownerId, snapshot.data);
      });
    });
  } catch (error) {
    logInfo(`[PatientTodoSnapshot] Restore unavailable: ${error instanceof Error ? error.name : 'storage_error'}`);
    return null;
  }
}
