/**
 * Enhanced Print Template Types
 * Supports multiple customizable print formats
 */

export type PrintTemplateType =
  | 'standard'
  | 'compact'
  | 'detailed'
  | 'sbar'
  | 'handoff'
  | 'signout'
  | 'nursing'
  | 'icuRounds'
  | 'brief'
  | 'progressNotes'
  | 'consult'
  | 'weeklyReview'
  | 'custom';

export interface PrintTemplate {
  id: PrintTemplateType;
  name: string;
  description: string;
  icon: string;
  sections: PrintSection[];
  layout: PrintLayout;
  styling: PrintStyling;
}

export interface PrintSection {
  key: string;
  label: string;
  enabled: boolean;
  order: number;
  required?: boolean;
}

export interface PrintLayout {
  columns: 1 | 2 | 3;
  patientsPerPage: number | 'auto';
  orientation: 'portrait' | 'landscape';
  margins: 'narrow' | 'normal' | 'wide';
  headerStyle: 'minimal' | 'standard' | 'detailed';
  showPageNumbers: boolean;
  showTimestamp: boolean;
  groupBy?: 'none' | 'location' | 'acuity' | 'team';
  viewType: 'table' | 'list' | 'cards';
}

export interface PrintStyling {
  fontSize: number;
  fontFamily: string;
  headerColor: string;
  accentColor: string;
  borderStyle: 'none' | 'light' | 'medium' | 'heavy';
  alternateRowColors: boolean;
  compactMode: boolean;
}

