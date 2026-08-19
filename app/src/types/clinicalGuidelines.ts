/**
 * Clinical Guidelines Types
 * Type definitions for evidence-based clinical practice guidelines
 */

// ============================================
// Core Guideline Types
// ============================================

export interface ClinicalGuideline {
  id: string;
  title: string;
  shortTitle: string;
  organization: GuidelineOrganization;
  specialty: MedicalSpecialty;
  condition: string;
  year: number;
  lastUpdated: string;
  version?: string;
  url: string;
  keywords: string[];
  summary: string;
  keyRecommendations: GuidelineRecommendation[];
  diagnosticCriteria?: DiagnosticCriterion[];
  treatmentAlgorithm?: TreatmentRecommendation[];
  qualityMeasures?: QualityMeasure[];
  references?: GuidelineReference[];
  relatedGuidelines?: string[]; // IDs of related guidelines
}

export interface GuidelineOrganization {
  id: string;
  name: string;
  abbreviation: string;
  country: string;
  logo?: string;
  website: string;
}

export type MedicalSpecialty =
  | 'cardiology'
  | 'pulmonology'
  | 'nephrology'
  | 'neurology'
  | 'infectious-disease'
  | 'endocrinology'
  | 'hematology'
  | 'gastroenterology'
  | 'rheumatology'
  | 'oncology'
  | 'critical-care'
  | 'emergency-medicine'
  | 'internal-medicine'
  | 'surgery'
  | 'pediatrics'
  | 'psychiatry'
  | 'dermatology'
  | 'obstetrics-gynecology';

// ============================================
// Recommendation Types
// ============================================

export interface GuidelineRecommendation {
  id: string;
  text: string;
  classOfRecommendation: RecommendationClass;
  levelOfEvidence: EvidenceLevel;
  category?: string;
  notes?: string;
}

export type RecommendationClass =
  | 'I'      // Strong recommendation - benefit >>> risk
  | 'IIa'    // Moderate recommendation - benefit >> risk
  | 'IIb'    // Weak recommendation - benefit >= risk
  | 'III'    // No benefit or harmful
  | 'A'      // Strong (alternative system)
  | 'B'      // Moderate (alternative system)
  | 'C'      // Weak (alternative system)
  | 'D';     // Against (alternative system)

export type EvidenceLevel =
  | 'A'           // Multiple RCTs or meta-analysis
  | 'B-R'         // Moderate quality from RCTs
  | 'B-NR'        // Moderate quality from non-randomized studies
  | 'C-LD'        // Limited data
  | 'C-EO'        // Expert opinion
  | 'High'        // Alternative: High quality
  | 'Moderate'    // Alternative: Moderate quality
  | 'Low'         // Alternative: Low quality
  | 'Very Low';   // Alternative: Very low quality

export interface DiagnosticCriterion {
  id: string;
  category: string;
  criteria: string[];
  notes?: string;
  required?: boolean;
}

export interface TreatmentRecommendation {
  id: string;
  phase: string;
  title: string;
  recommendations: string[];
  medications?: MedicationRecommendation[];
  timing?: string;
  monitoring?: string[];
}

export interface MedicationRecommendation {
  name: string;
  dose: string;
  route: string;
  frequency?: string;
  duration?: string;
  alternatives?: string[];
  contraindications?: string[];
  notes?: string;
}

export interface QualityMeasure {
  id: string;
  measure: string;
  target: string;
  rationale?: string;
}

export interface GuidelineReference {
  id: string;
  citation: string;
  pmid?: string;
  doi?: string;
  keyFinding?: string;
}

// ============================================
// Search and Filter Types
// ============================================

export interface GuidelineSearchResult {
  guideline: ClinicalGuideline;
  relevanceScore: number;
  matchedKeywords: string[];
  matchedInTitle: boolean;
  matchedInSummary: boolean;
}

export interface GuidelineFilter {
  specialty?: MedicalSpecialty;
  organization?: string;
  yearRange?: { min: number; max: number };
  searchQuery?: string;
}

// ============================================
// State Management Types
// ============================================

export interface GuidelinesState {
  isOpen: boolean;
  activeGuideline: ClinicalGuideline | null;
  searchQuery: string;
  activeSpecialty: MedicalSpecialty | null;
  activeOrganization: string | null;
  bookmarks: string[];
  recentlyViewed: string[];
}

// ============================================
// Organization Constants
// ============================================

