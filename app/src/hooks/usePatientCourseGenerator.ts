import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Patient } from '@/types/patient';
import { ensureString } from '@/lib/ai-response-utils';
import { useAuth } from '@/hooks/useAuth';
import { retainMemory, recallMemories } from '@/lib/hindsightClient';
import { withCategoryTimeout } from '@/lib/requestTimeout';
import { getUserFacingErrorMessage } from '@/lib/userFacingErrors';

export const usePatientCourseGenerator = () => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const generatePatientCourse = React.useCallback(async (
    patient: Patient,
    existingCourse?: string
  ): Promise<string | null> => {
    // Check if there's any content
    const hasContent = 
      patient.clinicalSummary?.replace(/<[^>]*>/g, '').trim() ||
      patient.intervalEvents?.replace(/<[^>]*>/g, '').trim() ||
      patient.imaging?.replace(/<[^>]*>/g, '').trim() ||
      patient.labs?.replace(/<[^>]*>/g, '').trim() ||
      Object.values(patient.systems).some(val => val?.replace(/<[^>]*>/g, '').trim());

    if (!hasContent) {
      toast.error('No patient data to generate course from. Add clinical notes first.');
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
            query: 'patient_course preferences and style',
            filters: {
              feature: 'patient_course',
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
          patient.clinicalSummary = `${patient.clinicalSummary || ''}\n\nClinician patient course preferences:\n${styleSummary}`;
        }
      }

      const { data, error } = await withCategoryTimeout(
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
            existingCourse,
          },
        }),
        'aiEdgeFunction',
        'generate-patient-course',
      );

      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) {
        return null;
      }

      if (error) {
        console.error('Patient course generation request failed');
        toast.error(getUserFacingErrorMessage(error, 'Failed to generate patient course'));
        return null;
      }

      if (data?.error) {
        toast.error(getUserFacingErrorMessage(data.error, 'Failed to generate patient course'));
        return null;
      }

      toast.success('Patient course generated');
      const course = ensureString(data.course);

      if (bankId && course) {
        const content = [
          `Patient: ${patient.name}`,
          `Inputs:\n${JSON.stringify({
            clinicalSummary: patient.clinicalSummary,
            intervalEvents: patient.intervalEvents,
            imaging: patient.imaging,
            labs: patient.labs,
            systems: patient.systems,
          })}`,
          `Generated patient course:\n${course}`,
        ].join('\n\n');

        void retainMemory({
          bankId,
          content,
          metadata: {
            feature: 'patient_course',
            source: 'generate-patient-course',
          },
        });
      }

      return course;
    } catch (err) {
      // Don't show error if it was cancelled
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      console.error('Patient course generation request failed');
      toast.error(getUserFacingErrorMessage(err, 'Failed to generate patient course'));
      return null;
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [user]);

  const cancelGeneration = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      toast.info('Generation cancelled');
    }
  }, []);

  return {
    generatePatientCourse,
    isGenerating,
    cancelGeneration,
  };
};
