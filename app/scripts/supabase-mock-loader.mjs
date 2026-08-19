/**
 * Test-only loader: serves a mock Supabase client for @/integrations/supabase/client
 * so auth and hook tests run without real network. Configure via globalThis.__SUPABASE_AUTH_MOCK__.
 * Insert/update calls are captured on globalThis.__supabaseInsertCapture / __supabaseUpdateCapture.
 */
const MOCK_SPECIFIER = "file:///supabase-client-mock.js";
const ASSET_PNG_MOCK_SOURCE = "export default '/test.png';";
const PATIENT_FIXTURE = {
  id: "test-patient-id",
  patient_number: 1,
  name: "",
  bed: "",
  clinical_summary: "",
  interval_events: "",
  imaging: "",
  labs: "",
  systems: {},
  medications: {},
  field_timestamps: {},
  collapsed: false,
  created_at: "2024-01-01T00:00:00Z",
  last_modified: null,
  user_id: "test-user-id",
};
const MOCK_SOURCE = `
export const hasSupabaseConfig = true;
export const supabaseUrl = "http://test";
export const resolvedKey = "test-key";
export const supabaseAuthStorageKey = "sb-test-auth-token";
export const readCachedSessionForBootstrap = () => (
  globalThis.__SUPABASE_AUTH_MOCK__?.readCachedSessionForBootstrap?.() ?? null
);
const insertCapture = (globalThis.__supabaseInsertCapture = globalThis.__supabaseInsertCapture || []);
const updateCapture = (globalThis.__supabaseUpdateCapture = globalThis.__supabaseUpdateCapture || []);
const rpcCapture = (globalThis.__supabaseRpcCapture = globalThis.__supabaseRpcCapture || []);
const storageRemoveCapture = (globalThis.__supabaseStorageRemoveCapture = globalThis.__supabaseStorageRemoveCapture || []);
const fixture = ${JSON.stringify(PATIENT_FIXTURE)};

function resolveSelect(query) {
  const handler = globalThis.__SUPABASE_SELECT_MOCK__;
  if (typeof handler === "function") {
    return Promise.resolve(handler(query));
  }
  if (query.table === "patients") {
    return Promise.resolve({ data: [fixture], error: null });
  }
  if (query.table === "patient_todos") {
    return Promise.resolve({ data: [], error: null });
  }
  return Promise.resolve({ data: [], error: null });
}

function createSelectQuery(table, columns) {
  const query = { table, columns, filters: [], orders: [], limitCount: null, singleResult: false };
  const builder = {
    in(column, values) {
      query.filters.push({ op: "in", column, values });
      return builder;
    },
    eq(column, value) {
      query.filters.push({ op: "eq", column, value });
      return builder;
    },
    order(column, options) {
      query.orders.push({ column, options });
      return builder;
    },
    limit(count) {
      query.limitCount = count;
      return builder;
    },
    single() {
      query.singleResult = true;
      return resolveSelect(query).then((result) => {
        const data = Array.isArray(result?.data) ? (result.data[0] ?? null) : result?.data ?? null;
        return { data, error: result?.error ?? null };
      });
    },
    maybeSingle() {
      query.singleResult = true;
      return resolveSelect(query).then((result) => {
        const data = Array.isArray(result?.data) ? (result.data[0] ?? null) : result?.data ?? null;
        return { data, error: result?.error ?? null };
      });
    },
    then(resolve, reject) {
      return resolveSelect(query).then(resolve, reject);
    },
    catch(reject) {
      return resolveSelect(query).catch(reject);
    },
    finally(onFinally) {
      return resolveSelect(query).finally(onFinally);
    },
  };
  return builder;
}

export const supabase = {
  storage: {
    from(bucket) {
      return {
        async upload(path) {
          return { data: { path }, error: null };
        },
        async createSignedUrl(path) {
          return {
            data: { signedUrl: \`http://test/storage/v1/object/sign/\${bucket}/\${path}?token=test\` },
            error: null,
          };
        },
        async remove(paths) {
          storageRemoveCapture.push({ bucket, paths });
          const handler = globalThis.__SUPABASE_STORAGE_REMOVE_MOCK__;
          if (typeof handler === "function") {
            return Promise.resolve(handler({ bucket, paths }));
          }
          return { data: paths.map((name) => ({ name })), error: null };
        },
      };
    },
  },
  functions: {
    invoke: async (name, payload) => (
      globalThis.__SUPABASE_FUNCTIONS_INVOKE_MOCK__?.(name, payload)
      ?? { data: { success: true, data: { patients: [] } }, error: null }
    ),
  },
  async rpc(name, args) {
    rpcCapture.push({ name, args });
    const handler = globalThis.__SUPABASE_RPC_MOCK__;
    if (typeof handler === "function") {
      return handler({ name, args });
    }
    return { data: true, error: null };
  },
  from(table) {
    return {
      select(columns = "*") {
        return createSelectQuery(table, columns);
      },
      insert(rows) {
        insertCapture.push({ table, rows });
        const resolveInsert = () => {
          const handler = globalThis.__SUPABASE_INSERT_MOCK__;
          return Promise.resolve(
            typeof handler === "function"
              ? handler({ table, rows })
              : { data: table === "patients" ? fixture : null, error: null },
          );
        };
        const builder = {
          select() {
            return {
              single: () => resolveInsert().then((result) => ({
                data: result?.data ?? fixture,
                error: result?.error ?? null,
              })),
            };
          },
          then(resolve, reject) { return resolveInsert().then(resolve, reject); },
          catch(reject) { return resolveInsert().catch(reject); },
          finally(onFinally) { return resolveInsert().finally(onFinally); },
        };
        return builder;
      },
      upsert(rows) {
        const handler = globalThis.__SUPABASE_UPSERT_MOCK__;
        return Promise.resolve(
          typeof handler === "function"
            ? handler({ table, rows })
            : { data: null, error: null },
        );
      },
      update(data, options) {
        updateCapture.push({ table, data });
        const filters = [];
        const resolveUpdate = () => {
          const handler = globalThis.__SUPABASE_UPDATE_MOCK__;
          return Promise.resolve(
            typeof handler === "function"
              ? handler({ table, data, options, filters })
              : { data: { revision: 1 }, error: null, count: 1 },
          );
        };
        const builder = {
          eq(column, value) {
            filters.push({ op: "eq", column, value });
            return builder;
          },
          select() { return builder; },
          maybeSingle: () => resolveUpdate(),
          single: () => resolveUpdate(),
          then(resolve, reject) { return resolveUpdate().then(resolve, reject); },
          catch(reject) { return resolveUpdate().catch(reject); },
          finally(onFinally) { return resolveUpdate().finally(onFinally); },
        };
        return builder;
      },
      delete() {
        const filters = [];
        const resolveDelete = () => {
          const handler = globalThis.__SUPABASE_DELETE_MOCK__;
          return Promise.resolve(
            typeof handler === "function"
              ? handler({ table, filters })
              : { data: null, error: null },
          );
        };
        const builder = {
          eq(column, value) {
            filters.push({ op: "eq", column, value });
            return builder;
          },
          then(resolve, reject) { return resolveDelete().then(resolve, reject); },
          catch(reject) { return resolveDelete().catch(reject); },
          finally(onFinally) { return resolveDelete().finally(onFinally); },
        };
        return builder;
      },
    };
  },
  auth: {
    getSession: async () => (globalThis.__SUPABASE_AUTH_MOCK__?.getSession?.() ?? { data: { session: null }, error: null }),
    getUser: async () => (globalThis.__SUPABASE_AUTH_MOCK__?.getUser?.() ?? { data: { user: null }, error: null }),
    refreshSession: async () => (globalThis.__SUPABASE_AUTH_MOCK__?.refreshSession?.() ?? { data: { session: null }, error: null }),
    onAuthStateChange: (cb) => {
      (async () => {
        try {
          const res = await (globalThis.__SUPABASE_AUTH_MOCK__?.getSession?.() ?? Promise.resolve({ data: { session: null } }));
          setTimeout(() => cb("INITIAL_SESSION", res?.data?.session ?? null));
        } catch {
          // Production auth initialization absorbs retryable recovery failures;
          // tests should not manufacture an unrelated unhandled rejection.
        }
      })();
      const sub = globalThis.__SUPABASE_AUTH_MOCK__?.onAuthStateChange?.(cb) ?? { unsubscribe: () => {} };
      return { data: { subscription: sub } };
    },
    signInWithPassword: async (opts) => (globalThis.__SUPABASE_AUTH_MOCK__?.signInWithPassword?.(opts) ?? { error: null }),
    signUp: async (opts) => (globalThis.__SUPABASE_AUTH_MOCK__?.signUp?.(opts) ?? { error: null }),
    signOut: async () => (
      (await globalThis.__SUPABASE_AUTH_MOCK__?.signOut?.()) ?? { error: null }
    ),
  },
};
`;

