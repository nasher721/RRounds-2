import { cacheHydration } from '@/lib/cache/queryClientConfig';
import { clearTelemetry } from '@/lib/observability/telemetry';
import { offlineOwnerTransitionBarrier } from '@/lib/offline/ownerTransitionBarrier';
import { syncAuthTransitionGate } from '@/lib/offline/syncAuthTransitionGate';

type EnumerableIDBFactory = IDBFactory & {
  databases?: () => Promise<Array<{ name?: string }>>;
};

function deleteDatabase(factory: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Failed to delete ${name}`));
    request.onblocked = () => reject(new Error(`Deletion of ${name} was blocked`));
  });
}

/** Delete Yjs persistence stores that live outside RoundRobinNotesDB. */
export async function clearCrdtDatabases(
  factory: EnumerableIDBFactory | undefined = globalThis.indexedDB,
): Promise<void> {
  if (!factory) return;
  if (typeof factory.databases !== 'function') {
    throw new Error(
      'This browser cannot enumerate offline collaboration databases; refusing an unsafe auth transition.',
    );
  }

  const databaseNames = (await factory.databases())
    .map(database => database.name)
    .filter((name): name is string => Boolean(name?.startsWith('crdt-')));
  await Promise.all(databaseNames.map(name => deleteDatabase(factory, name)));
}

/**
 * Prepare local data for exactly one authenticated identity. Same-user reloads
 * preserve owned IndexedDB work; sign-out, user changes, and unowned legacy
 * data are purged before the new identity is published to React.
 */
export async function prepareSensitiveClientState(ownerId: string | null): Promise<void> {
  await offlineOwnerTransitionBarrier.runTransition(async () => {
    const resumeSync = await syncAuthTransitionGate.pause();
    try {
      const [
        { reconcileFHIRStateForAuthOwner },
        { decideDataOwnerAction, getDatabaseOwner, transitionDatabaseOwner },
        { indexedDBQueue },
      ] = await Promise.all([
        import('@/integrations/fhir/client'),
        import('@/lib/offline/database'),
        import('@/lib/offline/indexedDBQueue'),
      ]);

      await indexedDBQueue.transitionOwnerWithinBarrier(ownerId, async () => {
        cacheHydration.clear();
        reconcileFHIRStateForAuthOwner(ownerId);

        if (typeof globalThis.indexedDB !== 'undefined') {
          const currentOwnerId = await getDatabaseOwner();
          if (decideDataOwnerAction(currentOwnerId, ownerId) !== 'preserve') {
            await clearCrdtDatabases();
          }
          await transitionDatabaseOwner(ownerId);
        }

        await clearTelemetry();
      });
    } finally {
      resumeSync();
    }
  });
}

export async function clearSensitiveClientState(): Promise<void> {
  await prepareSensitiveClientState(null);
}
