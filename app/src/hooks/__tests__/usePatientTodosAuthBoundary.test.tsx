import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, timeoutManager } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { useAllPatientTodos } from "@/hooks/useAllPatientTodos";
import { usePatientTodos } from "@/hooks/usePatientTodos";
import { useToast } from "@/hooks/use-toast";
import { QUERY_KEYS } from "@/lib/cache/cacheConfig";
import type { Patient } from "@/types/patient";

type QueryResult = { data: unknown[]; error: null };
type SelectQuery = {
  table: string;
  filters?: Array<{ column: string; value?: unknown }>;
};

timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => {
    const timer = setTimeout(callback, delay);
    if (typeof timer === "object" && "unref" in timer) timer.unref();
    return timer;
  },
  clearTimeout: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout> | undefined),
  setInterval: (callback, delay) => {
    const timer = setInterval(callback, delay);
    if (typeof timer === "object" && "unref" in timer) timer.unref();
    return timer;
  },
  clearInterval: (timer) => clearInterval(timer as ReturnType<typeof setInterval> | undefined),
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function todoRow(ownerId: string, content: string) {
  return {
    id: `todo-${ownerId}`,
    patient_id: "patient-shared",
    user_id: ownerId,
    section: null,
    content,
    completed: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

function setupAuthTransitionMock(initialUserId = "user-a") {
  let activeUserId = initialUserId;
  let authStateCallback:
    | ((event: string, session: { user: { id: string } }) => void)
    | undefined;

  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: activeUserId } } }, error: null }),
    onAuthStateChange: (callback: typeof authStateCallback) => {
      authStateCallback = callback;
      return { unsubscribe: () => {} };
    },
  };

  return {
    async transitionTo(nextUserId: string) {
      assert.ok(authStateCallback, "auth listener should be registered");
      activeUserId = nextUserId;
      await act(async () => {
        authStateCallback!("SIGNED_IN", { user: { id: nextUserId } });
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    },
  };
}

function ownerFilter(query: SelectQuery) {
  return query.filters?.find((filter) => filter.column === "user_id")?.value;
}

declare global {
  var __SUPABASE_AUTH_MOCK__: unknown;
  var __SUPABASE_SELECT_MOCK__: unknown;
  var __SUPABASE_FUNCTIONS_INVOKE_MOCK__: undefined | (() => Promise<unknown>);
  var __supabaseInsertCapture: undefined | unknown[];
}

const queryClients: QueryClient[] = [];

afterEach(() => {
  cleanup();
  queryClients.splice(0).forEach((queryClient) => queryClient.clear());
  delete globalThis.__SUPABASE_AUTH_MOCK__;
  delete globalThis.__SUPABASE_SELECT_MOCK__;
  delete globalThis.__SUPABASE_FUNCTIONS_INVOKE_MOCK__;
  delete (globalThis as typeof globalThis & { __SUPABASE_UPDATE_MOCK__?: unknown })
    .__SUPABASE_UPDATE_MOCK__;
});

function createWrapper(queryClient: QueryClient, includeSettings = true) {
  queryClients.push(queryClient);

  return function Wrapper({ children }: { children: React.ReactNode }) {
    const content = includeSettings ? <SettingsProvider>{children}</SettingsProvider> : children;
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider onAuthBoundary={() => queryClient.clear()}>{content}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

test("per-patient todos hide A immediately and discard a deferred A response after switching to B", async () => {
  const auth = setupAuthTransitionMock();
  const pendingA = deferred<QueryResult>();
  const pendingB = deferred<QueryResult>();
  const ownersRequested: unknown[] = [];
  globalThis.__SUPABASE_SELECT_MOCK__ = (query: SelectQuery) => {
    if (query.table !== "patient_todos") return { data: [], error: null };
    const ownerId = ownerFilter(query);
    ownersRequested.push(ownerId);
    return ownerId === "user-a" ? pendingA.promise : pendingB.promise;
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = createWrapper(queryClient);
  const { result } = renderHook(() => ({
    auth: useAuth(),
    patientTodos: usePatientTodos("patient-shared"),
  }), { wrapper });

  await waitFor(() => {
    assert.equal(result.current.auth.user?.id, "user-a");
    assert.deepEqual(ownersRequested, ["user-a"]);
  });

  await auth.transitionTo("user-b");
  await waitFor(() => {
    assert.equal(result.current.auth.user?.id, "user-b");
    assert.deepEqual(ownersRequested, ["user-a", "user-b"]);
  });
  assert.equal(result.current.patientTodos.todos.length, 0);

  await act(async () => {
    pendingB.resolve({ data: [todoRow("user-b", "B only")], error: null });
  });
  await waitFor(() => assert.equal(result.current.patientTodos.todos[0]?.content, "B only"));

  await act(async () => {
    pendingA.resolve({ data: [todoRow("user-a", "Late A PHI")], error: null });
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  assert.equal(result.current.patientTodos.todos[0]?.content, "B only");
  assert.equal(
    queryClient.getQueryData<Array<{ content: string }>>(
      QUERY_KEYS.patientTodosForOwner("user-b", "patient-shared"),
    )?.[0]?.content,
    "B only",
  );
  assert.equal(
    queryClient.getQueryData(QUERY_KEYS.patientTodosForOwner("user-a", "patient-shared")),
    undefined,
  );
  assert.equal(queryClient.getQueryData(["todos", "patient-shared"]), undefined);
});

test("bulk todos scope query and per-patient caches by owner across deferred A and B responses", async () => {
  const auth = setupAuthTransitionMock();
  const pendingA = deferred<QueryResult>();
  const pendingB = deferred<QueryResult>();
  globalThis.__SUPABASE_SELECT_MOCK__ = (query: SelectQuery) => {
    if (query.table !== "patient_todos") return { data: [], error: null };
    return ownerFilter(query) === "user-a" ? pendingA.promise : pendingB.promise;
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = createWrapper(queryClient, false);
  const { result } = renderHook(() => ({
    auth: useAuth(),
    allTodos: useAllPatientTodos(["patient-shared"]),
  }), { wrapper });

  await waitFor(() => assert.equal(result.current.auth.user?.id, "user-a"));
  await auth.transitionTo("user-b");
  await waitFor(() => assert.equal(result.current.auth.user?.id, "user-b"));
  assert.deepEqual(result.current.allTodos.todosMap, {});

  await act(async () => {
    pendingB.resolve({ data: [todoRow("user-b", "B bulk")], error: null });
  });
  await waitFor(() => assert.equal(result.current.allTodos.todosMap["patient-shared"]?.[0]?.content, "B bulk"));

  await act(async () => {
    pendingA.resolve({ data: [todoRow("user-a", "Late A bulk PHI")], error: null });
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  assert.equal(result.current.allTodos.todosMap["patient-shared"]?.[0]?.content, "B bulk");
  assert.equal(
    queryClient.getQueryData<Array<{ content: string }>>(
      QUERY_KEYS.patientTodosForOwner("user-b", "patient-shared"),
    )?.[0]?.content,
    "B bulk",
  );
  assert.equal(queryClient.getQueryData(["todos", "patient-shared"]), undefined);
});

test("a deferred user-A todo mutation cannot update user B state or caches", async () => {
  const auth = setupAuthTransitionMock();
  const pendingUpdate = deferred<{ error: null }>();
  let updateStarted = false;
  (globalThis as typeof globalThis & {
    __SUPABASE_UPDATE_MOCK__?: () => Promise<{ error: null }>;
  }).__SUPABASE_UPDATE_MOCK__ = () => {
    updateStarted = true;
    return pendingUpdate.promise;
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = createWrapper(queryClient);
  const userATodo = {
    id: "todo-user-a",
    patientId: "patient-shared",
    userId: "user-a",
    section: null,
    content: "A-only pending task",
    completed: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
  queryClient.setQueryData(
    QUERY_KEYS.patientTodosForOwner("user-a", "patient-shared"),
    [userATodo],
  );
  const { result } = renderHook(() => ({
    auth: useAuth(),
    patientTodos: usePatientTodos("patient-shared", { initialTodos: [userATodo] }),
    toastCount: useToast().toasts.length,
  }), { wrapper });
  await waitFor(() => {
    assert.equal(result.current.auth.user?.id, "user-a");
    assert.equal(result.current.patientTodos.todos[0]?.content, "A-only pending task");
  });

  let togglePromise!: Promise<void>;
  await act(async () => {
    togglePromise = result.current.patientTodos.toggleTodo("todo-user-a");
    await Promise.resolve();
  });
  assert.equal(updateStarted, true);

  await auth.transitionTo("user-b");
  await waitFor(() => assert.equal(result.current.auth.user?.id, "user-b"));
  assert.equal(result.current.patientTodos.todos.length, 0);

  await act(async () => {
    pendingUpdate.resolve({ error: null });
    await togglePromise;
  });

  assert.equal(result.current.patientTodos.todos.length, 0);
  assert.equal(
    queryClient.getQueryData(QUERY_KEYS.patientTodosForOwner("user-a", "patient-shared")),
    undefined,
  );
  assert.equal(
    queryClient.getQueryData(QUERY_KEYS.patientTodosForOwner("user-b", "patient-shared")),
    undefined,
  );
  assert.equal(result.current.toastCount, 0, "the stale mutation must not toast under user B");
});

test("todo generation stops before its insert and UI/cache writes when the owner changes", async () => {
  const auth = setupAuthTransitionMock();
  const pendingGeneration = deferred<unknown>();
  let invocationStarted = false;
  globalThis.__SUPABASE_FUNCTIONS_INVOKE_MOCK__ = () => {
    invocationStarted = true;
    return pendingGeneration.promise;
  };
  const insertCountBefore = globalThis.__supabaseInsertCapture?.length ?? 0;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = createWrapper(queryClient);
  const patient: Patient = {
    id: "patient-shared",
    patientNumber: 1,
    name: "User A private patient",
    mrn: "",
    bed: "A1",
    clinicalSummary: "A-only summary",
    intervalEvents: "",
    imaging: "",
    labs: "",
    systems: {
      neuro: "",
      cv: "",
      resp: "",
      renalGU: "",
      gi: "",
      endo: "",
      heme: "",
      infectious: "",
      skinLines: "",
      dispo: "",
    },
    medications: { infusions: [], scheduled: [], prn: [] },
    fieldTimestamps: {},
    collapsed: false,
    createdAt: "2024-01-01T00:00:00Z",
    lastModified: "2024-01-01T00:00:00Z",
  };

  const { result } = renderHook(() => ({
    auth: useAuth(),
    patientTodos: usePatientTodos("patient-shared", { initialTodos: [] }),
    toastCount: useToast().toasts.length,
  }), { wrapper });
  await waitFor(() => assert.equal(result.current.auth.user?.id, "user-a"));

  let generationPromise!: Promise<void>;
  await act(async () => {
    generationPromise = result.current.patientTodos.generateTodos(patient, "all");
    await Promise.resolve();
  });
  await waitFor(() => assert.equal(invocationStarted, true));
  assert.equal(result.current.patientTodos.generating, true);

  await auth.transitionTo("user-b");
  await waitFor(() => assert.equal(result.current.auth.user?.id, "user-b"));
  assert.equal(result.current.patientTodos.generating, false);
  assert.deepEqual(result.current.patientTodos.todos, []);

  await act(async () => {
    pendingGeneration.resolve({ data: { todos: ["Late A generated todo"] }, error: null });
    await generationPromise;
  });

  assert.equal(globalThis.__supabaseInsertCapture?.length ?? 0, insertCountBefore);
  assert.deepEqual(result.current.patientTodos.todos, []);
  assert.equal(
    queryClient.getQueryData(QUERY_KEYS.patientTodosForOwner("user-b", "patient-shared")),
    undefined,
  );
  assert.equal(result.current.toastCount, 0, "the stale generation must not toast under user B");
});
