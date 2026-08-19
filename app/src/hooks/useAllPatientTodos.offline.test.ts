import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';

import type { QueuedMutation } from '@/lib/offline/indexedDBQueue';
import { indexedDBQueue } from '@/lib/offline/indexedDBQueue';
import type { PatientTodo } from '@/types/todo';
import { AuthProvider } from './useAuth';
import { applyQueuedTodoMap } from './useAllPatientTodos';
import { useAllPatientTodos } from './useAllPatientTodos';

declare global {
  var __SUPABASE_AUTH_MOCK__: unknown;
  var __SUPABASE_SELECT_MOCK__: unknown;
}

const serverTodo = (overrides: Partial<PatientTodo> = {}): PatientTodo => ({
  id: 'todo-server',
  patientId: 'patient-1',
  userId: 'owner-1',
  section: null,
  content: 'Server task',
  completed: false,
  createdAt: '2026-08-13T10:00:00.000Z',
  updatedAt: '2026-08-13T10:00:00.000Z',
  ...overrides,
});

const mutation = (
  overrides: Partial<QueuedMutation>,
): QueuedMutation => ({
  id: 'mutation-1',
  type: 'todo',
  operation: 'create',
  table: 'patient_todos',
  payload: {},
  timestamp: 1,
  retryCount: 0,
  maxRetries: 3,
  status: 'pending',
  ownerId: 'owner-1',
  ...overrides,
});

test('offline Todo map overlays queued create, update, and delete before export', () => {
  const queuedCreated = {
    id: 'todo-created',
    patient_id: 'patient-1',
    user_id: 'owner-1',
    section: 'resp',
    content: 'Queued task',
    completed: false,
    created_at: '2026-08-13T10:01:00.000Z',
    updated_at: '2026-08-13T10:01:00.000Z',
  };
  const resolved = applyQueuedTodoMap(
    {
      'patient-1': [serverTodo(), serverTodo({ id: 'todo-delete', content: 'Remove me' })],
    },
    [
      mutation({ entityId: 'todo-created', payload: queuedCreated }),
      mutation({
        id: 'mutation-2',
        operation: 'update',
        entityId: 'todo-server',
        timestamp: 2,
        payload: { patient_id: 'patient-1', completed: true },
      }),
      mutation({
        id: 'mutation-3',
        operation: 'delete',
        entityId: 'todo-delete',
        timestamp: 3,
        payload: { patient_id: 'patient-1' },
      }),
    ],
    'owner-1',
    ['patient-1', 'patient-2'],
  );

  assert.equal(resolved['patient-1'].find((todo) => todo.id === 'todo-server')?.completed, true);
  assert.equal(resolved['patient-1'].find((todo) => todo.id === 'todo-created')?.content, 'Queued task');
  assert.equal(resolved['patient-1'].some((todo) => todo.id === 'todo-delete'), false);
  assert.deepEqual(resolved['patient-2'], []);
});

test('bulk Todo query owns the cold-offline snapshot path used by Round End', () => {
  const source = readFileSync('src/hooks/useAllPatientTodos.ts', 'utf8');
  const roundEnd = readFileSync('src/components/round/RoundEnd.tsx', 'utf8');

  assert.match(source, /isBrowserKnownOffline\(\)[\s\S]*readOfflineTodoMap/);
  assert.match(source, /readPatientTodoSnapshot/);
  assert.match(source, /networkMode: 'always'/);
  assert.match(roundEnd, /patientTodos=\{todosMap\}/);
});

test('cold offline hook exposes a durable queued Todo to the shared export map', async () => {
  const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  window.dispatchEvent(new Event('offline'));
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({
      data: { session: { user: { id: 'owner-1' } } },
      error: null,
    }),
    onAuthStateChange: () => ({ unsubscribe: () => undefined }),
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(AuthProvider, null, children),
    )
  );

  try {
    await indexedDBQueue.transitionOwner('owner-1', async () => undefined);
    await indexedDBQueue.clear();
    await indexedDBQueue.enqueue({
      type: 'todo',
      operation: 'create',
      table: 'patient_todos',
      entityId: 'todo-cold-offline',
      payload: {
        id: 'todo-cold-offline',
        patient_id: 'patient-1',
        user_id: 'owner-1',
        section: null,
        content: 'Include in offline export',
        completed: false,
        created_at: '2026-08-13T10:00:00.000Z',
        updated_at: '2026-08-13T10:00:00.000Z',
      },
    });

    const { result } = renderHook(
      () => useAllPatientTodos(['patient-1']),
      { wrapper },
    );
    await waitFor(() => {
      assert.equal(
        result.current.todosMap['patient-1']?.[0]?.content,
        'Include in offline export',
      );
    });
    assert.equal(result.current.todosMap['patient-1']?.[0]?.syncStatus, 'queued');
  } finally {
    cleanup();
    queryClient.clear();
    await indexedDBQueue.clear();
    delete globalThis.__SUPABASE_AUTH_MOCK__;
    window.sessionStorage.removeItem('network.offline-event');
    if (onlineDescriptor) {
      Object.defineProperty(navigator, 'onLine', onlineDescriptor);
    }
    window.dispatchEvent(new Event('online'));
  }
});

