import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PatientSystems } from '@/types/patient';
import { ensureString } from '@/lib/ai-response-utils';
import { useAuth } from '@/hooks/useAuth';
import { retainMemory, recallMemories } from '@/lib/hindsightClient';
import { withCategoryTimeout } from '@/lib/requestTimeout';
import { getUserFacingErrorMessage } from '@/lib/userFacingErrors';

export const useIntervalEventsGenerator = () => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generateIntervalEvents = useCallback(async (
    systems: PatientSystems,
    existingIntervalEvents?: string,
    patientName?: string
  ): Promise<string | null> => {
    // Check if there's any content in systems
    const hasContent = Object.values(systems).some(
      (val) => val && val.replace(/<[^>]*>/g, '').trim()
    );

    if (!hasContent) {
      toast.error('No system data to summarize. Add content to system reviews first.');
      return null;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    setIsGenerating(true);

    try {
      const bankId = user ? `clinician:${user.id}` : null;

      if (bankId) {
        const recalled = await recallMemories(
          {
            bankId,
            query: 'interval_events preferences and style',
            filters: {
              feature: 'interval_events',
            },
            limit: 6,
          },
          { signal: abortControllerRef.current?.signal ?? undefined }
        );

        const styleSummary = recalled?.memories
          ?.map((memory) => memory.content)
          .filter(Boolean)
          .join('\n---\n');

        if (styleSummary && patientName) {
          patientName = `${patientName} (with clinician interval event preferences applied)`;
        }
      }

      const { data, error } = await withCategoryTimeout(
        supabase.functions.invoke('generate-interval-events', {
          body: { systems, existingIntervalEvents, patientName },
        }),
        'aiEdgeFunction',
        'generate-interval-events',
      );

      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) {
        return null;
      }

      if (error) {
        console.error('Generate interval events error:', error);
        toast.error(getUserFacingErrorMessage(error, 'Failed to generate interval events'));
        return null;
      }

      if (data?.error) {
        toast.error(getUserFacingErrorMessage(data.error, 'Failed to generate interval events'));
        return null;
      }

      toast.success('Interval events generated');
      const intervalEvents = ensureString(data.intervalEvents);

      if (bankId && intervalEvents) {
        const content = [
          `Patient name: ${patientName || 'Unknown'}`,
          `Systems input:\n${JSON.stringify(systems)}`,
          `Generated interval events:\n${intervalEvents}`,
        ].join('\n\n');

        void retainMemory({
          bankId,
          content,
          metadata: {
            feature: 'interval_events',
            source: 'generate-interval-events',
          },
        });
      }

      return intervalEvents;
    } catch (err) {
      // Don't show error if it was cancelled
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      console.error('Generate interval events error:', err);
      toast.error(getUserFacingErrorMessage(err, 'Failed to generate interval events'));
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
    generateIntervalEvents,
    isGenerating,
    cancelGeneration,
  };
};
