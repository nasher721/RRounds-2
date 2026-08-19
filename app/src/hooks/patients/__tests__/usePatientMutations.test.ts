import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { cleanup, renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Patient } from "@/types/patient";
import { QUERY_KEYS } from "@/lib/cache/cacheConfig";
import { defaultSystemsValue, defaultMedicationsValue } from "@/services/patientService";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import {
  reconcilePatientSaveStates,
  usePatientMutations,
} from "@/hooks/patients/usePatientMutations";
import type { QueuedMutation } from "@/lib/offline/indexedDBQueue";
import { flushPatientMutationMetrics } from "@/lib/observability/operationalMetrics";
import { indexedDBQueue } from "@/lib/offline/indexedDBQueue";

const queryClients: QueryClient[] = [];

/**
 * Mutation surface plus the live auth session.
 *
 * Every mutation in usePatientMutations returns early while `user` is still
 * null, so a test that acts before AuthProvider resolves silently exercises
 * nothing. Spreading keeps `result.current.<mutation>` working while exposing
 * `__auth` for an observable readiness wait instead of a fixed sleep.
 */
function useMutationsWithAuth(options: Parameters<typeof usePatientMutations>[0]) {
  return { ...usePatientMutations(options), __auth: useAuth() };
}

/** Block until the provider has a session, replacing fixed-sleep auth waits. */
async function waitForAuthSession(result: { current: { __auth: ReturnType<typeof useAuth> } }) {
  await waitFor(() => {
    assert.ok(result.current.__auth.user?.id, "auth session should be ready");
  });
}

afterEach(() => {
  cleanup();
  queryClients.splice(0).forEach((queryClient) => queryClient.clear());
  delete (globalThis as unknown as { __SUPABASE_UPDATE_MOCK__?: unknown }).__SUPABASE_UPDATE_MOCK__;
  delete (globalThis as unknown as { __SUPABASE_RPC_MOCK__?: unknown }).__SUPABASE_RPC_MOCK__;
  delete (globalThis as unknown as { __SUPABASE_INSERT_MOCK__?: unknown }).__SUPABASE_INSERT_MOCK__;
  delete (globalThis as unknown as { __SUPABASE_STORAGE_REMOVE_MOCK__?: unknown }).__SUPABASE_STORAGE_REMOVE_MOCK__;
  (globalThis as unknown as {
    __supabaseStorageRemoveCapture?: Array<{ bucket: string; paths: string[] }>;
  }).__supabaseStorageRemoveCapture?.splice(0);
  (globalThis as unknown as { __supabaseRpcCapture?: unknown[] }).__supabaseRpcCapture?.splice(0);
});

function createAuthQueryWrapper(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })) {
  queryClients.push(queryClient);
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(AuthProvider, null, children),
      ),
  };
}

function setupAuthMock() {
  (globalThis as unknown as { __SUPABASE_AUTH_MOCK__?: { getSession: () => Promise<{ data: { session: { user: { id: string } } }; error: null }> } }).__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: "test-user-id" } } }, error: null }),
  };
}

function setupAuthTransitionMock(initialUserId = "user-a") {
  let authStateCallback: ((event: string, session: { user: { id: string } }) => void) | undefined;
  (globalThis as unknown as {
    __SUPABASE_AUTH_MOCK__?: {
      getSession: () => Promise<{ data: { session: { user: { id: string } } }; error: null }>;
      onAuthStateChange: (callback: typeof authStateCallback) => { unsubscribe: () => void };
    };
  }).__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: initialUserId } } }, error: null }),
    onAuthStateChange: (callback) => {
      authStateCallback = callback;
      return { unsubscribe: () => {} };
    },
  };

  return async (nextUserId: string) => {
    assert.ok(authStateCallback, "auth listener should be registered");
    await act(async () => {
      authStateCallback!("SIGNED_IN", { user: { id: nextUserId } });
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  };
}

const mockPatient: Patient = {
  id: "existing-id",
  patientNumber: 1,
  name: "Existing",
  mrn: "MRN-1",
  bed: "A1",
  clinicalSummary: "",
  intervalEvents: "",
  imaging: "",
  labs: "",
  systems: defaultSystemsValue,
  medications: defaultMedicationsValue,
  fieldTimestamps: {},
  collapsed: false,
  createdAt: "2024-01-01T00:00:00Z",
  lastModified: "2024-01-01T00:00:00Z",
  revision: 0,
};

const queuedPatientUpdate = (
  overrides: Partial<QueuedMutation> = {},
): QueuedMutation => ({
  id: "queued-patient-update",
  type: "patient",
  operation: "update",
  table: "patients",
  entityId: "existing-id",
  ownerId: "test-user-id",
  payload: { clinical_summary: "Queued summary" },
  timestamp: 1,
  retryCount: 0,
  maxRetries: 3,
  status: "pending",
  ...overrides,
});

test("durable patient queue restores save-state truth after a reload", () => {
  assert.deepEqual(
    reconcilePatientSaveStates({}, [queuedPatientUpdate()]),
    {
      states: { "existing-id": "queued" },
      drained: [],
      failed: [],
    },
  );

  assert.deepEqual(
    reconcilePatientSaveStates(
      { "existing-id": "queued", "failed-id": "queued" },
      [queuedPatientUpdate({ entityId: "failed-id", status: "failed" })],
    ),
    {
      states: { "existing-id": "saved", "failed-id": "error" },
      drained: ["existing-id"],
      failed: ["failed-id"],
    },
  );
});

test("usePatientMutations addPatient calls supabase insert with expected payload", async () => {
  setupAuthMock();
  const patientsRef = { current: [] as Patient[] };
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    if (typeof fn === "function") patientsRef.current = (fn as (prev: Patient[]) => Patient[])(patientsRef.current);
  };
  const setPatientCounter = () => {};
  const fetchPatients = async () => {};
  const { wrapper } = createAuthQueryWrapper();

  const { result } = renderHook(
    () =>
      useMutationsWithAuth({
        patientsRef,
        setPatients,
        patientCounter: 1,
        setPatientCounter,
        fetchPatients,
      }),
    { wrapper }
  );

  await waitForAuthSession(result);
  await act(async () => {
    await result.current.addPatient();
  });

  const capture = (globalThis as unknown as { __supabaseInsertCapture?: { table: string; rows: unknown[] }[] }).__supabaseInsertCapture;
  assert.ok(capture, "insert capture should exist");
  assert.ok(capture.length >= 1, "insert should have been called");
  const lastInsert = capture[capture.length - 1];
  assert.equal(lastInsert.table, "patients");
  assert.equal(lastInsert.rows.length, 1);
  const payload = lastInsert.rows[0] as Record<string, unknown>;
  assert.equal(payload.user_id, "test-user-id");
  assert.equal(typeof payload.patient_number, "number");
  assert.equal(payload.name, "");
  assert.equal(payload.bed, "");
});