export interface PrintTemplatePreset {
  id: string;
  name: string;
  templateType: PrintTemplateType;
  customizations: Partial<PrintTemplate>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// Default print templates
export const PRINT_TEMPLATES: PrintTemplate[] = [
  {
    id: 'standard',
    name: 'Standard Rounding',
    description: 'Comprehensive patient overview for daily rounds',
    icon: 'FileText',
    sections: [
      { key: 'patient', label: 'Patient Info', enabled: true, order: 0, required: true },
      { key: 'clinicalSummary', label: 'Clinical Summary', enabled: true, order: 1 },
      { key: 'intervalEvents', label: 'Interval Events', enabled: true, order: 2 },
      { key: 'imaging', label: 'Imaging', enabled: true, order: 3 },
      { key: 'labs', label: 'Labs', enabled: true, order: 4 },
      { key: 'systems', label: 'Systems Review', enabled: true, order: 5 },
      { key: 'medications', label: 'Medications', enabled: true, order: 6 },
      { key: 'todos', label: 'Action Items', enabled: true, order: 7 },
      { key: 'notes', label: 'Notes', enabled: false, order: 8 },
    ],
    layout: {
      columns: 1,
      patientsPerPage: 'auto',
      orientation: 'portrait',
      margins: 'normal',
      headerStyle: 'standard',
      showPageNumbers: true,
      showTimestamp: true,
      viewType: 'cards',
    },
    styling: {
      fontSize: 10,
      fontFamily: 'system',
      headerColor: '#3b82f6',
      accentColor: '#60a5fa',
      borderStyle: 'light',
      alternateRowColors: true,
      compactMode: false,
    },
  },
  {
    id: 'compact',
    name: 'Compact List',
    description: 'Condensed view for quick reference',
    icon: 'List',
    sections: [
      { key: 'patient', label: 'Patient', enabled: true, order: 0, required: true },
      { key: 'clinicalSummary', label: 'Summary', enabled: true, order: 1 },
      { key: 'labs', label: 'Labs', enabled: true, order: 2 },
      { key: 'todos', label: 'Tasks', enabled: true, order: 3 },
    ],
    layout: {
      columns: 2,
      patientsPerPage: 8,
      orientation: 'landscape',
      margins: 'narrow',
      headerStyle: 'minimal',
      showPageNumbers: true,
      showTimestamp: false,
      viewType: 'list',
    },
    styling: {
      fontSize: 8,
      fontFamily: 'arial',
      headerColor: '#6b7280',
      accentColor: '#9ca3af',
      borderStyle: 'light',
      alternateRowColors: false,
      compactMode: true,
    },
  },
  {
    id: 'detailed',
    name: 'Detailed Report',
    description: 'Full documentation with all systems',
    icon: 'FileSpreadsheet',
    sections: [
      { key: 'patient', label: 'Patient Info', enabled: true, order: 0, required: true },
      { key: 'clinicalSummary', label: 'Clinical Summary', enabled: true, order: 1 },
      { key: 'intervalEvents', label: 'Interval Events', enabled: true, order: 2 },
      { key: 'imaging', label: 'Imaging', enabled: true, order: 3 },
      { key: 'labs', label: 'Labs', enabled: true, order: 4 },
      { key: 'systems.neuro', label: 'Neuro', enabled: true, order: 5 },
      { key: 'systems.cv', label: 'Cardiovascular', enabled: true, order: 6 },
      { key: 'systems.resp', label: 'Respiratory', enabled: true, order: 7 },
      { key: 'systems.renalGU', label: 'Renal/GU', enabled: true, order: 8 },
      { key: 'systems.gi', label: 'GI/Nutrition', enabled: true, order: 9 },
      { key: 'systems.endo', label: 'Endocrine', enabled: true, order: 10 },
      { key: 'systems.heme', label: 'Hematology', enabled: true, order: 11 },
      { key: 'systems.infectious', label: 'Infectious Disease', enabled: true, order: 12 },
      { key: 'systems.skinLines', label: 'Skin/Lines', enabled: true, order: 13 },
      { key: 'systems.dispo', label: 'Disposition', enabled: true, order: 14 },
      { key: 'medications', label: 'Medications', enabled: true, order: 15 },
      { key: 'todos', label: 'Action Items', enabled: true, order: 16 },
      { key: 'notes', label: 'Notes', enabled: true, order: 17 },
    ],
    layout: {
      columns: 1,
      patientsPerPage: 1,
      orientation: 'portrait',
      margins: 'normal',
      headerStyle: 'detailed',
      showPageNumbers: true,
      showTimestamp: true,
      viewType: 'table',
    },
    styling: {
      fontSize: 9,
      fontFamily: 'times',
      headerColor: '#1e40af',
      accentColor: '#3b82f6',
      borderStyle: 'medium',
      alternateRowColors: true,
      compactMode: false,
    },
  },
  {
    id: 'sbar',
    name: 'SBAR Format',
    description: 'Situation-Background-Assessment-Recommendation',
    icon: 'MessageSquare',
    sections: [
      { key: 'patient', label: 'Patient', enabled: true, order: 0, required: true },
      { key: 'situation', label: 'Situation', enabled: true, order: 1 },
      { key: 'background', label: 'Background', enabled: true, order: 2 },
      { key: 'assessment', label: 'Assessment', enabled: true, order: 3 },
      { key: 'recommendation', label: 'Recommendation', enabled: true, order: 4 },
    ],
    layout: {
      columns: 1,
      patientsPerPage: 2,
      orientation: 'portrait',
      margins: 'normal',
      headerStyle: 'standard',
      showPageNumbers: true,
      showTimestamp: true,
      viewType: 'cards',
    },
    styling: {
      fontSize: 11,
      fontFamily: 'arial',
      headerColor: '#059669',
      accentColor: '#10b981',
      borderStyle: 'medium',
      alternateRowColors: false,
      compactMode: false,
    },
  },
  {
    id: 'handoff',
    name: 'Shift Handoff',
    description: 'Optimized for end-of-shift transitions',
    icon: 'ArrowRightLeft',
    sections: [
      { key: 'patient', label: 'Patient', enabled: true, order: 0, required: true },
      { key: 'clinicalSummary', label: 'One-Liner', enabled: true, order: 1 },
      { key: 'intervalEvents', label: 'Overnight/Recent Events', enabled: true, order: 2 },
      { key: 'labs', label: 'Key Labs', enabled: true, order: 3 },
      { key: 'todos', label: 'Pending Tasks', enabled: true, order: 4 },
      { key: 'anticipatory', label: 'Anticipatory Guidance', enabled: true, order: 5 },
      { key: 'contingencies', label: 'If-Then Plans', enabled: true, order: 6 },
    ],
    layout: {
      columns: 1,
      patientsPerPage: 3,
      orientation: 'portrait',
      margins: 'normal',
      headerStyle: 'standard',
      showPageNumbers: true,
      showTimestamp: true,
      viewType: 'cards',
    },
    styling: {
      fontSize: 10,
      fontFamily: 'arial',
      headerColor: '#7c3aed',
      accentColor: '#a78bfa',
      borderStyle: 'medium',
      alternateRowColors: true,
      compactMode: false,
    },
  },
  {
    id: 'signout',
    name: 'Sign-Out Sheet',
    description: 'Concise cross-cover information',
    icon: 'ClipboardCheck',
    sections: [
      { key: 'patient', label: 'Patient', enabled: true, order: 0, required: true },
      { key: 'clinicalSummary', label: 'Brief Summary', enabled: true, order: 1 },
      { key: 'codeStatus', label: 'Code Status', enabled: true, order: 2 },
      { key: 'allergies', label: 'Allergies', enabled: true, order: 3 },
      { key: 'todos', label: 'To Do', enabled: true, order: 4 },
      { key: 'contingencies', label: 'If/Then', enabled: true, order: 5 },
    ],
    layout: {
      columns: 2,
      patientsPerPage: 6,
      orientation: 'landscape',
      margins: 'narrow',
      headerStyle: 'minimal',
      showPageNumbers: true,
      showTimestamp: true,
      viewType: 'list',
    },
    styling: {
      fontSize: 9,
      fontFamily: 'arial',
      headerColor: '#dc2626',
      accentColor: '#f87171',
      borderStyle: 'light',
      alternateRowColors: true,
      compactMode: true,
    },
  },
  {
    id: 'nursing',
    name: 'Nursing Report',
    description: 'Focus on care tasks and assessments',
    icon: 'Heart',
    sections: [
      { key: 'patient', label: 'Patient', enabled: true, order: 0, required: true },
      { key: 'diagnosis', label: 'Primary Diagnosis', enabled: true, order: 1 },
      { key: 'vitals', label: 'Vital Signs', enabled: true, order: 2 },
      { key: 'systems.neuro', label: 'Neuro', enabled: true, order: 3 },
      { key: 'systems.cv', label: 'CV', enabled: true, order: 4 },
      { key: 'systems.resp', label: 'Resp', enabled: true, order: 5 },
      { key: 'systems.gi', label: 'GI', enabled: true, order: 6 },
      { key: 'systems.skinLines', label: 'Skin/Lines', enabled: true, order: 7 },
      { key: 'medications', label: 'Key Meds', enabled: true, order: 8 },
      { key: 'todos', label: 'Care Tasks', enabled: true, order: 9 },
    ],
    layout: {
      columns: 1,
      patientsPerPage: 2,
      orientation: 'portrait',
      margins: 'normal',
      headerStyle: 'standard',
      showPageNumbers: true,
      showTimestamp: true,
      viewType: 'cards',
    },
    styling: {
      fontSize: 10,
      fontFamily: 'arial',
      headerColor: '#db2777',
      accentColor: '#f472b6',
      borderStyle: 'medium',
      alternateRowColors: true,
      compactMode: false,
    },
  },
  {
    id: 'icuRounds',
    name: 'ICU Rounds',
    description: 'Structured ICU presentation format',
    icon: 'Activity',
    sections: [
      { key: 'patient', label: 'Patient', enabled: true, order: 0, required: true },
      { key: 'events', label: 'Events/Overnight', enabled: true, order: 1 },
      { key: 'vitals', label: 'Vitals', enabled: true, order: 2 },
      { key: 'vent', label: 'Vent Settings', enabled: true, order: 3 },
      { key: 'sedation', label: 'Sedation/Pain', enabled: true, order: 4 },
      { key: 'systems.neuro', label: 'Neuro', enabled: true, order: 5 },
      { key: 'systems.cv', label: 'CV', enabled: true, order: 6 },
      { key: 'systems.resp', label: 'Resp', enabled: true, order: 7 },
      { key: 'systems.renalGU', label: 'Renal/FEN', enabled: true, order: 8 },
      { key: 'systems.gi', label: 'GI/Nutrition', enabled: true, order: 9 },
      { key: 'systems.infectious', label: 'ID', enabled: true, order: 10 },
      { key: 'systems.heme', label: 'Heme', enabled: true, order: 11 },
      { key: 'systems.endo', label: 'Endo', enabled: true, order: 12 },
      { key: 'prophylaxis', label: 'Prophylaxis', enabled: true, order: 13 },
      { key: 'labs', label: 'Labs', enabled: true, order: 14 },
      { key: 'imaging', label: 'Imaging', enabled: true, order: 15 },
      { key: 'todos', label: 'Plan', enabled: true, order: 16 },
    ],
    layout: {
      columns: 1,
      patientsPerPage: 1,
      orientation: 'portrait',
      margins: 'normal',
      headerStyle: 'detailed',
      showPageNumbers: true,
      showTimestamp: true,
      viewType: 'cards',
    },
    styling: {
      fontSize: 9,
      fontFamily: 'arial',
      headerColor: '#0891b2',
      accentColor: '#22d3ee',
      borderStyle: 'medium',
      alternateRowColors: false,
      compactMode: false,
    },
  },
  {
    id: 'brief',
    name: 'Quick Brief',
    description: 'Ultra-condensed patient list',
    icon: 'Zap',
    sections: [
      { key: 'patient', label: 'Pt', enabled: true, order: 0, required: true },
      { key: 'oneLiner', label: 'One-Liner', enabled: true, order: 1 },
      { key: 'status', label: 'Status', enabled: true, order: 2 },
    ],
    layout: {
      columns: 3,
      patientsPerPage: 12,
      orientation: 'landscape',
      margins: 'narrow',
      headerStyle: 'minimal',
      showPageNumbers: false,
      showTimestamp: false,
      viewType: 'list',
    },
    styling: {
      fontSize: 7,
      fontFamily: 'arial',
      headerColor: '#374151',
      accentColor: '#6b7280',
      borderStyle: 'light',
      alternateRowColors: true,
      compactMode: true,
    },
  },
  {
    id: 'progressNotes',
    name: 'Progress Notes',
    description: 'Structured narrative template for daily progress notes',
    icon: 'FileText',
    sections: [
      { key: 'patient', label: 'Patient', enabled: true, order: 0, required: true },
      { key: 'clinicalSummary', label: 'Clinical Summary', enabled: true, order: 1 },
      { key: 'intervalEvents', label: 'Interval Events', enabled: true, order: 2 },
      { key: 'labs', label: 'Labs', enabled: true, order: 3 },
      { key: 'imaging', label: 'Imaging', enabled: true, order: 4 },
      { key: 'todos', label: 'Plan', enabled: true, order: 5 },
      { key: 'notes', label: 'Notes', enabled: true, order: 6 },
    ],
    layout: {
      columns: 1,
      patientsPerPage: 1,
      orientation: 'portrait',
      margins: 'normal',
      headerStyle: 'detailed',
      showPageNumbers: true,
      showTimestamp: true,
      viewType: 'table',
    },
    styling: {
      fontSize: 10,
      fontFamily: 'times',
      headerColor: '#0f172a',
      accentColor: '#64748b',
      borderStyle: 'medium',
      alternateRowColors: false,
      compactMode: false,
    },
  },
  {
    id: 'consult',
    name: 'Consult',
    description: 'Focused consult summary for specialty input',
    icon: 'MessageSquare',
    sections: [
      { key: 'patient', label: 'Patient', enabled: true, order: 0, required: true },
      { key: 'clinicalSummary', label: 'Consult Question', enabled: true, order: 1 },
      { key: 'intervalEvents', label: 'Key Events', enabled: true, order: 2 },
      { key: 'labs', label: 'Pertinent Labs', enabled: true, order: 3 },
      { key: 'imaging', label: 'Pertinent Imaging', enabled: true, order: 4 },
      { key: 'todos', label: 'Recommendations', enabled: true, order: 5 },
    ],
    layout: {
      columns: 1,
      patientsPerPage: 2,
      orientation: 'portrait',
      margins: 'normal',
      headerStyle: 'standard',
      showPageNumbers: true,
      showTimestamp: true,
      viewType: 'cards',
    },
    styling: {
      fontSize: 10,
      fontFamily: 'arial',
      headerColor: '#0ea5e9',
      accentColor: '#38bdf8',
      borderStyle: 'light',
      alternateRowColors: true,
      compactMode: false,
    },
  },
  {
    id: 'weeklyReview',
    name: 'Weekly Review',
    description: 'Summary layout for weekly review rounds',
    icon: 'List',
    sections: [
      { key: 'patient', label: 'Patient', enabled: true, order: 0, required: true },
      { key: 'clinicalSummary', label: 'Summary', enabled: true, order: 1 },
      { key: 'intervalEvents', label: 'Major Events', enabled: true, order: 2 },
      { key: 'labs', label: 'Trends', enabled: true, order: 3 },
      { key: 'imaging', label: 'Imaging', enabled: true, order: 4 },
      { key: 'todos', label: 'Weekly Goals', enabled: true, order: 5 },
    ],
    layout: {
      columns: 2,
      patientsPerPage: 4,
      orientation: 'landscape',
      margins: 'normal',
      headerStyle: 'standard',
      showPageNumbers: true,
      showTimestamp: false,
      viewType: 'list',
    },
    styling: {
      fontSize: 9,
      fontFamily: 'arial',
      headerColor: '#6366f1',
      accentColor: '#818cf8',
      borderStyle: 'light',
      alternateRowColors: true,
      compactMode: true,
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Build your own layout from scratch',
    icon: 'FileSpreadsheet',
    sections: [
      { key: 'patient', label: 'Patient', enabled: true, order: 0, required: true },
      { key: 'clinicalSummary', label: 'Summary', enabled: true, order: 1 },
      { key: 'intervalEvents', label: 'Events', enabled: true, order: 2 },
      { key: 'imaging', label: 'Imaging', enabled: true, order: 3 },
      { key: 'labs', label: 'Labs', enabled: true, order: 4 },
      { key: 'todos', label: 'Todos', enabled: true, order: 5 },
      { key: 'notes', label: 'Notes', enabled: true, order: 6 },
    ],
    layout: {
      columns: 1,
      patientsPerPage: 'auto',
      orientation: 'portrait',
      margins: 'normal',
      headerStyle: 'standard',
      showPageNumbers: true,
      showTimestamp: true,
      viewType: 'table',
    },
    styling: {
      fontSize: 10,
      fontFamily: 'system',
      headerColor: '#111827',
      accentColor: '#6b7280',
      borderStyle: 'light',
      alternateRowColors: true,
      compactMode: false,
    },
  },
];

// Helper to get template by ID
export const getTemplateById = (id: PrintTemplateType): PrintTemplate | undefined => {
  return PRINT_TEMPLATES.find(t => t.id === id);
};

// Helper to merge template with customizations
export const mergeTemplateCustomizations = (
  template: PrintTemplate,
  customizations: Partial<PrintTemplate>
): PrintTemplate => {
  return {
    ...template,
    ...customizations,
    sections: customizations.sections || template.sections,
    layout: { ...template.layout, ...customizations.layout },
    styling: { ...template.styling, ...customizations.styling },
  };
};
