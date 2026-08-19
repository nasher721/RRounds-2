import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { QUERY_KEYS } from "@/lib/cache/cacheConfig";
import {
  applyQueuedTodoMutations,
  usePatientTodos,
  updateTodosMapForPatient,
} from "@/hooks/usePatientTodos";
import type { PatientTodo } from "@/types/todo";
import type { PatientTodosMap } from "@/hooks/useAllPatientTodos";
import { indexedDBQueue, type QueuedMutation } from "@/lib/offline/indexedDBQueue";

declare global {
  var __SUPABASE_AUTH_MOCK__: unknown;
}

const queryClients: QueryClient[] = [];

afterEach(() => {
  cleanup();
  queryClients.splice(0).forEach((queryClient) => queryClient.clear());
  delete globalThis.__SUPABASE_AUTH_MOCK__;
  delete (globalThis as typeof globalThis & { __SUPABASE_INSERT_MOCK__?: unknown })
    .__SUPABASE_INSERT_MOCK__;
  delete (globalThis as typeof globalThis & { __SUPABASE_UPDATE_MOCK__?: unknown })
    .__SUPABASE_UPDATE_MOCK__;
  delete (globalThis as typeof globalThis & { __SUPABASE_DELETE_MOCK__?: unknown })
    .__SUPABASE_DELETE_MOCK__;
});

function setupAuthMock() {
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: "test-user-id" } } }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
}

function createQueryWrapper(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })) {
  queryClients.push(queryClient);
  function AuthReadyGate({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    return user ? <>{children}</> : null;
  }

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthReadyGate>
            <SettingsProvider>{children}</SettingsProvider>
          </AuthReadyGate>
        </AuthProvider>
      </QueryClientProvider>
    ),
  };
}