test("usePatientMutations updatePatient calls supabase update", async () => {
  setupAuthMock();
  const patientsRef = { current: [{ ...mockPatient }] };
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    if (typeof fn === "function") patientsRef.current = (fn as (prev: Patient[]) => Patient[])(patientsRef.current);
    else patientsRef.current = fn as Patient[];
  };
  const setPatientCounter = () => {};
  const fetchPatients = async () => {};
  const { queryClient, wrapper } = createAuthQueryWrapper();
  queryClient.setQueryData(QUERY_KEYS.patientList("test-user-id"), [{ ...mockPatient }]);

  const { result } = renderHook(() =>
    useMutationsWithAuth({
      patientsRef,
      setPatients,
      patientCounter: 1,
      setPatientCounter,
      fetchPatients,
      }),
    { wrapper }
  );

  await waitForAuthSession(result);
  await act(async () => {
    await result.current.updatePatient("existing-id", "name", "Updated Name");
  });

  const capture = (globalThis as unknown as { __supabaseUpdateCapture?: { table: string; data: unknown }[] }).__supabaseUpdateCapture;
  assert.ok(capture, "update capture should exist");
  assert.ok(capture.length >= 1, "update should have been called");
  const lastUpdate = capture[capture.length - 1];
  assert.equal(lastUpdate.table, "patients");
  assert.ok((lastUpdate.data as Record<string, unknown>).name === "Updated Name" || (lastUpdate.data as Record<string, unknown>).last_modified);
  assert.equal(queryClient.getQueryData<Patient[]>(QUERY_KEYS.patientList("test-user-id"))?.[0]?.name, "Updated Name");
});

test("sticky known-offline patient updates queue without issuing a Supabase update", async () => {
  setupAuthMock();
  const patientsRef = { current: [{ ...mockPatient }] };
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    patientsRef.current = typeof action === "function"
      ? (action as (previous: Patient[]) => Patient[])(patientsRef.current)
      : action;
  };
  const { wrapper } = createAuthQueryWrapper();
  const { result } = renderHook(() => useMutationsWithAuth({
    patientsRef,
    setPatients,
    patientCounter: 1,
    setPatientCounter: () => {},
    fetchPatients: async () => {},
  }), { wrapper });

  await waitForAuthSession(result);
  await indexedDBQueue.clear();
  const updateCapture = (globalThis as unknown as {
    __supabaseUpdateCapture?: Array<{ table: string; data: unknown }>;
  }).__supabaseUpdateCapture ?? [];
  const updatesBefore = updateCapture.length;
  Object.defineProperty(globalThis.navigator, "onLine", {
    configurable: true,
    value: true,
  });
  window.dispatchEvent(new Event("offline"));

  try {
    await act(async () => {
      await result.current.updatePatient("existing-id", "clinicalSummary", "Queued summary");
      await result.current.updatePatient("existing-id", "clinicalSummary", "Latest queued summary");
    });

    assert.equal(updateCapture.length, updatesBefore);
    assert.equal(result.current.patientSaveStates["existing-id"], "queued");
    const queued = await indexedDBQueue.getQueue();
    assert.equal(queued.length, 1);
    assert.equal(queued[0]?.entityId, "existing-id");
    assert.equal(queued[0]?.payload.clinical_summary, "Latest queued summary");
  } finally {
    await indexedDBQueue.clear();
    window.dispatchEvent(new Event("online"));
    delete (globalThis.navigator as unknown as { onLine?: boolean }).onLine;
  }
});

