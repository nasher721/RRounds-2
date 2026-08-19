import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { AuthProvider } from "@/hooks/useAuth";
import { useCacheWarming } from "@/hooks/useCacheWarming";
import { QUERY_KEYS } from "@/lib/cache/cacheConfig";

type SelectQuery = {
  table: string;
  filters: Array<{ op: string; column: string; value?: unknown }>;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

declare global {
  var __SUPABASE_AUTH_MOCK__: unknown;
  var __SUPABASE_SELECT_MOCK__: unknown;
}

afterEach(() => {
  cleanup();
  delete globalThis.__SUPABASE_AUTH_MOCK__;
  delete globalThis.__SUPABASE_SELECT_MOCK__;
});

test("late user A warming cannot write into user B caches or progress", async () => {
  let activeUserId = "user-a";
  let authStateCallback:
    | ((event: string, session: { user: { id: string } }) => void)
    | undefined;
  const userAPatients = deferred<{ data: unknown[]; error: null }>();

  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: activeUserId } } }, error: null }),
    onAuthStateChange: (callback: typeof authStateCallback) => {
      authStateCallback = callback;
      return { unsubscribe: () => {} };
    },
  };

  globalThis.__SUPABASE_SELECT_MOCK__ = (query: SelectQuery) => {
    const userId = query.filters.find((filter) => filter.column === "user_id")?.value;
    if (query.table === "patients" && userId === "user-a") {
      return userAPatients.promise;
    }

    return {
      data: [{
        id: `${String(userId)}-${query.table}`,
        user_id: userId,
        patient_number: 1,
        name: userId === "user-b" ? "B patient" : "A private data",
        bed: "",
        clinical_summary: "",
        interval_events: "",
        imaging: "",
        labs: "",
        systems: {},
        medications: {},
        field_timestamps: {},
        collapsed: false,
        created_at: "2026-01-01T00:00:00.000Z",
        last_modified: null,
      }],
      error: null,
    };
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );

  const { result } = renderHook(() => useCacheWarming(), { wrapper });
  await waitFor(() => assert.equal(result.current.isWarming, true));

  assert.ok(authStateCallback, "auth listener should be registered");
  activeUserId = "user-b";
  await act(async () => {
    authStateCallback!("SIGNED_IN", { user: { id: "user-b" } });
  });

  await waitFor(() => {
    const patients = queryClient.getQueryData<Array<{ name: string }>>(
      QUERY_KEYS.patientList("user-b"),
    );
    assert.equal(patients?.[0]?.name, "B patient");
    assert.equal(result.current.isWarming, false);
    assert.equal(result.current.progress?.completed, 5);
  });

  await act(async () => {
    userAPatients.resolve({
      data: [{
        id: "a-patient",
        user_id: "user-a",
        patient_number: 1,
        name: "A private data",
        bed: "",
        clinical_summary: "",
        interval_events: "",
        imaging: "",
        labs: "",
        systems: {},
        medications: {},
        field_timestamps: {},
        collapsed: false,
        created_at: "2026-01-01T00:00:00.000Z",
        last_modified: null,
      }],
      error: null,
    });
    await Promise.resolve();
  });

  assert.equal(result.current.progress?.completed, 5);
  assert.equal(
    queryClient.getQueryData(QUERY_KEYS.patientList("user-a")),
    undefined,
    "the late A response must be discarded",
  );
  assert.equal(
    queryClient.getQueryData(QUERY_KEYS.patients),
    undefined,
    "warming must never seed an unscoped patient cache",
  );

  const serializedCache = JSON.stringify(
    queryClient.getQueryCache().getAll().map((query) => query.state.data),
  );
  assert.doesNotMatch(serializedCache, /A private data/);
  queryClient.clear();
});
