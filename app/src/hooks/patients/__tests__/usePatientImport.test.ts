import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import type { Patient } from "@/types/patient";
import { defaultSystemsValue, defaultMedicationsValue } from "@/services/patientService";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { usePatientImport } from "@/hooks/patients/usePatientImport";
import { supabase } from "@/integrations/supabase/client";
import {
  setPatientImportAttemptStorageForTests,
  type PatientImportAttemptStorage,
} from "@/lib/import/patientImportIdempotency";

const authWrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

let restoreAttemptStorage: () => void = () => {};

afterEach(() => {
  cleanup();
  localStorage.clear();
  restoreAttemptStorage();
  delete (globalThis as unknown as { __SUPABASE_AUTH_MOCK__?: unknown }).__SUPABASE_AUTH_MOCK__;
});

function useAuthenticatedPatientImport(deps: Parameters<typeof usePatientImport>[0]) {
  return {
    auth: useAuth(),
    patientImport: usePatientImport(deps),
  };
}

async function waitForAuthenticatedUser(
  getUserId: () => string | undefined,
  expectedUserId = "test-user-id",
) {
  await waitFor(() => assert.equal(getUserId(), expectedUserId));
}

function installMemoryAttemptStorage() {
  const attempts = new Map<string, string[]>();
  const storage: PatientImportAttemptStorage = {
    acquire: async (ownerId, fingerprint, patientCount, createPatientIds) => {
      const key = `${ownerId}:${fingerprint}`;
      const existing = attempts.get(key);
      if (existing?.length === patientCount) return [...existing];
      const patientIds = createPatientIds();
      attempts.set(key, patientIds);
      return [...patientIds];
    },
    clear: async (ownerId, fingerprint) => {
      attempts.delete(`${ownerId}:${fingerprint}`);
    },
  };
  restoreAttemptStorage();
  restoreAttemptStorage = setPatientImportAttemptStorageForTests(storage);
}

function setupAuthMock() {
  installMemoryAttemptStorage();
  (globalThis as unknown as { __SUPABASE_AUTH_MOCK__?: { getSession: () => Promise<{ data: { session: { user: { id: string } } }; error: null }> } }).__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: "test-user-id" } } }, error: null }),
  };
}