test("successful patient updates emit fixed PHI-safe mutation metrics", async () => {
  setupAuthMock();
  const patientsRef = { current: [{ ...mockPatient }] };
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    patientsRef.current = typeof action === "function"
      ? (action as (previous: Patient[]) => Patient[])(patientsRef.current)
      : action;
  };
  const { wrapper } = createAuthQueryWrapper();
  const { result } = renderHook(() => useMutationsWithAuth({
    patientsRef,
    setPatients,
    patientCounter: 1,
    setPatientCounter: () => {},
    fetchPatients: async () => {},
  }), { wrapper });
  await waitForAuthSession(result);

  const originalConsoleLog = console.log;
  const lines: string[] = [];
  console.log = (...values: unknown[]) => lines.push(values.map(String).join(" "));
  try {
    await act(async () => {
      await result.current.updatePatient("existing-id", "name", "Updated Name");
    });
    flushPatientMutationMetrics();
  } finally {
    console.log = originalConsoleLog;
  }

  const metricContexts = lines
    .flatMap((line) => {
      try {
        const payload = JSON.parse(line) as { message?: string; context?: Record<string, unknown> };
        return payload.message === "metric" && payload.context ? [payload.context] : [];
      } catch {
        return [];
      }
    });
  assert.ok(metricContexts.some((context) => (
    context.metricName === "patients.mutation.total"
    && context.operation === "update"
    && context.outcome === "saved"
  )));
  assert.equal(JSON.stringify(metricContexts).includes("existing-id"), false);
  assert.equal(JSON.stringify(metricContexts).includes("Updated Name"), false);
});

test("updates for a missing patient never leave a phantom saving state", async () => {
  setupAuthMock();
  const patientsRef = { current: [{ ...mockPatient }] };
  const { wrapper } = createAuthQueryWrapper();
  const { result } = renderHook(() => useMutationsWithAuth({
    patientsRef,
    setPatients: () => {},
    patientCounter: 1,
    setPatientCounter: () => {},
    fetchPatients: async () => {},
  }), { wrapper });
  await waitForAuthSession(result);

  await act(async () => {
    await result.current.updatePatient("missing-id", "name", "Never persisted");
  });

  assert.equal(result.current.patientSaveStates["missing-id"], undefined);
});

test("usePatientMutations forces a server refresh after failed optimistic patient updates", async () => {
  setupAuthMock();
  const patientsRef = { current: [{ ...mockPatient }] };
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    if (typeof fn === "function") patientsRef.current = (fn as (prev: Patient[]) => Patient[])(patientsRef.current);
    else patientsRef.current = fn as Patient[];
  };
  const setPatientCounter = () => {};
  const fetchCalls: Array<{ force?: boolean } | undefined> = [];
  const fetchPatients = async (options?: { force?: boolean }) => {
    fetchCalls.push(options);
  };
  const { queryClient, wrapper } = createAuthQueryWrapper();
  queryClient.setQueryData(QUERY_KEYS.patientList("test-user-id"), [{ ...mockPatient }]);
  (globalThis as unknown as { __SUPABASE_UPDATE_MOCK__?: () => { error: Error } }).__SUPABASE_UPDATE_MOCK__ = () => ({
    error: new Error("forced update failure"),
  });

  const { result } = renderHook(() =>
    useMutationsWithAuth({
      patientsRef,
      setPatients,
      patientCounter: 1,
      setPatientCounter,
      fetchPatients,
    }),
    { wrapper }
  );

  await waitForAuthSession(result);
  await act(async () => {
    await result.current.updatePatient("existing-id", "name", "Failed Update");
  });

  assert.equal(patientsRef.current[0]?.name, "Existing");
  assert.equal(queryClient.getQueryData<Patient[]>(QUERY_KEYS.patientList("test-user-id"))?.[0]?.name, "Existing");
  assert.deepEqual(fetchCalls, [{ force: true }]);
});

test("usePatientMutations rejects a stale cross-tab revision instead of overwriting", async () => {
  setupAuthMock();
  const patientsRef: { current: Patient[] } = { current: [{ ...mockPatient, revision: 7 }] };
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    patientsRef.current = typeof action === "function"
      ? (action as (previous: Patient[]) => Patient[])(patientsRef.current)
      : action;
  };
  const fetchCalls: Array<{ force?: boolean } | undefined> = [];
  let revisionFilter: unknown;
  (globalThis as unknown as {
    __SUPABASE_UPDATE_MOCK__?: (request: { filters: Array<{ column: string; value: unknown }> }) => {
      data: null;
      error: null;
      count: number;
    };
  }).__SUPABASE_UPDATE_MOCK__ = ({ filters }) => {
    revisionFilter = filters.find((filter) => filter.column === "revision")?.value;
    return { data: null, error: null, count: 0 };
  };
  const { wrapper } = createAuthQueryWrapper();
  const { result } = renderHook(() => useMutationsWithAuth({
    patientsRef,
    setPatients,
    patientCounter: 1,
    setPatientCounter: () => {},
    fetchPatients: async (options) => { fetchCalls.push(options); },
  }), { wrapper });

  await waitForAuthSession(result);
  await act(async () => {
    await result.current.updatePatient("existing-id", "name", "Stale edit");
  });

  assert.equal(revisionFilter, 7);
  assert.equal(patientsRef.current[0]?.name, "Existing");
  assert.equal(result.current.patientSaveStates["existing-id"], "conflict");
  assert.deepEqual(fetchCalls, [{ force: true }]);
});

