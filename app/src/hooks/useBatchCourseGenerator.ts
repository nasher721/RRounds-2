import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Patient } from '@/types/patient';
import type { PatientTodo } from '@/types/todo';
import { ensureString } from '@/lib/ai-response-utils';
import { withCategoryTimeout } from '@/lib/requestTimeout';
import { getUserFacingErrorMessage } from '@/lib/userFacingErrors';
import { useAssertBackendReady } from '@/contexts/EdgeHealthContext';

export type BatchGenerationType = 'course' | 'intervalEvents' | 'dailySummary';

export type BatchResult = {
  patientId: string;
  patientName: string;
  content: string | null;
  error?: string;
};

export type BatchProgress = {
  total: number;
  completed: number;
  current: string | null;
  results: BatchResult[];
};

export const useBatchCourseGenerator = () => {
  const assertBackendReady = useAssertBackendReady();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [progress, setProgress] = React.useState<BatchProgress>({
    total: 0,
    completed: 0,
    current: null,
    results: [],
  });
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const toTodoRow = (t: PatientTodo): { content: string | null; completed: boolean; section: string | null; created_at: string } => ({
    content: t.content ?? null,
    completed: t.completed,
    section: t.section,
    created_at: t.createdAt,
  });

  const generateBatch = React.useCallback(async (
    patients: Patient[],
    type: BatchGenerationType,
    todosByPatientId?: Record<string, PatientTodo[]>
  ): Promise<BatchResult[]> => {
    // Filter patients with content based on generation type
    const patientsWithContent = patients.filter(patient => {
      if (type === 'intervalEvents') {
        // For interval events, need system notes
        return Object.values(patient.systems).some(val => val?.replace(/<[^>]*>/g, '').trim());
      } else {
        // For course and dailySummary, need any clinical data
        const hasContent = 
          patient.clinicalSummary?.replace(/<[^>]*>/g, '').trim() ||
          patient.intervalEvents?.replace(/<[^>]*>/g, '').trim() ||
          patient.imaging?.replace(/<[^>]*>/g, '').trim() ||
          patient.labs?.replace(/<[^>]*>/g, '').trim() ||
          Object.values(patient.systems).some(val => val?.replace(/<[^>]*>/g, '').trim());
        return hasContent;
      }
    });

    if (patientsWithContent.length === 0) {
      const message = type === 'intervalEvents' 
        ? 'No patients with system notes to generate interval events from.'
        : 'No patients with clinical data to generate from.';
      toast.error(message);
      return [];
    }

    if (!assertBackendReady()) {
      return [];
    }

    // Cancel any existing generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsGenerating(true);
    
    const results: BatchResult[] = [];
    setProgress({
      total: patientsWithContent.length,
      completed: 0,
      current: patientsWithContent[0]?.name || null,
      results: [],
    });

    for (let i = 0; i < patientsWithContent.length; i++) {
      // Check if cancelled
      if (abortControllerRef.current?.signal.aborted) {
        break;
      }

      const patient = patientsWithContent[i];
      
      setProgress(prev => ({
        ...prev,
        current: patient.name,
      }));

      try {
        let data, error;

        if (type === 'intervalEvents') {
          const response = await withCategoryTimeout(
            supabase.functions.invoke('generate-interval-events', {
              body: { 
                systems: patient.systems,
                existingIntervalEvents: patient.intervalEvents,
                patientName: patient.name,
              },
            }),
            'aiEdgeFunction',
            'generate-interval-events',
          );
          data = response.data;
          error = response.error;
        } else if (type === 'dailySummary') {
          let todoRows: { content: string | null; completed: boolean; section: string | null; created_at: string }[];
          const existing = todosByPatientId?.[patient.id];
          if (existing?.length) {
            todoRows = existing.map(toTodoRow);
          } else {
            const { data } = await supabase
              .from('patient_todos')
              .select('content, completed, section, created_at')
              .eq('patient_id', patient.id);
            todoRows = data ?? [];
          }

          const response = await withCategoryTimeout(
            supabase.functions.invoke('generate-daily-summary', {
              body: {
                patientName: patient.name,
                clinicalSummary: patient.clinicalSummary,
                intervalEvents: patient.intervalEvents,
                imaging: patient.imaging,
                labs: patient.labs,
                systems: patient.systems,
                medications: patient.medications,
                todos: todoRows,
                existingIntervalEvents: patient.intervalEvents,
              },
            }),
            'aiEdgeFunction',
            'generate-daily-summary',
          );
          data = response.data;
          error = response.error;
        } else {
          const response = await withCategoryTimeout(
            supabase.functions.invoke('generate-patient-course', {
              body: { 
                patientData: {
                  name: patient.name,
                  clinicalSummary: patient.clinicalSummary,
                  intervalEvents: patient.intervalEvents,
                  imaging: patient.imaging,
                  labs: patient.labs,
                  systems: patient.systems,
                },
              },
            }),
            'aiEdgeFunction',
            'generate-patient-course',
          );
          data = response.data;
          error = response.error;
        }

        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        if (error || data?.error) {
          const errPayload = error ?? data?.error;
          results.push({
            patientId: patient.id,
            patientName: patient.name,
            content: null,
            error: getUserFacingErrorMessage(errPayload, 'Generation failed'),
          });
        } else {
          // Get the content based on type
          const content = type === 'intervalEvents'
            ? ensureString(data.intervalEvents)
            : type === 'dailySummary'
              ? ensureString(data.summaryOnly || data.summary)
              : ensureString(data.course);
          
          results.push({
            patientId: patient.id,
            patientName: patient.name,
            content,
          });

        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          break;
        }
        results.push({
          patientId: patient.id,
          patientName: patient.name,
          content: null,
          error: getUserFacingErrorMessage(err, 'Generation failed'),
        });
      }

      setProgress(prev => ({
        ...prev,
        completed: i + 1,
        results: [...results],
      }));
    }

    setIsGenerating(false);
    abortControllerRef.current = null;

    const successCount = results.filter(r => r.content).length;
    const failCount = results.filter(r => !r.content).length;
    const labelMap: Record<BatchGenerationType, string> = {
      course: 'course',
      intervalEvents: 'interval event',
      dailySummary: 'summary',
    };
    const label = labelMap[type];
    
    if (successCount > 0) {
      toast.success(`Generated ${successCount} ${label}${successCount > 1 ? (type === 'dailySummary' ? 'ies' : 's') : ''}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to generate ${failCount} ${label}${failCount > 1 ? (type === 'dailySummary' ? 'ies' : 's') : ''}`);
    }

    return results;
  }, [assertBackendReady]);

  const cancelGeneration = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      toast.info('Batch generation cancelled');
    }
  }, []);

  return {
    generateBatch,
    isGenerating,
    progress,
    cancelGeneration,
  };
};