const initialTodo: PatientTodo = {
  id: "todo-1",
  patientId: "patient-1",
  userId: "test-user-id",
  section: null,
  content: "Review active plan",
  completed: false,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("usePatientTodos mutation cache updates", { concurrency: false }, () => {
  it("keeps selected todos and dashboard todo-map cache aligned after add, toggle, and delete", async () => {
    setupAuthMock();
    const { queryClient, wrapper } = createQueryWrapper();
    const allTodosKey = [...QUERY_KEYS.allTodos, "test-user-id", "patient-1|patient-2"] as const;

    const patientTodosKey = QUERY_KEYS.patientTodosForOwner("test-user-id", "patient-1");
    queryClient.setQueryData<PatientTodo[]>(patientTodosKey, [initialTodo]);
    queryClient.setQueryData<PatientTodosMap>(allTodosKey, {
      "patient-1": [initialTodo],
      "patient-2": [],
    });

    const { result } = renderHook(
      () => usePatientTodos("patient-1", { initialTodos: [initialTodo] }),
      { wrapper },
    );

    await waitFor(() => assert.equal(result.current.todos.length, 1));

    let addedTodo: PatientTodo | undefined;
    await act(async () => {
      addedTodo = await result.current.addTodo("Call family", "clinical_summary");
    });

    assert.equal(addedTodo?.content, "Call family");
    await waitFor(() => assert.equal(result.current.todos[0]?.content, "Call family", "selected todo state should prepend added todo"));
    assert.equal(
      queryClient.getQueryData<PatientTodo[]>(patientTodosKey)?.[0]?.content,
      "Call family",
      "patient todo cache should prepend added todo",
    );
    assert.equal(
      queryClient.getQueryData<PatientTodosMap>(allTodosKey)?.["patient-1"]?.[0]?.content,
      "Call family",
      "dashboard todo-map cache should prepend added todo",
    );

    await act(async () => {
      await result.current.toggleTodo("todo-1");
    });

    const toggledSelectedTodo = result.current.todos.find((todo) => todo.id === "todo-1");
    const toggledPatientCacheTodo = queryClient
      .getQueryData<PatientTodo[]>(patientTodosKey)
      ?.find((todo) => todo.id === "todo-1");
    const toggledDashboardTodo = queryClient
      .getQueryData<PatientTodosMap>(allTodosKey)
      ?.["patient-1"]?.find((todo) => todo.id === "todo-1");

    assert.equal(toggledSelectedTodo?.completed, true);
    assert.equal(toggledPatientCacheTodo?.completed, true);
    assert.equal(toggledDashboardTodo?.completed, true);

    await act(async () => {
      await result.current.deleteTodo("todo-1");
    });

    assert.equal(result.current.todos.some((todo) => todo.id === "todo-1"), false);
    assert.equal(
      queryClient.getQueryData<PatientTodo[]>(patientTodosKey)?.some((todo) => todo.id === "todo-1"),
      false,
    );
    assert.equal(
      queryClient.getQueryData<PatientTodosMap>(allTodosKey)?.["patient-1"]?.some((todo) => todo.id === "todo-1"),
      false,
    );
    assert.equal(
      queryClient.getQueryData(["todos", "patient-1"]),
      undefined,
      "todo mutations must not populate the legacy ownerless cache key",
    );
  });

  it("updates only todo maps that already contain the affected patient", () => {
    const generatedTodo: PatientTodo = {
      ...initialTodo,
      id: "generated-1",
      content: "Generated follow-up",
    };
    const currentMap: PatientTodosMap = {
      "patient-1": [initialTodo],
      "patient-2": [],
    };

    const nextMap = updateTodosMapForPatient(currentMap, "patient-1", (todos) => [generatedTodo, ...todos]);
    const untouchedMap = updateTodosMapForPatient(currentMap, "missing-patient", (todos) => [generatedTodo, ...todos]);

    assert.deepEqual(nextMap?.["patient-1"].map((todo) => todo.id), ["generated-1", "todo-1"]);
    assert.equal(nextMap?.["patient-2"], currentMap["patient-2"]);
    assert.equal(untouchedMap, currentMap);
  });

  it("replays queued todo create, update, and delete operations over server state", () => {
    const queuedCreate: QueuedMutation = {
      id: "mutation-create",
      type: "todo",
      operation: "create",
      table: "patient_todos",
      entityId: "todo-offline",
      payload: {
        id: "todo-offline",
        patient_id: "patient-1",
        user_id: "test-user-id",
        section: null,
        content: "Call family",
        completed: false,
        created_at: "2024-01-02T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      },
      timestamp: 2,
      retryCount: 0,
      maxRetries: 3,
      status: "pending",
      ownerId: "test-user-id",
    };
    const queuedToggle: QueuedMutation = {
      ...queuedCreate,
      id: "mutation-toggle",
      operation: "update",
      entityId: "todo-1",
      payload: {
        patient_id: "patient-1",
        user_id: "test-user-id",
        completed: true,
      },
      conflictData: { updated_at: initialTodo.updatedAt },
      timestamp: 3,
    };

    const withQueuedChanges = applyQueuedTodoMutations(
      [initialTodo],
      [queuedCreate, queuedToggle],
      "test-user-id",
      "patient-1",
    );
    assert.equal(withQueuedChanges[0]?.id, "todo-offline");
    assert.equal(withQueuedChanges[0]?.syncStatus, "queued");
    assert.equal(withQueuedChanges.find((todo) => todo.id === "todo-1")?.completed, true);
    assert.equal(withQueuedChanges.find((todo) => todo.id === "todo-1")?.syncStatus, "queued");

    const afterDelete = applyQueuedTodoMutations(
      withQueuedChanges,
      [{ ...queuedToggle, id: "mutation-delete", operation: "delete", timestamp: 4 }],
      "test-user-id",
      "patient-1",
    );
    assert.equal(afterDelete.some((todo) => todo.id === "todo-1"), false);
  });

  it("durably keeps todo mutations local after an offline reload reports navigator online", async () => {
    setupAuthMock();
    await indexedDBQueue.transitionOwner("test-user-id", async () => undefined);
    await indexedDBQueue.clear();
    const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, "onLine");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const offlineError = new TypeError("Failed to fetch");
    let insertCalls = 0;
    let updateCalls = 0;
    let deleteCalls = 0;
    (globalThis as typeof globalThis & {
      __SUPABASE_INSERT_MOCK__?: () => { data: null; error: Error };
      __SUPABASE_UPDATE_MOCK__?: () => { data: null; error: Error };
      __SUPABASE_DELETE_MOCK__?: () => { data: null; error: Error };
    }).__SUPABASE_INSERT_MOCK__ = () => {
      insertCalls += 1;
      return { data: null, error: offlineError };
    };
    (globalThis as typeof globalThis & {
      __SUPABASE_UPDATE_MOCK__?: () => { data: null; error: Error };
    }).__SUPABASE_UPDATE_MOCK__ = () => {
      updateCalls += 1;
      return { data: null, error: offlineError };
    };
    (globalThis as typeof globalThis & {
      __SUPABASE_DELETE_MOCK__?: () => { data: null; error: Error };
    }).__SUPABASE_DELETE_MOCK__ = () => {
      deleteCalls += 1;
      return { data: null, error: offlineError };
    };
    window.dispatchEvent(new Event("offline"));

    try {
      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => usePatientTodos("patient-1", { initialTodos: [] }),
        { wrapper },
      );
      await waitFor(() => assert.equal(result.current.todos.length, 0));

      let queuedTodo: PatientTodo | undefined;
      await act(async () => {
        queuedTodo = await result.current.addTodo("Call family", null);
      });

      assert.ok(queuedTodo?.id);
      assert.equal(queuedTodo?.syncStatus, "queued");
      assert.equal(result.current.todos[0]?.content, "Call family");
      let queue = await indexedDBQueue.getQueue();
      assert.equal(queue.length, 1);
      assert.equal(queue[0]?.type, "todo");
      assert.equal(queue[0]?.operation, "create");
      assert.equal(queue[0]?.payload.content, "Call family");

      await act(async () => {
        await result.current.toggleTodo(queuedTodo!.id);
      });
      assert.equal(result.current.todos[0]?.completed, true);
      queue = await indexedDBQueue.getQueue();
      assert.equal(queue.length, 1);
      assert.equal(queue[0]?.operation, "create");
      assert.equal(queue[0]?.payload.completed, true);

      await act(async () => {
        await result.current.deleteTodo(queuedTodo!.id);
      });
      assert.equal(result.current.todos.length, 0);
      assert.deepEqual(await indexedDBQueue.getQueue(), []);
      assert.deepEqual(
        { insertCalls, updateCalls, deleteCalls },
        { insertCalls: 0, updateCalls: 0, deleteCalls: 0 },
        "sticky offline state must bypass every Supabase todo write",
      );
    } finally {
      await indexedDBQueue.clear();
      window.dispatchEvent(new Event("online"));
      if (onlineDescriptor) Object.defineProperty(navigator, "onLine", onlineDescriptor);
      else Reflect.deleteProperty(navigator, "onLine");
    }
  });
});