test("one stale revision blocks already-queued keystrokes from issuing repeated conflict writes", async () => {
  setupAuthMock();
  const patientsRef: { current: Patient[] } = { current: [{ ...mockPatient, revision: 7 }] };
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    patientsRef.current = typeof action === "function"
      ? (action as (previous: Patient[]) => Patient[])(patientsRef.current)
      : action;
  };
  const fetchCalls: Array<{ force?: boolean } | undefined> = [];
  let updateCalls = 0;
  let resolveFirstUpdate!: () => void;
  (globalThis as unknown as {
    __SUPABASE_UPDATE_MOCK__?: () => Promise<{
      data: null;
      error: null;
      count: number;
    }> | {
      data: null;
      error: null;
      count: number;
    };
  }).__SUPABASE_UPDATE_MOCK__ = () => {
    updateCalls += 1;
    if (updateCalls === 1) {
      return new Promise((resolve) => {
        resolveFirstUpdate = () => resolve({ data: null, error: null, count: 0 });
      });
    }
    return { data: null, error: null, count: 0 };
  };

  const { wrapper } = createAuthQueryWrapper();
  const { result } = renderHook(() => useMutationsWithAuth({
    patientsRef,
    setPatients,
    patientCounter: 1,
    setPatientCounter: () => {},
    fetchPatients: async (options) => { fetchCalls.push(options); },
  }), { wrapper });
  await waitForAuthSession(result);

  let writes!: Promise<void>[];
  await act(async () => {
    writes = [
      result.current.updatePatient("existing-id", "clinicalSummary", "S"),
      result.current.updatePatient("existing-id", "clinicalSummary", "St"),
      result.current.updatePatient("existing-id", "clinicalSummary", "Sta"),
      result.current.updatePatient("existing-id", "clinicalSummary", "Stale"),
    ];
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(updateCalls, 1, "only the leading write should be in flight before its result is known");

  await act(async () => {
    resolveFirstUpdate();
    await Promise.all(writes);
  });

  assert.equal(updateCalls, 1, "queued keystrokes must stop at the first revision conflict");
  assert.deepEqual(fetchCalls, [{ force: true }]);
  assert.equal(result.current.patientSaveStates["existing-id"], "conflict");
});

test("an edit started after a conflict waits for the forced refresh before writing", async () => {
  setupAuthMock();
  const patientsRef: { current: Patient[] } = { current: [{ ...mockPatient, revision: 7 }] };
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    patientsRef.current = typeof action === "function"
      ? (action as (previous: Patient[]) => Patient[])(patientsRef.current)
      : action;
  };
  const revisionFilters: unknown[] = [];
  (globalThis as unknown as {
    __SUPABASE_UPDATE_MOCK__?: (request: {
      filters: Array<{ column: string; value: unknown }>;
    }) => { data: null; error: null; count: number };
  }).__SUPABASE_UPDATE_MOCK__ = ({ filters }) => {
    revisionFilters.push(filters.find((filter) => filter.column === "revision")?.value);
    return { data: null, error: null, count: revisionFilters.length === 1 ? 0 : 1 };
  };

  let resolveRefresh!: () => void;
  const fetchPatients = () => new Promise<void>((resolve) => {
    resolveRefresh = () => {
      patientsRef.current = [{ ...mockPatient, revision: 8, clinicalSummary: "Remote truth" }];
      resolve();
    };
  });
  const { wrapper } = createAuthQueryWrapper();
  const { result } = renderHook(() => useMutationsWithAuth({
    patientsRef,
    setPatients,
    patientCounter: 1,
    setPatientCounter: () => {},
    fetchPatients,
  }), { wrapper });
  await waitForAuthSession(result);

  await act(async () => {
    await result.current.updatePatient("existing-id", "clinicalSummary", "Stale local edit");
  });
  assert.deepEqual(revisionFilters, [7]);

  let freshWrite!: Promise<void>;
  await act(async () => {
    freshWrite = result.current.updatePatient("existing-id", "clinicalSummary", "Fresh local edit");
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.deepEqual(revisionFilters, [7], "the follow-up write must wait while the refresh is active");

  await act(async () => {
    resolveRefresh();
    await freshWrite;
  });

  assert.deepEqual(revisionFilters, [7, 8]);
  assert.equal(result.current.patientSaveStates["existing-id"], "saved");
  assert.equal(patientsRef.current[0]?.clinicalSummary, "Fresh local edit");
});

test("usePatientMutations ignores a deferred user-A rollback after switching to user B", async () => {
  const transitionTo = setupAuthTransitionMock();
  const userAPatient = { ...mockPatient, id: "patient-a", name: "User A" };
  const userBPatient = { ...mockPatient, id: "patient-b", name: "User B" };
  const patientsRef = { current: [userAPatient] };
  let renderedPatients = patientsRef.current;
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    renderedPatients = typeof action === "function"
      ? (action as (prev: Patient[]) => Patient[])(renderedPatients)
      : action;
    patientsRef.current = renderedPatients;
  };
  const fetchCalls: Array<{ force?: boolean } | undefined> = [];
  const fetchPatients = async (options?: { force?: boolean }) => {
    fetchCalls.push(options);
  };
  let resolveUpdate!: (result: { error: Error | null }) => void;
  (globalThis as unknown as {
    __SUPABASE_UPDATE_MOCK__?: () => Promise<{ error: Error | null }>;
  }).__SUPABASE_UPDATE_MOCK__ = () => new Promise((resolve) => {
    resolveUpdate = resolve;
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  queryClients.push(queryClient);
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(AuthProvider, {
        onAuthBoundary: () => queryClient.clear(),
        children,
      }),
    );
  const { result } = renderHook(() =>
    useMutationsWithAuth({
      patientsRef,
      setPatients,
      patientCounter: 1,
      setPatientCounter: () => {},
      fetchPatients,
    }),
    { wrapper },
  );

  await waitForAuthSession(result);

  let pendingUpdate!: Promise<void>;
  await act(async () => {
    pendingUpdate = result.current.updatePatient("patient-a", "name", "User A pending");
    await Promise.resolve();
  });

  await transitionTo("user-b");
  renderedPatients = [userBPatient];
  patientsRef.current = renderedPatients;
  queryClient.setQueryData(QUERY_KEYS.patientList("user-b"), renderedPatients);

  await act(async () => {
    resolveUpdate({ error: new Error("late user-A failure") });
    await pendingUpdate;
  });

  assert.deepEqual(patientsRef.current, [userBPatient]);
  assert.deepEqual(renderedPatients, [userBPatient]);
  assert.deepEqual(queryClient.getQueryData(QUERY_KEYS.patientList("user-b")), [userBPatient]);
  assert.deepEqual(fetchCalls, []);
});

test("a failed older update rolls back only its field and preserves a newer successful edit", async () => {
  setupAuthMock();
  const patientsRef = { current: [{ ...mockPatient }] };
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    patientsRef.current = typeof action === "function"
      ? (action as (previous: Patient[]) => Patient[])(patientsRef.current)
      : action;
  };
  const fetchCalls: Array<{ force?: boolean } | undefined> = [];
  let resolveOlderUpdate!: (result: { error: Error | null }) => void;
  (globalThis as unknown as {
    __SUPABASE_UPDATE_MOCK__?: (request: { data: Record<string, unknown> }) => Promise<{ error: Error | null }> | { error: null };
  }).__SUPABASE_UPDATE_MOCK__ = ({ data }) => {
    if (data.name === "Pending name") {
      return new Promise((resolve) => {
        resolveOlderUpdate = resolve;
      });
    }
    return { error: null };
  };
  const { wrapper } = createAuthQueryWrapper();
  const { result } = renderHook(() => useMutationsWithAuth({
    patientsRef,
    setPatients,
    patientCounter: 1,
    setPatientCounter: () => {},
    fetchPatients: async (options) => { fetchCalls.push(options); },
  }), { wrapper });

  await waitForAuthSession(result);

  let olderUpdate!: Promise<void>;
  let newerUpdate!: Promise<void>;
  await act(async () => {
    olderUpdate = result.current.updatePatient("existing-id", "name", "Pending name");
    await Promise.resolve();
    newerUpdate = result.current.updatePatient("existing-id", "bed", "B2");
  });

  await act(async () => {
    resolveOlderUpdate({ error: new Error("older request failed") });
    await olderUpdate;
    await newerUpdate;
  });

  assert.equal(patientsRef.current[0]?.name, "Existing");
  assert.equal(patientsRef.current[0]?.bed, "B2");
  assert.deepEqual(fetchCalls, [], "an older failure must not refresh over a newer optimistic mutation");
});

test("a failed deferred systems patch cannot leak through a concurrent sibling update", async () => {
  setupAuthMock();
  const patientsRef = { current: [{ ...mockPatient, systems: { ...defaultSystemsValue } }] };
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    patientsRef.current = typeof action === "function"
      ? (action as (previous: Patient[]) => Patient[])(patientsRef.current)
      : action;
  };
  const serverSystems = { ...defaultSystemsValue };
  let resolveLegacyNeuro!: (result: { error: Error | null }) => void;
  (globalThis as unknown as {
    __SUPABASE_UPDATE_MOCK__?: (request: { data: { systems?: typeof serverSystems } }) => Promise<{ error: Error | null }> | { error: null };
  }).__SUPABASE_UPDATE_MOCK__ = ({ data }) => {
    if (data.systems?.neuro === "pending neuro" && data.systems.cv === "") {
      return new Promise((resolve) => { resolveLegacyNeuro = resolve; });
    }
    if (data.systems) Object.assign(serverSystems, data.systems);
    return { error: null };
  };

  const { wrapper } = createAuthQueryWrapper();
  const { result } = renderHook(() => useMutationsWithAuth({
    patientsRef,
    setPatients,
    patientCounter: 1,
    setPatientCounter: () => {},
    fetchPatients: async () => {},
  }), { wrapper });
  await waitForAuthSession(result);

  let neuroRequest!: Promise<void>;
  let cvRequest!: Promise<void>;
  await act(async () => {
    neuroRequest = result.current.updatePatient("existing-id", "systems.neuro", "pending neuro");
    await new Promise((resolve) => setTimeout(resolve, 0));
    cvRequest = result.current.updatePatient("existing-id", "systems.cv", "stable cv");
  });
  await act(async () => {
    resolveLegacyNeuro({ error: new Error("neuro rejected") });
    await neuroRequest;
    await cvRequest;
  });

  assert.equal(patientsRef.current[0]?.systems.neuro, "");
  assert.equal(patientsRef.current[0]?.systems.cv, "stable cv");
  assert.equal(serverSystems.neuro, "", "the rejected optimistic value must never persist indirectly");
  assert.equal(serverSystems.cv, "stable cv");
  assert.equal((globalThis as unknown as { __supabaseRpcCapture?: unknown[] }).__supabaseRpcCapture?.length ?? 0, 0);
});

