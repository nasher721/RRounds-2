import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import type { Json } from '@/integrations/supabase/types';
import { retainMemory, recallMemories } from '@/lib/hindsightClient';
import { withCategoryTimeout } from '@/lib/requestTimeout';
import { getUserFacingErrorMessage } from '@/lib/userFacingErrors';
import { safeLocalStorage } from '@/utils/safeStorage';

export type TransformType = 'comma-list' | 'medical-shorthand' | 'custom';

/** Result of a successful transform-text call (for preview + trust UX). */
export type TextTransformResult = {
  text: string
  latencyMs: number
  inputChars: number
  outputChars: number
  /** Rough output size for display (~tokens); not from the model API. */
  approxTokensOut: number
}

export interface CustomPrompt {
  id: string;
  name: string;
  prompt: string;
}

const MAX_CUSTOM_PROMPTS = 50;
const MAX_PROMPT_NAME_LENGTH = 100;
const MAX_PROMPT_LENGTH = 4000;

const sanitizeCustomPrompts = (value: unknown): CustomPrompt[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((prompt): prompt is CustomPrompt => (
      typeof prompt === 'object'
      && prompt !== null
      && typeof (prompt as CustomPrompt).id === 'string'
      && typeof (prompt as CustomPrompt).name === 'string'
      && typeof (prompt as CustomPrompt).prompt === 'string'
    ))
    .slice(0, MAX_CUSTOM_PROMPTS)
    .map((prompt) => ({
      id: prompt.id.slice(0, 100),
      name: prompt.name.slice(0, MAX_PROMPT_NAME_LENGTH),
      prompt: prompt.prompt.slice(0, MAX_PROMPT_LENGTH),
    }));
};

// Custom prompts can contain clinical text. RLS-protected user settings are
// the durable store; remove copies left in unscoped browser storage.
safeLocalStorage.removeItem('ai-custom-prompts');