function setupAuthTransitionMock(initialUserId = "user-a") {
  installMemoryAttemptStorage();
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

function makeExistingPatient(patientNumber: number): Patient {
  return {
    id: `existing-${patientNumber}`,
    patientNumber,
    name: `Existing ${patientNumber}`,
    mrn: "",
    bed: `A${patientNumber}`,
    clinicalSummary: "",
    intervalEvents: "",
    imaging: "",
    labs: "",
    systems: defaultSystemsValue,
    medications: defaultMedicationsValue,
    fieldTimestamps: {},
    collapsed: false,
    createdAt: "2024-01-01T00:00:00Z",
    lastModified: "",
  };
}

function rowFromPayload(payload: Record<string, unknown>, id: string) {
  return {
    id,
    user_id: payload.user_id,
    patient_number: payload.patient_number,
    name: payload.name ?? "",
    mrn: payload.mrn ?? "",
    bed: payload.bed ?? "",
    clinical_summary: payload.clinical_summary ?? "",
    interval_events: payload.interval_events ?? "",
    imaging: payload.imaging ?? "",
    labs: payload.labs ?? "",
    systems: payload.systems ?? {},
    medications: payload.medications ?? {},
    field_timestamps: {},
    collapsed: payload.collapsed ?? false,
    created_at: "2024-01-01T00:00:00Z",
    last_modified: null,
  };
}

function installPatientImportSupabaseMock(options: {
  latestPatientNumber?: number;
  conflictNumbers?: number[];
  commitThenTimeoutOnce?: boolean;
} = {}) {
  const supabaseWithMutableFrom = supabase as unknown as { from: (table: string) => unknown };
  const originalFrom = supabaseWithMutableFrom.from.bind(supabase);
  const insertPayloads: Record<string, unknown>[] = [];
  const insertPayloadBatches: Record<string, unknown>[][] = [];
  const latestNumberSelects: unknown[] = [];
  const conflictedNumbers = new Set(options.conflictNumbers ?? []);
  const serverRows = new Map<string, ReturnType<typeof rowFromPayload>>();
  let shouldCommitThenTimeout = options.commitThenTimeoutOnce ?? false;

  supabaseWithMutableFrom.from = (table: string) => {
    if (table !== "patients") return originalFrom(table);

    return {
      select(columns = "*") {
        const query = {
          table,
          columns,
          filters: [] as unknown[],
          orders: [] as unknown[],
          limitCount: null as number | null,
        };
        const result = () => {
          latestNumberSelects.push(query);
          return Promise.resolve({
            data: [{ patient_number: options.latestPatientNumber ?? 0 }],
            error: null,
          });
        };
        const builder = {
          eq(column: string, value: unknown) {
            query.filters.push({ column, value });
            return builder;
          },
          order(column: string, orderOptions: unknown) {
            query.orders.push({ column, options: orderOptions });
            return builder;
          },
          limit(count: number) {
            query.limitCount = count;
            return result();
          },
          in(column: string, values: unknown[]) {
            assert.equal(column, "id");
            return Promise.resolve({
              data: values.flatMap((value) => {
                const row = serverRows.get(String(value));
                return row ? [row] : [];
              }),
              error: null,
            });
          },
          then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
            return result().then(resolve, reject);
          },
        };
        return builder;
      },
      insert(rows: unknown[]) {
        const payloadBatch = rows as Record<string, unknown>[];
        insertPayloadBatches.push(payloadBatch);
        insertPayloads.push(...payloadBatch);
        const shouldConflict = payloadBatch.some((payload) => conflictedNumbers.delete(Number(payload.patient_number)));
        const hasIdConflict = payloadBatch.some((payload) => serverRows.has(String(payload.id)));

        return {
          select: () => {
            const selectResult = (async () => {
              if (shouldCommitThenTimeout) {
                shouldCommitThenTimeout = false;
                payloadBatch.forEach((payload) => {
                  const id = String(payload.id);
                  serverRows.set(id, rowFromPayload(payload, id));
                });
                throw new Error("response lost after commit");
              }

              if (hasIdConflict) {
                return {
                  data: null,
                  error: {
                    code: "23505",
                    details: "Key (id) already exists.",
                    message: "duplicate key value violates unique constraint patients_pkey",
                  },
                };
              }

              if (shouldConflict) {
                return {
                  data: null,
                  error: {
                    code: "23505",
                    details: "Key (patient_number) already exists.",
                    message: "duplicate key value violates unique constraint patients_patient_number_key",
                  },
                };
              }

              const rows = payloadBatch.map((payload) => {
                const id = String(payload.id ?? `inserted-${payload.patient_number}`);
                const row = rowFromPayload(payload, id);
                serverRows.set(id, row);
                return row;
              });
              return {
                data: rows,
                error: null,
              };
            })();

            return {
              single: async () => {
                const { data, error } = await selectResult;
                return {
                  data: Array.isArray(data) ? data[0] ?? null : null,
                  error,
                };
              },
              then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
                return selectResult.then(resolve, reject);
              },
            };
          },
        };
      },
    };
  };

  return {
    insertPayloads,
    insertPayloadBatches,
    latestNumberSelects,
    serverRows,
    restore() {
      supabaseWithMutableFrom.from = originalFrom;
    },
  };
}