test("deferred medication sibling patches persist without last-completer JSON loss", async () => {
  setupAuthMock();
  const patientsRef = { current: [{ ...mockPatient, medications: { ...defaultMedicationsValue } }] };
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    patientsRef.current = typeof action === "function"
      ? (action as (previous: Patient[]) => Patient[])(patientsRef.current)
      : action;
  };
  const serverMedications = { ...defaultMedicationsValue };
  let finishLegacyInfusions!: () => void;
  (globalThis as unknown as {
    __SUPABASE_UPDATE_MOCK__?: (request: { data: { medications?: typeof serverMedications } }) => Promise<{ error: null }> | { error: null };
  }).__SUPABASE_UPDATE_MOCK__ = ({ data }) => {
    if (data.medications?.infusions?.length && !data.medications.scheduled?.length) {
      const staleSnapshot = data.medications;
      return new Promise((resolve) => {
        finishLegacyInfusions = () => {
          Object.assign(serverMedications, staleSnapshot);
          resolve({ error: null });
        };
      });
    }
    if (data.medications) Object.assign(serverMedications, data.medications);
    return { error: null };
  };

  const { wrapper } = createAuthQueryWrapper();
  const { result } = renderHook(() => useMutationsWithAuth({
    patientsRef,
    setPatients,
    patientCounter: 1,
    setPatientCounter: () => {},
    fetchPatients: async () => {},
  }), { wrapper });
  await waitForAuthSession(result);

  let infusionsRequest!: Promise<void>;
  let scheduledRequest!: Promise<void>;
  await act(async () => {
    infusionsRequest = result.current.updatePatient("existing-id", "medications.infusions", ["norepinephrine"]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    scheduledRequest = result.current.updatePatient("existing-id", "medications.scheduled", ["levetiracetam"]);
  });
  await act(async () => {
    finishLegacyInfusions();
    await infusionsRequest;
    await scheduledRequest;
  });

  assert.deepEqual(serverMedications.infusions, ["norepinephrine"]);
  assert.deepEqual(serverMedications.scheduled, ["levetiracetam"]);
  assert.deepEqual(patientsRef.current[0]?.medications.infusions, ["norepinephrine"]);
  assert.deepEqual(patientsRef.current[0]?.medications.scheduled, ["levetiracetam"]);
});

