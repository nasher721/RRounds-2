import { useCallback } from 'react';
import { useStreamingAI, type StreamingChunk } from './useStreamingAI';
import { useToast } from './use-toast';
import type { AIFeature, ClinicalContext } from '@/lib/openai-config';
import type { Patient } from '@/types/patient';

/**
 * Unified AI Hook - Consolidates all AI functionality into a single, easy-to-use API
 * 
 * This hook provides a unified interface for all AI features, making it easy for
 * developers to use AI functionality without understanding the underlying complexity.
 * 
 * Features:
 * - All AI commands accessible via simple methods
 * - Automatic streaming support
 * - Built-in error handling and toasts
 * - Context-aware (works with or without patient)
 * 
 * @example
 * ```tsx
 * const ai = useAI();
 * 
 * // Simple AI commands
 * await ai.differentialDiagnosis(patient);
 * await ai.soapFormat(patient);
 * await ai.clinicalSummary(patient);
 * 
 * // Text-based commands
 * await ai.smartExpand("pt c/o");
 * await ai.transcribe("patient dictation");
 * 
 * // Access streaming state
 * console.log(ai.isStreaming);
 * ```
 */
export const useAI = () => {
  const { toast } = useToast();
  
  const streamingAI = useStreamingAI({
    onChunk: (chunk, accumulated) => {
      // Could be used for real-time UI updates
    },
    onComplete: (response) => {
      toast({
        title: 'AI Complete',
        description: 'Response generated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'AI Error',
        description: error,
        variant: 'destructive',
      });
    },
  });

  // === Clinical Commands (require patient) ===
  
  const differentialDiagnosis = useCallback(async (patient: Patient) => {
    return streamingAI.streamWithAI('differential_diagnosis', { patient });
  }, [streamingAI]);

  const documentationCheck = useCallback(async (patient: Patient) => {
    return streamingAI.streamWithAI('documentation_check', { patient });
  }, [streamingAI]);

  const soapFormat = useCallback(async (patient: Patient) => {
    return streamingAI.streamWithAI('soap_format', { patient });
  }, [streamingAI]);

  const assessmentPlan = useCallback(async (patient: Patient) => {
    return streamingAI.streamWithAI('assessment_plan', { patient });
  }, [streamingAI]);

  const clinicalSummary = useCallback(async (patient: Patient) => {
    return streamingAI.streamWithAI('clinical_summary', { patient });
  }, [streamingAI]);

  // === Advanced Commands (require patient) ===
  
  const systemBasedRounds = useCallback(async (patient: Patient) => {
    return streamingAI.streamWithAI('system_based_rounds', { patient });
  }, [streamingAI]);

  const problemList = useCallback(async (patient: Patient) => {
    return streamingAI.streamWithAI('problem_list', { patient });
  }, [streamingAI]);

  const smartDraft = useCallback(async (patient: Patient) => {
    return streamingAI.streamWithAI('smart_draft', { patient });
  }, [streamingAI]);

  // === Text-Based Commands (require text input) ===
  
  const smartExpand = useCallback(async (text: string) => {
    return streamingAI.streamWithAI('smart_expand', { text });
  }, [streamingAI]);

  const dateOrganizer = useCallback(async (text: string) => {
    return streamingAI.streamWithAI('date_organizer', { text });
  }, [streamingAI]);

  const intervalEvents = useCallback(async (text: string) => {
    return streamingAI.streamWithAI('interval_events_generator', { text });
  }, [streamingAI]);

  const neuroICUHPI = useCallback(async (text: string) => {
    return streamingAI.streamWithAI('neuro_icu_hpi', { text });
  }, [streamingAI]);

  const transcribe = useCallback(async (text: string) => {
    return streamingAI.streamWithAI('transcription', { text });
  }, [streamingAI]);

  const formatMedications = useCallback(async (text: string) => {
    return streamingAI.streamWithAI('medical_correction', { text });
  }, [streamingAI]);

  const icuBoardsExplainer = useCallback(async (text: string) => {
    return streamingAI.streamWithAI('icu_boards_explainer', { text });
  }, [streamingAI]);

  // === Generic Command (for any AI feature) ===
  
  const run = useCallback(async (
    feature: AIFeature, 
    options: {
      text?: string;
      context?: ClinicalContext;
      patient?: Patient;
      customPrompt?: string;
    } = {}
  ) => {
    return streamingAI.streamWithAI(feature, options);
  }, [streamingAI]);

  const cancel = useCallback(() => {
    streamingAI.cancel();
  }, [streamingAI]);

  const reset = useCallback(() => {
    streamingAI.reset();
  }, [streamingAI]);

  return {
    // State
    isStreaming: streamingAI.isStreaming,
    accumulatedResponse: streamingAI.accumulatedResponse,
    error: streamingAI.error,

    // Clinical Commands (patient-based)
    differentialDiagnosis,
    documentationCheck,
    soapFormat,
    assessmentPlan,
    clinicalSummary,

    // Advanced Commands (patient-based)
    systemBasedRounds,
    problemList,
    smartDraft,

    // Text-Based Commands
    smartExpand,
    dateOrganizer,
    intervalEvents,
    neuroICUHPI,
    transcribe,
    formatMedications,
    icuBoardsExplainer,

    // Generic
    run,
    cancel,
    reset,
  };
};

export type UseAIReturn = ReturnType<typeof useAI>;
