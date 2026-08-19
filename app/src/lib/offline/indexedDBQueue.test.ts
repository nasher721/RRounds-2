import assert from 'node:assert/strict';
import test from 'node:test';
import {
  indexedDBQueue,
  OwnerTransitionBarrier,
  selectOwnedMutations,
  type QueuedMutation,
} from './indexedDBQueue';
import { safeLocalStorage } from '../../utils/safeStorage';
import { pendingQueueSignature } from './queueSignature';

const QUEUE_STORAGE_KEY = 'offline-mutation-queue';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function setQueueOwner(ownerId: string): Promise<void> {
  await indexedDBQueue.transitionOwner(ownerId, async () => undefined);
}

test('local fallback keeps conflict status in memory and never persists payloads', async () => {
  await setQueueOwner('user-a');
  await indexedDBQueue.clear();

  const mutationId = await indexedDBQueue.enqueue({
    type: 'patient',
    operation: 'update',
    table: 'patients',
    entityId: 'patient-1',
    payload: { diagnosis: 'updated' },
  });

  assert.equal(
    (await indexedDBQueue.getQueue()).find(item => item.id === mutationId)?.status,
    'pending',
  );

  await indexedDBQueue.updateStatus(mutationId, 'conflict');

  const queue = await indexedDBQueue.getQueue();
  assert.equal(queue.find(item => item.id === mutationId)?.status, 'conflict');
  assert.equal(
    (await indexedDBQueue.getPendingBatch(20)).some(item => item.id === mutationId),
    false,
  );
  assert.equal(await indexedDBQueue.getPendingCount(), 0);

  assert.equal(window.localStorage.getItem(QUEUE_STORAGE_KEY), null);
});

test('local fallback survives a blocked localStorage getter', async () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('Storage access blocked');
    },
  });

  try {
    await setQueueOwner('user-a');
    await indexedDBQueue.clear();
    const mutationId = await indexedDBQueue.enqueue({
      type: 'todo',
      operation: 'create',
      table: 'todos',
      payload: { text: 'follow up' },
    });

    await indexedDBQueue.updateStatus(mutationId, 'conflict');
    assert.equal(
      (await indexedDBQueue.getQueue()).find(item => item.id === mutationId)?.status,
      'conflict',
    );
  } finally {
    safeLocalStorage.removeItem(QUEUE_STORAGE_KEY);
    if (originalDescriptor) {
      Object.defineProperty(window, 'localStorage', originalDescriptor);
    }
  }
});

test('local fallback discards legacy serialized queue data', async () => {
  await setQueueOwner('user-a');
  safeLocalStorage.setItem(QUEUE_STORAGE_KEY, '{not-json');
  await indexedDBQueue.migrateFromLocalStorage();
  await assert.doesNotReject(() => indexedDBQueue.getQueue());
  assert.deepEqual(await indexedDBQueue.getQueue(), []);
  await indexedDBQueue.clear();
});

test('recovery discard refuses to delete a queue that changed after export', async () => {
  await setQueueOwner('user-a');
  await indexedDBQueue.clear();
  await indexedDBQueue.enqueue({
    type: 'patient',
    operation: 'update',
    table: 'patients',
    entityId: 'patient-1',
    payload: { clinicalSummary: 'Downloaded recovery note' },
  });
  const downloadedSignature = pendingQueueSignature(await indexedDBQueue.getQueue());

  await indexedDBQueue.enqueue({
    type: 'todo',
    operation: 'create',
    table: 'patient_todos',
    entityId: 'todo-2',
    payload: { content: 'New change from another tab' },
  });

  assert.equal(await indexedDBQueue.discardIfUnchanged(downloadedSignature), false);
  assert.equal((await indexedDBQueue.getQueue()).length, 2);

  const currentSignature = pendingQueueSignature(await indexedDBQueue.getQueue());
  assert.equal(await indexedDBQueue.discardIfUnchanged(currentSignature), true);
  assert.deepEqual(await indexedDBQueue.getQueue(), []);
});