test("a failed collapse-all request restores only collapse state and preserves newer patient edits", async () => {
  setupAuthMock();
  const patientsRef = { current: [{ ...mockPatient, collapsed: false }] };
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    patientsRef.current = typeof action === "function"
      ? (action as (previous: Patient[]) => Patient[])(patientsRef.current)
      : action;
  };
  let resolveCollapse!: (result: { error: Error | null }) => void;
  (globalThis as unknown as {
    __SUPABASE_UPDATE_MOCK__?: (request: { data: Record<string, unknown> }) => Promise<{ error: Error | null }> | { error: null };
  }).__SUPABASE_UPDATE_MOCK__ = ({ data }) => {
    if (data.collapsed === true) {
      return new Promise((resolve) => {
        resolveCollapse = resolve;
      });
    }
    return { error: null };
  };
  const { wrapper } = createAuthQueryWrapper();
  const { result } = renderHook(() => useMutationsWithAuth({
    patientsRef,
    setPatients,
    patientCounter: 1,
    setPatientCounter: () => {},
    fetchPatients: async () => {},
  }), { wrapper });

  await waitForAuthSession(result);

  let collapseRequest!: Promise<void>;
  await act(async () => {
    collapseRequest = result.current.collapseAll();
    await Promise.resolve();
    await result.current.updatePatient("existing-id", "name", "Newer name");
  });
  await act(async () => {
    resolveCollapse({ error: new Error("collapse failed") });
    await collapseRequest;
  });

  assert.equal(patientsRef.current[0]?.collapsed, false);
  assert.equal(patientsRef.current[0]?.name, "Newer name");
});

