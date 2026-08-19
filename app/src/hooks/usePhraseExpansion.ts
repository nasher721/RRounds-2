/**
 * Hook for handling phrase expansion in text editors
 * Detects autotext shortcuts and hotkeys, triggers phrase insertion
 */

import * as React from 'react';
import { useClinicalPhrases } from './useClinicalPhrases';
import type { ClinicalPhrase, PhraseField } from '@/types/phrases';
import type { Patient } from '@/types/patient';
import { expandPhrase } from '@/lib/phraseExpander';

interface UsePhraseExpansionOptions {
  patient?: Patient;
  context?: {
    noteType?: string;
    section?: string;
  };
  onInsert?: (content: string) => void;
}

export const usePhraseExpansion = (options: UsePhraseExpansionOptions = {}) => {
  const { patient, context, onInsert } = options;
  
  const {
    phrases,
    getPhraseByShortcut,
    getPhraseByHotkey,
    getPhrasesByContext,
    getPhraseFields,
    logUsage,
  } = useClinicalPhrases();

  const [selectedPhrase, setSelectedPhrase] = React.useState<ClinicalPhrase | null>(null);
  const [phraseFields, setPhraseFields] = React.useState<PhraseField[]>([]);
  const [showForm, setShowForm] = React.useState(false);
  
  // Track text input for autotext detection
  const inputBuffer = React.useRef('');
  const inputTimeout = React.useRef<NodeJS.Timeout>();

  // Load fields when phrase is selected
  React.useEffect(() => {
    if (selectedPhrase) {
      getPhraseFields(selectedPhrase.id)
        .then(fields => {
          setPhraseFields(fields);
          // If no fields, expand directly
          if (fields.length === 0) {
            const expanded = expandPhrase(selectedPhrase, [], {}, patient);
            onInsert?.(expanded.content);
            logUsage(selectedPhrase.id, patient?.id, context?.section);
            setSelectedPhrase(null);
          } else {
            setShowForm(true);
          }
        })
        .catch(error => {
          console.error('Failed to load phrase fields:', error);
          setSelectedPhrase(null);
        });
    }
  }, [selectedPhrase, getPhraseFields, patient, onInsert, logUsage, context?.section]);

  // Check for autotext match
  const checkAutotext = React.useCallback((text: string): ClinicalPhrase | null => {
    // Look for patterns like ".sob" at end of text
    const match = text.match(/(\.\w+)$/);
    if (match) {
      const shortcut = match[1];
      const phrase = getPhraseByShortcut(shortcut);
      return phrase || null;
    }
    return null;
  }, [getPhraseByShortcut]);

  // Handle text input for autotext detection
  const handleTextInput = React.useCallback((char: string) => {
    // Clear timeout
    if (inputTimeout.current) {
      clearTimeout(inputTimeout.current);
    }

    // Add to buffer
    inputBuffer.current += char;

    // Check for autotext after space or punctuation
    if (/[\s.,!?;:]/.test(char) || char === ' ') {
      const phrase = checkAutotext(inputBuffer.current.trim());
      if (phrase) {
        // Return the matched phrase and shortcut length
        inputBuffer.current = '';
        return {
          phrase,
          shortcutLength: phrase.shortcut?.length || 0,
        };
      }
    }

    // Clear buffer after 2 seconds of inactivity
    inputTimeout.current = setTimeout(() => {
      inputBuffer.current = '';
    }, 2000);

    return null;
  }, [checkAutotext]);

  // Handle keyboard shortcuts
  const handleKeyDown = React.useCallback((event: KeyboardEvent) => {
    // Build hotkey string
    const parts: string[] = [];
    if (event.ctrlKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    if (event.metaKey) parts.push('meta');
    
    // Add the key
    const key = event.key.toLowerCase();
    if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
      parts.push(key);
    }

    if (parts.length < 2) return null; // Need at least modifier + key

    const hotkey = parts.join('+');
    const phrase = getPhraseByHotkey(hotkey);
    
    if (phrase) {
      event.preventDefault();
      setSelectedPhrase(phrase);
      return phrase;
    }

    return null;
  }, [getPhraseByHotkey]);

  // Select a phrase for insertion
  const selectPhrase = React.useCallback((phrase: ClinicalPhrase) => {
    setSelectedPhrase(phrase);
  }, []);

  // Handle form submission
  const handleFormInsert = React.useCallback((content: string) => {
    onInsert?.(content);
    setShowForm(false);
    setSelectedPhrase(null);
    setPhraseFields([]);
  }, [onInsert]);

  // Log usage from form
  const handleLogUsage = React.useCallback(() => {
    if (selectedPhrase) {
      logUsage(selectedPhrase.id, patient?.id, context?.section);
    }
  }, [selectedPhrase, patient?.id, context?.section, logUsage]);

  // Close form
  const closeForm = React.useCallback(() => {
    setShowForm(false);
    setSelectedPhrase(null);
    setPhraseFields([]);
  }, []);

  // Get context suggestions
  const contextSuggestions = context ? getPhrasesByContext({
    noteType: context.noteType,
    section: context.section,
  }) : [];

  return {
    phrases,
    selectedPhrase,
    phraseFields,
    showForm,
    contextSuggestions,
    handleTextInput,
    handleKeyDown,
    selectPhrase,
    handleFormInsert,
    handleLogUsage,
    closeForm,
  };
};
