import { useState, useEffect, useCallback, useRef } from 'react';
import {
  indexedDBQueue,
  type ConflictData,
  type QueuedMutation,
  type QueuedMutationInput,
} from '@/lib/offline/indexedDBQueue';
import { syncEngine } from '@/lib/offline/syncEngine';
import { useOnlineStatus } from './useOnlineStatus';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { QUERY_KEYS } from '@/lib/cache/cacheConfig';
import { isBrowserKnownOffline } from '@/lib/networkConnectivity';

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  current: string;
}

interface SkippedMutation {
  id: string;
  mutation: QueuedMutation;
  reason: string;
  serverTimestamp?: string;
  conflict: ConflictData;
}

export interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  pendingMutations: QueuedMutation[];
  isSyncing: boolean;
  syncProgress: SyncProgress | null;
  lastSyncTime: number | null;
  skippedMutations: SkippedMutation[];
}

function getRetainedConflicts(queue: QueuedMutation[]): SkippedMutation[] {
  return queue
    .filter(mutation => mutation.status === 'conflict')
    .map(mutation => ({
      id: mutation.id,
      mutation,
      reason: 'Conflict detected - manual review required',
      conflict: {
        id: mutation.entityId ?? mutation.id,
        table: mutation.table,
        operation: mutation.operation,
        clientData: mutation.payload,
        serverData: mutation.conflictServerData ?? null,
        originalData: mutation.conflictData ?? mutation.payload,
      },
    }));
}

export function useOfflineMode() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const [pendingMutations, setPendingMutations] = useState<QueuedMutation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [skippedMutations, setSkippedMutations] = useState<SkippedMutation[]>([]);
  const syncInProgressRef = useRef(false);
  const lastAutoSyncKeyRef = useRef<string | null>(null);

  const updateQueueState = useCallback((queue: QueuedMutation[]) => {
    setPendingMutations(queue);
    setSkippedMutations(getRetainedConflicts(queue));
  }, []);

  const triggerSync = useCallback(async () => {
    if (isBrowserKnownOffline() || syncInProgressRef.current) return;

    const queuedBeforeSync = await indexedDBQueue.getQueue();
    const pendingBeforeSync = queuedBeforeSync.filter(
      mutation => !mutation.status || mutation.status === 'pending',
    );
    if (pendingBeforeSync.length === 0) {
      updateQueueState(queuedBeforeSync);
      return;
    }

    syncInProgressRef.current = true;
    setIsSyncing(true);
    setSyncProgress({
      total: pendingBeforeSync.length,
      completed: 0,
      failed: 0,
      skipped: 0,
      current: 'Preparing queued changes',
    });

    try {
      const result = await syncEngine.sync();
      const queuedAfterSync = await indexedDBQueue.getQueue();
      updateQueueState(queuedAfterSync);
      const replayedTodoPatientIds = new Set(
        pendingBeforeSync
          .filter((mutation) => mutation.type === 'todo' && mutation.table === 'patient_todos')
          .map((mutation) => mutation.payload.patient_id)
          .filter((value): value is string => typeof value === 'string'),
      );
      if (user?.id && replayedTodoPatientIds.size > 0) {
        await queryClient.invalidateQueries({
          queryKey: [...QUERY_KEYS.allTodos, user.id],
        });
        await Promise.all([...replayedTodoPatientIds].map((patientId) => (
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.patientTodosForOwner(user.id, patientId),
            exact: true,
          })
        )));
      }
      setSyncProgress({
        total: pendingBeforeSync.length,
        completed: result.success,
        failed: result.failed,
        skipped: result.conflicts.length,
        current: '',
      });
      setLastSyncTime(Date.now());
    } catch (error) {
      console.error('[OfflineSync] Sync failed:', error);
    } finally {
      syncInProgressRef.current = false;
      setIsSyncing(false);
    }
  }, [queryClient, updateQueueState, user?.id]);

  const pendingAutoSyncKey = pendingMutations
    .filter(mutation => !mutation.status || mutation.status === 'pending')
    .map(mutation => mutation.id)
    .sort()
    .join('|');

  // Sync persisted same-user work after reload and on later reconnections.
  // Keying by owner + durable mutation IDs closes the race where the browser
  // comes online before the auth boundary has rebound IndexedDB to its owner.
  useEffect(() => {
    if (!isOnline || !user?.id || !pendingAutoSyncKey) {
      if (!isOnline || !user?.id) lastAutoSyncKeyRef.current = null;
      return;
    }
    const syncKey = `${user.id}:${pendingAutoSyncKey}`;
    if (lastAutoSyncKeyRef.current === syncKey) return;
    lastAutoSyncKeyRef.current = syncKey;
    const timeout = setTimeout(() => {
      void triggerSync();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [isOnline, pendingAutoSyncKey, triggerSync, user?.id]);

  useEffect(() => {
    const unsubscribeQueue = indexedDBQueue.subscribe(updateQueueState);
    const unsubscribeStatus = syncEngine.on('status-change', status => {
      const syncing = status === 'syncing';
      syncInProgressRef.current = syncing;
      setIsSyncing(syncing);
    });
    const unsubscribeProgress = syncEngine.on('progress', ({ processed, total }) => {
      setSyncProgress(previous => ({
        total,
        completed: processed,
        failed: previous?.failed ?? 0,
        skipped: previous?.skipped ?? 0,
        current: processed < total ? 'Processing queued changes' : '',
      }));
    });
    const unsubscribeComplete = syncEngine.on('complete', result => {
      setLastSyncTime(Date.now());
      setSyncProgress(previous => ({
        total: previous?.total ?? result.success + result.failed + result.conflicts.length,
        completed: result.success,
        failed: result.failed,
        skipped: result.conflicts.length,
        current: '',
      }));
    });

    return () => {
      unsubscribeQueue();
      unsubscribeStatus();
      unsubscribeProgress();
      unsubscribeComplete();
    };
  }, [updateQueueState]);

  const queueMutation = useCallback((mutation: QueuedMutationInput): Promise<string> => {
    return indexedDBQueue.enqueue(mutation);
  }, []);

  const discardQueue = useCallback(async (expectedSignature: string): Promise<boolean> => {
    return indexedDBQueue.discardIfUnchanged(expectedSignature);
  }, []);

  const hasPendingChanges = useCallback((entityId: string, table: string): boolean => {
    return pendingMutations.some(
      mutation => mutation.entityId === entityId && mutation.table === table,
    );
  }, [pendingMutations]);

  const retryFailed = useCallback(async (): Promise<void> => {
    const failed = await indexedDBQueue.getByStatus('failed');
    await Promise.all(failed.map((mutation) => indexedDBQueue.updateStatus(mutation.id, 'pending')));
    await triggerSync();
  }, [triggerSync]);

  const resolveSkippedConflict = useCallback(async (
    skipped: SkippedMutation,
    resolution: 'server-wins' | 'client-wins',
  ): Promise<void> => {
    const resolved = await syncEngine.resolvePendingConflict(skipped.conflict, resolution);
    if (!resolved) return;
    updateQueueState(await indexedDBQueue.getQueue());
    if (user?.id) {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.patientList(user.id), exact: true });
    }
  }, [queryClient, updateQueueState, user?.id]);

  const failedCount = pendingMutations.filter((mutation) => mutation.status === 'failed').length;

  return {
    isOnline,
    pendingCount: pendingMutations.length,
    pendingMutations,
    failedCount,
    isSyncing,
    syncProgress,
    lastSyncTime,
    skippedMutations,
    triggerSync,
    retryFailed,
    resolveSkippedConflict,
    queueMutation,
    discardQueue,
    hasPendingChanges,
  };
}