test("imaging updates delete superseded objects only after persistence succeeds", async () => {
  setupAuthMock();
  const oldKey = "test-user-id/old.png";
  const newKey = "test-user-id/new.png";
  const patientsRef = {
    current: [{ ...mockPatient, imaging: `<img data-patient-image-key="${oldKey}">` }],
  };
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    patientsRef.current = typeof action === "function"
      ? (action as (previous: Patient[]) => Patient[])(patientsRef.current)
      : action;
  };
  const { wrapper } = createAuthQueryWrapper();
  const { result } = renderHook(() => useMutationsWithAuth({
    patientsRef,
    setPatients,
    patientCounter: 1,
    setPatientCounter: () => {},
    fetchPatients: async () => {},
  }), { wrapper });

  await waitForAuthSession(result);
  await act(async () => {
    await result.current.updatePatient(
      "existing-id",
      "imaging",
      `<img data-patient-image-key="${newKey}">`,
    );
  });

  const removals = (globalThis as unknown as {
    __supabaseStorageRemoveCapture?: Array<{ bucket: string; paths: string[] }>;
  }).__supabaseStorageRemoveCapture ?? [];
  assert.deepEqual(removals, [{ bucket: "patient-images", paths: [oldKey] }]);
});

test("failed imaging persistence removes only the uncommitted upload and restores the old reference", async () => {
  setupAuthMock();
  const oldKey = "test-user-id/old.png";
  const newKey = "test-user-id/uncommitted.png";
  const oldImaging = `<img data-patient-image-key="${oldKey}">`;
  const patientsRef = { current: [{ ...mockPatient, imaging: oldImaging }] };
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    patientsRef.current = typeof action === "function"
      ? (action as (previous: Patient[]) => Patient[])(patientsRef.current)
      : action;
  };
  (globalThis as unknown as { __SUPABASE_UPDATE_MOCK__?: () => { error: Error } }).__SUPABASE_UPDATE_MOCK__ = () => ({
    error: new Error("forced imaging failure"),
  });
  const { wrapper } = createAuthQueryWrapper();
  const { result } = renderHook(() => useMutationsWithAuth({
    patientsRef,
    setPatients,
    patientCounter: 1,
    setPatientCounter: () => {},
    fetchPatients: async () => {},
  }), { wrapper });

  await waitForAuthSession(result);
  await act(async () => {
    await result.current.updatePatient(
      "existing-id",
      "imaging",
      `<img data-patient-image-key="${newKey}">`,
    );
  });

  const removals = (globalThis as unknown as {
    __supabaseStorageRemoveCapture?: Array<{ bucket: string; paths: string[] }>;
  }).__supabaseStorageRemoveCapture ?? [];
  assert.equal(patientsRef.current[0]?.imaging, oldImaging);
  assert.deepEqual(removals, [{ bucket: "patient-images", paths: [newKey] }]);
});

test("patient deletion preserves an image object still referenced by another patient", async () => {
  setupAuthMock();
  const sharedKey = "test-user-id/shared.png";
  const sharedImaging = `<img data-patient-image-key="${sharedKey}">`;
  const patientsRef = {
    current: [
      { ...mockPatient, imaging: sharedImaging },
      { ...mockPatient, id: "copy-id", patientNumber: 2, imaging: sharedImaging },
    ],
  };
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    patientsRef.current = typeof action === "function"
      ? (action as (previous: Patient[]) => Patient[])(patientsRef.current)
      : action;
  };
  const { wrapper } = createAuthQueryWrapper();
  const { result } = renderHook(() => useMutationsWithAuth({
    patientsRef,
    setPatients,
    patientCounter: 2,
    setPatientCounter: () => {},
    fetchPatients: async () => {},
  }), { wrapper });

  await waitForAuthSession(result);
  await act(async () => {
    await result.current.removePatient("existing-id");
  });

  assert.deepEqual(patientsRef.current.map((patient) => patient.id), ["copy-id"]);
  assert.deepEqual(
    (globalThis as unknown as { __supabaseStorageRemoveCapture?: unknown[] }).__supabaseStorageRemoveCapture ?? [],
    [],
  );
});

test("patient deletion removes image objects that are no longer referenced", async () => {
  setupAuthMock();
  const onlyKey = "test-user-id/only.png";
  const patientsRef = {
    current: [{ ...mockPatient, imaging: `<img data-patient-image-key="${onlyKey}">` }],
  };
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    patientsRef.current = typeof action === "function"
      ? (action as (previous: Patient[]) => Patient[])(patientsRef.current)
      : action;
  };
  const { wrapper } = createAuthQueryWrapper();
  const { result } = renderHook(() => useMutationsWithAuth({
    patientsRef,
    setPatients,
    patientCounter: 1,
    setPatientCounter: () => {},
    fetchPatients: async () => {},
  }), { wrapper });

  await waitForAuthSession(result);
  await act(async () => {
    await result.current.removePatient("existing-id");
  });

  assert.deepEqual(
    (globalThis as unknown as {
      __supabaseStorageRemoveCapture?: Array<{ bucket: string; paths: string[] }>;
    }).__supabaseStorageRemoveCapture,
    [{ bucket: "patient-images", paths: [onlyKey] }],
  );
});

