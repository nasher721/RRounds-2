import type { QueuedMutationDB } from './database';

/**
 * Stable signature for the complete owner-scoped queue. The signature contains
 * no new data: it is kept in memory only and is derived from the same mutation
 * payload that the user explicitly downloads for recovery.
 */
export function pendingQueueSignature(
  mutations: readonly QueuedMutationDB[],
): string {
  return JSON.stringify(
    [...mutations]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((mutation) => ({
        ...mutation,
        payload: mutation.payload,
        conflictData: mutation.conflictData,
        conflictServerData: mutation.conflictServerData,
      })),
  );
}