export const useTextTransform = () => {
  const { user } = useAuth();
  const [isTransforming, setIsTransforming] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const initialSyncDone = React.useRef(false);
  const loadedOwnerRef = React.useRef<string | null>(null);
  const userId = user?.id ?? null;

  const [storedCustomPrompts, setStoredCustomPrompts] = React.useState<CustomPrompt[]>([]);
  const customPrompts = React.useMemo(
    () => loadedOwnerRef.current === userId ? storedCustomPrompts : [],
    [storedCustomPrompts, userId],
  );

  // Sync custom prompts to database
  const syncPromptsToDb = React.useCallback(async (prompts: CustomPrompt[]) => {
    if (!userId) return;

    try {
      const { data: existing, error: lookupError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (lookupError) throw lookupError;

      // Cast prompts to Json-compatible type
      const promptsJson = JSON.parse(JSON.stringify(sanitizeCustomPrompts(prompts))) as Json;

      if (existing) {
        const { error } = await supabase
          .from('user_settings')
          .update({ custom_prompts: promptsJson })
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_settings')
          .insert([{ user_id: userId, custom_prompts: promptsJson }]);
        if (error) throw error;
      }
    } catch {
      console.error('Failed to sync custom prompts');
    }
  }, [userId]);

  // Load prompts from database on login
  React.useEffect(() => {
    let active = true;
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    setIsSyncing(false);
    initialSyncDone.current = false;
    loadedOwnerRef.current = null;
    setStoredCustomPrompts([]);
    safeLocalStorage.removeItem('ai-custom-prompts');

    const loadFromDb = async () => {
      if (!userId) return;

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('custom_prompts')
          .eq('user_id', userId)
          .maybeSingle();
        if (error) throw error;

        if (!active) return;
        const dbPrompts = sanitizeCustomPrompts(data?.custom_prompts);
        loadedOwnerRef.current = userId;
        setStoredCustomPrompts(dbPrompts);
        initialSyncDone.current = true;
      } catch {
        if (active) console.error('Failed to load custom prompts');
      }
    };

    void loadFromDb();
    return () => {
      active = false;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [userId]);

  const saveCustomPrompts = React.useCallback((prompts: CustomPrompt[]) => {
    const sanitizedPrompts = sanitizeCustomPrompts(prompts);
    loadedOwnerRef.current = userId;
    setStoredCustomPrompts(sanitizedPrompts);
    
    // Debounce DB sync
    if (userId && initialSyncDone.current) {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      setIsSyncing(true);
      syncTimeoutRef.current = setTimeout(() => {
        syncPromptsToDb(sanitizedPrompts).finally(() => {
          setIsSyncing(false);
        });
      }, 500);
    }
  }, [userId, syncPromptsToDb]);

  const addCustomPrompt = React.useCallback((name: string, prompt: string) => {
    const newPrompt: CustomPrompt = {
      id: crypto.randomUUID(),
      name,
      prompt,
    };
    saveCustomPrompts([...customPrompts, newPrompt]);
    toast.success(`Saved prompt: ${name}`);
    return newPrompt;
  }, [customPrompts, saveCustomPrompts]);

  const removeCustomPrompt = React.useCallback((id: string) => {
    saveCustomPrompts(customPrompts.filter(p => p.id !== id));
    toast.success('Prompt deleted');
  }, [customPrompts, saveCustomPrompts]);

  const transformText = React.useCallback(async (
    text: string,
    transformType: TransformType,
    customPrompt?: string
  ): Promise<TextTransformResult | null> => {
    if (!text.trim()) {
      toast.error('No text selected');
      return null;
    }

    setIsTransforming(true);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    try {
      const bankId = user ? `clinician:${user.id}` : null;

      let combinedCustomPrompt = customPrompt;

      if (bankId) {
        const recalled = await recallMemories({
          bankId,
          query: `text_transform preferences and style for transform type ${transformType}`,
          filters: {
            feature: 'text_transform',
            transformType,
          },
          limit: 8,
        });

        const styleSummary = recalled?.memories
          ?.map((memory) => memory.content)
          .filter(Boolean)
          .join('\n---\n');

        if (styleSummary) {
          const prefix = `Clinician style and preferences for text transforms:\n${styleSummary}`;
          combinedCustomPrompt = [prefix, customPrompt].filter(Boolean).join('\n\n');
        }
      }

      const { data, error } = await withCategoryTimeout(
        supabase.functions.invoke('transform-text', {
          body: { text, transformType, customPrompt: combinedCustomPrompt },
        }),
        'textTransform',
        'transform-text',
      );

      if (error) {
        console.error('Transform error:', error);
        toast.error(getUserFacingErrorMessage(error, 'Failed to transform text'));
        return null;
      }

      if (data?.error) {
        toast.error(getUserFacingErrorMessage(data.error, 'Failed to transform text'));
        return null;
      }

      const out = data?.transformedText
      if (typeof out !== 'string' || !out) {
        toast.error('No transformed text returned');
        return null
      }

      if (bankId) {
        const content = [
          `Original text:\n${text}`,
          `Transform type: ${transformType}`,
          combinedCustomPrompt ? `Custom prompt used:\n${combinedCustomPrompt}` : null,
          `Transformed text:\n${out}`,
        ]
          .filter(Boolean)
          .join('\n\n');

        void retainMemory({
          bankId,
          content,
          metadata: {
            feature: 'text_transform',
            transformType,
            source: 'transform-text',
          },
        });
      }

      const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const latencyMs = Math.round(endedAt - startedAt)
      const outputChars = out.length
      return {
        text: out,
        latencyMs,
        inputChars: text.length,
        outputChars,
        approxTokensOut: Math.max(1, Math.ceil(outputChars / 4)),
      }
    } catch (err) {
      console.error('Transform error:', err);
      toast.error(getUserFacingErrorMessage(err, 'Failed to transform text'));
      return null;
    } finally {
      setIsTransforming(false);
    }
  }, [user]);

  return {
    transformText,
    isTransforming,
    isSyncing,
    customPrompts,
    addCustomPrompt,
    removeCustomPrompt,
  };
};