test("clearing all patients removes each owner image object once after the database delete", async () => {
  setupAuthMock();
  const firstKey = "test-user-id/first.png";
  const secondKey = "test-user-id/second.png";
  const patientsRef = {
    current: [
      {
        ...mockPatient,
        imaging:
          `<img data-patient-image-key="${firstKey}">` +
          `<img data-patient-image-key="${secondKey}">`,
      },
      {
        ...mockPatient,
        id: "copy-id",
        patientNumber: 2,
        imaging: `<img data-patient-image-key="${firstKey}">`,
      },
    ],
  };
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    patientsRef.current = typeof action === "function"
      ? (action as (previous: Patient[]) => Patient[])(patientsRef.current)
      : action;
  };
  const { wrapper } = createAuthQueryWrapper();
  const { result } = renderHook(() => useMutationsWithAuth({
    patientsRef,
    setPatients,
    patientCounter: 2,
    setPatientCounter: () => {},
    fetchPatients: async () => {},
  }), { wrapper });

  await waitForAuthSession(result);
  await act(async () => {
    await result.current.clearAll();
  });

  assert.deepEqual(patientsRef.current, []);
  assert.deepEqual(
    (globalThis as unknown as {
      __supabaseStorageRemoveCapture?: Array<{ bucket: string; paths: string[] }>;
    }).__supabaseStorageRemoveCapture,
    [{ bucket: "patient-images", paths: [firstKey, secondKey] }],
  );
});

test("usePatientMutations removePatient scopes patient and todo cache updates to the removed patient", async () => {
  setupAuthMock();
  const remainingPatient = { ...mockPatient, id: "remaining-id", name: "Remaining", patientNumber: 2 };
  const patientsRef = { current: [{ ...mockPatient }, remainingPatient] };
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    if (typeof fn === "function") patientsRef.current = (fn as (prev: Patient[]) => Patient[])(patientsRef.current);
    else patientsRef.current = fn as Patient[];
  };
  const setPatientCounter = () => {};
  const fetchPatients = async () => {};
  const { queryClient, wrapper } = createAuthQueryWrapper();
  queryClient.setQueryData(QUERY_KEYS.patientList("test-user-id"), patientsRef.current);
  queryClient.setQueryData(QUERY_KEYS.patientTodosForOwner("test-user-id", "existing-id"), [
    {
      id: "todo-1",
      patientId: "existing-id",
      userId: "test-user-id",
      section: null,
      content: "Removed patient todo",
      completed: false,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
  ]);
  queryClient.setQueryData(QUERY_KEYS.patientTodosForOwner("other-user-id", "existing-id"), [
    {
      id: "other-owner-todo",
      patientId: "existing-id",
      userId: "other-user-id",
      section: null,
      content: "Other owner's todo",
      completed: false,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
  ]);
  queryClient.setQueryData([...QUERY_KEYS.allTodos, "test-user-id", "existing-id|remaining-id"], {
    "existing-id": [],
    "remaining-id": [],
  });

  const { result } = renderHook(() => ({
    auth: useAuth(),
    mutations: usePatientMutations({
      patientsRef,
      setPatients,
      patientCounter: 2,
      setPatientCounter,
      fetchPatients,
    }),
  }),
  { wrapper }
  );

  await waitFor(() => {
    assert.equal(result.current.auth.user?.id, "test-user-id");
  });
  await act(async () => {
    await result.current.mutations.removePatient("existing-id");
  });

  assert.deepEqual(queryClient.getQueryData<Patient[]>(QUERY_KEYS.patientList("test-user-id"))?.map((patient) => patient.id), ["remaining-id"]);
  assert.equal(
    queryClient.getQueryData(QUERY_KEYS.patientTodosForOwner("test-user-id", "existing-id")),
    undefined,
  );
  assert.equal(
    queryClient.getQueryData<Array<{ id: string }>>(
      QUERY_KEYS.patientTodosForOwner("other-user-id", "existing-id"),
    )?.[0]?.id,
    "other-owner-todo",
  );
  assert.deepEqual(
    queryClient.getQueryData([...QUERY_KEYS.allTodos, "test-user-id", "existing-id|remaining-id"]),
    { "remaining-id": [] },
  );
});

test("usePatientMutations returns addPatient, updatePatient, removePatient, duplicatePatient, toggleCollapse, collapseAll, clearAll", () => {
  setupAuthMock();
  const patientsRef = { current: [] as Patient[] };
  const setPatients = () => {};
  const setPatientCounter = () => {};
  const fetchPatients = async () => {};
  const { wrapper } = createAuthQueryWrapper();

  const { result } = renderHook(() =>
    useMutationsWithAuth({
      patientsRef,
      setPatients,
      patientCounter: 1,
      setPatientCounter,
      fetchPatients,
      }),
    { wrapper }
  );

  assert.equal(typeof result.current.addPatient, "function");
  assert.equal(typeof result.current.updatePatient, "function");
  assert.equal(typeof result.current.removePatient, "function");
  assert.equal(typeof result.current.duplicatePatient, "function");
  assert.equal(typeof result.current.toggleCollapse, "function");
  assert.equal(typeof result.current.collapseAll, "function");
  assert.equal(typeof result.current.clearAll, "function");
});
