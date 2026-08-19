import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PatientMedications } from '@/types/patient';
import { useAuth } from '@/hooks/useAuth';
import { retainMemory, recallMemories } from '@/lib/hindsightClient';
import { withCategoryTimeout } from '@/lib/requestTimeout';
import { getUserFacingErrorMessage } from '@/lib/userFacingErrors';

export const useMedicationFormat = () => {
  const { user } = useAuth();
  const [isFormatting, setIsFormatting] = useState(false);

  const formatMedications = useCallback(async (
    rawText: string
  ): Promise<PatientMedications | null> => {
    if (!rawText.trim()) {
      toast.error('No medication text to format');
      return null;
    }

    setIsFormatting(true);

    try {
      const bankId = user ? `clinician:${user.id}` : null;

      if (bankId) {
        void recallMemories({
          bankId,
          query: 'medication formatting preferences',
          filters: {
            feature: 'medications',
          },
          limit: 4,
        });
      }

      const { data, error } = await withCategoryTimeout(
        supabase.functions.invoke('format-medications', {
          body: { medications: rawText },
        }),
        'aiEdgeFunction',
        'format-medications',
      );

      if (error) {
        console.error('Medication formatting request failed');
        toast.error(getUserFacingErrorMessage(error, 'Failed to format medications'));
        return null;
      }

      if (data?.error) {
        toast.error(getUserFacingErrorMessage(data.error, 'Failed to format medications'));
        return null;
      }

      if (data?.medications) {
        toast.success('Medications formatted successfully');

        if (bankId) {
          const content = [
            `Raw medications text:\n${rawText}`,
            `Formatted medications object:\n${JSON.stringify(data.medications)}`,
          ].join('\n\n');

          void retainMemory({
            bankId,
            content,
            metadata: {
              feature: 'medications',
              source: 'format-medications',
            },
          });
        }

        return data.medications;
      }

      return null;
    } catch (err) {
      console.error('Medication formatting request failed');
      toast.error(getUserFacingErrorMessage(err, 'Failed to format medications'));
      return null;
    } finally {
      setIsFormatting(false);
    }
  }, [user]);

  return {
    formatMedications,
    isFormatting,
  };
};
