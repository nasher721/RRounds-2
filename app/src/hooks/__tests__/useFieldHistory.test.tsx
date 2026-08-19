import * as React from "react";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useFieldHistory } from "@/hooks/useFieldHistory";

afterEach(() => {
  cleanup();
  delete (globalThis as unknown as { __SUPABASE_AUTH_MOCK__?: unknown }).__SUPABASE_AUTH_MOCK__;
  delete (globalThis as unknown as { __SUPABASE_SELECT_MOCK__?: unknown }).__SUPABASE_SELECT_MOCK__;
  delete (globalThis as unknown as { __SUPABASE_INSERT_MOCK__?: unknown }).__SUPABASE_INSERT_MOCK__;
  delete (globalThis as unknown as { __SUPABASE_DELETE_MOCK__?: unknown }).__SUPABASE_DELETE_MOCK__;
});

function setupAuthenticatedUser() {
  (globalThis as unknown as { __SUPABASE_AUTH_MOCK__?: unknown }).__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({
      data: { session: { user: { id: "owner-1" } } },
      error: null,
    }),
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

test("clearHistory preserves visible history when Supabase returns a delete error", async () => {
  setupAuthenticatedUser();
  (globalThis as unknown as { __SUPABASE_SELECT_MOCK__?: unknown }).__SUPABASE_SELECT_MOCK__ = () => ({
    data: [{
      id: "history-1",
      patient_id: "patient-1",
      user_id: "owner-1",
      field_name: "systems.neuro",
      old_value: "old",
      new_value: "new",
      changed_at: "2026-07-11T00:00:00.000Z",
    }],
    error: null,
  });
  (globalThis as unknown as { __SUPABASE_DELETE_MOCK__?: unknown }).__SUPABASE_DELETE_MOCK__ = () => ({
    data: null,
    error: new Error("delete rejected"),
  });

  const { result } = renderHook(() => ({
    auth: useAuth(),
    fieldHistory: useFieldHistory("patient-1"),
  }), { wrapper });
  await waitFor(() => assert.equal(result.current.auth.user?.id, "owner-1"));
  await act(async () => { await result.current.fieldHistory.fetchHistory(); });
  assert.equal(result.current.fieldHistory.history.length, 1);

  let cleared: boolean | undefined;
  await act(async () => { cleared = await result.current.fieldHistory.clearHistory(); });

  assert.equal(cleared, false);
  assert.equal(result.current.fieldHistory.history.length, 1);
  assert.equal(result.current.fieldHistory.history[0]?.newValue, "new");
});

test("addHistoryEntry reports a returned Supabase insert error", async () => {
  setupAuthenticatedUser();
  (globalThis as unknown as { __SUPABASE_INSERT_MOCK__?: unknown }).__SUPABASE_INSERT_MOCK__ = () => ({
    data: null,
    error: new Error("insert rejected"),
  });

  const { result } = renderHook(() => ({
    auth: useAuth(),
    fieldHistory: useFieldHistory("patient-1"),
  }), { wrapper });
  await waitFor(() => assert.equal(result.current.auth.user?.id, "owner-1"));

  let inserted: boolean | undefined;
  await act(async () => {
    inserted = await result.current.fieldHistory.addHistoryEntry("systems.neuro", "old", "new");
  });
  assert.equal(inserted, false);
});
