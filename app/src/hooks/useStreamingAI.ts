import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Patient } from '@/types/patient';
import { useAuth } from '@/hooks/useAuth';
import type {
  AIFeature,
  ClinicalContext,
} from '@/lib/openai-config';
import { stripHtml } from '@/lib/openai-config';
import { retainMemory, recallMemories } from '@/lib/hindsightClient';
import { getEdgeFunctionAuthHeaders } from '@/lib/edgeFunctionHeaders';
import { getUserFacingErrorMessage, UserFacingError } from '@/lib/userFacingErrors';

export interface StreamingChunk {
  chunk: string;
  isComplete: boolean;
  error?: string;
}

interface UseStreamingAIOptions {
  onChunk?: (chunk: string, accumulated: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: string) => void;
}

export function createStreamingResponseError(response: Response): UserFacingError {
  return new UserFacingError(
    getUserFacingErrorMessage(
      { context: response },
      'AI processing failed. Please try again.',
    ),
  );
}

interface UseStreamingAIReturn {
  isStreaming: boolean;
  accumulatedResponse: string;
  error: string | null;

  streamWithAI: (
    feature: AIFeature,
    options: {
      text?: string;
      context?: ClinicalContext;
      patient?: Patient;
      customPrompt?: string;
    }
  ) => Promise<string | null>;

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

export const useStreamingAI = (
  options: UseStreamingAIOptions = {}
): UseStreamingAIReturn => {
  const { onChunk, onComplete, onError } = options;
  const { user } = useAuth();

  const [isStreaming, setIsStreaming] = useState(false);
  const [accumulatedResponse, setAccumulatedResponse] = useState('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const reset = useCallback(() => {
    setAccumulatedResponse('');
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const streamWithAI = useCallback(async (
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
  ): Promise<string | null> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsStreaming(true);
    setError(null);
    setAccumulatedResponse('');

    try {
      const bankId = user ? `clinician:${user.id}` : null;

      const finalContext = patient ? patientToContext(patient) : context;

      if (!text && !finalContext) {
        throw new UserFacingError('No text or patient data provided.');
      }

      if (finalContext && !text) {
        const hasContent =
          finalContext.clinicalSummary ||
          finalContext.intervalEvents ||
          finalContext.labs ||
          finalContext.imaging ||
          Object.values(finalContext.systems || {}).some((v) => v && stripHtml(v).trim());

        if (!hasContent) {
          throw new UserFacingError('No clinical data available. Please add patient information first.');
        }
      }

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

      // Direct fetch for SSE — must send apikey + user JWT like functions.invoke does
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-clinical-assistant`, {
        method: 'POST',
        headers: await getEdgeFunctionAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          feature,
          text,
          context: finalContext,
          customPrompt: combinedCustomPrompt,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw createStreamingResponseError(response);
      }

      // Check if response is SSE stream or JSON
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        if (!response.body) {
          throw new UserFacingError('AI service returned no response. Please try again.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let lineBuffer = '';
        let readerDone = false;
        let sawDoneEvent = false;

        while (!readerDone && !sawDoneEvent) {
          const { value, done: inputDone } = await reader.read();
          readerDone = inputDone;

          if (value) {
            lineBuffer += decoder.decode(value, { stream: true });
          }
          if (readerDone) {
            lineBuffer += decoder.decode();
          }

          const segments = lineBuffer.split('\n');
          lineBuffer = segments.pop() ?? '';

          for (const rawLine of segments) {
            const line = rawLine.replace(/\r$/, '');
            if (!line.startsWith('data: ')) {
              continue;
            }
            const payload = line.slice(6).trimEnd();

            if (payload === '[DONE]') {
              sawDoneEvent = true;
              await reader.cancel();
              break;
            }
            if (!payload) {
              continue;
            }

            let parsed: { chunk?: unknown; error?: string };
            try {
              parsed = JSON.parse(payload) as { chunk?: unknown; error?: string };
            } catch {
              throw new Error('AI stream returned invalid JSON');
            }

            if (parsed.error) {
              throw new Error('AI provider rejected the stream');
            }
            if (typeof parsed.chunk === 'string') {
              accumulated += parsed.chunk;
              setAccumulatedResponse(accumulated);
              onChunk?.(parsed.chunk, accumulated);
            }
          }
        }

        // Remainder after last newline (or full stream if server omits trailing \n)
        if (lineBuffer.trim()) {
          const line = lineBuffer.replace(/\r$/, '');
          if (line.startsWith('data: ')) {
            const payload = line.slice(6).trimEnd();
            if (payload === '[DONE]') {
              sawDoneEvent = true;
              void reader.cancel().catch(() => {
                console.error('[streamingAI] Failed to cancel reader');
              });
            } else if (payload) {
              let parsed: { chunk?: unknown; error?: string };
              try {
                parsed = JSON.parse(payload) as { chunk?: unknown; error?: string };
              } catch {
                throw new Error('AI stream ended with invalid JSON');
              }
              if (parsed.error) {
                throw new Error('AI provider rejected the stream');
              }
              if (typeof parsed.chunk === 'string') {
                accumulated += parsed.chunk;
                setAccumulatedResponse(accumulated);
                onChunk?.(parsed.chunk, accumulated);
              }
            }
          }
        }

        setIsStreaming(false);
        onComplete?.(accumulated);

        if (bankId && accumulated) {
          const contentPieces = [
            text ? `Input text:\n${text}` : null,
            finalContext ? `Context:\n${JSON.stringify(finalContext)}` : null,
            `AI result:\n${accumulated}`,
          ].filter(Boolean);

          void retainMemory({
            bankId,
            content: contentPieces.join('\n\n'),
            metadata: {
              feature,
              source: 'ai-clinical-assistant-streaming',
            },
          });
        }

        return accumulated;
      }

      // Handle non-streaming JSON response
      const jsonData = await response.json();
      if (!jsonData.success) {
        throw new Error('AI processing failed');
      }

      const result = jsonData.result as string;
      setAccumulatedResponse(result);
      onComplete?.(result);

      if (bankId) {
        const contentPieces = [
          text ? `Input text:\n${text}` : null,
          finalContext ? `Context:\n${JSON.stringify(finalContext)}` : null,
          result ? `AI result:\n${String(result)}` : null,
        ].filter(Boolean);

        const content = contentPieces.join('\n\n');

        void retainMemory({
          bankId,
          content,
          metadata: {
            feature,
            source: 'ai-clinical-assistant-streaming',
          },
        });
      }

      return result;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }

      const message = getUserFacingErrorMessage(
        err,
        'AI streaming failed. Please try again.',
      );
      setError(message);
      onError?.(message);

      toast({
        title: 'AI Streaming Failed',
        description: message,
        variant: 'destructive',
      });

      return null;
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [onChunk, onComplete, onError, toast, user]);

  return {
    isStreaming,
    accumulatedResponse,
    error,
    streamWithAI,
    cancel,
    reset,
  };
};
