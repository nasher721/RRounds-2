/**
 * Unified Patient Types
 * Single source of truth for all patient-related type definitions
 */

// Patient acuity levels for clinical prioritization
export type AcuityLevel = 'low' | 'moderate' | 'high' | 'critical';

/**
 * Code status options for resuscitation preferences
 */
export type CodeStatus = 'full' | 'dnr' | 'dni' | 'comfort';

/** Administrative sex/gender value supplied by an upstream patient roster. */
export type PatientGender = 'male' | 'female' | 'other' | 'unknown';

/**
 * Vitals data structure for patient monitoring
 */
export interface Vitals {
  /** ISO timestamp of when vitals were last recorded */
  lastRecorded?: string;
  /** Temperature (e.g., "98.6°F" or "37.0°C") */
  temp?: string;
  /** Heart rate in BPM */
  hr?: string;
  /** Blood pressure (e.g., "120/80") */
  bp?: string;
  /** Respiratory rate in breaths per minute */
  rr?: string;
  /** Oxygen saturation percentage */
  spo2?: string;
}

// System-by-system review structure
export interface PatientSystems {
  neuro: string;
  cv: string;
  resp: string;
  renalGU: string;
  gi: string;
  endo: string;
  heme: string;
  infectious: string;
  skinLines: string;
  dispo: string;
}

// Structured medication categories
export interface PatientMedications {
  infusions: string[];
  scheduled: string[];
  prn: string[];
  rawText?: string; // Keep original text as backup
}

// Default empty medications object
export const defaultMedications: PatientMedications = {
  infusions: [],
  scheduled: [],
  prn: [],
  rawText: "",
};

// Field timestamps tracking when each field was last modified
export interface FieldTimestamps {
  clinicalSummary?: string;
  intervalEvents?: string;
  imaging?: string;
  labs?: string;
  medications?: string;
  [key: `systems.${string}`]: string | undefined;
}

// Default empty systems object
export const defaultSystems: PatientSystems = {
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

/**
 * Database Patient - matches Supabase table schema
 * Uses snake_case to match database columns
 */
export interface DbPatient {
  id: string;
  user_id: string;
  patient_number: number;
  name: string;
  mrn: string;
  bed: string;
  clinical_summary: string;
  interval_events: string;
  imaging: string;
  labs: string;
  systems: PatientSystems;
  medications: PatientMedications;
  field_timestamps: FieldTimestamps;
  collapsed: boolean;
  created_at: string;
  last_modified: string;
  revision?: number;
  age?: number;
  /** ISO calendar date from the source roster; never inferred from age. */
  date_of_birth?: string;
  /** Normalized administrative sex/gender value from the source roster. */
  gender?: PatientGender;
  /** ISO timestamp for the current admission when supplied. */
  admission_date?: string;
  /** ICU service line (MICU, SICU, CVICU, etc.) */
  service_line?: string;
  /** Primary attending physician name */
  attending_physician?: string;
  /** Consulting teams involved in patient care */
  consulting_team?: string[];
  /** Patient acuity level for clinical prioritization */
  acuity?: AcuityLevel;
  /** Code status for resuscitation preferences */
  code_status?: CodeStatus;
  /** Clinical alerts (allergies, isolation precautions, etc.) */
  alerts?: string[];
  /** Most recent vital signs */
  vitals?: Vitals;
  /** User ID of the clinician assigned to this patient */
  assigned_to?: string;
}

/**
 * UI Patient - used in components
 * Uses camelCase for React conventions
 */
export interface Patient {
  id: string;
  patientNumber: number;
  name: string;
  /** Medical record number or hospital ID; may be empty when not yet captured */
  mrn: string;
  bed: string;
  clinicalSummary: string;
  intervalEvents: string;
  imaging: string;
  labs: string;
  systems: PatientSystems;
  medications: PatientMedications;
  fieldTimestamps: FieldTimestamps;
  collapsed: boolean;
  createdAt: string;
  lastModified: string;
  /** Monotonic server revision used to reject stale cross-tab writes. */
  revision?: number;
  age?: number;
  /** ISO calendar date from the source roster; never inferred from age. */
  dateOfBirth?: string;
  /** Normalized administrative sex/gender value from the source roster. */
  gender?: PatientGender;
  /** ISO timestamp for the current admission when supplied. */
  admissionDate?: string;
  /** ICU service line (MICU, SICU, CVICU, etc.) */
  serviceLine?: string;
  /** Primary attending physician name */
  attendingPhysician?: string;
  /** Consulting teams involved in patient care */
  consultingTeam?: string[];
  /** Patient acuity level for clinical prioritization */
  acuity?: AcuityLevel;
  /** Code status for resuscitation preferences */
  codeStatus?: CodeStatus;
  /** Clinical alerts (allergies, isolation precautions, etc.) */
  alerts?: string[];
  /** Most recent vital signs */
  vitals?: Vitals;
  /** User ID of the clinician assigned to this patient */
  assignedTo?: string;
}

/**
 * Settings configuration for the app
 */
export interface SettingsType {
  fontSize: string;
  orientation: string;
  margins: string;
  includeSystems: string;
  includeTimestamps: string;
  theme: string;
  cardView: string;
  autoSaveInterval: number;
}
