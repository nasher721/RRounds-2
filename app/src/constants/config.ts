// Local storage keys - centralized to prevent magic strings
export const STORAGE_KEYS = {
  // Settings
  GLOBAL_FONT_SIZE: 'globalFontSize',
  THEME: 'theme',
  TODOS_ALWAYS_VISIBLE: 'todosAlwaysVisible',
  PATIENT_SORT_BY: 'patientSortBy',
  SHOW_LAB_FISHBONES: 'showLabFishbones',
  SECTION_VISIBILITY: 'sectionVisibility',
  SELECTED_SPECIALTY: 'selectedSpecialty',
  AI_PROVIDER: 'aiProvider',
  AI_MODEL: 'aiModel',
  AI_CREDENTIALS: 'aiCredentials',
  AI_FEATURE_MODELS: 'aiFeatureModels',

  // Editor toolbar (affects all text boxes)
  EDITOR_TOOLBAR_MODE: 'editorToolbarMode',
  EDITOR_TOOLBAR_BUTTONS: 'editorToolbarButtons',

  // Patient info toolbar
  PATIENT_INFO_TOOLBAR_MODE: 'patientInfoToolbarMode',
  PATIENT_INFO_TOOLBAR_BUTTONS: 'patientInfoToolbarButtons',

  // Print preferences
  PRINT_COLUMN_WIDTHS: 'printColumnWidths',
  PRINT_COLUMN_PREFS: 'printColumnPrefs',
  PRINT_FONT_SIZE: 'printFontSize',
  PRINT_FONT_FAMILY: 'printFontFamily',
  PRINT_ONE_PATIENT_PER_PAGE: 'printOnePatientPerPage',
  PRINT_AUTO_FIT_FONT_SIZE: 'printAutoFitFontSize',
  PRINT_COMBINED_COLUMNS: 'printCombinedColumns',
  PRINT_COMBINED_COLUMN_WIDTHS: 'printCombinedColumnWidths',
  PRINT_SYSTEMS_REVIEW_COLUMN_COUNT: 'printSystemsReviewColumnCount',
  PRINT_ORIENTATION: 'printOrientation',
  PRINT_CUSTOM_PRESETS: 'printCustomPresets',
  PRINT_CUSTOM_COMBINATIONS: 'printCustomCombinations',
  PRINT_TEMPLATE_PRESETS: 'printTemplatePresets',
  PRINT_SELECTED_TEMPLATE_ID: 'printSelectedTemplateId',
  PRINT_FORMAT: 'printFormat',
  PRINT_ROUNDS_SETTINGS: 'printRoundsSettings',
} as const;

// Clinical section keys for visibility toggles
export const CLINICAL_SECTIONS = [
  { key: 'clinicalSummary', label: 'Clinical Summary', icon: 'FileText' },
  { key: 'intervalEvents', label: 'Interval Events', icon: 'Calendar' },
  { key: 'imaging', label: 'Imaging', icon: 'ImageIcon' },
  { key: 'labs', label: 'Labs', icon: 'TestTube' },
  { key: 'medications', label: 'Medications', icon: 'Pill' },
  { key: 'systemsReview', label: 'Systems Review', icon: 'Activity' },
] as const;

export type ClinicalSectionKey = typeof CLINICAL_SECTIONS[number]['key'];

export type SectionVisibility = Record<ClinicalSectionKey, boolean>;

export const DEFAULT_SECTION_VISIBILITY: SectionVisibility = {
  clinicalSummary: true,
  intervalEvents: true,
  imaging: true,
  labs: true,
  medications: true,
  systemsReview: true,
};

// Default configuration values
export const DEFAULT_CONFIG = {
  GLOBAL_FONT_SIZE: 14,
  PRINT_FONT_SIZE: 9,
  PRINT_FONT_FAMILY: 'system',
  PRINT_ORIENTATION: 'portrait' as const,
  SYSTEMS_REVIEW_COLUMN_COUNT: 2,
  DEFAULT_SORT_BY: 'room' as const,
  DEFAULT_THEME: 'system' as const,
  SHOW_LAB_FISHBONES: true,
  PRINT_MARGINS: 'normal' as const,
  PRINT_HEADER_STYLE: 'standard' as const,
  PRINT_BORDER_STYLE: 'light' as const,
  PRINT_SHOW_PAGE_NUMBERS: true,
  PRINT_SHOW_TIMESTAMP: true,
  PRINT_ALTERNATE_ROW_COLORS: true,
  PRINT_COMPACT_MODE: false,
} as const;

/** Editor note text uses pixel font size; base matches DEFAULT_CONFIG.GLOBAL_FONT_SIZE for % migration. */
export const GLOBAL_FONT_SIZE_BASE_PX = DEFAULT_CONFIG.GLOBAL_FONT_SIZE;
export const MIN_GLOBAL_FONT_SIZE_PX = 14;
export const MAX_GLOBAL_FONT_SIZE_PX = 24;

/**
 * `globalFontSize` is stored as px (14–24). Legacy bug: desktop showed 85–125 "%" but passed the
 * number through as px (e.g. 100 → 100px). Values in 80–130 are treated as percentages of the base.
 */
export function normalizeGlobalFontSizeToPx(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 8) return DEFAULT_CONFIG.GLOBAL_FONT_SIZE;
  if (n >= 80 && n <= 130) {
    return Math.min(
      MAX_GLOBAL_FONT_SIZE_PX,
      Math.max(
        MIN_GLOBAL_FONT_SIZE_PX,
        Math.round(GLOBAL_FONT_SIZE_BASE_PX * (n / 100)),
      ),
    );
  }
  return Math.min(MAX_GLOBAL_FONT_SIZE_PX, Math.max(MIN_GLOBAL_FONT_SIZE_PX, Math.round(n)));
}

export type Theme = 'light' | 'dark' | 'system';

// Patient filter state enum
export enum PatientFilterType {
  All = 'all',
  Filled = 'filled',
  Empty = 'empty',
  MyPatients = 'myPatients',
}

// Patient info toolbar - available items that can appear in the toolbar
export interface PatientInfoToolbarItem {
  id: string;
  label: string;
  icon: string;
  category: 'patient' | 'clinical' | 'common';
}

export const PATIENT_INFO_TOOLBAR_ITEMS: PatientInfoToolbarItem[] = [
  { id: 'patientName', label: 'Patient Name', icon: 'User', category: 'patient' },
  { id: 'mrn', label: 'MRN', icon: 'Hash', category: 'patient' },
  { id: 'dob', label: 'Date of Birth', icon: 'Calendar', category: 'patient' },
  { id: 'room', label: 'Room', icon: 'DoorOpen', category: 'patient' },
  { id: 'codeStatus', label: 'Code Status', icon: 'AlertCircle', category: 'clinical' },
  { id: 'attending', label: 'Attending', icon: 'Stethoscope', category: 'clinical' },
  { id: 'diagnosis', label: 'Diagnosis', icon: 'ClipboardList', category: 'clinical' },
  { id: 'admissionDate', label: 'Admission Date', icon: 'CalendarDays', category: 'clinical' },
  { id: 'allergies', label: 'Allergies', icon: 'AlertTriangle', category: 'common' },
  { id: 'medications', label: 'Medications', icon: 'Pill', category: 'common' },
  { id: 'vitals', label: 'Vitals', icon: 'Activity', category: 'common' },
  { id: 'labs', label: 'Labs', icon: 'TestTube', category: 'common' },
];

export const DEFAULT_PATIENT_INFO_TOOLBAR_BUTTONS = [
  'patientName', 'mrn', 'room', 'codeStatus', 'allergies',
] as const;
