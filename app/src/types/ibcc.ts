/**
 * IBCC (Internet Book of Critical Care) Types
 * Type definitions for clinical reference integration
 */

// ============================================
// Core Chapter Types
// ============================================

export interface IBCCChapter {
  id: string;
  title: string;
  slug: string;
  url: string;
  category: IBCCCategory;
  system: MedicalSystem;
  keywords: string[];
  summary: string;
  lastUpdated?: string;
  isBookmarked?: boolean;
  // Enhanced content - optional for backwards compatibility
  content?: IBCCChapterContent;
}

export interface IBCCCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export type MedicalSystem = 
  | 'cardiology'
  | 'pulmonology'
  | 'nephrology'
  | 'neurology'
  | 'infectious'
  | 'endocrine'
  | 'hematology'
  | 'gi'
  | 'toxicology'
  | 'resuscitation'
  | 'procedures'
  | 'general';

// ============================================
// Comprehensive Chapter Content Types
// ============================================

export interface IBCCChapterContent {
  /** Critical clinical points - most important takeaways */
  keyPearls: ClinicalPearl[];
  /** Diagnostic criteria and workup */
  diagnosticCriteria?: DiagnosticSection[];
  /** Step-by-step treatment approach */
  treatmentAlgorithm?: TreatmentStep[];
  /** Medication dosing information */
  medications?: MedicationDosing[];
  /** Common mistakes to avoid */
  pitfalls?: ClinicalPitfall[];
  /** Differential diagnosis considerations */
  differentialDiagnosis?: string[];
  /** Quick reference tables */
  tables?: ClinicalTable[];
  /** Key literature references */
  references?: ClinicalReference[];
}

export interface ClinicalPearl {
  id: string;
  text: string;
  importance: 'critical' | 'high' | 'moderate';
  category?: string;
}

export interface DiagnosticSection {
  id: string;
  title: string;
  criteria: DiagnosticCriterion[];
  notes?: string;
}

export interface DiagnosticCriterion {
  id: string;
  text: string;
  required?: boolean;
  value?: string;
}

export interface TreatmentStep {
  id: string;
  phase: string;
  title: string;
  actions: TreatmentAction[];
  timing?: string;
  notes?: string;
}

export interface TreatmentAction {
  id: string;
  text: string;
  priority: 'immediate' | 'urgent' | 'routine';
  details?: string;
}

export interface MedicationDosing {
  id: string;
  name: string;
  genericName?: string;
  category: 'first-line' | 'second-line' | 'adjunct' | 'rescue';
  indication: string;
  dosing: DosingInfo[];
  contraindications?: string[];
  sideEffects?: string[];
  monitoringParameters?: string[];
  pearls?: string[];
}

export interface DosingInfo {
  route: 'IV' | 'PO' | 'IM' | 'SC' | 'INH' | 'PR' | 'topical';
  dose: string;
  frequency?: string;
  maxDose?: string;
  renalAdjustment?: string;
  hepaticAdjustment?: string;
  notes?: string;
}

export interface ClinicalPitfall {
  id: string;
  title: string;
  description: string;
  consequence: string;
  prevention: string;
  severity: 'critical' | 'major' | 'minor';
}

export interface ClinicalTable {
  id: string;
  title: string;
  headers: string[];
  rows: string[][];
  footnotes?: string[];
}

export interface ClinicalReference {
  id: string;
  citation: string;
  year?: number;
  keyFinding?: string;
  url?: string;
}

// ============================================
// Search and Context Types
// ============================================

export interface IBCCSearchResult {
  chapter: IBCCChapter;
  relevanceScore: number;
  matchedKeywords: string[];
}

export interface PatientContextMatch {
  patientId: string;
  suggestedChapters: IBCCChapter[];
  matchReason: string[];
}

export interface IBCCBookmark {
  chapterId: string;
  userId: string;
  createdAt: string;
  notes?: string;
}

// ============================================
// Calculator Types
// ============================================

export interface ClinicalCalculator {
  id: string;
  name: string;
  description: string;
  chapterId: string;
  inputs: CalculatorInput[];
  formula: (inputs: Record<string, number | string>) => CalculatorResult;
}

export interface CalculatorInput {
  id: string;
  label: string;
  type: 'number' | 'select' | 'boolean';
  options?: { value: string | number; label: string }[];
  unit?: string;
  min?: number;
  max?: number;
  defaultValue?: number | string;
}

export interface CalculatorResult {
  value: number | string;
  interpretation: string;
  risk?: 'low' | 'moderate' | 'high' | 'critical';
}

// ============================================
// Protocol & Checklist Types
// ============================================

export interface ProtocolChecklist {
  id: string;
  name: string;
  chapterId: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  isCompleted?: boolean;
  category?: string;
  timeframe?: string;
}

// ============================================
// State Management Types
// ============================================

export interface IBCCState {
  isOpen: boolean;
  activeChapter: IBCCChapter | null;
  searchQuery: string;
  activeCategory: string | null;
  activeSystem: MedicalSystem | null;
  bookmarks: string[];
  recentlyViewed: string[];
}
