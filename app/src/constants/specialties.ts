// Medical specialty/role definitions with tailored function visibility

export type SpecialtyCategory =
  | 'physician'
  | 'advanced_practice'
  | 'nursing'
  | 'therapy'
  | 'respiratory'
  | 'pharmacy'
  | 'management';

export type PhysicianSubspecialty =
  | 'critical_care'
  | 'hospitalist'
  | 'neurologist'
  | 'cardiologist'
  | 'pulmonologist'
  | 'nephrologist'
  | 'gastroenterologist'
  | 'infectious_disease'
  | 'general_surgery'
  | 'other';

export interface SpecialtyRole {
  id: string;
  label: string;
  category: SpecialtyCategory;
  subspecialty?: PhysicianSubspecialty;
  description: string;
  /** Which clinical sections are shown by default for this role */
  defaultVisibleSections: string[];
  /** Which quick-action features are surfaced for this role */
  enabledFeatures: SpecialtyFeature[];
}

export type SpecialtyFeature =
  | 'systems_review'
  | 'medications'
  | 'labs'
  | 'imaging'
  | 'interval_events'
  | 'clinical_summary'
  | 'ai_clinical_assistant'
  | 'batch_course_generator'
  | 'medication_formatting'
  | 'daily_summary'
  | 'todo_management'
  | 'clinical_phrases'
  | 'autotexts'
  | 'print_export'
  | 'dictation'
  | 'ventilator_management'
  | 'hemodynamic_monitoring'
  | 'neuro_assessment'
  | 'cardiac_monitoring'
  | 'renal_monitoring'
  | 'wound_care'
  | 'mobility_assessment'
  | 'functional_assessment'
  | 'staffing_overview'
  | 'patient_assignments'
  | 'medication_reconciliation'
  | 'drug_interactions';

export const SPECIALTY_CATEGORIES: { id: SpecialtyCategory; label: string }[] = [
  { id: 'physician', label: 'Physician' },
  { id: 'advanced_practice', label: 'Advanced Practice Provider' },
  { id: 'nursing', label: 'Nursing' },
  { id: 'respiratory', label: 'Respiratory Therapy' },
  { id: 'therapy', label: 'Rehabilitation Therapy' },
  { id: 'pharmacy', label: 'Pharmacy' },
  { id: 'management', label: 'Management' },
];

// Core features available to all roles
const CORE_FEATURES: SpecialtyFeature[] = [
  'clinical_summary',
  'todo_management',
  'clinical_phrases',
  'autotexts',
  'print_export',
];

// All clinical sections
const ALL_SECTIONS = [
  'clinicalSummary',
  'intervalEvents',
  'imaging',
  'labs',
  'medications',
  'systemsReview',
];

