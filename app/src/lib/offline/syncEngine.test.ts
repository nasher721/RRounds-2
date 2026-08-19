import assert from 'node:assert/strict';
import test from 'node:test';
import { indexedDBQueue } from './indexedDBQueue';
import { syncEngine } from './syncEngine';

async function setQueueOwner(ownerId: string): Promise<void> {
  await indexedDBQueue.transitionOwner(ownerId, async () => undefined);
}

test('offline event prevents queue drain when a reloaded document reports navigator online', async () => {
  const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  let updateCalls = 0;
  const globalMocks = globalThis as typeof globalThis & {
    __SUPABASE_UPDATE_MOCK__?: () => { data: null; error: null };
  };
  globalMocks.__SUPABASE_UPDATE_MOCK__ = () => {
    updateCalls += 1;
    return { data: null, error: null };
  };

  await setQueueOwner('user-a');
  await indexedDBQueue.clear();
  await indexedDBQueue.enqueue({
    type: 'patient',
    operation: 'update',
    table: 'patients',
    entityId: 'patient-1',
    payload: { diagnosis: 'local edit' },
  });
  window.dispatchEvent(new Event('offline'));

  try {
    const result = await syncEngine.sync();
    assert.deepEqual(result, { success: 0, failed: 0, conflicts: [], duration: 0 });
    assert.equal(updateCalls, 0);
    assert.equal((await indexedDBQueue.getQueue()).length, 1);
  } finally {
    await indexedDBQueue.clear();
    window.dispatchEvent(new Event('online'));
    delete globalMocks.__SUPABASE_UPDATE_MOCK__;
    if (onlineDescriptor) Object.defineProperty(navigator, 'onLine', onlineDescriptor);
    else Reflect.deleteProperty(navigator, 'onLine');
  }
});

test('sync retains a server-newer mutation as a conflict instead of deleting it', async () => {
  const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  globalThis.__SUPABASE_SELECT_MOCK__ = () => ({
    data: { last_modified: '2100-01-01T00:00:00.000Z' },
    error: null,
  });

  await setQueueOwner('user-a');
  await indexedDBQueue.clear();
  const mutationId = await indexedDBQueue.enqueue({
    type: 'patient',
    operation: 'update',
    table: 'patients',
    entityId: 'patient-1',
    payload: { diagnosis: 'local edit' },
  });

  try {
    const result = await syncEngine.sync();
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.success, 0);
    assert.equal(
      (await indexedDBQueue.getQueue()).find(item => item.id === mutationId)?.status,
      'conflict',
    );
    assert.equal(
      (await indexedDBQueue.getPendingBatch(10)).some(item => item.id === mutationId),
      false,
    );
  } finally {
    delete globalThis.__SUPABASE_SELECT_MOCK__;
    await indexedDBQueue.clear();
    if (onlineDescriptor) {
      Object.defineProperty(navigator, 'onLine', onlineDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'onLine');
    }
  }
});

test('failed client-wins resolution retains the conflicted mutation', async () => {
  const updateMockGlobal = globalThis as unknown as {
    __SUPABASE_UPDATE_MOCK__?: () => { data: null; error: { message: string } };
  };
  updateMockGlobal.__SUPABASE_UPDATE_MOCK__ = () => ({
    data: null,
    error: { message: 'conflict update rejected' },
  });

  await setQueueOwner('user-a');
  await indexedDBQueue.clear();
  const mutationId = await indexedDBQueue.enqueue({
    type: 'patient',
    operation: 'update',
    table: 'patients',
    entityId: 'patient-1',
    payload: { diagnosis: 'local edit' },
  });
  await indexedDBQueue.updateStatus(mutationId, 'conflict');

  try {
    await assert.rejects(
      () => syncEngine.resolvePendingConflict({
        id: 'patient-1',
        table: 'patients',
        operation: 'update',
        clientData: { diagnosis: 'local edit' },
        serverData: { diagnosis: 'server edit' },
        originalData: { diagnosis: 'original' },
      }, 'client-wins'),
      /conflict update rejected/,
    );

    const retained = (await indexedDBQueue.getQueue()).find(item => item.id === mutationId);
    assert.equal(retained?.status, 'conflict');
  } finally {
    delete updateMockGlobal.__SUPABASE_UPDATE_MOCK__;
    await indexedDBQueue.clear();
  }
});

test('todo creates replay idempotently through upsert', async () => {
  const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  const globalMocks = globalThis as typeof globalThis & {
    __SUPABASE_INSERT_MOCK__?: () => { data: null; error: Error };
    __SUPABASE_UPSERT_MOCK__?: (request: {
      table: string;
      rows: Record<string, unknown>;
    }) => { data: null; error: null };
  };
  globalMocks.__SUPABASE_INSERT_MOCK__ = () => ({
    data: null,
    error: new Error('non-idempotent insert must not be used'),
  });
  let replayedPayload: Record<string, unknown> | null = null;
  globalMocks.__SUPABASE_UPSERT_MOCK__ = ({ table, rows }) => {
    assert.equal(table, 'patient_todos');
    replayedPayload = rows;
    return { data: null, error: null };
  };

  await setQueueOwner('user-a');
  await indexedDBQueue.clear();
  await indexedDBQueue.enqueue({
    type: 'todo',
    operation: 'create',
    table: 'patient_todos',
    entityId: 'todo-offline',
    payload: {
      id: 'todo-offline',
      patient_id: 'patient-1',
      user_id: 'user-a',
      content: 'Call family',
      completed: false,
    },
  });

  try {
    const result = await syncEngine.sync();
    assert.equal(result.success, 1);
    assert.equal((replayedPayload as Record<string, unknown> | null)?.id, 'todo-offline');
    assert.deepEqual(await indexedDBQueue.getQueue(), []);
  } finally {
    delete globalMocks.__SUPABASE_INSERT_MOCK__;
    delete globalMocks.__SUPABASE_UPSERT_MOCK__;
    await indexedDBQueue.clear();
    if (onlineDescriptor) Object.defineProperty(navigator, 'onLine', onlineDescriptor);
    else Reflect.deleteProperty(navigator, 'onLine');
  }
});

test('stale offline todo delete is retained for explicit conflict resolution', async () => {
  const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  globalThis.__SUPABASE_SELECT_MOCK__ = () => ({
    data: {
      id: 'todo-1',
      patient_id: 'patient-1',
      user_id: 'user-a',
      updated_at: '2026-08-13T03:00:00.000Z',
    },
    error: null,
  });

  await setQueueOwner('user-a');
  await indexedDBQueue.clear();
  const mutationId = await indexedDBQueue.enqueue({
    type: 'todo',
    operation: 'delete',
    table: 'patient_todos',
    entityId: 'todo-1',
    payload: { patient_id: 'patient-1', user_id: 'user-a' },
    conflictData: {
      patient_id: 'patient-1',
      user_id: 'user-a',
      updated_at: '2026-08-13T01:00:00.000Z',
    },
  });

  try {
    const result = await syncEngine.sync();
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0]?.operation, 'delete');
    assert.equal(
      (await indexedDBQueue.getQueue()).find((item) => item.id === mutationId)?.status,
      'conflict',
    );
  } finally {
    delete globalThis.__SUPABASE_SELECT_MOCK__;
    await indexedDBQueue.clear();
    if (onlineDescriptor) Object.defineProperty(navigator, 'onLine', onlineDescriptor);
    else Reflect.deleteProperty(navigator, 'onLine');
  }
});
