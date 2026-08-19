/**
 * OpenAI API Integration Configuration
 *
 * This module provides shared types and configuration for OpenAI API integrations
 * including GPT-4 for clinical AI and Whisper for speech transcription.
 *
 * ARCHITECTURE OVERVIEW:
 * =====================
 *
 * 1. WHISPER INTEGRATION (Speech-to-Text)
 *    - Enhanced medical vocabulary prompting
 *    - Real-time audio level feedback
 *    - Medical terminology post-processing
 *
 * 2. GPT-4 INTEGRATION (Clinical AI Assistant)
 *    - Smart clinical summary generation
 *    - Differential diagnosis suggestions
 *    - Documentation completeness checking
 *    - SOAP note formatting
 *    - Assessment & Plan generation
 *
 * All API calls go through Supabase Edge Functions to keep API keys secure.
 */

import { stripHtml } from '@/lib/sanitize';

// Re-export stripHtml for backward compatibility
export { stripHtml };

// AI Model options
export const AI_MODELS = {
  // GPT-4 models for complex clinical reasoning
  GPT4_TURBO: 'gpt-4-turbo-preview',
  GPT4: 'gpt-4',
  GPT4O: 'gpt-4o',
  GPT4O_MINI: 'gpt-4o-mini',

  // GPT-3.5 for faster, simpler tasks
  GPT35_TURBO: 'gpt-3.5-turbo',

  // Whisper for audio transcription
  WHISPER: 'whisper-1',
} as const;

export type AIModel = typeof AI_MODELS[keyof typeof AI_MODELS];

// Temperature settings for different use cases
export const AI_TEMPERATURES = {
  PRECISE: 0.1,      // For factual responses, transcription enhancement
  BALANCED: 0.3,     // For clinical summaries
  CREATIVE: 0.7,     // For suggestions and brainstorming
} as const;

// AI Feature types
export type AIFeature =
  | 'transcription'
  | 'clinical_summary'
  | 'differential_diagnosis'
  | 'documentation_check'
  | 'soap_format'
  | 'assessment_plan'
  | 'smart_expand'
  | 'medical_correction'
  | 'system_based_rounds'
  | 'date_organizer'
  | 'problem_list'
  | 'icu_boards_explainer'
  | 'interval_events_generator'
  | 'neuro_icu_hpi'
  | 'smart_draft';

// Response types for AI operations
export interface AIResponse<T = string> {
  success: boolean;
  data?: T;
  error?: string;
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Differential diagnosis types
export interface DifferentialDiagnosis {
  diagnosis: string;
  likelihood: 'high' | 'moderate' | 'low';
  supportingFindings: string[];
  workupNeeded: string[];
}

export interface DDxResponse {
  differentials: DifferentialDiagnosis[];
  mostLikely: string;
  criticalToRuleOut: string[];
  suggestedWorkup: string[];
}

// Documentation completeness types
export interface DocumentationGap {
  section: string;
  issue: string;
  suggestion: string;
  priority: 'critical' | 'important' | 'minor';
}

export interface DocumentationCheckResponse {
  overallScore: number; // 0-100
  gaps: DocumentationGap[];
  strengths: string[];
  suggestions: string[];
}

// SOAP note structure
export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

// Assessment & Plan types
export interface AssessmentPlanItem {
  problem: string;
  assessment: string;
  plan: string[];
}

export interface AssessmentPlanResponse {
  problems: AssessmentPlanItem[];
  overallAssessment: string;
}

// Clinical context for AI operations
export interface ClinicalContext {
  patientName?: string;
  clinicalSummary?: string;
  intervalEvents?: string;
  imaging?: string;
  labs?: string;
  systems?: {
    neuro?: string;
    cv?: string;
    resp?: string;
    renalGU?: string;
    gi?: string;
    endo?: string;
    heme?: string;
    infectious?: string;
    skinLines?: string;
    dispo?: string;
  };
  medications?: {
    infusions?: string[];
    scheduled?: string[];
    prn?: string[];
  };
  todos?: Array<{ content: string; completed: boolean }>;
}

// Medical specialty context for better AI responses
export const MEDICAL_SPECIALTIES = {
  ICU: 'intensive_care',
  MEDICINE: 'internal_medicine',
  SURGERY: 'surgery',
  PEDIATRICS: 'pediatrics',
  EMERGENCY: 'emergency',
} as const;

export type MedicalSpecialty = typeof MEDICAL_SPECIALTIES[keyof typeof MEDICAL_SPECIALTIES];

// Common medical abbreviations for Whisper prompting
export const MEDICAL_ABBREVIATION_HINTS = `
Common medical terms and abbreviations:
- Vitals: BP, HR, RR, SpO2, T, MAP
- Labs: BMP, CBC, LFTs, coags, ABG, lactate, BNP, troponin
- Respiratory: PEEP, FiO2, TV, RR, ETT, vent, BiPAP, CPAP
- Cardiac: EF, EKG, afib, sinus, NSR, STEMI, NSTEMI
- Neuro: GCS, AMS, CVA, TIA, ICH, SDH
- Renal: Cr, BUN, GFR, HD, CRRT, UOP
- Infectious: WBC, abx, cx, BCx, UCx, BAL
- GI: NPO, TPN, PEG, NGT, LFTs, lipase
- Medications: gtt, mcg, mg, mL, q, prn, bid, tid, qid
- General: pt, hx, dx, tx, rx, sx, f/u, d/c, w/o, w/
`;

// Build clinical context string for AI prompts
export function buildClinicalContextString(context: ClinicalContext): string {
  const sections: string[] = [];

  if (context.clinicalSummary) {
    sections.push(`CLINICAL SUMMARY:\n${stripHtml(context.clinicalSummary)}`);
  }

  if (context.systems) {
    const systemLabels: Record<string, string> = {
      neuro: 'Neuro', cv: 'CV', resp: 'Resp', renalGU: 'Renal/GU',
      gi: 'GI', endo: 'Endo', heme: 'Heme', infectious: 'ID',
      skinLines: 'Skin/Lines', dispo: 'Dispo'
    };

    const systemNotes: string[] = [];
    for (const [key, label] of Object.entries(systemLabels)) {
      const content = context.systems[key as keyof typeof context.systems];
      if (content && stripHtml(content).trim()) {
        systemNotes.push(`${label}: ${stripHtml(content)}`);
      }
    }
    if (systemNotes.length > 0) {
      sections.push(`SYSTEMS REVIEW:\n${systemNotes.join('\n')}`);
    }
  }

  if (context.labs) {
    sections.push(`LABS:\n${stripHtml(context.labs)}`);
  }

  if (context.imaging) {
    sections.push(`IMAGING:\n${stripHtml(context.imaging)}`);
  }

  if (context.medications) {
    const medNotes: string[] = [];
    if (context.medications.infusions?.length) {
      medNotes.push(`Infusions: ${context.medications.infusions.join(', ')}`);
    }
    if (context.medications.scheduled?.length) {
      medNotes.push(`Scheduled: ${context.medications.scheduled.join(', ')}`);
    }
    if (context.medications.prn?.length) {
      medNotes.push(`PRN: ${context.medications.prn.join(', ')}`);
    }
    if (medNotes.length > 0) {
      sections.push(`MEDICATIONS:\n${medNotes.join('\n')}`);
    }
  }

  if (context.intervalEvents) {
    sections.push(`INTERVAL EVENTS:\n${stripHtml(context.intervalEvents)}`);
  }

  return sections.join('\n\n');
}
