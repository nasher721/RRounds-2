/**
 * Edge-only clinical AI hook.
 *
 * Every clinical request crosses the authenticated Supabase Edge boundary,
 * where provider resolution, de-identification, and rate limits are enforced.
 */

import { useCallback, useRef, useState } from 'react';

import { useAssertBackendReady } from '@/contexts/EdgeHealthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type {
  AIFeature,
  AssessmentPlanResponse,
  ClinicalContext,
  DDxResponse,
  DocumentationCheckResponse,
  SOAPNote,
} from '@/lib/openai-config';
import { stripHtml } from '@/lib/openai-config';
import { sanitizeClinicalContext } from '@/lib/piiSanitizer';
import { withCategoryTimeout } from '@/lib/requestTimeout';
import { getUserFacingErrorMessage } from '@/lib/userFacingErrors';
import type { Patient } from '@/types/patient';

interface UseLLMClinicalAssistantOptions {
  onSuccess?: (result: unknown, feature: AIFeature) => void;
  onError?: (error: string) => void;
}

interface UseLLMClinicalAssistantReturn {
  isProcessing: boolean;
  lastResult: unknown | null;
  lastFeature: AIFeature | null;
  lastModel: string | null;
  error: string | null;
  processWithAI: <T = string>(
    feature: AIFeature,
    options: {
      text?: string;
      context?: ClinicalContext;
      patient?: Patient;
      customPrompt?: string;
    },
  ) => Promise<T | null>;
  smartExpand: (text: string) => Promise<string | null>;
  getDifferentialDiagnosis: (patient: Patient) => Promise<DDxResponse | null>;
  checkDocumentation: (patient: Patient) => Promise<DocumentationCheckResponse | null>;
  formatAsSOAP: (patient: Patient) => Promise<SOAPNote | null>;
  generateAssessmentPlan: (patient: Patient) => Promise<AssessmentPlanResponse | null>;
  generateClinicalSummary: (patient: Patient) => Promise<string | null>;
  correctMedicalText: (text: string) => Promise<string | null>;
  cancel: () => void;
  reset: () => void;
}

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

async function invokeClinicalAssistant<T>(
  feature: AIFeature,
  text?: string,
  context?: ClinicalContext,
  customPrompt?: string,
): Promise<{ result: T; model: string | null }> {
  const { data, error } = await withCategoryTimeout(
    supabase.functions.invoke('ai-clinical-assistant', {
      body: { feature, text, context, customPrompt },
    }),
    'aiEdgeFunction',
    'ai-clinical-assistant',
  );

  if (error) throw new Error(error.message || 'AI processing failed');
  if (!data?.success) throw new Error(data?.error || 'AI processing failed');

  return {
    result: data.result as T,
    model: typeof data.model === 'string' ? data.model : null,
  };
}

export const useLLMClinicalAssistant = (
  options: UseLLMClinicalAssistantOptions = {},
): UseLLMClinicalAssistantReturn => {
  const { onSuccess, onError } = options;
  const assertBackendReady = useAssertBackendReady();
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<unknown | null>(null);
  const [lastFeature, setLastFeature] = useState<AIFeature | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setLastResult(null);
    setLastFeature(null);
    setLastModel(null);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsProcessing(false);
  }, []);

  const processWithAI = useCallback(async <T = string>(
    feature: AIFeature,
    request: {
      text?: string;
      context?: ClinicalContext;
      patient?: Patient;
      customPrompt?: string;
    },
  ): Promise<T | null> => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    setIsProcessing(true);
    setError(null);
    setLastFeature(feature);

    try {
      if (!assertBackendReady()) return null;

      const rawContext = request.patient
        ? patientToContext(request.patient)
        : request.context;

      if (!request.text && !rawContext) {
        throw new Error('No text or patient data provided');
      }
      if (rawContext && !request.text) {
        const hasContent =
          rawContext.clinicalSummary ||
          rawContext.intervalEvents ||
          rawContext.labs ||
          rawContext.imaging ||
          Object.values(rawContext.systems || {}).some(
            (value) => value && stripHtml(value).trim(),
          );
        if (!hasContent) {
          throw new Error('No clinical data available. Please add patient information first.');
        }
      }

      const context = rawContext
        ? sanitizeClinicalContext(rawContext as Record<string, unknown>).sanitized as ClinicalContext
        : undefined;
      const response = await invokeClinicalAssistant<T>(
        feature,
        request.text,
        context,
        request.customPrompt,
      );

      setLastResult(response.result);
      setLastModel(response.model);
      onSuccess?.(response.result, feature);
      return response.result;
    } catch (caught) {
      if (caught instanceof Error && caught.name === 'AbortError') return null;
      const message = getUserFacingErrorMessage(caught, 'AI processing failed');
      setError(message);
      onError?.(message);
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
  }, [assertBackendReady, onError, onSuccess, toast]);

  const smartExpand = useCallback(
    (text: string) => processWithAI<string>('smart_expand', { text }),
    [processWithAI],
  );
  const getDifferentialDiagnosis = useCallback(
    (patient: Patient) => processWithAI<DDxResponse>('differential_diagnosis', { patient }),
    [processWithAI],
  );
  const checkDocumentation = useCallback(
    (patient: Patient) => processWithAI<DocumentationCheckResponse>('documentation_check', { patient }),
    [processWithAI],
  );
  const formatAsSOAP = useCallback(
    (patient: Patient) => processWithAI<SOAPNote>('soap_format', { patient }),
    [processWithAI],
  );
  const generateAssessmentPlan = useCallback(
    (patient: Patient) => processWithAI<AssessmentPlanResponse>('assessment_plan', { patient }),
    [processWithAI],
  );
  const generateClinicalSummary = useCallback(
    (patient: Patient) => processWithAI<string>('clinical_summary', { patient }),
    [processWithAI],
  );
  const correctMedicalText = useCallback(
    (text: string) => processWithAI<string>('medical_correction', { text }),
    [processWithAI],
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
    correctMedicalText,
    cancel,
    reset,
  };
};
