/**
 * Patient Templates for Rapid Patient Creation
 * 
 * Pre-defined templates that pre-fill common patient scenarios
 * to speed up the new patient workflow.
 */

import type { AcuityLevel, CodeStatus } from "@/types/patient";

/**
 * Service line values matching the SERVICE_LINES in NewPatientSheet
 */
export type ServiceLineValue = 
  | "micu" 
  | "sicu" 
  | "cvicu" 
  | "ccu" 
  | "nicu" 
  | "picu" 
  | "medicine" 
  | "surgery" 
  | "ortho" 
  | "neuro" 
  | "trauma" 
  | "oncology" 
  | "burn" 
  | "transplant" 
  | "obgyn";

/**
 * Isolation precaution values matching ISOLATION_OPTIONS in NewPatientSheet
 */
export type IsolationValue = 
  | "none" 
  | "contact" 
  | "droplet" 
  | "airborne" 
  | "neutropenic" 
  | "protective";

/**
 * Data structure for pre-filling form fields
 */
export interface PatientTemplateData {
  serviceLine?: ServiceLineValue;
  attendingPhysician?: string;
  consultingTeam?: string[];
  acuity?: AcuityLevel;
  codeStatus?: CodeStatus;
  /** Allergies - comma-separated in form, array in template */
  allergies?: string[];
  alerts?: string[];
  isolation?: IsolationValue;
}

/**
 * Patient template definition
 */
export interface PatientTemplate {
  /** Unique identifier for the template */
  id: string;
  /** Display name for the template */
  name: string;
  /** Brief description of what this template is for */
  description: string;
  /** Form values to pre-fill when this template is selected */
  data: PatientTemplateData;
}

/**
 * Pre-defined patient templates
 */
export const PATIENT_TEMPLATES: PatientTemplate[] = [
  {
    id: "icu-admission",
    name: "ICU Admission",
    description: "Critical patient in Medical ICU, full code status",
    data: {
      serviceLine: "micu",
      acuity: "critical",
      codeStatus: "full",
    },
  },
  {
    id: "step-down",
    name: "Step-down",
    description: "Moderate acuity patient in SDU",
    data: {
      serviceLine: "sicu",
      acuity: "moderate",
      codeStatus: "full",
    },
  },
  {
    id: "observation",
    name: "Observation",
    description: "Low acuity patient for observation",
    data: {
      serviceLine: "medicine",
      acuity: "low",
      codeStatus: "full",
    },
  },
];

/**
 * Get a template by its ID
 */
export function getTemplateById(id: string): PatientTemplate | undefined {
  return PATIENT_TEMPLATES.find((t) => t.id === id);
}
