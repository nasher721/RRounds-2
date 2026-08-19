import { useState, useCallback } from 'react';
import { useLLMClinicalAssistant } from '@/hooks/useLLMClinicalAssistant';

interface LabPrediction {
  labName: string;
  currentValue: number;
  predictedValue: number;
  predictedTime: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export function useLabPrediction() {
  const [predictions, setPredictions] = useState<Map<string, LabPrediction>>(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const { processWithAI } = useLLMClinicalAssistant();

  const predictLabValue = useCallback(async (
    labName: string,
    history: Array<{ timestamp: string; value: number }>,
    patientContext: string
  ): Promise<LabPrediction | null> => {
    setIsGenerating(true);

    try {
      const prompt = `
You are an ICU physician. Predict lab value trends.

Lab: ${labName}

Recent history (most recent first):
${history.map(h => `  ${h.timestamp}: ${h.value}`).join('\n')}

Patient context:
${patientContext}

Predict the likely value in 6 hours. Consider:
1. Clinical trajectory (improving vs deteriorating)
2. Treatment effects (diuretics causing low K+, etc.)
3. Disease progression

Provide your prediction with confidence level.

Respond in JSON format:
{
  "predictedValue": number,
  "confidence": "high|medium|low",
  "reasoning": "brief explanation (1-2 sentences)"
}
`;

      const result = await processWithAI<{ predictedValue: number; confidence: string; reasoning: string }>(
        'smart_expand',
        { text: prompt }
      );

      if (!result) return null;

      const now = new Date();
      now.setHours(now.getHours() + 6);

      const prediction: LabPrediction = {
        labName,
        currentValue: history[history.length - 1].value,
        predictedValue: result.predictedValue,
        predictedTime: now.toISOString(),
        confidence: result.confidence as 'high' | 'medium' | 'low',
        reasoning: result.reasoning,
      };

      setPredictions(prev => new Map(prev).set(labName, prediction));

      return prediction;
    } catch (error) {
      console.error('Lab prediction error:', error);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [processWithAI]);

  const getPrediction = useCallback((labName: string) => {
    return predictions.get(labName) || null;
  }, [predictions]);

  const clearPredictions = useCallback(() => {
    setPredictions(new Map());
  }, []);

  return {
    predictions,
    isGenerating,
    predictLabValue,
    getPrediction,
    clearPredictions,
  };
}
