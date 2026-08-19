/**
 * Patient service: Supabase access and row-level mapping.
 * Owns mapPatientRecord (DB row → Patient), buildPatientInsertPayload, and shouldTrackTimestamp.
 * JSON parsing and update-payload building live in @/lib/mappers/patientMapper.
 */
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import type { Patient, PatientMedications, PatientSystems } from "@/types/patient";
import { parseFieldTimestampsJson, parseMedicationsJson, parseSystemsJson } from "@/lib/mappers/patientMapper";

export const defaultSystemsValue: PatientSystems = {
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

export const defaultMedicationsValue: PatientMedications = {
  infusions: [],
  scheduled: [],
  prn: [],
  rawText: "",
};

/** Explicit roster projection shared by fetch and cache-warming paths. */
export const PATIENT_SELECT_COLUMNS = [
  "id",
  "user_id",
  "patient_number",
  "name",
  "mrn",
  "bed",
  "clinical_summary",
  "interval_events",
  "imaging",
  "labs",
  "systems",
  "medications",
  "field_timestamps",
  "collapsed",
  "created_at",
  "last_modified",
  "revision",
  "age",
  "date_of_birth",
  "gender",
  "admission_date",
  "service_line",
  "attending_physician",
  "consulting_team",
  "acuity",
  "code_status",
  "alerts",
  "vitals",
  "assigned_to",
].join(", ");

/** Columns present before the additive clinical metadata migration. */
export const PATIENT_SELECT_COLUMNS_LEGACY = [
  "id",
  "user_id",
  "patient_number",
  "name",
  "mrn",
  "bed",
  "clinical_summary",
  "interval_events",
  "imaging",
  "labs",
  "systems",
  "medications",
  "field_timestamps",
  "collapsed",
  "created_at",
  "last_modified",
  "revision",
].join(", ");

let patientRosterProjection: "expanded" | "legacy" = "expanded";

/**
 * Keep the additive-schema fallback sticky for this browser tab. During a
 * backend-first rollout, one confirmed missing-column response is enough to
 * avoid repeating the same failed expanded query on every roster read.
 */
export const getPatientRosterSelectColumns = (): string => (
  patientRosterProjection === "legacy"
    ? PATIENT_SELECT_COLUMNS_LEGACY
    : PATIENT_SELECT_COLUMNS
);

export const markPatientRosterProjectionLegacy = (): void => {
  patientRosterProjection = "legacy";
};

export const resetPatientRosterProjectionForTesting = (): void => {
  patientRosterProjection = "expanded";
};

export const isMissingPatientContractColumnError = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return error.code === "PGRST204"
    || (message.includes("column") && (
      message.includes("age")
      || message.includes("date_of_birth")
      || message.includes("gender")
      || message.includes("admission_date")
      || message.includes("service_line")
      || message.includes("assigned_to")
      || message.includes("consulting_team")
      || message.includes("attending_physician")
      || message.includes("code_status")
      || message.includes("field")
      || message.includes("vitals")
    ));
};

export interface PatientRecord {
  id: string;
  patient_number: number;
  name: string;
  mrn?: string | null;
  bed: string;
  clinical_summary: string;
  interval_events: string;
  imaging: string | null;
  labs: string | null;
  systems: Json | null;
  medications: Json | null;
  field_timestamps: Json | null;
  collapsed: boolean;
  created_at: string;
  last_modified: string | null;
  revision?: number | null;
  age?: number | null;
  date_of_birth?: string | null;
  gender?: string | null;
  admission_date?: string | null;
  service_line?: string | null;
  attending_physician?: string | null;
  consulting_team?: string[] | null;
  acuity?: string | null;
  code_status?: string | null;
  alerts?: string[] | null;
  vitals?: Json | null;
  assigned_to?: string | null;
}

