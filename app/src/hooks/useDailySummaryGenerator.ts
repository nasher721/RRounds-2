import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Patient } from '@/types/patient';
import type { PatientTodo } from '@/types/todo';
import { ensureString } from '@/lib/ai-response-utils';
import { useAuth } from '@/hooks/useAuth';
import { retainMemory, recallMemories } from '@/lib/hindsightClient';
import { withCategoryTimeout } from '@/lib/requestTimeout';
import { getUserFacingErrorMessage } from '@/lib/userFacingErrors';

type TodoRow = { content: string | null; completed: boolean; section: string | null; created_at: string };

function mapPatientTodoToRow(t: PatientTodo): TodoRow {
  return {
    content: t.content ?? null,
    completed: t.completed,
    section: t.section,
    created_at: t.createdAt,
  };
}

export const useDailySummaryGenerator = () => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generateDailySummary = useCallback(async (
    patient: Patient,
    onUpdate?: (intervalEvents: string) => void,
    existingTodos?: PatientTodo[] | TodoRow[]
  ): Promise<string | null> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsGenerating(true);

    try {
      const bankId = user ? `clinician:${user.id}` : null;

      let todos: TodoRow[] | null = null;
      if (existingTodos?.length) {
        todos = 'created_at' in existingTodos[0] ? (existingTodos as TodoRow[]) : (existingTodos as PatientTodo[]).map(mapPatientTodoToRow);
      }
      if (todos === null) {
        const { data, error: todosError } = await supabase
          .from('patient_todos')
          .select('content, completed, section, created_at')
          .eq('patient_id', patient.id);
        if (todosError) console.error('Todo lookup for daily summary failed');
        todos = data;
      }

      if (abortControllerRef.current?.signal.aborted) {
        return null;
      }

      if (bankId) {
        const recalled = await recallMemories(
          {
            bankId,
            query: 'daily_summary preferences and style',
            filters: {
              feature: 'daily_summary',
            },
            limit: 6,
          },
          { signal: abortControllerRef.current?.signal ?? undefined }
        );

        const styleSummary = recalled?.memories
          ?.map((memory) => memory.content)
          .filter(Boolean)
          .join('\n---\n');

        if (styleSummary) {
          patient.clinicalSummary = `${patient.clinicalSummary || ''}\n\nClinician style and preferences for daily summaries:\n${styleSummary}`;
        }
      }

      const { data, error } = await withCategoryTimeout(
        supabase.functions.invoke('generate-daily-summary', {
          body: {
            patientName: patient.name || `Bed ${patient.bed}`,
            clinicalSummary: patient.clinicalSummary,
            intervalEvents: patient.intervalEvents,
            imaging: patient.imaging,
            labs: patient.labs,
            systems: patient.systems,
            medications: patient.medications,
            todos: todos ?? [],
            existingIntervalEvents: patient.intervalEvents,
          },
        }),
        'aiEdgeFunction',
        'generate-daily-summary',
      );

      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) {
        return null;
      }

      if (error) {
        console.error('Daily summary generation request failed');
        toast.error(getUserFacingErrorMessage(error, 'Failed to generate daily summary'));
        return null;
      }

      if (data?.error) {
        toast.error(getUserFacingErrorMessage(data.error, 'Failed to generate daily summary'));
        return null;
      }

      // Auto-update if callback provided
      const summary = ensureString(data.summary);
      if (onUpdate && summary) {
        onUpdate(summary);
      }

      toast.success('Daily summary generated');

      if (bankId && summary) {
        const content = [
          `Patient: ${patient.name || `Bed ${patient.bed}`}`,
          `Inputs:\n${JSON.stringify({
            clinicalSummary: patient.clinicalSummary,
            intervalEvents: patient.intervalEvents,
            imaging: patient.imaging,
            labs: patient.labs,
          })}`,
          `Generated daily summary:\n${summary}`,
        ].join('\n\n');

        void retainMemory({
          bankId,
          content,
          metadata: {
            feature: 'daily_summary',
            source: 'generate-daily-summary',
          },
        });
      }

      return summary;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      console.error('Daily summary generation request failed');
      toast.error(getUserFacingErrorMessage(err, 'Failed to generate daily summary'));
      return null;
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [user]);

  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      toast.info('Generation cancelled');
    }
  }, []);

  return {
    generateDailySummary,
    isGenerating,
    cancelGeneration,
  };
};
