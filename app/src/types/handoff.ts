/**
 * Shift Handoff Types
 * SBAR format and handoff workflow support
 */

import { stripHtml } from '@/lib/sanitize';

export interface SBARNote {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

export interface HandoffData {
  id: string;
  patientId: string;
  patientName: string;
  bed: string;

  // Core SBAR
  sbar: SBARNote;

  // Additional handoff fields
  oneLiner: string;
  codeStatus: string;
  allergies: string[];

  // Active issues
  activeProblems: string[];
  keyMedications: string[];

  // Pending items
  pendingTasks: HandoffTask[];
  pendingLabs: string[];
  pendingConsults: string[];
  pendingProcedures: string[];

  // Anticipatory guidance
  anticipatoryGuidance: string;
  ifThenPlans: IfThenPlan[];

  // Contact info
  primaryTeam: string;
  attendingPhysician: string;
  consultants: string[];
  familyContact?: string;

  // Metadata
  createdAt: string;
  createdBy: string;
  shiftType: 'day' | 'night' | 'weekend';
  handoffTime?: string;
  receivedBy?: string;
  receivedAt?: string;
  signedOff: boolean;
}

export interface HandoffTask {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dueTime?: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface IfThenPlan {
  id: string;
  condition: string;
  action: string;
  priority: 'urgent' | 'routine';
  contactOnCall?: boolean;
}

export interface HandoffSession {
  id: string;
  date: string;
  shiftType: 'day' | 'night' | 'weekend';
  outgoingProvider: string;
  incomingProvider: string;
  startTime: string;
  endTime?: string;
  patientHandoffs: string[]; // HandoffData IDs
  status: 'in_progress' | 'completed' | 'signed_off';
  notes?: string;
}

// Default empty SBAR
export const defaultSBAR: SBARNote = {
  situation: '',
  background: '',
  assessment: '',
  recommendation: '',
};

// Default empty handoff
export const createEmptyHandoff = (patientId: string, patientName: string, bed: string): HandoffData => ({
  id: `handoff-${patientId}-${Date.now()}`,
  patientId,
  patientName,
  bed,
  sbar: { ...defaultSBAR },
  oneLiner: '',
  codeStatus: '',
  allergies: [],
  activeProblems: [],
  keyMedications: [],
  pendingTasks: [],
  pendingLabs: [],
  pendingConsults: [],
  pendingProcedures: [],
  anticipatoryGuidance: '',
  ifThenPlans: [],
  primaryTeam: '',
  attendingPhysician: '',
  consultants: [],
  createdAt: new Date().toISOString(),
  createdBy: '',
  shiftType: 'day',
  signedOff: false,
});

// Helper to generate SBAR from patient data
export const generateSBARFromPatient = (patient: {
  name: string;
  bed: string;
  clinicalSummary: string;
  intervalEvents: string;
  labs: string;
  systems: Record<string, string>;
}): SBARNote => {
  // Extract key info for SBAR sections

  const situation = `${patient.name} in ${patient.bed}. ${stripHtml(patient.intervalEvents).slice(0, 200)}`;
  const background = stripHtml(patient.clinicalSummary).slice(0, 500);
  const assessment = Object.entries(patient.systems)
    .filter(([_, v]) => v && stripHtml(v).trim())
    .map(([k, v]) => `${k}: ${stripHtml(v).slice(0, 100)}`)
    .join('; ');
  const recommendation = ''; // To be filled by user

  return {
    situation,
    background,
    assessment,
    recommendation,
  };
};

// SBAR Templates
export const SBAR_TEMPLATES = {
  general: {
    situation: 'Patient [NAME] is a [AGE] year old [GENDER] admitted for [DIAGNOSIS]. Current status: [STABLE/UNSTABLE].',
    background: 'Relevant PMH includes [CONDITIONS]. This admission began [DATE] for [REASON]. Hospital course has been notable for [EVENTS].',
    assessment: 'Currently: [VITAL STABILITY]. Key concerns: [ISSUES]. Active problems: [LIST].',
    recommendation: 'Plan: [IMMEDIATE TASKS]. Anticipatory guidance: [IF/THEN]. Contact me if: [CRITERIA].',
  },
  deteriorating: {
    situation: 'I am calling about [PATIENT] who is acutely [SYMPTOM]. This is [URGENT/EMERGENT].',
    background: '[PATIENT] was admitted for [DIAGNOSIS]. Baseline status was [DESCRIPTION]. Recent changes include [EVENTS].',
    assessment: 'Vital signs: [VALUES]. Physical exam notable for [FINDINGS]. I am concerned about [DIFFERENTIAL].',
    recommendation: 'I need [SPECIFIC REQUEST]. Please [ACTION] immediately. Time-sensitive because [REASON].',
  },
  stable: {
    situation: '[PATIENT] in [BED] is stable and doing well overnight/today.',
    background: 'Admitted [DATE] for [DIAGNOSIS]. Hospital course: [BRIEF SUMMARY].',
    assessment: 'Currently at baseline. No acute issues. Progressing toward [GOAL].',
    recommendation: 'Continue current plan. Pending: [TASKS]. Anticipated discharge: [TIMEFRAME].',
  },
};

// Code status options
export const CODE_STATUS_OPTIONS = [
  { value: 'full', label: 'Full Code', color: 'green' },
  { value: 'dnr', label: 'DNR', color: 'yellow' },
  { value: 'dnr-dni', label: 'DNR/DNI', color: 'orange' },
  { value: 'comfort', label: 'Comfort Care Only', color: 'purple' },
  { value: 'limited', label: 'Limited Code', color: 'blue' },
];
