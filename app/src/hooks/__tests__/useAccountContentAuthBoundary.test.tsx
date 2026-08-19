import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useCloudAutotexts } from "@/hooks/useAutotexts";
import { useCloudDictionary } from "@/hooks/useCloudDictionary";
import { supabase } from "@/integrations/supabase/client";

type QueryResult = { data: unknown[]; error: null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function setupAuthTransitionMock(initialUserId = "user-a") {
  let activeUserId = initialUserId;
  let authStateCallback:
    | ((event: string, session: { user: { id: string } }) => void)
    | undefined;

  (globalThis as typeof globalThis & { __SUPABASE_AUTH_MOCK__: unknown }).__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: activeUserId } } }, error: null }),
    onAuthStateChange: (callback: typeof authStateCallback) => {
      authStateCallback = callback;
      return { unsubscribe: () => {} };
    },
  };

  return {
    get activeUserId() {
      return activeUserId;
    },
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

declare global {
  // Supabase's test loader reads this hook to provide deterministic auth sessions.
  var __SUPABASE_AUTH_MOCK__: unknown;
}

afterEach(() => {
  cleanup();
  delete globalThis.__SUPABASE_AUTH_MOCK__;
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

test("account content hides user A immediately and ignores A responses after switching to user B", async () => {
  const auth = setupAuthTransitionMock();
  const pendingA = {
    autotexts: deferred<QueryResult>(),
    templates: deferred<QueryResult>(),
    dictionary: deferred<QueryResult>(),
  };
  const pendingB = {
    autotexts: deferred<QueryResult>(),
    templates: deferred<QueryResult>(),
    dictionary: deferred<QueryResult>(),
  };
  let deferUserARefetch = false;

  const supabaseWithMutableFrom = supabase as unknown as { from: (table: string) => unknown };
  const originalFrom = supabaseWithMutableFrom.from.bind(supabase);
  supabaseWithMutableFrom.from = (table: string) => ({
    select: () => {
      const key = table === "user_dictionary" ? "dictionary" : table;
      assert.ok(
        key === "autotexts" || key === "templates" || key === "dictionary",
        `unexpected table ${table}`,
      );

      if (auth.activeUserId === "user-a" && !deferUserARefetch) {
        if (key === "autotexts") {
          return Promise.resolve({
            data: [{ shortcut: "a-private", expansion: "A only", category: "custom" }],
            error: null,
          });
        }
        if (key === "templates") {
          return Promise.resolve({
            data: [{ id: "template-a", name: "A private", content: "A only", category: "custom" }],
            error: null,
          });
        }
        return Promise.resolve({
          data: [{ misspelling: "aprivate", correction: "A only" }],
          error: null,
        });
      }

      return auth.activeUserId === "user-a" ? pendingA[key].promise : pendingB[key].promise;
    },
  });

  try {
    const { result } = renderHook(() => ({
      auth: useAuth(),
      autotexts: useCloudAutotexts(),
      dictionary: useCloudDictionary(),
    }), { wrapper });

    await waitFor(() => {
      assert.equal(result.current.auth.user?.id, "user-a");
      assert.ok(result.current.autotexts.autotexts.some((entry) => entry.shortcut === "a-private"));
      assert.ok(result.current.autotexts.templates.some((entry) => entry.id === "template-a"));
      assert.equal(result.current.dictionary.customDictionary.aprivate, "A only");
    });

    deferUserARefetch = true;
    let pendingUserARefetch!: Promise<unknown>;
    await act(async () => {
      pendingUserARefetch = Promise.all([
        result.current.autotexts.refetch(),
        result.current.dictionary.refetch(),
      ]);
      await Promise.resolve();
    });

    await auth.transitionTo("user-b");
    await waitFor(() => assert.equal(result.current.auth.user?.id, "user-b"));

    assert.equal(
      result.current.autotexts.autotexts.some((entry) => entry.shortcut === "a-private"),
      false,
      "user B must not render user A's custom autotext while B is loading",
    );
    assert.equal(
      result.current.autotexts.templates.some((entry) => entry.id === "template-a"),
      false,
      "user B must not render user A's custom template while B is loading",
    );
    assert.deepEqual(
      result.current.dictionary.customDictionary,
      {},
      "user B must not render user A's dictionary while B is loading",
    );

    await act(async () => {
      pendingB.autotexts.resolve({
        data: [{ shortcut: "b-private", expansion: "B only", category: "custom" }],
        error: null,
      });
      pendingB.templates.resolve({
        data: [{ id: "template-b", name: "B private", content: "B only", category: "custom" }],
        error: null,
      });
      pendingB.dictionary.resolve({
        data: [{ misspelling: "bprivate", correction: "B only" }],
        error: null,
      });
    });

    await waitFor(() => {
      assert.ok(result.current.autotexts.autotexts.some((entry) => entry.shortcut === "b-private"));
      assert.ok(result.current.autotexts.templates.some((entry) => entry.id === "template-b"));
      assert.equal(result.current.dictionary.customDictionary.bprivate, "B only");
    });

    await act(async () => {
      pendingA.autotexts.resolve({
        data: [{ shortcut: "late-a", expansion: "Late A", category: "custom" }],
        error: null,
      });
      pendingA.templates.resolve({
        data: [{ id: "late-template-a", name: "Late A", content: "Late A", category: "custom" }],
        error: null,
      });
      pendingA.dictionary.resolve({
        data: [{ misspelling: "latea", correction: "Late A" }],
        error: null,
      });
      await pendingUserARefetch;
    });

    assert.equal(result.current.autotexts.autotexts.some((entry) => entry.shortcut === "late-a"), false);
    assert.equal(result.current.autotexts.templates.some((entry) => entry.id === "late-template-a"), false);
    assert.equal(result.current.dictionary.customDictionary.latea, undefined);
    assert.ok(result.current.autotexts.autotexts.some((entry) => entry.shortcut === "b-private"));
    assert.equal(result.current.dictionary.customDictionary.bprivate, "B only");
  } finally {
    supabaseWithMutableFrom.from = originalFrom;
  }
});

test("dictionary import stops before the next chunk when the authenticated owner changes", async () => {
  const auth = setupAuthTransitionMock();
  const firstChunk = deferred<{ error: null }>();
  const upsertedChunks: Array<Array<{ user_id: string; misspelling: string; correction: string }>> = [];

  const supabaseWithMutableFrom = supabase as unknown as { from: (table: string) => unknown };
  const originalFrom = supabaseWithMutableFrom.from.bind(supabase);
  supabaseWithMutableFrom.from = (table: string) => {
    assert.equal(table, "user_dictionary");
    return {
      select: () => Promise.resolve({ data: [], error: null }),
      upsert: (rows: Array<{ user_id: string; misspelling: string; correction: string }>) => {
        upsertedChunks.push(rows);
        return upsertedChunks.length === 1 ? firstChunk.promise : Promise.resolve({ error: null });
      },
    };
  };

  try {
    const { result } = renderHook(() => ({
      auth: useAuth(),
      dictionary: useCloudDictionary(),
    }), { wrapper });

    await waitFor(() => {
      assert.equal(result.current.auth.user?.id, "user-a");
      assert.equal(result.current.dictionary.loading, false);
    });

    const entries = Object.fromEntries(
      Array.from({ length: 150 }, (_, index) => [`mistake-${index}`, `correction-${index}`]),
    );
    let importPromise!: Promise<boolean>;
    await act(async () => {
      importPromise = result.current.dictionary.importDictionary(entries);
      await Promise.resolve();
    });
    assert.equal(upsertedChunks.length, 1);
    assert.equal(upsertedChunks[0].length, 100);
    assert.ok(upsertedChunks[0].every((entry) => entry.user_id === "user-a"));

    await auth.transitionTo("user-b");
    await waitFor(() => assert.equal(result.current.auth.user?.id, "user-b"));

    let importResult = true;
    await act(async () => {
      firstChunk.resolve({ error: null });
      importResult = await importPromise;
    });

    assert.equal(importResult, false);
    assert.equal(upsertedChunks.length, 1, "no later user-A chunks may run under user B");
    assert.deepEqual(result.current.dictionary.customDictionary, {});
  } finally {
    supabaseWithMutableFrom.from = originalFrom;
  }
});
