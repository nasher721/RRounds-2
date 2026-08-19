/**
 * Clinical Phrase Types for Text Expansion Engine
 */

export type PhraseTriggerType = 'autotext' | 'hotkey' | 'context_menu' | 'smart_suggestion';

export type PhraseFieldType = 
  | 'text' 
  | 'number' 
  | 'date' 
  | 'dropdown' 
  | 'checkbox' 
  | 'radio' 
  | 'patient_data' 
  | 'calculation' 
  | 'conditional';

export interface PhraseFolder {
  id: string;
  userId: string;
  teamId?: string | null;
  parentId?: string | null;
  name: string;
  description?: string | null;
  icon: string;
  sortOrder: number;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
  children?: PhraseFolder[];
}

export interface ContextTriggers {
  noteType?: string[];  // ['H&P', 'Progress Note', 'Discharge Summary']
  section?: string[];   // ['Subjective', 'Assessment', 'Plan']
  timeOfDay?: string[]; // ['morning', 'afternoon', 'evening']
}

export interface ClinicalPhrase {
  id: string;
  userId: string;
  folderId?: string | null;
  name: string;
  description?: string | null;
  content: string;  // Template with {{field_key}} placeholders
  shortcut?: string | null;  // Autotext trigger like ".sob"
  hotkey?: string | null;    // Keyboard shortcut like "ctrl+shift+1"
  contextTriggers: ContextTriggers;
  isActive: boolean;
  isShared: boolean;
  usageCount: number;
  lastUsedAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  fields?: PhraseField[];
}

export interface FieldOption {
  value: string;
  label: string;
}

export interface PatientDataSource {
  source: string;  // 'age' | 'mrn' | 'name' | 'labs.creatinine' | 'meds' | 'allergies'
  format?: string; // Optional formatting
}

export interface FieldValidation {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

export interface ConditionalLogic {
  if: {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
    value?: string | number | boolean;
  };
  then: 'show' | 'hide' | 'require' | 'set_value';
  thenValue?: string;
}

export interface PhraseField {
  id: string;
  phraseId: string;
  fieldKey: string;
  fieldType: PhraseFieldType;
  label: string;
  placeholder?: string | null;
  defaultValue?: string | null;
  options?: FieldOption[] | PatientDataSource | null;
  validation?: FieldValidation | null;
  conditionalLogic?: ConditionalLogic | null;
  calculationFormula?: string | null;  // e.g., "bmi = weight / (height * height)"
  sortOrder: number;
  createdAt: string;
}

export interface PhraseVersion {
  id: string;
  phraseId: string;
  version: number;
  content: string;
  fieldsSnapshot?: PhraseField[] | null;
  changedBy?: string | null;
  changeNote?: string | null;
  createdAt: string;
}

export interface PhraseUsageLog {
  id: string;
  userId: string;
  phraseId: string;
  patientId?: string | null;
  targetField?: string | null;
  createdAt: string;
}

export interface PhraseTeam {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  members?: PhraseTeamMember[];
}

export interface PhraseTeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'viewer' | 'editor' | 'admin';
  createdAt: string;
}

export interface LearnedPhrase {
  id: string;
  userId: string;
  textPattern: string;
  frequency: number;
  suggestedAsPhrase: boolean;
  createdAt: string;
  updatedAt: string;
}

// Form state for dynamic phrase insertion
export interface PhraseFormState {
  phraseId: string;
  fieldValues: Record<string, string | number | boolean | string[]>;
  isValid: boolean;
  errors: Record<string, string>;
}

// Expanded phrase result
export interface ExpandedPhrase {
  content: string;
  usedFields: string[];
  calculatedValues: Record<string, number>;
}

// Smart suggestion
export interface PhraseSuggestion {
  phrase: ClinicalPhrase;
  matchType: 'shortcut' | 'content' | 'context' | 'learned';
  score: number;
}