test("usePatientImport addPatientWithData calls supabase insert and maps correctly", async () => {
  setupAuthMock();
  const patientsRef: React.MutableRefObject<Patient[]> = { current: [] };
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    if (typeof fn === "function") (fn as (prev: Patient[]) => Patient[])([]);
  };

  const { result } = renderHook(
    () =>
      useAuthenticatedPatientImport({
        patientsRef,
        setPatients,
      }),
    { wrapper: authWrapper }
  );

  await waitForAuthenticatedUser(() => result.current.auth.user?.id);
  await act(async () => {
    await result.current.patientImport.addPatientWithData({
      name: "FHIR Patient",
      bed: "B2",
      clinicalSummary: "Summary",
      intervalEvents: "Events",
      imaging: "CXR",
      labs: "CBC",
      systems: defaultSystemsValue,
      medications: defaultMedicationsValue,
    });
  });

  const capture = (globalThis as unknown as { __supabaseInsertCapture?: { table: string; rows: unknown[] }[] }).__supabaseInsertCapture;
  assert.ok(capture, "insert capture should exist");
  assert.ok(capture.length >= 1, "insert should have been called");
  const lastInsert = capture[capture.length - 1];
  assert.equal(lastInsert.table, "patients");
  assert.equal(lastInsert.rows.length, 1);
  const payload = lastInsert.rows[0] as Record<string, unknown>;
  assert.equal(payload.user_id, "test-user-id");
  assert.equal(payload.name, "FHIR Patient");
  assert.equal(payload.bed, "B2");
  assert.equal(payload.clinical_summary, "Summary");
  assert.equal(payload.interval_events, "Events");
  assert.equal(payload.imaging, "CXR");
  assert.equal(payload.labs, "CBC");
  assert.equal(payload.patient_number, 1);
  assert.equal(payload.mrn, "");
});

test("usePatientImport importPatients performs a single multi-row insert on the happy path", async () => {
  setupAuthMock();
  const patientsRef: React.MutableRefObject<Patient[]> = { current: [] };
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    if (typeof fn === "function") (fn as (prev: Patient[]) => Patient[])([]);
  };
  const supabaseMock = installPatientImportSupabaseMock();

  try {
    const { result } = renderHook(
      () =>
        useAuthenticatedPatientImport({
          patientsRef,
          setPatients,
        }),
      { wrapper: authWrapper }
    );

    await waitForAuthenticatedUser(() => result.current.auth.user?.id);
    await act(async () => {
      await result.current.patientImport.importPatients([
        {
          name: "Imported One",
          bed: "C1",
          clinicalSummary: "S1",
          intervalEvents: "",
          dateOfBirth: "1980-01-02",
          gender: "female",
          admissionDate: "2026-08-01T00:00:00.000Z",
          serviceLine: "MICU",
          attendingPhysician: "Dr Smith",
          codeStatus: "dnr",
          alerts: ["Isolation: Contact"],
        },
        { name: "Imported Two", bed: "C2", clinicalSummary: "S2", intervalEvents: "" },
      ]);
    });

    assert.deepEqual(
      supabaseMock.insertPayloadBatches.map((batch) => batch.map((payload) => payload.patient_number)),
      [[1, 2]],
      "insert should include both patients in one multi-row payload"
    );
    const firstPayload = supabaseMock.insertPayloadBatches[0][0];
    const secondPayload = supabaseMock.insertPayloadBatches[0][1];
    assert.equal(firstPayload.name, "Imported One");
    assert.equal(firstPayload.bed, "C1");
    assert.equal(firstPayload.patient_number, 1);
    assert.equal(firstPayload.date_of_birth, "1980-01-02");
    assert.equal(firstPayload.gender, "female");
    assert.equal(firstPayload.admission_date, "2026-08-01T00:00:00.000Z");
    assert.equal(firstPayload.service_line, "MICU");
    assert.equal(firstPayload.attending_physician, "Dr Smith");
    assert.equal(firstPayload.code_status, "dnr");
    assert.deepEqual(firstPayload.alerts, ["Isolation: Contact"]);
    assert.equal(secondPayload.name, "Imported Two");
    assert.equal(secondPayload.bed, "C2");
    assert.equal(secondPayload.patient_number, 2);
  } finally {
    supabaseMock.restore();
  }
});

