import assert from 'node:assert/strict';
import test from 'node:test';
import { indexedDBQueue } from '@/lib/offline/indexedDBQueue';
import { syncEngine } from '@/lib/offline/syncEngine';
import { loadFHIRState, saveFHIRState } from '@/integrations/fhir/client';
import {
  clearCrdtDatabases,
  prepareSensitiveClientState,
} from './clearSensitiveClientState';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createFactory(
  names: string[],
  options: { blocked?: string } = {},
): { factory: IDBFactory; deleted: string[] } {
  const deleted: string[] = [];
  const factory = {
    databases: async () => names.map(name => ({ name })),
    deleteDatabase: (name: string) => {
      const request: {
        error: DOMException | null;
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
        onblocked: (() => void) | null;
      } = { error: null, onsuccess: null, onerror: null, onblocked: null };
      queueMicrotask(() => {
        if (options.blocked === name) {
          request.onblocked?.();
        } else {
          deleted.push(name);
          request.onsuccess?.();
        }
      });
      return request;
    },
  };
  return { factory: factory as unknown as IDBFactory, deleted };
}

test('auth-boundary cleanup deletes only CRDT IndexedDB databases', async () => {
  const { factory, deleted } = createFactory([
    'RoundRobinNotesDB',
    'crdt-patients-patient-a',
    'rr_telemetry',
    'crdt-phrases-phrase-a',
  ]);

  await clearCrdtDatabases(factory);
  assert.deepEqual(deleted.sort(), [
    'crdt-patients-patient-a',
    'crdt-phrases-phrase-a',
  ]);
});

test('auth-boundary cleanup fails closed without database enumeration', async () => {
  const factory = { deleteDatabase: () => ({}) } as unknown as IDBFactory;
  await assert.rejects(
    () => clearCrdtDatabases(factory),
    /cannot enumerate offline collaboration databases/,
  );
});

test('auth-boundary cleanup reports a blocked CRDT deletion', async () => {
  const { factory } = createFactory(
    ['crdt-patients-patient-a'],
    { blocked: 'crdt-patients-patient-a' },
  );
  await assert.rejects(
    () => clearCrdtDatabases(factory),
    /was blocked/,
  );
});

test('auth boundary preserves a same-user FHIR redirect but purges it on A-to-B transition', async () => {
  const smartStateKey = 'smartStateAuthBoundary';
  saveFHIRState({ isLaunching: true, ownerId: 'user-a' });
  window.sessionStorage.setItem('SMART_KEY', JSON.stringify(smartStateKey));
  window.sessionStorage.setItem(smartStateKey, JSON.stringify({
    tokenResponse: { access_token: 'user-a-access-token' },
  }));

  await prepareSensitiveClientState('user-a');
  assert.equal(loadFHIRState()?.ownerId, 'user-a');
  assert.notEqual(window.sessionStorage.getItem(smartStateKey), null);

  await prepareSensitiveClientState('user-b');
  assert.equal(loadFHIRState(), null);
  assert.equal(window.sessionStorage.getItem('SMART_KEY'), null);
  assert.equal(window.sessionStorage.getItem(smartStateKey), null);
});

test('auth transition aborts and drains an in-flight sync before publishing the next owner', async () => {
  const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  const selectStarted = createDeferred<void>();
  const finishSelect = createDeferred<{
    data: { diagnosis: string; last_modified: null };
    error: null;
  }>();
  globalThis.__SUPABASE_SELECT_MOCK__ = () => {
    selectStarted.resolve();
    return finishSelect.promise;
  };
  const updateCapture = (globalThis as unknown as {
    __supabaseUpdateCapture?: unknown[];
  }).__supabaseUpdateCapture ?? [];
  updateCapture.length = 0;

  await indexedDBQueue.transitionOwner('user-a', async () => undefined);
  await indexedDBQueue.clear();
  await indexedDBQueue.enqueue({
    type: 'patient',
    operation: 'update',
    table: 'patients',
    entityId: 'patient-a',
    payload: { diagnosis: 'A only' },
  });

  let sync: Promise<unknown> | undefined;
  let transition: Promise<unknown> | undefined;
  try {
    sync = syncEngine.sync();
    await selectStarted.promise;

    let transitionSettled = false;
    transition = prepareSensitiveClientState('user-b').then(() => {
      transitionSettled = true;
    });
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(transitionSettled, false);
    await assert.rejects(
      () => indexedDBQueue.enqueue({
        type: 'patient',
        operation: 'update',
        table: 'patients',
        entityId: 'late-user-a-event',
        payload: { diagnosis: 'must not cross identities' },
      }),
      /owner transition is in progress/,
    );

    finishSelect.resolve({
      data: { diagnosis: 'A only', last_modified: null },
      error: null,
    });
    await sync;
    await transition;
    assert.equal(updateCapture.length, 0);

    const userBMutation = await indexedDBQueue.enqueue({
      type: 'patient',
      operation: 'update',
      table: 'patients',
      entityId: 'patient-b',
      payload: { diagnosis: 'B only' },
    });
    const queue = await indexedDBQueue.getQueue();
    assert.equal(queue.length, 1);
    assert.equal(queue[0]?.id, userBMutation);
    assert.equal(queue[0]?.ownerId, 'user-b');
  } finally {
    finishSelect.resolve({
      data: { diagnosis: 'A only', last_modified: null },
      error: null,
    });
    syncEngine.abort();
    await Promise.allSettled([sync, transition].filter(Boolean) as Promise<unknown>[]);
    delete globalThis.__SUPABASE_SELECT_MOCK__;
    await indexedDBQueue.clear();
    if (onlineDescriptor) {
      Object.defineProperty(navigator, 'onLine', onlineDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'onLine');
    }
  }
});
