import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { cacheWarming } from "./cacheWarming";
import { QUERY_KEYS } from "./cacheConfig";

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
  var __SUPABASE_SELECT_MOCK__: unknown;
}

afterEach(() => {
  delete globalThis.__SUPABASE_SELECT_MOCK__;
});

test("essential warming uses owner-scoped keys for every user content type", async () => {
  globalThis.__SUPABASE_SELECT_MOCK__ = (query: SelectQuery) => ({
    data: query.table === "patients"
      ? [{
          id: "patient-a",
          user_id: "user-a",
          patient_number: 1,
          name: "Scoped patient",
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
        }]
      : [{ id: query.table, user_id: "user-a" }],
    error: null,
  });

  const queryClient = new QueryClient();
  await cacheWarming.warmEssential(queryClient, "user-a", () => true);

  assert.ok(queryClient.getQueryData(QUERY_KEYS.patientList("user-a")));
  assert.ok(queryClient.getQueryData(QUERY_KEYS.autotextList("user-a")));
  assert.ok(queryClient.getQueryData(QUERY_KEYS.clinicalPhraseList("user-a")));
  assert.ok(queryClient.getQueryData(QUERY_KEYS.templateList("user-a")));
  assert.ok(queryClient.getQueryData(QUERY_KEYS.userDictionaryList("user-a")));

  for (const unscopedKey of [
    QUERY_KEYS.patients,
    QUERY_KEYS.autotexts,
    QUERY_KEYS.clinicalPhrases,
    QUERY_KEYS.templates,
    QUERY_KEYS.userDictionary,
  ]) {
    assert.equal(queryClient.getQueryData(unscopedKey), undefined);
  }
  queryClient.clear();
});

test("essential warming reports safe partial-failure status", async () => {
  globalThis.__SUPABASE_SELECT_MOCK__ = () => ({
    data: null,
    error: new Error("database diagnostic with patient identifier 123456"),
  });

  const queryClient = new QueryClient();
  const progress = await cacheWarming.warmEssential(queryClient, "user-a", () => true);

  assert.ok(progress);
  assert.equal(progress.completed, 0);
  assert.equal(progress.errors.length, progress.total);
  assert.match(progress.errors[0], /could not be loaded/i);
  assert.doesNotMatch(progress.errors.join(" "), /diagnostic|123456/i);
  queryClient.clear();
});

test("every essential warmer rejects a late response before writing user A data", async () => {
  const scenarios = [
    {
      table: "patients",
      key: QUERY_KEYS.patientList("user-a"),
      run: (client: QueryClient, fence: () => boolean) => (
        cacheWarming.warmPatients(client, "user-a", fence)
      ),
    },
    {
      table: "autotexts",
      key: QUERY_KEYS.autotextList("user-a"),
      run: (client: QueryClient, fence: () => boolean) => (
        cacheWarming.warmAutotexts(client, "user-a", fence)
      ),
    },
    {
      table: "clinical_phrases",
      key: QUERY_KEYS.clinicalPhraseList("user-a"),
      run: (client: QueryClient, fence: () => boolean) => (
        cacheWarming.warmClinicalPhrases(client, "user-a", fence)
      ),
    },
    {
      table: "templates",
      key: QUERY_KEYS.templateList("user-a"),
      run: (client: QueryClient, fence: () => boolean) => (
        cacheWarming.warmTemplates(client, "user-a", fence)
      ),
    },
    {
      table: "user_dictionary",
      key: QUERY_KEYS.userDictionaryList("user-a"),
      run: (client: QueryClient, fence: () => boolean) => (
        cacheWarming.warmUserDictionary(client, "user-a", fence)
      ),
    },
  ] as const;

  for (const scenario of scenarios) {
    const response = deferred<{ data: unknown[]; error: null }>();
    globalThis.__SUPABASE_SELECT_MOCK__ = (query: SelectQuery) => {
      assert.equal(query.table, scenario.table);
      return response.promise;
    };

    let ownerIsCurrent = true;
    const queryClient = new QueryClient();
    const warming = scenario.run(queryClient, () => ownerIsCurrent);
    ownerIsCurrent = false;
    response.resolve({ data: [{ marker: "A private data" }], error: null });

    await assert.rejects(warming, /owner changed/i);
    assert.equal(queryClient.getQueryData(scenario.key), undefined);
    queryClient.clear();
  }
});