test('online-flagged Todo read failure preserves snapshot truth and marks it unverified', async () => {
  const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  window.dispatchEvent(new Event('online'));
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({
      data: { session: { user: { id: 'owner-1' } } },
      error: null,
    }),
    onAuthStateChange: () => ({ unsubscribe: () => undefined }),
  };
  globalThis.__SUPABASE_SELECT_MOCK__ = (query: { table?: string }) => {
    if (query.table === 'patient_todos') {
      return { data: null, error: new Error('temporary backend outage') };
    }
    return { data: [], error: null };
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(AuthProvider, null, children),
    )
  );

  try {
    await indexedDBQueue.transitionOwner('owner-1', async () => undefined);
    await indexedDBQueue.clear();
    await indexedDBQueue.enqueue({
      type: 'todo',
      operation: 'create',
      table: 'patient_todos',
      entityId: 'todo-stale-fallback',
      payload: {
        id: 'todo-stale-fallback',
        patient_id: 'patient-1',
        user_id: 'owner-1',
        section: null,
        content: 'Preserve during backend outage',
        completed: false,
        created_at: '2026-08-13T10:00:00.000Z',
        updated_at: '2026-08-13T10:00:00.000Z',
      },
    });

    const { result } = renderHook(
      () => useAllPatientTodos(['patient-1']),
      { wrapper },
    );
    await waitFor(() => {
      assert.equal(result.current.verification, 'stale');
      assert.equal(
        result.current.todosMap['patient-1']?.[0]?.content,
        'Preserve during backend outage',
      );
    });
  } finally {
    cleanup();
    queryClient.clear();
    await indexedDBQueue.clear();
    delete globalThis.__SUPABASE_AUTH_MOCK__;
    delete globalThis.__SUPABASE_SELECT_MOCK__;
    window.sessionStorage.removeItem('network.offline-event');
    if (onlineDescriptor) {
      Object.defineProperty(navigator, 'onLine', onlineDescriptor);
    }
  }
});

test('online Todo truth remains visible but unverified when durable snapshot storage is unavailable', async () => {
  const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  window.dispatchEvent(new Event('online'));
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({
      data: { session: { user: { id: 'owner-1' } } },
      error: null,
    }),
    onAuthStateChange: () => ({ unsubscribe: () => undefined }),
  };
  globalThis.__SUPABASE_SELECT_MOCK__ = (query: { table?: string }) => {
    if (query.table === 'patient_todos') {
      return {
        data: [{
          id: 'todo-server',
          patient_id: 'patient-1',
          user_id: 'owner-1',
          section: null,
          content: 'Visible remote task',
          completed: false,
          created_at: '2026-08-13T10:00:00.000Z',
          updated_at: '2026-08-13T10:00:00.000Z',
        }],
        error: null,
      };
    }
    return { data: [], error: null };
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(AuthProvider, null, children),
    )
  );

  try {
    const { result } = renderHook(
      () => useAllPatientTodos(['patient-1']),
      { wrapper },
    );
    await waitFor(() => {
      assert.equal(result.current.todosMap['patient-1']?.[0]?.content, 'Visible remote task');
      assert.equal(result.current.verification, 'stale');
    });
  } finally {
    cleanup();
    queryClient.clear();
    delete globalThis.__SUPABASE_AUTH_MOCK__;
    delete globalThis.__SUPABASE_SELECT_MOCK__;
    window.sessionStorage.removeItem('network.offline-event');
    if (onlineDescriptor) {
      Object.defineProperty(navigator, 'onLine', onlineDescriptor);
    }
  }
});
