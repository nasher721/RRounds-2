import type { Patient } from "@/types/patient";
import { defaultMedications, defaultSystems } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";

const FIXTURE_TIMESTAMP = "2026-05-27T12:00:00.000Z";

const beds = [
  "A01",
  "A02",
  "A03",
  "A04",
  "B05",
  "B06",
  "B07",
  "B08",
  "C09",
  "C10",
  "C11",
  "C12",
  "D13",
  "D14",
  "D15",
  "D16",
  "E17",
  "E18",
  "E19",
  "E20",
];

const names = [
  "Alex Morgan",
  "Blair Patel",
  "Casey Nguyen",
  "Devon Rivera",
  "Elliot Brooks",
  "Finley Shah",
  "Gray Kim",
  "Harper Chen",
  "Indigo Lewis",
  "Jordan Singh",
  "Kai Thompson",
  "Logan Garcia",
  "Morgan Davis",
  "Noah Williams",
  "Oakley Brown",
  "Parker Jones",
  "Quinn Miller",
  "Riley Wilson",
  "Sage Moore",
  "Taylor Martin",
];

export function makeDashboardPatients(count: 8 | 20): Patient[] {
  return Array.from({ length: count }, (_, index) => {
    const patientNumber = index + 1;
    return {
      id: `patient-${String(patientNumber).padStart(2, "0")}`,
      patientNumber,
      name: names[index],
      mrn: `MRN-${String(900000 + patientNumber)}`,
      bed: beds[index],
      clinicalSummary: `Neuro ICU rounding summary for ${names[index]}.`,
      intervalEvents: patientNumber % 2 === 0 ? "No overnight events." : "Repeat CT reviewed.",
      imaging: patientNumber % 3 === 0 ? "CT head stable." : "",
      labs: patientNumber % 4 === 0 ? "Na 140, WBC 8.1." : "",
      systems: {
        ...defaultSystems,
        neuro: patientNumber % 2 === 0 ? "Awake, follows commands." : "Sedated, localizes.",
        resp: patientNumber % 5 === 0 ? "Ventilator wean today." : "",
      },
      medications: {
        ...defaultMedications,
        scheduled: patientNumber % 2 === 0 ? ["levetiracetam"] : [],
      },
      fieldTimestamps: {},
      collapsed: false,
      createdAt: FIXTURE_TIMESTAMP,
      lastModified: FIXTURE_TIMESTAMP,
      age: 40 + patientNumber,
      serviceLine: patientNumber % 2 === 0 ? "NCC" : "NSGY",
      acuity: patientNumber % 5 === 0 ? "critical" : "moderate",
      codeStatus: "full",
      alerts: patientNumber % 7 === 0 ? ["fall risk"] : [],
    };
  });
}

export const dashboardPatients8 = makeDashboardPatients(8);
export const dashboardPatients20 = makeDashboardPatients(20);
export const dashboardPatients3 = dashboardPatients8.slice(0, 3);

export function makeDashboardTodosMap(patients: Patient[]): Record<string, PatientTodo[]> {
  return Object.fromEntries(
    patients.map((patient, index) => [
      patient.id,
      [
        {
          id: `todo-${patient.id}-rounds`,
          patientId: patient.id,
          userId: "test-user",
          section: null,
          content: `Review active plan for ${patient.bed}`,
          completed: index % 3 === 0,
          createdAt: FIXTURE_TIMESTAMP,
          updatedAt: FIXTURE_TIMESTAMP,
        },
      ],
    ]),
  );
}

export function makeDashboardPatientRows(patients: Patient[]) {
  return patients.map((patient) => ({
    id: patient.id,
    user_id: "test-user",
    patient_number: patient.patientNumber,
    name: patient.name,
    mrn: patient.mrn,
    bed: patient.bed,
    clinical_summary: patient.clinicalSummary,
    interval_events: patient.intervalEvents,
    imaging: patient.imaging,
    labs: patient.labs,
    systems: patient.systems,
    medications: patient.medications,
    field_timestamps: patient.fieldTimestamps,
    collapsed: patient.collapsed,
    created_at: patient.createdAt,
    last_modified: patient.lastModified,
    age: patient.age,
    service_line: patient.serviceLine,
    acuity: patient.acuity,
    code_status: patient.codeStatus,
    alerts: patient.alerts,
  }));
}

export function makeDashboardTodoRows(patients: Patient[]) {
  return Object.values(makeDashboardTodosMap(patients))
    .flat()
    .map((todo) => ({
      id: todo.id,
      patient_id: todo.patientId,
      user_id: todo.userId,
      section: todo.section,
      content: todo.content,
      completed: todo.completed,
      created_at: todo.createdAt,
      updated_at: todo.updatedAt,
    }));
}

export const dashboardImportPatients = dashboardPatients8.slice(0, 3).map((patient) => ({
  name: `${patient.name} Imported`,
  bed: `I${patient.bed}`,
  clinicalSummary: patient.clinicalSummary,
  intervalEvents: patient.intervalEvents,
}));

export const dashboardPatientUpdatePatch = {
  field: "clinicalSummary",
  value: "Updated focused neuro ICU rounding summary.",
} as const;

/** Shared Step 1 production-readiness scenarios for dashboard/activity/dictation harnesses. */
export const productionReadinessFixtures = {
  zeroPatients: [] as Patient[],
  threePatientRoster: dashboardPatients3,
  selectedNonFirstPatient: dashboardPatients3[2],
  filteredEmpty: {
    patients: dashboardPatients3,
    filteredPatients: [] as Patient[],
    searchQuery: "zz-no-match",
  },
  storageAccessDeniedError: new Error("Access to storage is not allowed from this context"),
  storageQuotaExceededError: new Error("Quota exceeded"),
  activityFetchFailure: () => ({
    data: null,
    error: new Error("activity service unavailable"),
  }),
  activityFetchSuccess: (rows: unknown[] = []) => ({
    data: rows,
    error: null,
  }),
  dictationPermissionDenied: () =>
    new DOMException("Permission denied by test browser", "NotAllowedError"),
} as const;

export function createThrowingStorage(options?: {
  onGetItem?: "throw" | "null";
  onSetItem?: "throw" | "ok";
  onRemoveItem?: "throw" | "ok";
}): Storage {
  const store = new Map<string, string>();
  const onGetItem = options?.onGetItem ?? "throw";
  const onSetItem = options?.onSetItem ?? "throw";
  const onRemoveItem = options?.onRemoveItem ?? "ok";

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    key() {
      return null;
    },
    getItem(key: string) {
      if (onGetItem === "throw") {
        throw productionReadinessFixtures.storageAccessDeniedError;
      }
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (onSetItem === "throw") {
        throw productionReadinessFixtures.storageQuotaExceededError;
      }
      store.set(key, value);
    },
    removeItem(key: string) {
      if (onRemoveItem === "throw") {
        throw productionReadinessFixtures.storageAccessDeniedError;
      }
      store.delete(key);
    },
  } as Storage;
}
