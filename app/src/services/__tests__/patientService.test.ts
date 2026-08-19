import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPatientInsertPayload,
  defaultMedicationsValue,
  defaultSystemsValue,
  getPatientRosterSelectColumns,
  getNextPatientCounter,
  markPatientRosterProjectionLegacy,
  mapPatientRecord,
  PATIENT_SELECT_COLUMNS,
  PATIENT_SELECT_COLUMNS_LEGACY,
  resetPatientRosterProjectionForTesting,
  shouldTrackTimestamp,
} from "@/services/patientService";

test("uses one expanded patient projection until a missing-column response marks the session legacy", () => {
  resetPatientRosterProjectionForTesting();
  assert.equal(getPatientRosterSelectColumns(), PATIENT_SELECT_COLUMNS);

  markPatientRosterProjectionLegacy();
  assert.equal(getPatientRosterSelectColumns(), PATIENT_SELECT_COLUMNS_LEGACY);

  resetPatientRosterProjectionForTesting();
  assert.equal(getPatientRosterSelectColumns(), PATIENT_SELECT_COLUMNS);
});

test("maps patient records with safe defaults", () => {
  const mapped = mapPatientRecord({
    id: "id-1",
    patient_number: 1,
    name: "Test",
    bed: "A1",
    clinical_summary: "Summary",
    interval_events: "Events",
    imaging: null,
    labs: null,
    systems: null,
    medications: null,
    field_timestamps: null,
    collapsed: false,
    created_at: "2024-01-01T00:00:00Z",
    last_modified: null,
  });

  assert.equal(mapped.imaging, "");
  assert.equal(mapped.labs, "");
  assert.deepEqual(mapped.systems, defaultSystemsValue);
  assert.deepEqual(mapped.medications, defaultMedicationsValue);
  assert.equal(mapped.lastModified, "2024-01-01T00:00:00Z");
});

test("builds patient insert payload with defaults", () => {
  const payload = buildPatientInsertPayload({
    userId: "user-1",
    patientNumber: 3,
    name: "Jane",
    bed: "B2",
  });

  assert.equal(payload.user_id, "user-1");
  assert.equal(payload.patient_number, 3);
  assert.equal(payload.name, "Jane");
  assert.equal(payload.bed, "B2");
  assert.deepEqual(payload.systems, defaultSystemsValue);
});

test("builds patient insert payload with explicit systems and medications", () => {
  const payload = buildPatientInsertPayload({
    userId: "user-2",
    patientNumber: 4,
    name: "Alex",
    bed: "C1",
    clinicalSummary: "Custom summary",
    dateOfBirth: "1980-01-02",
    gender: "female",
    admissionDate: "2026-08-01T00:00:00.000Z",
    systems: {
      ...defaultSystemsValue,
      neuro: "Awake",
      cv: "Stable",
    },
    medications: {
      ...defaultMedicationsValue,
      infusions: ["Norepinephrine"],
      scheduled: ["Aspirin"],
    },
  });

  assert.equal(payload.user_id, "user-2");
  assert.equal(payload.patient_number, 4);
  assert.equal(payload.clinical_summary, "Custom summary");
  assert.equal(payload.date_of_birth, "1980-01-02");
  assert.equal(payload.gender, "female");
  assert.equal(payload.admission_date, "2026-08-01T00:00:00.000Z");
  assert.deepEqual(payload.systems, {
    ...defaultSystemsValue,
    neuro: "Awake",
    cv: "Stable",
  });
  assert.deepEqual(payload.medications, {
    ...defaultMedicationsValue,
    infusions: ["Norepinephrine"],
    scheduled: ["Aspirin"],
  });
});

test("tracks all major field types", () => {
  assert.equal(shouldTrackTimestamp("clinicalSummary"), true);
  assert.equal(shouldTrackTimestamp("medications"), true);
  assert.equal(shouldTrackTimestamp("labs"), true);
  assert.equal(shouldTrackTimestamp("imaging"), true);
  assert.equal(shouldTrackTimestamp("intervalEvents"), true);
  // systems is tracked via nested fields (e.g., systems.neuro)
  assert.equal(shouldTrackTimestamp("systems.neuro"), true);
  assert.equal(shouldTrackTimestamp("systems.cardiovascular"), true);
  // non-trackable fields
  assert.equal(shouldTrackTimestamp("name"), false);
  assert.equal(shouldTrackTimestamp("bed"), false);
});

test("computes next patient counter correctly", () => {
  const mockPatient = {
    id: "test-id",
    patientNumber: 7,
    name: "",
    mrn: "",
    bed: "",
    clinicalSummary: "",
    intervalEvents: "",
    imaging: "",
    labs: "",
    systems: defaultSystemsValue,
    medications: defaultMedicationsValue,
    fieldTimestamps: {},
    collapsed: false,
    createdAt: "",
    lastModified: "",
  };
  assert.equal(getNextPatientCounter([mockPatient]), 8);
  assert.equal(getNextPatientCounter([]), 1);
  
  const unsorted = [
    { ...{ patientNumber: 3 }, id: "3", name: "", mrn: "", bed: "", clinicalSummary: "", intervalEvents: "", imaging: "", labs: "", systems: defaultSystemsValue, medications: defaultMedicationsValue, fieldTimestamps: {}, collapsed: false, createdAt: "", lastModified: "" },
    { ...{ patientNumber: 1 }, id: "1", name: "", mrn: "", bed: "", clinicalSummary: "", intervalEvents: "", imaging: "", labs: "", systems: defaultSystemsValue, medications: defaultMedicationsValue, fieldTimestamps: {}, collapsed: false, createdAt: "", lastModified: "" },
    { ...{ patientNumber: 5 }, id: "5", name: "", mrn: "", bed: "", clinicalSummary: "", intervalEvents: "", imaging: "", labs: "", systems: defaultSystemsValue, medications: defaultMedicationsValue, fieldTimestamps: {}, collapsed: false, createdAt: "", lastModified: "" },
  ];
  assert.equal(getNextPatientCounter(unsorted), 6);

  const withMissingNumber = [
    { ...mockPatient, id: "a", patientNumber: 2 },
    { ...mockPatient, id: "b", patientNumber: undefined as unknown as number },
  ];
  assert.equal(getNextPatientCounter(withMissingNumber), 3);
});

test("maps patient with existing data preserves values", () => {
  const mapped = mapPatientRecord({
    id: "id-2",
    patient_number: 2,
    name: "Existing",
    mrn: "XYZ-99",
    bed: "C3",
    clinical_summary: "Custom summary",
    interval_events: "Custom events",
    imaging: "Chest X-ray",
    labs: "CBC, BMP",
    systems: { neuro: "Alert", cv: "Stable" },
    medications: { infusions: ["Propofol"], scheduled: [], prn: [] },
    field_timestamps: { clinicalSummary: "2024-01-01" },
    collapsed: true,
    created_at: "2024-01-01T00:00:00Z",
    last_modified: "2024-01-02T00:00:00Z",
  });

  assert.equal(mapped.mrn, "XYZ-99");
  assert.equal(mapped.imaging, "Chest X-ray");
  assert.equal(mapped.labs, "CBC, BMP");
  assert.equal(mapped.clinicalSummary, "Custom summary");
  assert.equal(mapped.intervalEvents, "Custom events");
  assert.equal(mapped.collapsed, true);
  assert.equal(mapped.lastModified, "2024-01-02T00:00:00Z");
});