export const mapPatientRecord = (record: PatientRecord): Patient => ({
  id: record.id,
  patientNumber: record.patient_number,
  name: record.name,
  mrn: record.mrn ?? "",
  bed: record.bed,
  clinicalSummary: record.clinical_summary,
  intervalEvents: record.interval_events,
  imaging: record.imaging || "",
  labs: record.labs || "",
  systems: parseSystemsJson(record.systems),
  medications: parseMedicationsJson(record.medications),
  fieldTimestamps: parseFieldTimestampsJson(record.field_timestamps),
  collapsed: record.collapsed,
  createdAt: record.created_at,
  lastModified: record.last_modified ?? record.created_at,
  revision: record.revision ?? 0,
  age: record.age ?? undefined,
  dateOfBirth: record.date_of_birth ?? undefined,
  gender: record.gender as Patient["gender"] ?? undefined,
  admissionDate: record.admission_date ?? undefined,
  serviceLine: record.service_line ?? undefined,
  attendingPhysician: record.attending_physician ?? undefined,
  consultingTeam: record.consulting_team ?? undefined,
  acuity: record.acuity as Patient["acuity"] ?? undefined,
  codeStatus: record.code_status as Patient["codeStatus"] ?? undefined,
  alerts: record.alerts ?? undefined,
  vitals: record.vitals as Patient["vitals"] ?? undefined,
  assignedTo: record.assigned_to ?? undefined,
});

export const buildPatientInsertPayload = (input: {
  userId: string;
  patientNumber: number;
  name?: string;
  mrn?: string;
  bed?: string;
  clinicalSummary?: string;
  intervalEvents?: string;
  imaging?: string;
  labs?: string;
  systems?: PatientSystems;
  medications?: PatientMedications;
  age?: number;
  dateOfBirth?: string;
  gender?: Patient["gender"];
  admissionDate?: string;
  serviceLine?: string;
  attendingPhysician?: string;
  consultingTeam?: string[];
  acuity?: Patient["acuity"];
  codeStatus?: Patient["codeStatus"];
  alerts?: string[];
  vitals?: Patient["vitals"];
  assignedTo?: string | null;
}): TablesInsert<"patients"> => ({
  user_id: input.userId,
  patient_number: input.patientNumber,
  name: input.name ?? "",
  mrn: input.mrn ?? "",
  bed: input.bed ?? "",
  clinical_summary: input.clinicalSummary ?? "",
  interval_events: input.intervalEvents ?? "",
  imaging: input.imaging ?? "",
  labs: input.labs ?? "",
  systems: (input.systems ?? defaultSystemsValue) as unknown as Json,
  medications: (input.medications ?? defaultMedicationsValue) as unknown as Json,
  collapsed: false,
  ...(input.age !== undefined ? { age: input.age } : {}),
  ...(input.dateOfBirth !== undefined ? { date_of_birth: input.dateOfBirth } : {}),
  ...(input.gender !== undefined ? { gender: input.gender } : {}),
  ...(input.admissionDate !== undefined ? { admission_date: input.admissionDate } : {}),
  ...(input.serviceLine !== undefined ? { service_line: input.serviceLine } : {}),
  ...(input.attendingPhysician !== undefined ? { attending_physician: input.attendingPhysician } : {}),
  ...(input.consultingTeam !== undefined ? { consulting_team: input.consultingTeam } : {}),
  ...(input.acuity !== undefined ? { acuity: input.acuity } : {}),
  ...(input.codeStatus !== undefined ? { code_status: input.codeStatus } : {}),
  ...(input.alerts !== undefined ? { alerts: input.alerts } : {}),
  ...(input.vitals !== undefined ? { vitals: input.vitals as unknown as Json } : {}),
  ...(input.assignedTo !== undefined ? { assigned_to: input.assignedTo } : {}),
});

export const shouldTrackTimestamp = (field: string): boolean => {
  const trackableFields = new Set(["clinicalSummary", "intervalEvents", "imaging", "labs", "medications"]);
  return trackableFields.has(field) || field.startsWith("systems.");
};

export const getNextPatientCounter = (patients: Patient[]): number => {
  const maxNumber = patients.reduce(
    (max, patient) => Math.max(max, patient.patientNumber ?? 0),
    0,
  );
  return maxNumber + 1;
};