test("patient prefetch discards late responses after the owner changes", async () => {
  const pendingTodos = deferred<{ data: unknown[]; error: null }>();
  const pendingHistory = deferred<{ data: unknown[]; error: null }>();
  globalThis.__SUPABASE_SELECT_MOCK__ = (query: SelectQuery) => {
    assert.equal(
      query.filters.find((filter) => filter.column === "user_id")?.value,
      "user-a",
    );
    assert.equal(
      query.filters.find((filter) => filter.column === "patient_id")?.value,
      "patient-a",
    );
    return query.table === "patient_todos" ? pendingTodos.promise : pendingHistory.promise;
  };

  let currentOwnerId = "user-a";
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const prefetch = cacheWarming.prefetchPatient(
    queryClient,
    "user-a",
    "patient-a",
    () => currentOwnerId === "user-a",
  );

  currentOwnerId = "user-b";
  pendingTodos.resolve({
    data: [{ id: "todo-a", content: "A private todo", user_id: "user-a" }],
    error: null,
  });
  pendingHistory.resolve({
    data: [{ id: "history-a", new_value: "A private history", user_id: "user-a" }],
    error: null,
  });
  await prefetch;

  assert.equal(
    queryClient.getQueryData(QUERY_KEYS.patientTodosForOwner("user-a", "patient-a")),
    undefined,
  );
  assert.equal(
    queryClient.getQueryData(QUERY_KEYS.fieldHistoryForOwner("user-a", "patient-a")),
    undefined,
  );
  assert.equal(queryClient.getQueryData(["todos", "patient-a"]), undefined);
  assert.equal(queryClient.getQueryData(["fieldHistory", "patient-a"]), undefined);
  queryClient.clear();
});

test("patient prefetch maps database rows to the application todo and history models", async () => {
  globalThis.__SUPABASE_SELECT_MOCK__ = (query: SelectQuery) => {
    if (query.table === "patient_todos") {
      return {
        data: [{
          id: "todo-a",
          patient_id: "patient-a",
          user_id: "user-a",
          section: "labs",
          content: "Repeat BMP",
          completed: false,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-02T00:00:00.000Z",
        }, {
          id: "todo-b",
          patient_id: "patient-a",
          user_id: "user-b",
          section: null,
          content: "user-b-private-todo",
          completed: false,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-02T00:00:00.000Z",
        }],
        error: null,
      };
    }

    assert.equal(query.table, "patient_field_history");
    return {
      data: [{
        id: "history-a",
        patient_id: "patient-a",
        user_id: "user-a",
        field_name: "labs",
        old_value: "Na 138",
        new_value: "Na 140",
        changed_at: "2026-01-03T00:00:00.000Z",
      }, {
        id: "history-b",
        patient_id: "patient-a",
        user_id: "user-b",
        field_name: "labs",
        old_value: null,
        new_value: "user-b-private-history",
        changed_at: "2026-01-03T00:00:00.000Z",
      }],
      error: null,
    };
  };

  const queryClient = new QueryClient();
  await cacheWarming.prefetchPatient(queryClient, "user-a", "patient-a");

  const todos = queryClient.getQueryData(
    QUERY_KEYS.patientTodosForOwner("user-a", "patient-a"),
  );
  const history = queryClient.getQueryData(
    QUERY_KEYS.fieldHistoryForOwner("user-a", "patient-a"),
  );

  assert.deepEqual(todos, [{
    id: "todo-a",
    patientId: "patient-a",
    userId: "user-a",
    section: "labs",
    content: "Repeat BMP",
    completed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  }]);
  assert.deepEqual(history, [{
    id: "history-a",
    patientId: "patient-a",
    fieldName: "labs",
    oldValue: "Na 138",
    newValue: "Na 140",
    changedAt: "2026-01-03T00:00:00.000Z",
  }]);
  assert.doesNotMatch(JSON.stringify({ todos, history }), /patient_id|user_id|field_name|changed_at/);
  assert.doesNotMatch(JSON.stringify({ todos, history }), /user-b-private/);
  queryClient.clear();
});