export const SPECIALTY_ROLES: SpecialtyRole[] = [
  // ── Physicians ──
  {
    id: 'physician_critical_care',
    label: 'Critical Care',
    category: 'physician',
    subspecialty: 'critical_care',
    description: 'ICU attending or fellow with full systems review',
    defaultVisibleSections: ALL_SECTIONS,
    enabledFeatures: [
      ...CORE_FEATURES,
      'systems_review',
      'medications',
      'labs',
      'imaging',
      'interval_events',
      'ai_clinical_assistant',
      'batch_course_generator',
      'medication_formatting',
      'daily_summary',
      'dictation',
      'ventilator_management',
      'hemodynamic_monitoring',
    ],
  },
  {
    id: 'physician_hospitalist',
    label: 'Hospitalist',
    category: 'physician',
    subspecialty: 'hospitalist',
    description: 'Inpatient medicine attending or resident',
    defaultVisibleSections: ALL_SECTIONS,
    enabledFeatures: [
      ...CORE_FEATURES,
      'systems_review',
      'medications',
      'labs',
      'imaging',
      'interval_events',
      'ai_clinical_assistant',
      'batch_course_generator',
      'medication_formatting',
      'daily_summary',
      'dictation',
    ],
  },
  {
    id: 'physician_neurologist',
    label: 'Neurologist',
    category: 'physician',
    subspecialty: 'neurologist',
    description: 'Neurology attending, fellow, or consultant',
    defaultVisibleSections: ALL_SECTIONS,
    enabledFeatures: [
      ...CORE_FEATURES,
      'systems_review',
      'medications',
      'labs',
      'imaging',
      'interval_events',
      'ai_clinical_assistant',
      'medication_formatting',
      'daily_summary',
      'dictation',
      'neuro_assessment',
    ],
  },
  {
    id: 'physician_cardiologist',
    label: 'Cardiologist',
    category: 'physician',
    subspecialty: 'cardiologist',
    description: 'Cardiology attending, fellow, or consultant',
    defaultVisibleSections: ALL_SECTIONS,
    enabledFeatures: [
      ...CORE_FEATURES,
      'systems_review',
      'medications',
      'labs',
      'imaging',
      'interval_events',
      'ai_clinical_assistant',
      'medication_formatting',
      'daily_summary',
      'dictation',
      'cardiac_monitoring',
      'hemodynamic_monitoring',
    ],
  },
  {
    id: 'physician_pulmonologist',
    label: 'Pulmonologist',
    category: 'physician',
    subspecialty: 'pulmonologist',
    description: 'Pulmonary medicine attending or fellow',
    defaultVisibleSections: ALL_SECTIONS,
    enabledFeatures: [
      ...CORE_FEATURES,
      'systems_review',
      'medications',
      'labs',
      'imaging',
      'interval_events',
      'ai_clinical_assistant',
      'medication_formatting',
      'daily_summary',
      'dictation',
      'ventilator_management',
    ],
  },
  {
    id: 'physician_nephrologist',
    label: 'Nephrologist',
    category: 'physician',
    subspecialty: 'nephrologist',
    description: 'Nephrology attending or fellow',
    defaultVisibleSections: ALL_SECTIONS,
    enabledFeatures: [
      ...CORE_FEATURES,
      'systems_review',
      'medications',
      'labs',
      'imaging',
      'interval_events',
      'ai_clinical_assistant',
      'medication_formatting',
      'daily_summary',
      'dictation',
      'renal_monitoring',
    ],
  },
  {
    id: 'physician_gastroenterologist',
    label: 'Gastroenterologist',
    category: 'physician',
    subspecialty: 'gastroenterologist',
    description: 'GI attending or fellow',
    defaultVisibleSections: ALL_SECTIONS,
    enabledFeatures: [
      ...CORE_FEATURES,
      'systems_review',
      'medications',
      'labs',
      'imaging',
      'interval_events',
      'ai_clinical_assistant',
      'medication_formatting',
      'daily_summary',
      'dictation',
    ],
  },
  {
    id: 'physician_infectious_disease',
    label: 'Infectious Disease',
    category: 'physician',
    subspecialty: 'infectious_disease',
    description: 'ID attending or fellow',
    defaultVisibleSections: ALL_SECTIONS,
    enabledFeatures: [
      ...CORE_FEATURES,
      'systems_review',
      'medications',
      'labs',
      'imaging',
      'interval_events',
      'ai_clinical_assistant',
      'medication_formatting',
      'daily_summary',
      'dictation',
    ],
  },
  {
    id: 'physician_general_surgery',
    label: 'General Surgery',
    category: 'physician',
    subspecialty: 'general_surgery',
    description: 'Surgical attending or resident',
    defaultVisibleSections: ALL_SECTIONS,
    enabledFeatures: [
      ...CORE_FEATURES,
      'systems_review',
      'medications',
      'labs',
      'imaging',
      'interval_events',
      'ai_clinical_assistant',
      'medication_formatting',
      'daily_summary',
      'dictation',
      'wound_care',
    ],
  },
  {
    id: 'physician_other',
    label: 'Other Physician',
    category: 'physician',
    subspecialty: 'other',
    description: 'Other physician specialty',
    defaultVisibleSections: ALL_SECTIONS,
    enabledFeatures: [
      ...CORE_FEATURES,
      'systems_review',
      'medications',
      'labs',
      'imaging',
      'interval_events',
      'ai_clinical_assistant',
      'medication_formatting',
      'daily_summary',
      'dictation',
    ],
  },

  // ── Advanced Practice Providers ──
  {
    id: 'nurse_practitioner',
    label: 'Nurse Practitioner',
    category: 'advanced_practice',
    description: 'NP with prescriptive authority',
    defaultVisibleSections: ALL_SECTIONS,
    enabledFeatures: [
      ...CORE_FEATURES,
      'systems_review',
      'medications',
      'labs',
      'imaging',
      'interval_events',
      'ai_clinical_assistant',
      'medication_formatting',
      'daily_summary',
      'dictation',
    ],
  },
  {
    id: 'physician_assistant',
    label: 'Physician Assistant',
    category: 'advanced_practice',
    description: 'PA working in inpatient setting',
    defaultVisibleSections: ALL_SECTIONS,
    enabledFeatures: [
      ...CORE_FEATURES,
      'systems_review',
      'medications',
      'labs',
      'imaging',
      'interval_events',
      'ai_clinical_assistant',
      'medication_formatting',
      'daily_summary',
      'dictation',
    ],
  },

  // ── Nursing ──
  {
    id: 'registered_nurse',
    label: 'Registered Nurse',
    category: 'nursing',
    description: 'Bedside RN focused on assessments and medications',
    defaultVisibleSections: ['clinicalSummary', 'medications', 'labs', 'systemsReview'],
    enabledFeatures: [
      ...CORE_FEATURES,
      'medications',
      'labs',
      'interval_events',
      'systems_review',
      'wound_care',
    ],
  },
  {
    id: 'charge_nurse',
    label: 'Charge Nurse',
    category: 'nursing',
    description: 'Charge nurse with patient assignment oversight',
    defaultVisibleSections: ['clinicalSummary', 'medications', 'labs', 'systemsReview'],
    enabledFeatures: [
      ...CORE_FEATURES,
      'medications',
      'labs',
      'interval_events',
      'systems_review',
      'patient_assignments',
    ],
  },
  {
    id: 'nurse_manager',
    label: 'Nurse Manager',
    category: 'management',
    description: 'Unit manager with staffing and quality oversight',
    defaultVisibleSections: ['clinicalSummary', 'intervalEvents'],
    enabledFeatures: [
      ...CORE_FEATURES,
      'interval_events',
      'staffing_overview',
      'patient_assignments',
    ],
  },

  // ── Respiratory Therapy ──
  {
    id: 'respiratory_therapist',
    label: 'Respiratory Therapist',
    category: 'respiratory',
    description: 'RT focused on ventilator management and respiratory care',
    defaultVisibleSections: ['clinicalSummary', 'medications', 'labs', 'systemsReview'],
    enabledFeatures: [
      ...CORE_FEATURES,
      'medications',
      'labs',
      'systems_review',
      'ventilator_management',
    ],
  },

  // ── Rehabilitation Therapy ──
  {
    id: 'physical_therapist',
    label: 'Physical Therapist',
    category: 'therapy',
    description: 'PT focused on mobility and functional status',
    defaultVisibleSections: ['clinicalSummary', 'medications', 'systemsReview'],
    enabledFeatures: [
      ...CORE_FEATURES,
      'medications',
      'systems_review',
      'mobility_assessment',
    ],
  },
  {
    id: 'occupational_therapist',
    label: 'Occupational Therapist',
    category: 'therapy',
    description: 'OT focused on ADLs and functional independence',
    defaultVisibleSections: ['clinicalSummary', 'medications', 'systemsReview'],
    enabledFeatures: [
      ...CORE_FEATURES,
      'medications',
      'systems_review',
      'functional_assessment',
    ],
  },
  {
    id: 'speech_therapist',
    label: 'Speech-Language Pathologist',
    category: 'therapy',
    description: 'SLP focused on swallowing and communication',
    defaultVisibleSections: ['clinicalSummary', 'medications', 'systemsReview'],
    enabledFeatures: [
      ...CORE_FEATURES,
      'medications',
      'systems_review',
    ],
  },

  // ── Pharmacy ──
  {
    id: 'clinical_pharmacist',
    label: 'Clinical Pharmacist',
    category: 'pharmacy',
    description: 'Pharmacist focused on medication safety and optimization',
    defaultVisibleSections: ['clinicalSummary', 'medications', 'labs'],
    enabledFeatures: [
      ...CORE_FEATURES,
      'medications',
      'labs',
      'medication_formatting',
      'medication_reconciliation',
      'drug_interactions',
    ],
  },
];

