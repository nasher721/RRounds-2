/**
 * Patient Mapper
 * Transforms between database and UI patient representations.
 *
 * Responsibility split: patientService owns Supabase row → Patient (mapPatientRecord,
 * buildPatientInsertPayload, shouldTrackTimestamp). This module owns JSON parsing
 * (parseSystemsJson, parseMedicationsJson, parseFieldTimestampsJson), DB↔UI field
 * name mapping (uiFieldToDbField, dbToUiPatient), and building update payloads
 * (prepareUpdateData) from field-level edits.
 */

import type { DbPatient, Patient, PatientSystems, PatientMedications, FieldTimestamps } from "@/types/patient";
import type { Json } from "@/integrations/supabase/types";

/**
 * Parse systems JSON from database into typed PatientSystems
 */
export const parseSystemsJson = (systems: Json | null): PatientSystems => {
  const defaults: PatientSystems = {
    neuro: "",
    cv: "",
    resp: "",
    renalGU: "",
    gi: "",
    endo: "",
    heme: "",
    infectious: "",
    skinLines: "",
    dispo: "",
  };

  if (!systems || typeof systems !== 'object' || Array.isArray(systems)) {
    return defaults;
  }

  const s = systems as Record<string, unknown>;
  return {
    neuro: String(s.neuro || ''),
    cv: String(s.cv || ''),
    resp: String(s.resp || ''),
    renalGU: String(s.renalGU || ''),
    gi: String(s.gi || ''),
    endo: String(s.endo || ''),
    heme: String(s.heme || ''),
    infectious: String(s.infectious || ''),
    skinLines: String(s.skinLines || ''),
    dispo: String(s.dispo || ''),
  };
};

/**
 * Parse medications JSON from database into typed PatientMedications
 */
export const parseMedicationsJson = (medications: Json | null): PatientMedications => {
  const defaults: PatientMedications = {
    infusions: [],
    scheduled: [],
    prn: [],
    rawText: "",
  };

  if (!medications || typeof medications !== 'object' || Array.isArray(medications)) {
    return defaults;
  }

  const m = medications as Record<string, unknown>;
  return {
    infusions: Array.isArray(m.infusions) ? m.infusions.map(String) : [],
    scheduled: Array.isArray(m.scheduled) ? m.scheduled.map(String) : [],
    prn: Array.isArray(m.prn) ? m.prn.map(String) : [],
    rawText: String(m.rawText || ''),
  };
};

/**
 * Parse field_timestamps JSON from database into typed FieldTimestamps
 */
export const parseFieldTimestampsJson = (timestamps: Json | null): FieldTimestamps => {
  if (!timestamps || typeof timestamps !== 'object' || Array.isArray(timestamps)) {
    return {};
  }
  return timestamps as FieldTimestamps;
};

/**
 * Convert database patient to UI patient (snake_case to camelCase)
 */
export const dbToUiPatient = (dbPatient: DbPatient): Patient => ({
  id: dbPatient.id,
  patientNumber: dbPatient.patient_number,
  name: dbPatient.name,
  mrn: dbPatient.mrn ?? "",
  bed: dbPatient.bed,
  clinicalSummary: dbPatient.clinical_summary,
  intervalEvents: dbPatient.interval_events,
  imaging: dbPatient.imaging,
  labs: dbPatient.labs,
  systems: dbPatient.systems,
  medications: dbPatient.medications || { infusions: [], scheduled: [], prn: [], rawText: "" },
  fieldTimestamps: dbPatient.field_timestamps || {},
  collapsed: dbPatient.collapsed,
  createdAt: dbPatient.created_at,
  lastModified: dbPatient.last_modified,
  revision: dbPatient.revision ?? 0,
  age: dbPatient.age,
  dateOfBirth: dbPatient.date_of_birth ?? undefined,
  gender: dbPatient.gender ?? undefined,
  admissionDate: dbPatient.admission_date ?? undefined,
  serviceLine: dbPatient.service_line ?? undefined,
  attendingPhysician: dbPatient.attending_physician ?? undefined,
  consultingTeam: dbPatient.consulting_team ?? undefined,
  acuity: dbPatient.acuity ?? undefined,
  codeStatus: dbPatient.code_status ?? undefined,
  alerts: dbPatient.alerts ?? undefined,
  vitals: dbPatient.vitals ?? undefined,
  assignedTo: dbPatient.assigned_to ?? undefined,
});

/**
 * Map field names from UI (camelCase) to DB (snake_case)
 */
export const uiFieldToDbField = (field: string): string => {
  const fieldMap: Record<string, string> = {
    clinicalSummary: "clinical_summary",
    intervalEvents: "interval_events",
    patientNumber: "patient_number",
    createdAt: "created_at",
    lastModified: "last_modified",
    dateOfBirth: "date_of_birth",
    admissionDate: "admission_date",
    serviceLine: "service_line",
    attendingPhysician: "attending_physician",
    consultingTeam: "consulting_team",
    acuity: "acuity",
    codeStatus: "code_status",
    alerts: "alerts",
    vitals: "vitals",
    assignedTo: "assigned_to",
  };
  return fieldMap[field] || field;
};

/**
 * Prepare update data for database from UI field update
 */
export const prepareUpdateData = (
  field: string,
  value: unknown,
  currentSystems?: PatientSystems,
  currentMedications?: PatientMedications
): Record<string, unknown> => {
  const updateData: Record<string, unknown> = {};

  if (field.includes(".")) {
    const [parent, child] = field.split(".");
    if (parent === "systems" && currentSystems) {
      updateData.systems = { ...currentSystems, [child]: value };
    } else if (parent === "medications" && currentMedications) {
      updateData.medications = { ...currentMedications, [child]: value };
    }
  } else if (field === "medications") {
    updateData.medications = value;
  } else {
    updateData[uiFieldToDbField(field)] = value;
  }

  return updateData;
};