export async function resolve(specifier, context, defaultResolve) {
  const norm = (specifier || "").replace(/\\/g, "/");
  if (norm === "@/integrations/supabase/client" || norm.endsWith("integrations/supabase/client") || norm.includes("integrations/supabase/client")) {
    return { url: MOCK_SPECIFIER, shortCircuit: true };
  }
  if (norm.endsWith(".png") || (norm.includes("assets/") && norm.includes(".png"))) {
    return { url: "file:///asset-png-mock.js", shortCircuit: true };
  }
  return defaultResolve(specifier, context);
}

function isClientModuleUrl(url) {
  if (!url || typeof url !== "string") return false;
  const p = url.replace(/^file:\/\//, "").replace(/\\/g, "/");
  return p.includes("integrations/supabase/client");
}

export async function load(url, context, defaultLoad) {
  if (url === MOCK_SPECIFIER || isClientModuleUrl(url)) {
    return { format: "module", source: MOCK_SOURCE, shortCircuit: true };
  }
  if (url === "file:///asset-png-mock.js" || (url && url.replace(/^file:\/\//, "").replace(/\\/g, "/").endsWith(".png"))) {
    return { format: "module", source: ASSET_PNG_MOCK_SOURCE, shortCircuit: true };
  }
  return defaultLoad(url, context, defaultLoad);
}