/** Feature labels and descriptions for the UI */
export const FEATURE_METADATA: Record<SpecialtyFeature, { label: string; description: string }> = {
  systems_review: { label: 'Systems Review', description: '10-system clinical assessment' },
  medications: { label: 'Medications', description: 'Infusions, scheduled, and PRN medications' },
  labs: { label: 'Labs', description: 'Lab results and trending' },
  imaging: { label: 'Imaging', description: 'Radiology and imaging studies' },
  interval_events: { label: 'Interval Events', description: 'Events since last assessment' },
  clinical_summary: { label: 'Clinical Summary', description: 'Patient overview and one-liner' },
  ai_clinical_assistant: { label: 'AI Clinical Assistant', description: 'AI-powered clinical decision support' },
  batch_course_generator: { label: 'Batch Course Generator', description: 'Generate hospital courses for multiple patients' },
  medication_formatting: { label: 'Medication Formatting', description: 'AI-assisted medication list formatting' },
  daily_summary: { label: 'Daily Summary', description: 'Generate daily progress notes' },
  todo_management: { label: 'Todo Management', description: 'Patient-specific task lists' },
  clinical_phrases: { label: 'Clinical Phrases', description: 'Reusable clinical text blocks' },
  autotexts: { label: 'Autotexts', description: 'Quick text expansion shortcuts' },
  print_export: { label: 'Print / Export', description: 'PDF, Excel, and print output' },
  dictation: { label: 'Dictation', description: 'Audio transcription for notes' },
  ventilator_management: { label: 'Ventilator Management', description: 'Vent settings and weaning protocols' },
  hemodynamic_monitoring: { label: 'Hemodynamic Monitoring', description: 'Pressors, fluid balance, and hemodynamics' },
  neuro_assessment: { label: 'Neuro Assessment', description: 'GCS, pupil checks, and neuro exam tracking' },
  cardiac_monitoring: { label: 'Cardiac Monitoring', description: 'Telemetry, rhythms, and cardiac output' },
  renal_monitoring: { label: 'Renal Monitoring', description: 'Dialysis, UOP, and renal labs' },
  wound_care: { label: 'Wound Care', description: 'Wound assessment and dressing tracking' },
  mobility_assessment: { label: 'Mobility Assessment', description: 'Functional mobility and fall risk' },
  functional_assessment: { label: 'Functional Assessment', description: 'ADL performance and cognitive status' },
  staffing_overview: { label: 'Staffing Overview', description: 'Unit staffing and acuity tracking' },
  patient_assignments: { label: 'Patient Assignments', description: 'Nurse-patient assignment management' },
  medication_reconciliation: { label: 'Med Reconciliation', description: 'Medication reconciliation workflow' },
  drug_interactions: { label: 'Drug Interactions', description: 'Drug interaction checking and alerts' },
};

/** Get all roles for a given category */
export function getRolesByCategory(category: SpecialtyCategory): SpecialtyRole[] {
  return SPECIALTY_ROLES.filter(r => r.category === category);
}

/** Get a role by its ID */
export function getRoleById(id: string): SpecialtyRole | undefined {
  return SPECIALTY_ROLES.find(r => r.id === id);
}

/** Check if a feature is enabled for a given role */
export function isFeatureEnabled(roleId: string, feature: SpecialtyFeature): boolean {
  const role = getRoleById(roleId);
  if (!role) return true; // If no role selected, enable everything
  return role.enabledFeatures.includes(feature);
}
