import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Patient } from '@/types/patient';
import { useAuth } from '@/hooks/useAuth';
import type {
  AIFeature,
  DDxResponse,
  DocumentationCheckResponse,
  SOAPNote,
  AssessmentPlanResponse,
  ClinicalContext,
} from '@/lib/openai-config';
import { stripHtml } from '@/lib/openai-config';
import { withTimeout, TIMEOUT_DEFAULTS } from '@/lib/requestTimeout';
import { getUserFacingErrorMessage } from '@/lib/userFacingErrors';
import { recordTelemetryEvent } from '@/lib/observability/telemetry';
import { sanitizeClinicalContext } from '@/lib/piiSanitizer';
import { retainMemory, recallMemories } from '@/lib/hindsightClient';
import { useAssertBackendReady } from '@/contexts/EdgeHealthContext';

interface UseAIClinicalAssistantOptions {
  onSuccess?: (result: unknown, feature: AIFeature) => void;
  onError?: (error: string) => void;
}

interface UseAIClinicalAssistantReturn {
  // State
  isProcessing: boolean;
  lastResult: unknown | null;
  lastFeature: AIFeature | null;
  lastModel: string | null;
  error: string | null;

  // Core function
  processWithAI: <T = string>(
    feature: AIFeature,
    options: {
      text?: string;
      context?: ClinicalContext;
      patient?: Patient;
      customPrompt?: string;
    }
  ) => Promise<T | null>;

  // Convenience methods
  smartExpand: (text: string) => Promise<string | null>;
  getDifferentialDiagnosis: (patient: Patient) => Promise<DDxResponse | null>;
  checkDocumentation: (patient: Patient) => Promise<DocumentationCheckResponse | null>;
  formatAsSOAP: (patient: Patient) => Promise<SOAPNote | null>;
  generateAssessmentPlan: (patient: Patient) => Promise<AssessmentPlanResponse | null>;
  generateClinicalSummary: (patient: Patient) => Promise<string | null>;
  generateDraft: (patient: Patient) => Promise<string | null>;
  correctMedicalText: (text: string) => Promise<string | null>;

  // Utilities
  cancel: () => void;
  reset: () => void;
}

// Convert Patient to ClinicalContext
function patientToContext(patient: Patient): ClinicalContext {
  return {
    patientName: patient.name,
    clinicalSummary: patient.clinicalSummary,
    intervalEvents: patient.intervalEvents,
    imaging: patient.imaging,
    labs: patient.labs,
    systems: patient.systems,
    medications: patient.medications,
  };
}

