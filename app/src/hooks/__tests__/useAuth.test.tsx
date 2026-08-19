import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { createRoot } from "react-dom/client";

// DOM is provided by scripts/test-setup.mjs (jsdom) when running via npm test
if (typeof global.window !== "undefined" && typeof global.window.requestAnimationFrame === "undefined") {
  global.window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}

async function waitForCondition(condition: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) {
      throw new Error(`Condition was not met within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test("useAuth throws when used outside AuthProvider", async () => {
  globalThis.__SUPABASE_AUTH_MOCK__ = { getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ unsubscribe: () => {} }) };
  const { useAuth } = await import("@/hooks/useAuth");
  const Comp = () => {
    useAuth();
    return null;
  };
  class ErrorBoundary extends React.Component<{ children: React.ReactNode; onError: (e: Error) => void }, { error: Error | null }> {
    state = { error: null as Error | null };
    static getDerivedStateFromError(error: Error) {
      return { error };
    }
    componentDidCatch(error: Error) {
      this.props.onError(error);
    }
    render() {
      if (this.state.error) return null;
      return this.props.children;
    }
  }
  let caught: Error | null = null;
  const div = document.createElement("div");
  const root = createRoot(div);
  root.render(
    <ErrorBoundary onError={(e) => { caught = e; }}>
      <Comp />
    </ErrorBoundary>
  );
  await new Promise((r) => setTimeout(r, 80));
  root.unmount();
  assert.ok(caught?.message?.includes("AuthProvider"), "useAuth should throw when used outside AuthProvider");
});

test("useAuth: when no session, user is null and loading becomes false", async () => {
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
  const { useAuth, AuthProvider } = await import("@/hooks/useAuth");
  let captured = { user: undefined, loading: true };
  const Capture = () => {
    const auth = useAuth();
    captured = { user: auth.user, loading: auth.loading };
    return null;
  };
  const div = document.createElement("div");
  const root = createRoot(div);
  root.render(
    <AuthProvider>
      <Capture />
    </AuthProvider>
  );
  await waitForCondition(() => captured.loading === false);
  assert.equal(captured.user, null);
  assert.equal(captured.loading, false);
  root.unmount();
});

test("useAuth: when mock returns a session, user is set", async () => {
  const mockUser = { id: "user-1", email: "test@example.com" };
  const mockSession = { user: mockUser };
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: mockSession }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
  const { useAuth, AuthProvider } = await import("@/hooks/useAuth");
  let captured = { user: null };
  const Capture = () => {
    const auth = useAuth();
    captured = { user: auth.user };
    return null;
  };
  const div = document.createElement("div");
  const root = createRoot(div);
  root.render(
    <AuthProvider>
      <Capture />
    </AuthProvider>
  );
  await waitForCondition(() => captured.user !== null);
  assert.ok(captured.user, "user should be set from mock session");
  assert.equal(captured.user?.id, "user-1");
  assert.equal(captured.user?.email, "test@example.com");
  root.unmount();
});

test("useAuth: a stalled bootstrap restores an unexpired cached session within the app deadline", async () => {
  const cachedUser = { id: "cached-user", email: "cached@example.com" };
  const cachedSession = {
    access_token: "cached-access-token",
    refresh_token: "cached-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 600,
    token_type: "bearer",
    user: cachedUser,
  };
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: () => new Promise(() => undefined),
    readCachedSessionForBootstrap: () => cachedSession,
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };

  const { useAuth, AuthProvider } = await import("@/hooks/useAuth");
  let captured: ReturnType<typeof useAuth> | null = null;
  const Capture = () => {
    captured = useAuth();
    return null;
  };
  const div = document.createElement("div");
  const root = createRoot(div);
  root.render(
    <AuthProvider bootstrapTimeoutMs={20}>
      <Capture />
    </AuthProvider>,
  );

  await waitForCondition(() => captured?.loading === false, 500);
  assert.equal(captured?.user?.id, cachedUser.id);
  assert.equal(captured?.session?.access_token, cachedSession.access_token);
  root.unmount();
});

test("useAuth: an eventual authoritative sign-out supersedes cached bootstrap recovery", async () => {
  const cachedSession = {
    access_token: "cached-access-token",
    refresh_token: "cached-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 600,
    token_type: "bearer",
    user: { id: "cached-user", email: "cached@example.com" },
  };
  let resolveSession!: (result: { data: { session: null }; error: null }) => void;
  const pendingSession = new Promise<{ data: { session: null }; error: null }>((resolve) => {
    resolveSession = resolve;
  });
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: () => pendingSession,
    readCachedSessionForBootstrap: () => cachedSession,
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };

  const { useAuth, AuthProvider } = await import("@/hooks/useAuth");
  let captured: ReturnType<typeof useAuth> | null = null;
  const Capture = () => {
    captured = useAuth();
    return null;
  };
  const div = document.createElement("div");
  const root = createRoot(div);
  root.render(<AuthProvider bootstrapTimeoutMs={20}><Capture /></AuthProvider>);

  await waitForCondition(() => captured?.user?.id === "cached-user", 500);
  resolveSession({ data: { session: null }, error: null });
  await waitForCondition(() => captured?.loading === false && captured?.user === null, 1_000);
  root.unmount();
});

test("useAuth: failed INITIAL_SESSION does not erase cached recovery but SIGNED_OUT does", async () => {
  const cachedSession = {
    access_token: "cached-access-token",
    refresh_token: "cached-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 600,
    token_type: "bearer",
    user: { id: "cached-user", email: "cached@example.com" },
  };
  let authStateCallback: ((event: string, session: unknown) => void) | null = null;
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: () => new Promise(() => undefined),
    readCachedSessionForBootstrap: () => cachedSession,
    onAuthStateChange: (callback) => {
      authStateCallback = callback;
      return { unsubscribe: () => {} };
    },
  };

  const { useAuth, AuthProvider } = await import("@/hooks/useAuth");
  let captured: ReturnType<typeof useAuth> | null = null;
  const Capture = () => {
    captured = useAuth();
    return null;
  };
  const div = document.createElement("div");
  const root = createRoot(div);
  root.render(<AuthProvider bootstrapTimeoutMs={20}><Capture /></AuthProvider>);

  await waitForCondition(() => captured?.user?.id === "cached-user", 500);
  authStateCallback!("INITIAL_SESSION", null);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(captured?.user?.id, "cached-user");

  authStateCallback!("SIGNED_OUT", null);
  await waitForCondition(() => captured?.user === null, 1_000);
  root.unmount();
});

test("useAuth: a rejected bootstrap releases public routes without deleting local clinical state", async () => {
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => {
      throw new Error("simulated auth outage");
    },
    readCachedSessionForBootstrap: () => null,
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };

  const { useAuth, AuthProvider } = await import("@/hooks/useAuth");

  let captured: ReturnType<typeof useAuth> | null = null;
  let authBoundaries = 0;
  const Capture = () => {
    captured = useAuth();
    return null;
  };
  const div = document.createElement("div");
  const root = createRoot(div);
  root.render(
    <AuthProvider
      bootstrapTimeoutMs={20}
      onAuthBoundary={() => {
        authBoundaries += 1;
      }}
    >
      <Capture />
    </AuthProvider>,
  );

  await waitForCondition(() => captured?.loading === false, 500);
  assert.equal(captured?.user, null);
  assert.equal(authBoundaries, 0, "a transient auth failure must not be treated as an authoritative sign-out");
  root.unmount();
});

test("useAuth: signOut clears user when listener fires", async () => {
  const mockUser = { id: "user-2", email: "u2@example.com" };
  let authStateCallback = null;
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: mockUser } }, error: null }),
    onAuthStateChange: (cb) => {
      authStateCallback = cb;
      return { unsubscribe: () => {} };
    },
    signOut: async () => {
      if (authStateCallback) authStateCallback("SIGNED_OUT", null);
    },
  };
  const { useAuth, AuthProvider } = await import("@/hooks/useAuth");
  let captured = { user: null };
  const Capture = () => {
    const auth = useAuth();
    captured = { user: auth.user, signOut: auth.signOut };
    return null;
  };
  const div = document.createElement("div");
  const root = createRoot(div);
  root.render(
    <AuthProvider>
      <Capture />
    </AuthProvider>
  );
  await new Promise((r) => setTimeout(r, 120));
  assert.ok(captured.user, "user should be set before signOut");
  await captured.signOut();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(captured.user, null, "user should be cleared after signOut");
  root.unmount();
});

test("useAuth: a remote sign-out error still clears the local session and sensitive queue", async () => {
  const mockUser = { id: "user-signout-error", email: "error@example.com" };
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: mockUser } }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
    signOut: async () => ({ error: new Error("sign-out rejected") }),
  };
  const { useAuth, AuthProvider } = await import("@/hooks/useAuth");
  const { indexedDBQueue } = await import("@/lib/offline/indexedDBQueue");
  let captured: ReturnType<typeof useAuth> | null = null;
  const Capture = () => {
    captured = useAuth();
    return null;
  };
  const div = document.createElement("div");
  const root = createRoot(div);
  root.render(<AuthProvider><Capture /></AuthProvider>);
  await new Promise((resolve) => setTimeout(resolve, 100));

  await indexedDBQueue.enqueue({
    type: "patient",
    operation: "update",
    table: "patients",
    entityId: "patient-a",
    payload: { diagnosis: "keep me" },
  });
  await assert.rejects(() => captured!.signOut(), /sign-out rejected/);

  assert.equal(captured!.user, null);
  assert.deepEqual(await indexedDBQueue.getQueue(), []);
  root.unmount();
  await indexedDBQueue.clear();
});

test("useAuth: same-user refresh preserves work and A-to-B transition isolates it", async () => {
  const userA = { id: "user-a", email: "a@example.com" };
  const userB = { id: "user-b", email: "b@example.com" };
  let authStateCallback: ((event: string, session: unknown) => void) | null = null;
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: userA } }, error: null }),
    onAuthStateChange: (callback) => {
      authStateCallback = callback;
      return { unsubscribe: () => {} };
    },
  };
  const { useAuth, AuthProvider } = await import("@/hooks/useAuth");
  const { indexedDBQueue } = await import("@/lib/offline/indexedDBQueue");
  let captured: ReturnType<typeof useAuth> | null = null;
  const Capture = () => {
    captured = useAuth();
    return null;
  };
  const div = document.createElement("div");
  const root = createRoot(div);
  root.render(<AuthProvider><Capture /></AuthProvider>);
  await new Promise((resolve) => setTimeout(resolve, 100));

  const userAMutation = await indexedDBQueue.enqueue({
    type: "patient",
    operation: "update",
    table: "patients",
    entityId: "patient-a",
    payload: { diagnosis: "A only" },
  });
  authStateCallback!("TOKEN_REFRESHED", { user: userA });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal((await indexedDBQueue.getQueue())[0]?.id, userAMutation);

  authStateCallback!("SIGNED_IN", { user: userB });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(captured!.user?.id, "user-b");
  assert.deepEqual(await indexedDBQueue.getQueue(), []);

  const userBMutation = await indexedDBQueue.enqueue({
    type: "patient",
    operation: "update",
    table: "patients",
    entityId: "patient-b",
    payload: { diagnosis: "B only" },
  });
  assert.equal((await indexedDBQueue.getQueue())[0]?.id, userBMutation);
  assert.equal((await indexedDBQueue.getQueue())[0]?.ownerId, "user-b");
  root.unmount();
  await indexedDBQueue.clear();
});
