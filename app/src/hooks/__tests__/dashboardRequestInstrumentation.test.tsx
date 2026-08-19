import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { usePatientFetch } from "@/hooks/patients/usePatientFetch";
import { useAllPatientTodos } from "@/hooks/useAllPatientTodos";
import { usePatientTodos } from "@/hooks/usePatientTodos";
import {
  dashboardPatients8,
  makeDashboardPatientRows,
  makeDashboardTodoRows,
} from "@/test/dashboardRegressionFixtures";

declare global {
  var __SUPABASE_AUTH_MOCK__: unknown;
  var __SUPABASE_SELECT_MOCK__: unknown;
}

interface SupabaseSelectQuery {
  table: string;
  filters: Array<{ op: string; column: string; values?: string[]; value?: string }>;
}

const queryClients: QueryClient[] = [];

afterEach(() => {
  cleanup();
  queryClients.splice(0).forEach((queryClient) => queryClient.clear());
  delete globalThis.__SUPABASE_AUTH_MOCK__;
  delete globalThis.__SUPABASE_SELECT_MOCK__;
});

function setupAuthMock() {
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: "test-user-id" } } }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
}

function createQueryWrapper({ includeSettings = false }: { includeSettings?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  queryClients.push(queryClient);

  return function Wrapper({ children }: { children: React.ReactNode }) {
    const wrappedChildren = includeSettings
      ? <SettingsProvider>{children}</SettingsProvider>
      : children;

    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{wrappedChildren}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

function setupSelectMock() {
  const counts = {
    patientList: 0,
    todoMap: 0,
    patientTodo: 0,
  };
  const patientRows = makeDashboardPatientRows(dashboardPatients8)
    .map((patient) => ({ ...patient, user_id: "test-user-id" }));
  const todoRows = makeDashboardTodoRows(dashboardPatients8)
    .map((todo) => ({ ...todo, user_id: "test-user-id" }));

  const selectMock = async (query: SupabaseSelectQuery): Promise<{ data: unknown[]; error: null }> => {
    if (query.table === "patients") {
      counts.patientList += 1;
      return { data: patientRows, error: null };
    }

    if (query.table === "patient_todos") {
      const ids = query.filters.find((filter) => filter.op === "in" && filter.column === "patient_id")?.values;
      const patientId = query.filters.find((filter) => filter.op === "eq" && filter.column === "patient_id")?.value;
      if (ids) {
        counts.todoMap += 1;
      } else if (patientId) {
        counts.patientTodo += 1;
      }
      const filteredRows = ids
        ? todoRows.filter((todo) => ids.includes(String(todo.patient_id)))
        : patientId
          ? todoRows.filter((todo) => String(todo.patient_id) === patientId)
          : todoRows;
      return { data: filteredRows, error: null };
    }

    return { data: [], error: null };
  };
  globalThis.__SUPABASE_SELECT_MOCK__ = selectMock;

  return counts;
}

function PatientFetchSelectionHarness() {
  const { patients, fetchPatients } = usePatientFetch();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  return (
    <section aria-label="Patient fetch selection harness">
      <button type="button" disabled={!user} onClick={() => void fetchPatients()}>
        Load patients
      </button>
      {patients.map((patient) => (
        <button
          key={patient.id}
          type="button"
          aria-current={patient.id === selectedId ? "true" : undefined}
          onClick={() => setSelectedId(patient.id)}
        >
          Select {patient.name}
        </button>
      ))}
    </section>
  );
}

async function loadPatientsFromHarness() {
  await waitFor(() => assert.equal(screen.getByRole("button", { name: "Load patients" }).hasAttribute("disabled"), false));
  fireEvent.click(screen.getByRole("button", { name: "Load patients" }));
  await screen.findByRole("button", { name: "Select Alex Morgan" }, { timeout: 2000 });
}

function TodoMapSelectionHarness() {
  const patientIds = React.useMemo(() => dashboardPatients8.map((patient) => patient.id), []);
  const { todosMap, loading, refetch } = useAllPatientTodos(patientIds);
  const [selectedId, setSelectedId] = React.useState(patientIds[0]);

  return (
    <section aria-label="Todo map selection harness">
      <p>Todos loaded: {Object.keys(todosMap).length}</p>
      <p>Todo loading type: {typeof loading}</p>
      <p>Todo refetch type: {typeof refetch}</p>
      {dashboardPatients8.map((patient) => (
        <button
          key={patient.id}
          type="button"
          aria-current={patient.id === selectedId ? "true" : undefined}
          onClick={() => setSelectedId(patient.id)}
        >
          Select {patient.name}
        </button>
      ))}
    </section>
  );
}

function SelectedTodoHydrationHarness() {
  const patientIds = React.useMemo(() => dashboardPatients8.map((patient) => patient.id), []);
  const { todosMap } = useAllPatientTodos(patientIds);
  const [selectedId, setSelectedId] = React.useState(patientIds[0]);
  const initialTodos = todosMap[selectedId] ?? [];
  const { todos } = usePatientTodos(selectedId, { initialTodos });

  return (
    <section aria-label="Selected todo hydration harness">
      <p>Selected todo: {todos[0]?.content ?? "none"}</p>
      {dashboardPatients8.map((patient) => (
        <button
          key={patient.id}
          type="button"
          aria-current={patient.id === selectedId ? "true" : undefined}
          onClick={() => setSelectedId(patient.id)}
        >
          Select {patient.name}
        </button>
      ))}
    </section>
  );
}

describe("dashboard request-count instrumentation against real hooks", { concurrency: false }, () => {
  it("does not refetch the full patient list when selection changes after patients load", async () => {
    setupAuthMock();
    const counts = setupSelectMock();
    const Wrapper = createQueryWrapper();

    render(<PatientFetchSelectionHarness />, { wrapper: Wrapper });

    await loadPatientsFromHarness();
    await waitFor(() => assert.equal(counts.patientList, 1));

    fireEvent.click(screen.getByRole("button", { name: "Select Harper Chen" }));

    await waitFor(() => {
      assert.equal(screen.getByRole("button", { name: "Select Harper Chen" }).getAttribute("aria-current"), "true");
      assert.equal(counts.patientList, 1);
    });
  });

  it("reuses the fresh patient cache when the fetch path is called after initial load", async () => {
    setupAuthMock();
    const counts = setupSelectMock();
    const Wrapper = createQueryWrapper();

    render(<PatientFetchSelectionHarness />, { wrapper: Wrapper });

    await loadPatientsFromHarness();
    await waitFor(() => assert.equal(counts.patientList, 1));

    fireEvent.click(screen.getByRole("button", { name: "Load patients" }));

    await waitFor(() => {
      assert.equal(screen.getByRole("button", { name: "Select Alex Morgan" }).textContent, "Select Alex Morgan");
      assert.equal(counts.patientList, 1);
    });
  });

  it("does not reload the full todo map when selected patient changes after bulk todos load", async () => {
    setupAuthMock();
    const counts = setupSelectMock();
    const Wrapper = createQueryWrapper();

    render(<TodoMapSelectionHarness />, { wrapper: Wrapper });

    await screen.findByText("Todos loaded: 8", {}, { timeout: 2000 });
    assert.equal(screen.getByText("Todo loading type: boolean").textContent, "Todo loading type: boolean");
    assert.equal(screen.getByText("Todo refetch type: function").textContent, "Todo refetch type: function");
    const todoMapCountAfterLoad = counts.todoMap;
    assert.equal(todoMapCountAfterLoad > 0, true);

    fireEvent.click(screen.getByRole("button", { name: "Select Devon Rivera" }));

    await waitFor(() => {
      assert.equal(screen.getByRole("button", { name: "Select Devon Rivera" }).getAttribute("aria-current"), "true");
      assert.equal(counts.todoMap, todoMapCountAfterLoad);
    });
  });

  it("hydrates selected patient todos from the bulk map without a duplicate per-patient fetch", async () => {
    setupAuthMock();
    const counts = setupSelectMock();
    const Wrapper = createQueryWrapper({ includeSettings: true });

    render(<SelectedTodoHydrationHarness />, { wrapper: Wrapper });

    await screen.findByText("Selected todo: Review active plan for A01", {}, { timeout: 2000 });
    assert.equal(counts.todoMap, 1);
    assert.equal(counts.patientTodo, 0);

    fireEvent.click(screen.getByRole("button", { name: "Select Devon Rivera" }));

    await waitFor(() => {
      assert.equal(screen.getByRole("button", { name: "Select Devon Rivera" }).getAttribute("aria-current"), "true");
      assert.equal(screen.getByText("Selected todo: Review active plan for A04").textContent, "Selected todo: Review active plan for A04");
      assert.equal(counts.todoMap, 1);
      assert.equal(counts.patientTodo, 0);
    });
  });
});
