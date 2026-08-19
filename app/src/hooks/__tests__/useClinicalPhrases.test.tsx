import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useClinicalPhrases } from "@/hooks/useClinicalPhrases";

const phraseRow = {
  id: "phrase-1",
  user_id: "owner-1",
  folder_id: null,
  name: "Neuro exam",
  description: null,
  content: "baseline",
  shortcut: ".neuro",
  hotkey: null,
  context_triggers: {},
  is_active: true,
  is_shared: false,
  usage_count: 3,
  last_used_at: null,
  version: 1,
  created_at: "2026-07-11T00:00:00.000Z",
  updated_at: "2026-07-11T00:00:00.000Z",
};

function setup() {
  (globalThis as unknown as { __SUPABASE_AUTH_MOCK__?: unknown }).__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({
      data: { session: { user: { id: "owner-1" } } },
      error: null,
    }),
    getUser: async () => {
      throw new Error("useClinicalPhrases must not validate the user over the network");
    },
  };
  (globalThis as unknown as { __SUPABASE_SELECT_MOCK__?: unknown }).__SUPABASE_SELECT_MOCK__ = (
    query: { table: string },
  ) => ({
    data: query.table === "clinical_phrases" ? [phraseRow] : [],
    error: null,
  });
}

afterEach(() => {
  cleanup();
  for (const key of [
    "__SUPABASE_AUTH_MOCK__",
    "__SUPABASE_SELECT_MOCK__",
    "__SUPABASE_UPDATE_MOCK__",
    "__SUPABASE_INSERT_MOCK__",
    "__SUPABASE_RPC_MOCK__",
  ]) {
    delete (globalThis as Record<string, unknown>)[key];
  }
  (globalThis as unknown as { __supabaseInsertCapture?: unknown[] }).__supabaseInsertCapture?.splice(0);
  (globalThis as unknown as { __supabaseUpdateCapture?: unknown[] }).__supabaseUpdateCapture?.splice(0);
  (globalThis as unknown as { __supabaseRpcCapture?: unknown[] }).__supabaseRpcCapture?.splice(0);
});

test("logUsage records usage through one atomic RPC and trusts the server count", async () => {
  setup();
  const lastUsedAt = "2026-07-12T12:34:56.000Z";
  (globalThis as unknown as { __SUPABASE_RPC_MOCK__?: unknown }).__SUPABASE_RPC_MOCK__ = (
    request: { name: string; args: Record<string, unknown> },
  ) => ({ data: [{ usage_count: 9, last_used_at: lastUsedAt }], error: null });
  const { result } = renderHook(() => useClinicalPhrases());
  await waitFor(() => assert.equal(result.current.loading, false));
  assert.equal(result.current.phrases[0]?.usageCount, 3);

  let logged: boolean | undefined;
  await act(async () => { logged = await result.current.logUsage("phrase-1", "patient-1", "systems.neuro"); });

  assert.equal(logged, true);
  assert.equal(result.current.phrases[0]?.usageCount, 9);
  assert.equal(result.current.phrases[0]?.lastUsedAt, lastUsedAt);
  assert.deepEqual(
    (globalThis as unknown as { __supabaseRpcCapture?: unknown[] }).__supabaseRpcCapture,
    [{
      name: "record_owned_phrase_usage",
      args: {
        p_phrase_id: "phrase-1",
        p_patient_id: "patient-1",
        p_target_field: "systems.neuro",
      },
    }],
  );
  assert.equal((globalThis as unknown as { __supabaseInsertCapture?: unknown[] }).__supabaseInsertCapture?.length, 0);
  assert.equal((globalThis as unknown as { __supabaseUpdateCapture?: unknown[] }).__supabaseUpdateCapture?.length, 0);
});

test("concurrent phrase consumers share one owner-scoped library request", async () => {
  setup();
  const pending: Array<() => void> = [];
  let selectCalls = 0;
  (globalThis as unknown as { __SUPABASE_SELECT_MOCK__?: unknown }).__SUPABASE_SELECT_MOCK__ = (
    query: { table: string },
  ) => new Promise((resolve) => {
    selectCalls += 1;
    pending.push(() => resolve({
      data: query.table === "clinical_phrases" ? [phraseRow] : [],
      error: null,
    }));
  });

  const first = renderHook(() => useClinicalPhrases());
  const second = renderHook(() => useClinicalPhrases());
  await waitFor(() => assert.equal(selectCalls, 2));

  await act(async () => {
    pending.forEach((resolve) => resolve());
  });
  await waitFor(() => assert.equal(first.result.current.loading, false));
  await waitFor(() => assert.equal(second.result.current.loading, false));

  assert.equal(selectCalls, 2);
  assert.equal(first.result.current.phrases[0]?.id, "phrase-1");
  assert.equal(second.result.current.phrases[0]?.id, "phrase-1");
});

test("logUsage keeps local usage unchanged when the atomic RPC fails", async () => {
  setup();
  (globalThis as unknown as { __SUPABASE_RPC_MOCK__?: unknown }).__SUPABASE_RPC_MOCK__ = () => ({
    data: null,
    error: new Error("usage transaction rejected"),
  });
  const { result } = renderHook(() => useClinicalPhrases());
  await waitFor(() => assert.equal(result.current.loading, false));

  let logged: boolean | undefined;
  await act(async () => { logged = await result.current.logUsage("phrase-1"); });

  assert.equal(logged, false);
  assert.equal(result.current.phrases[0]?.usageCount, 3);
  assert.equal((globalThis as unknown as { __supabaseInsertCapture?: unknown[] }).__supabaseInsertCapture?.length, 0);
  assert.equal((globalThis as unknown as { __supabaseUpdateCapture?: unknown[] }).__supabaseUpdateCapture?.length, 0);
});

test("updatePhrase aborts when version-history insertion returns an error", async () => {
  setup();
  (globalThis as unknown as { __SUPABASE_INSERT_MOCK__?: unknown }).__SUPABASE_INSERT_MOCK__ = (
    request: { table: string },
  ) => request.table === "phrase_versions"
    ? { data: null, error: new Error("version insert rejected") }
    : { data: null, error: null };
  const updateCalls: unknown[] = [];
  (globalThis as unknown as { __SUPABASE_UPDATE_MOCK__?: unknown }).__SUPABASE_UPDATE_MOCK__ = (request: unknown) => {
    updateCalls.push(request);
    return { error: null };
  };
  const { result } = renderHook(() => useClinicalPhrases());
  await waitFor(() => assert.equal(result.current.loading, false));

  let updated: boolean | undefined;
  await act(async () => { updated = await result.current.updatePhrase("phrase-1", { content: "changed" }); });

  assert.equal(updated, false);
  assert.deepEqual(updateCalls, []);
  assert.equal(result.current.phrases[0]?.content, "baseline");
});