export const GUIDELINE_ORGANIZATIONS: GuidelineOrganization[] = [
  {
    id: 'aha-acc',
    name: 'American Heart Association / American College of Cardiology',
    abbreviation: 'AHA/ACC',
    country: 'USA',
    website: 'https://www.heart.org'
  },
  {
    id: 'esc',
    name: 'European Society of Cardiology',
    abbreviation: 'ESC',
    country: 'Europe',
    website: 'https://www.escardio.org'
  },
  {
    id: 'ats-idsa',
    name: 'American Thoracic Society / Infectious Diseases Society of America',
    abbreviation: 'ATS/IDSA',
    country: 'USA',
    website: 'https://www.thoracic.org'
  },
  {
    id: 'idsa',
    name: 'Infectious Diseases Society of America',
    abbreviation: 'IDSA',
    country: 'USA',
    website: 'https://www.idsociety.org'
  },
  {
    id: 'sccm',
    name: 'Society of Critical Care Medicine',
    abbreviation: 'SCCM',
    country: 'USA',
    website: 'https://www.sccm.org'
  },
  {
    id: 'ada',
    name: 'American Diabetes Association',
    abbreviation: 'ADA',
    country: 'USA',
    website: 'https://www.diabetes.org'
  },
  {
    id: 'aasld',
    name: 'American Association for the Study of Liver Diseases',
    abbreviation: 'AASLD',
    country: 'USA',
    website: 'https://www.aasld.org'
  },
  {
    id: 'acr',
    name: 'American College of Rheumatology',
    abbreviation: 'ACR',
    country: 'USA',
    website: 'https://www.rheumatology.org'
  },
  {
    id: 'asco',
    name: 'American Society of Clinical Oncology',
    abbreviation: 'ASCO',
    country: 'USA',
    website: 'https://www.asco.org'
  },
  {
    id: 'kdigo',
    name: 'Kidney Disease: Improving Global Outcomes',
    abbreviation: 'KDIGO',
    country: 'International',
    website: 'https://kdigo.org'
  },
  {
    id: 'nice',
    name: 'National Institute for Health and Care Excellence',
    abbreviation: 'NICE',
    country: 'UK',
    website: 'https://www.nice.org.uk'
  },
  {
    id: 'who',
    name: 'World Health Organization',
    abbreviation: 'WHO',
    country: 'International',
    website: 'https://www.who.int'
  },
  {
    id: 'acep',
    name: 'American College of Emergency Physicians',
    abbreviation: 'ACEP',
    country: 'USA',
    website: 'https://www.acep.org'
  },
  {
    id: 'aans',
    name: 'American Academy of Neurology',
    abbreviation: 'AAN',
    country: 'USA',
    website: 'https://www.aan.com'
  },
  {
    id: 'gina',
    name: 'Global Initiative for Asthma',
    abbreviation: 'GINA',
    country: 'International',
    website: 'https://ginasthma.org'
  },
  {
    id: 'gold',
    name: 'Global Initiative for Chronic Obstructive Lung Disease',
    abbreviation: 'GOLD',
    country: 'International',
    website: 'https://goldcopd.org'
  }
];

export const SPECIALTY_MAP: Record<MedicalSpecialty, { label: string; icon: string }> = {
  cardiology: { label: 'Cardiology', icon: '❤️' },
  pulmonology: { label: 'Pulmonology', icon: '🫁' },
  nephrology: { label: 'Nephrology', icon: '💧' },
  neurology: { label: 'Neurology', icon: '🧠' },
  'infectious-disease': { label: 'Infectious Disease', icon: '🦠' },
  endocrinology: { label: 'Endocrinology', icon: '⚡' },
  hematology: { label: 'Hematology', icon: '🩸' },
  gastroenterology: { label: 'Gastroenterology', icon: '🍽️' },
  rheumatology: { label: 'Rheumatology', icon: '🦴' },
  oncology: { label: 'Oncology', icon: '🎗️' },
  'critical-care': { label: 'Critical Care', icon: '🏥' },
  'emergency-medicine': { label: 'Emergency Medicine', icon: '🚑' },
  'internal-medicine': { label: 'Internal Medicine', icon: '💊' },
  surgery: { label: 'Surgery', icon: '🔪' },
  pediatrics: { label: 'Pediatrics', icon: '👶' },
  psychiatry: { label: 'Psychiatry', icon: '🧩' },
  dermatology: { label: 'Dermatology', icon: '🔬' },
  'obstetrics-gynecology': { label: 'OB/GYN', icon: '🤰' }
};