test('local fallback isolates user A mutations from user B', async () => {
  await setQueueOwner('user-a');
  await indexedDBQueue.clear();
  await indexedDBQueue.enqueue({
    type: 'patient',
    operation: 'update',
    table: 'patients',
    entityId: 'patient-a',
    payload: { diagnosis: 'A only' },
  });
  assert.equal(await indexedDBQueue.getLength(), 1);

  await setQueueOwner('user-b');
  assert.deepEqual(await indexedDBQueue.getQueue(), []);
  const id = await indexedDBQueue.enqueue({
    type: 'patient',
    operation: 'update',
    table: 'patients',
    entityId: 'patient-b',
    payload: { diagnosis: 'B only' },
  });
  assert.equal((await indexedDBQueue.getQueue())[0]?.id, id);
  assert.equal((await indexedDBQueue.getQueue())[0]?.ownerId, 'user-b');
  await indexedDBQueue.clear();
});

test('owner transition drains accepted enqueue work and blocks later writes', async () => {
  const barrier = new OwnerTransitionBarrier();
  const operationStarted = createDeferred<void>();
  const finishOperation = createDeferred<void>();
  let transitionEntered = false;

  const acceptedOperation = barrier.runOperation(async () => {
    operationStarted.resolve();
    await finishOperation.promise;
    return 'persisted-for-user-a';
  });
  await operationStarted.promise;

  const transition = barrier.runTransition(async () => {
    transitionEntered = true;
  });
  await Promise.resolve();

  assert.equal(transitionEntered, false);
  await assert.rejects(
    () => barrier.runOperation(async () => 'must-not-run-as-user-b'),
    /owner transition is in progress/,
  );

  finishOperation.resolve();
  assert.equal(await acceptedOperation, 'persisted-for-user-a');
  await transition;
  assert.equal(transitionEntered, true);
});

test('queue drains an accepted enqueue and rejects later writes until owner publication', async () => {
  await setQueueOwner('user-a');
  await indexedDBQueue.clear();
  const transitionStarted = createDeferred<void>();
  const finishTransition = createDeferred<void>();

  const acceptedEnqueue = indexedDBQueue.enqueue({
    type: 'patient',
    operation: 'update',
    table: 'patients',
    entityId: 'accepted-user-a-event',
    payload: { diagnosis: 'A only' },
  });

  const transition = indexedDBQueue.transitionOwner('user-b', async () => {
    transitionStarted.resolve();
    await finishTransition.promise;
  });
  await transitionStarted.promise;
  const acceptedMutationId = await acceptedEnqueue;
  assert.equal((await indexedDBQueue.getQueue())[0]?.id, acceptedMutationId);
  assert.equal((await indexedDBQueue.getQueue())[0]?.ownerId, 'user-a');

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

  finishTransition.resolve();
  await transition;
  const userBMutation = await indexedDBQueue.enqueue({
    type: 'patient',
    operation: 'update',
    table: 'patients',
    entityId: 'patient-b',
    payload: { diagnosis: 'B only' },
  });
  assert.equal((await indexedDBQueue.getQueue())[0]?.id, userBMutation);
  assert.equal((await indexedDBQueue.getQueue())[0]?.ownerId, 'user-b');
  await indexedDBQueue.clear();
});

test('persisted records rehydrate only for the same authenticated owner', () => {
  const persistedRecords: QueuedMutation[] = [
    {
      id: 'a-later',
      type: 'patient',
      operation: 'update',
      table: 'patients',
      payload: { diagnosis: 'same-user reload keeps me' },
      timestamp: 20,
      retryCount: 0,
      maxRetries: 3,
      status: 'pending',
      entityId: 'patient-a-2',
      ownerId: 'user-a',
    },
    {
      id: 'b-only',
      type: 'patient',
      operation: 'update',
      table: 'patients',
      payload: { diagnosis: 'B only' },
      timestamp: 15,
      retryCount: 0,
      maxRetries: 3,
      status: 'pending',
      entityId: 'patient-b',
      ownerId: 'user-b',
    },
    {
      id: 'a-first',
      type: 'todo',
      operation: 'create',
      table: 'patient_todos',
      payload: { task: 'first' },
      timestamp: 10,
      retryCount: 0,
      maxRetries: 3,
      status: 'pending',
      entityId: 'todo-a',
      ownerId: 'user-a',
    },
  ];

  assert.deepEqual(
    selectOwnedMutations(persistedRecords, 'user-a').map(item => item.id),
    ['a-first', 'a-later'],
  );
  assert.deepEqual(
    selectOwnedMutations(persistedRecords, 'user-b').map(item => item.id),
    ['b-only'],
  );
  assert.deepEqual(selectOwnedMutations(persistedRecords, null), []);
});