export const useAIClinicalAssistant = (
  options: UseAIClinicalAssistantOptions = {}
): UseAIClinicalAssistantReturn => {
  const { onSuccess, onError } = options;
  const assertBackendReady = useAssertBackendReady();
  const { user } = useAuth();

  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<unknown | null>(null);
  const [lastFeature, setLastFeature] = useState<AIFeature | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const reset = useCallback(() => {
    setLastResult(null);
    setLastFeature(null);
    setLastModel(null);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
  }, []);

  const processWithAI = useCallback(async <T = string>(
    feature: AIFeature,
    {
      text,
      context,
      patient,
      customPrompt,
    }: {
      text?: string;
      context?: ClinicalContext;
      patient?: Patient;
      customPrompt?: string;
    }
  ): Promise<T | null> => {
    // Cancel any in-progress request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsProcessing(true);
    setError(null);
    setLastFeature(feature);

    try {
      if (!assertBackendReady()) {
        return null;
      }

      const bankId = user ? `clinician:${user.id}` : null;

      const finalContext = patient ? patientToContext(patient) : context;

      if (!text && !finalContext) {
        throw new Error('No text or patient data provided');
      }

      if (finalContext && !text) {
        const hasContent =
          finalContext.clinicalSummary ||
          finalContext.intervalEvents ||
          finalContext.labs ||
          finalContext.imaging ||
          Object.values(finalContext.systems || {}).some((v) => v && stripHtml(v).trim());

        if (!hasContent) {
          throw new Error('No clinical data available. Please add patient information first.');
        }
      }

      const sanitizedContext = finalContext
        ? sanitizeClinicalContext(finalContext as Record<string, unknown>).sanitized
        : undefined;

      let combinedCustomPrompt = customPrompt;

      if (bankId) {
        const recalled = await recallMemories(
          {
            bankId,
            query: `clinical_assistant preferences and style for feature ${feature}`,
            filters: {
              feature,
            },
            limit: 8,
          },
          { signal: abortControllerRef.current?.signal ?? undefined }
        );

        const styleSummary = recalled?.memories
          ?.map((memory) => memory.content)
          .filter(Boolean)
          .join('\n---\n');

        if (styleSummary) {
          const prefix = `Clinician style and preferences (from prior interactions):\n${styleSummary}`;
          combinedCustomPrompt = [prefix, customPrompt].filter(Boolean).join('\n\n');
        }
      }

      const { data, error: fnError } = await withTimeout(
        supabase.functions.invoke('ai-clinical-assistant', {
          body: {
            feature,
            text,
            context: sanitizedContext,
            customPrompt: combinedCustomPrompt,
          },
        }),
        TIMEOUT_DEFAULTS.aiEdgeFunction,
        `AI ${feature}`,
      );

      if (fnError) {
        throw new Error(fnError.message || 'AI processing failed');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'AI processing failed');
      }

      const result = data.result as T;
      setLastResult(result);
      setLastModel(data.model || null);

      if (bankId) {
        const contentPieces = [
          text ? `Input text:\n${text}` : null,
          sanitizedContext ? `Context:\n${JSON.stringify(sanitizedContext)}` : null,
          result ? `AI result:\n${String(result)}` : null,
        ].filter(Boolean);

        const content = contentPieces.join('\n\n');

        void retainMemory({
          bankId,
          content,
          metadata: {
            feature,
            noteType: (sanitizedContext as { noteType?: string } | undefined)?.noteType ?? null,
            source: 'ai-clinical-assistant',
          },
        });
      }

      onSuccess?.(result, feature);

      return result;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }

      const message = getUserFacingErrorMessage(err, 'AI processing failed');
      setError(message);
      onError?.(message);

      recordTelemetryEvent('ai_error', message, { feature });

      toast({
        title: 'AI Processing Failed',
        description: message,
        variant: 'destructive',
      });

      return null;
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  }, [onSuccess, onError, toast, user, assertBackendReady]);

  // Convenience methods
  const smartExpand = useCallback(
    (text: string) => processWithAI<string>('smart_expand', { text }),
    [processWithAI]
  );

  const getDifferentialDiagnosis = useCallback(
    (patient: Patient) => processWithAI<DDxResponse>('differential_diagnosis', { patient }),
    [processWithAI]
  );

  const checkDocumentation = useCallback(
    (patient: Patient) => processWithAI<DocumentationCheckResponse>('documentation_check', { patient }),
    [processWithAI]
  );

  const formatAsSOAP = useCallback(
    (patient: Patient) => processWithAI<SOAPNote>('soap_format', { patient }),
    [processWithAI]
  );

  const generateAssessmentPlan = useCallback(
    (patient: Patient) => processWithAI<AssessmentPlanResponse>('assessment_plan', { patient }),
    [processWithAI]
  );

  const generateClinicalSummary = useCallback(
    (patient: Patient) => processWithAI<string>('clinical_summary', { patient }),
    [processWithAI]
  );

  const generateDraft = useCallback(
    (patient: Patient) => processWithAI<string>('smart_draft', { patient }),
    [processWithAI]
  );

  const correctMedicalText = useCallback(
    (text: string) => processWithAI<string>('medical_correction', { text }),
    [processWithAI]
  );

  return {
    isProcessing,
    lastResult,
    lastFeature,
    lastModel,
    error,
    processWithAI,
    smartExpand,
    getDifferentialDiagnosis,
    checkDocumentation,
    formatAsSOAP,
    generateAssessmentPlan,
    generateClinicalSummary,
    generateDraft,
    correctMedicalText,
    cancel,
    reset,
  };
};