test("usePatientImport importPatients commits a multi-patient roster once with immediate cache visibility", async () => {
  setupAuthMock();
  const supabaseMock = installPatientImportSupabaseMock();
  const initialPatients = [1, 2, 3].map(makeExistingPatient);
  const patientsRef: React.MutableRefObject<Patient[]> = { current: initialPatients };
  let cachedPatients = initialPatients;
  let setPatientsCalls = 0;
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    setPatientsCalls += 1;
    cachedPatients = typeof fn === "function" ? (fn as (prev: Patient[]) => Patient[])(cachedPatients) : fn;
  };

  try {
    const { result } = renderHook(
      () =>
        useAuthenticatedPatientImport({
          patientsRef,
          setPatients,
        }),
      { wrapper: authWrapper }
    );

    await waitForAuthenticatedUser(() => result.current.auth.user?.id);
    await act(async () => {
      await result.current.patientImport.importPatients(
        [4, 5, 6, 7, 8].map((patientNumber) => ({
          name: `Imported ${patientNumber}`,
          bed: `B${patientNumber}`,
          clinicalSummary: `Summary ${patientNumber}`,
          intervalEvents: "",
        }))
      );
    });

    assert.equal(setPatientsCalls, 1, "multi-patient import should make one consolidated cache update");
    assert.equal(cachedPatients.length, 8, "cache should expose at least eight patients immediately");
    assert.equal(patientsRef.current.length, 8, "patientsRef should be immediately current for follow-on actions");
    assert.deepEqual(cachedPatients.slice(-5).map((patient) => patient.patientNumber), [4, 5, 6, 7, 8]);
    assert.deepEqual(
      supabaseMock.insertPayloadBatches.map((batch) => batch.map((payload) => payload.patient_number)),
      [[4, 5, 6, 7, 8]],
      "happy-path imports should batch all patients into one insert"
    );
    assert.equal(supabaseMock.latestNumberSelects.length, 0, "successful imports should not perform conflict/latest-number selects");
  } finally {
    supabaseMock.restore();
  }
});

test("usePatientImport importPatients preserves patient-number conflict retry without reloading between rows", async () => {
  setupAuthMock();
  const supabaseMock = installPatientImportSupabaseMock({
    latestPatientNumber: 42,
    conflictNumbers: [1],
  });
  const patientsRef: React.MutableRefObject<Patient[]> = { current: [] };
  let cachedPatients: Patient[] = [];
  let setPatientsCalls = 0;
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    setPatientsCalls += 1;
    cachedPatients = typeof fn === "function" ? (fn as (prev: Patient[]) => Patient[])(cachedPatients) : fn;
  };

  try {
    const { result } = renderHook(
      () =>
        useAuthenticatedPatientImport({
          patientsRef,
          setPatients,
        }),
      { wrapper: authWrapper }
    );

    await waitForAuthenticatedUser(() => result.current.auth.user?.id);
    await act(async () => {
      await result.current.patientImport.importPatients([
        { name: "Conflict Then Retry", bed: "C1", clinicalSummary: "S1", intervalEvents: "" },
        { name: "Next Patient", bed: "C2", clinicalSummary: "S2", intervalEvents: "" },
      ]);
    });

    assert.deepEqual(
      supabaseMock.insertPayloadBatches.map((batch) => batch.map((payload) => payload.patient_number)),
      [[1, 2], [43], [44]],
      "conflict recovery should retry sequential numbers after a bulk conflict"
    );
    assert.equal(supabaseMock.latestNumberSelects.length, 1, "latest-number lookup should run only for the conflict");
    assert.equal(setPatientsCalls, 1, "conflict recovery should still consolidate the cache update");
    assert.deepEqual(cachedPatients.map((patient) => patient.patientNumber), [43, 44]);
    assert.deepEqual(patientsRef.current.map((patient) => patient.patientNumber), [43, 44]);
  } finally {
    supabaseMock.restore();
  }
});