test('coalescing keeps one durable mutation and cancels create-then-delete', async () => {
  await setQueueOwner('user-a');
  await indexedDBQueue.clear();

  const createId = await indexedDBQueue.enqueue({
    type: 'patient',
    operation: 'create',
    table: 'patients',
    entityId: 'temp-patient',
    payload: { diagnosis: 'initial' },
  });
  const updateId = await indexedDBQueue.enqueue({
    type: 'patient',
    operation: 'update',
    table: 'patients',
    entityId: 'temp-patient',
    payload: { bed: '12' },
  });

  assert.equal(updateId, createId);
  const coalescedQueue = await indexedDBQueue.getQueue();
  assert.equal(coalescedQueue.length, 1);
  assert.equal(coalescedQueue[0]?.id, createId);
  assert.equal(coalescedQueue[0]?.operation, 'create');
  assert.deepEqual(coalescedQueue[0]?.payload, { diagnosis: 'initial', bed: '12' });

  const deleteId = await indexedDBQueue.enqueue({
    type: 'patient',
    operation: 'delete',
    table: 'patients',
    entityId: 'temp-patient',
    payload: {},
  });
  assert.equal(deleteId, createId);
  assert.deepEqual(await indexedDBQueue.getQueue(), []);
});

test('coalescing repeated updates preserves every field and the oldest conflict snapshot', async () => {
  await setQueueOwner('user-a');
  await indexedDBQueue.clear();
  const firstId = await indexedDBQueue.enqueue({
    type: 'todo',
    operation: 'update',
    table: 'patient_todos',
    entityId: 'todo-1',
    payload: { patient_id: 'patient-1', completed: true },
    conflictData: { updated_at: '2026-08-13T01:00:00.000Z' },
  });
  const secondId = await indexedDBQueue.enqueue({
    type: 'todo',
    operation: 'update',
    table: 'patient_todos',
    entityId: 'todo-1',
    payload: { patient_id: 'patient-1', content: 'Updated task' },
    conflictData: { updated_at: '2026-08-13T02:00:00.000Z' },
  });

  const queued = await indexedDBQueue.getQueue();
  assert.equal(secondId, firstId);
  assert.equal(queued.length, 1);
  assert.deepEqual(queued[0]?.payload, {
    patient_id: 'patient-1',
    completed: true,
    content: 'Updated task',
  });
  assert.deepEqual(queued[0]?.conflictData, {
    updated_at: '2026-08-13T01:00:00.000Z',
  });
  await indexedDBQueue.clear();
});

test('retry exhaustion retains a failed mutation outside the pending batch', async () => {
  await setQueueOwner('user-a');
  await indexedDBQueue.clear();
  const id = await indexedDBQueue.enqueue({
    type: 'todo',
    operation: 'create',
    table: 'patient_todos',
    entityId: 'todo-1',
    payload: { task: 'follow up' },
  });

  assert.equal(await indexedDBQueue.markFailed(id), true);
  assert.equal(await indexedDBQueue.markFailed(id), true);
  assert.equal(await indexedDBQueue.markFailed(id), false);
  assert.equal((await indexedDBQueue.getQueue()).find(item => item.id === id)?.status, 'failed');
  assert.equal((await indexedDBQueue.getPendingBatch(10)).some(item => item.id === id), false);
  await indexedDBQueue.clear();
});