test("usePatientImport reconciles a committed batch after its response is lost", async () => {
  setupAuthMock();
  const supabaseMock = installPatientImportSupabaseMock({ commitThenTimeoutOnce: true });
  const patientsRef: React.MutableRefObject<Patient[]> = { current: [] };
  let cachedPatients: Patient[] = [];
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    cachedPatients = typeof action === "function"
      ? (action as (previous: Patient[]) => Patient[])(cachedPatients)
      : action;
  };
  const rows = [
    { name: "Ambiguous One", bed: "A1", clinicalSummary: "S1", intervalEvents: "" },
    { name: "Ambiguous Two", bed: "A2", clinicalSummary: "S2", intervalEvents: "" },
  ];

  try {
    const { result } = renderHook(
      () => useAuthenticatedPatientImport({ patientsRef, setPatients }),
      { wrapper: authWrapper },
    );
    await waitForAuthenticatedUser(() => result.current.auth.user?.id);

    let firstFailure: unknown;
    await act(async () => {
      try {
        await result.current.patientImport.importPatients(rows);
      } catch (error) {
        firstFailure = error;
      }
    });
    assert.ok(firstFailure instanceof Error);
    assert.equal(supabaseMock.serverRows.size, 2, "the simulated server committed the first batch");
    assert.equal(cachedPatients.length, 0, "the lost response did not update the local roster");

    await act(async () => {
      await result.current.patientImport.importPatients(rows);
    });

    assert.equal(supabaseMock.serverRows.size, 2, "retry must not create duplicate server rows");
    assert.equal(cachedPatients.length, 2, "retry reconciles the original committed rows");
    assert.equal(patientsRef.current.length, 2);
    assert.deepEqual(
      supabaseMock.insertPayloadBatches[1].map((payload) => payload.id),
      supabaseMock.insertPayloadBatches[0].map((payload) => payload.id),
      "retry must reuse the original client-generated IDs",
    );
    assert.equal(supabaseMock.latestNumberSelects.length, 0);
  } finally {
    supabaseMock.restore();
  }
});

test("usePatientImport ignores a deferred user-A insert after switching to user B", async () => {
  const transitionTo = setupAuthTransitionMock();
  const userAPatient = makeExistingPatient(1);
  userAPatient.id = "patient-a";
  userAPatient.name = "User A";
  const userBPatient = makeExistingPatient(2);
  userBPatient.id = "patient-b";
  userBPatient.name = "User B";
  const patientsRef: React.MutableRefObject<Patient[]> = { current: [userAPatient] };
  let renderedPatients = patientsRef.current;
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    renderedPatients = typeof action === "function"
      ? (action as (prev: Patient[]) => Patient[])(renderedPatients)
      : action;
    patientsRef.current = renderedPatients;
  };

  const supabaseWithMutableFrom = supabase as unknown as { from: (table: string) => unknown };
  const originalFrom = supabaseWithMutableFrom.from.bind(supabase);
  let resolveInsert!: (result: { data: unknown; error: null }) => void;
  let insertedPayload: Record<string, unknown> | undefined;
  supabaseWithMutableFrom.from = (table: string) => {
    if (table !== "patients") return originalFrom(table);
    return {
      insert(rows: unknown[]) {
        insertedPayload = rows[0] as Record<string, unknown>;
        return {
          select: () => ({
            single: () => new Promise((resolve) => {
              resolveInsert = resolve;
            }),
          }),
        };
      },
    };
  };

  try {
    const { result } = renderHook(
      () => useAuthenticatedPatientImport({ patientsRef, setPatients }),
      { wrapper: authWrapper },
    );

    await waitForAuthenticatedUser(() => result.current.auth.user?.id, "user-a");

    let pendingInsert!: Promise<void>;
    await act(async () => {
      pendingInsert = result.current.patientImport.addPatientWithData({
        name: "Late User A",
        bed: "A1",
        clinicalSummary: "A-only summary",
        intervalEvents: "",
        imaging: "",
        labs: "",
        systems: defaultSystemsValue,
      });
      await Promise.resolve();
    });
    assert.ok(insertedPayload, "user-A insert should be in flight");

    await transitionTo("user-b");
    renderedPatients = [userBPatient];
    patientsRef.current = renderedPatients;

    await act(async () => {
      resolveInsert({ data: rowFromPayload(insertedPayload!, "late-patient-a"), error: null });
      await pendingInsert;
    });

    assert.deepEqual(renderedPatients, [userBPatient]);
    assert.deepEqual(patientsRef.current, [userBPatient]);
  } finally {
    supabaseWithMutableFrom.from = originalFrom;
  }
});

test("usePatientImport returns importPatients and addPatientWithData", () => {
  setupAuthMock();
  const patientsRef: React.MutableRefObject<Patient[]> = { current: [] };
  const setPatients = () => {};

  const { result } = renderHook(
    () =>
      useAuthenticatedPatientImport({
        patientsRef,
        setPatients,
      }),
    { wrapper: authWrapper }
  );

  assert.equal(typeof result.current.patientImport.importPatients, "function");
  assert.equal(typeof result.current.patientImport.addPatientWithData, "function");
});
