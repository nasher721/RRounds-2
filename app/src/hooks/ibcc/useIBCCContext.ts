/**
 * IBCC Context Detection Hook
 * Extracts clinical keywords from patient data for context-aware suggestions
 * Enhanced with medication analysis and relevance scoring
 */

import { useMemo } from 'react';
import type { Patient } from '@/types/patient';
import type { IBCCChapter } from '@/types/ibcc';
import {
  MEDICATION_KEYWORD_PATTERNS,
  SYSTEM_KEYWORD_PATTERNS,
  LAB_KEYWORD_PATTERNS,
} from '@/data/ibccExtendedPatterns';

// Types for enhanced context matching
export interface ContextMatch {
  chapter: IBCCChapter;
  relevanceScore: number;
  matchReasons: string[];
}

interface IBCCContextData {
  chapters: IBCCChapter[];
  patterns: Record<string, string[]>;
}

export function useIBCCContext(currentPatient?: Patient, ibccData?: IBCCContextData) {

  // Enhanced context suggestions with relevance scoring
  const contextSuggestions = useMemo((): ContextMatch[] => {
    const chapters = ibccData?.chapters ?? [];
    const keywordPatterns = ibccData?.patterns ?? {};
    if (!currentPatient || chapters.length === 0) return [];

    // 1. Build clinical text from systems and summary
    const clinicalText = [
      currentPatient.clinicalSummary,
      currentPatient.intervalEvents,
      ...Object.values(currentPatient.systems)
    ].join(' ').toLowerCase();

    // 2. Build medication text from all medication fields
    const medicationText = [
      ...(currentPatient.medications?.infusions ?? []),
      ...(currentPatient.medications?.scheduled ?? []),
      ...(currentPatient.medications?.prn ?? [])
    ].join(' ').toLowerCase();

    // 3. Labs text
    const labText = (currentPatient.labs ?? '').toLowerCase();

    // Track matches with scoring
    const chapterMatches: Map<string, { score: number; reasons: string[] }> = new Map();

    // Helper to add match
    const addMatch = (chapterId: string, score: number, reason: string) => {
      const existing = chapterMatches.get(chapterId) ?? { score: 0, reasons: [] };
      existing.score += score;
      if (!existing.reasons.includes(reason)) {
        existing.reasons.push(reason);
      }
      chapterMatches.set(chapterId, existing);
    };

    // 3. Match against basic keyword patterns (clinical text)
    Object.entries(keywordPatterns).forEach(([chapterId, patterns]) => {
      (patterns as string[]).forEach(pattern => {
        const patternLower = pattern.toLowerCase();
        if (clinicalText.includes(patternLower)) {
          addMatch(chapterId, 3, `Clinical: "${pattern}"`);
        }
      });
    });

    // 4. Match against medication patterns
    Object.entries(MEDICATION_KEYWORD_PATTERNS).forEach(([chapterId, patterns]) => {
      (patterns as string[]).forEach(pattern => {
        const patternLower = pattern.toLowerCase();
        if (medicationText.includes(patternLower)) {
          addMatch(chapterId, 2, `Med: "${pattern}"`);
        }
      });
    });

    // 5. Match against lab patterns
    Object.entries(LAB_KEYWORD_PATTERNS).forEach(([chapterId, patterns]) => {
      (patterns as string[]).forEach(pattern => {
        const patternLower = pattern.toLowerCase();
        if (labText.includes(patternLower)) {
          addMatch(chapterId, 2, `Lab: "${pattern}"`);
        }
      });
    });

    // 6. Match against system patterns
    Object.entries(SYSTEM_KEYWORD_PATTERNS).forEach(([chapterId, patterns]) => {
      (patterns as string[]).forEach(pattern => {
        const patternLower = pattern.toLowerCase();
        if (clinicalText.includes(patternLower)) {
          addMatch(chapterId, 3, `System: "${pattern}"`);
        }
      });
    });

    // 7. Match chapter keywords directly
    chapters.forEach(chapter => {
      chapter.keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        if (clinicalText.includes(keywordLower)) {
          addMatch(chapter.id, 2, `Keyword: "${keyword}"`);
        }
        if (medicationText.includes(keywordLower)) {
          addMatch(chapter.id, 1, `Med keyword: "${keyword}"`);
        }
      });
    });

    // Sort by relevance and return top matches with reasons
    const sortedMatches = Array.from(chapterMatches.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 5);

    return sortedMatches.map(([chapterId, { score, reasons }]) => ({
      chapter: chapters.find(c => c.id === chapterId)!,
      relevanceScore: score,
      matchReasons: reasons.slice(0, 3), // Max 3 reasons
    })).filter(match => match.chapter);
  }, [currentPatient, ibccData]);

  const hasContextSuggestions = contextSuggestions.length > 0;

  return {
    contextSuggestions: contextSuggestions.map(c => c.chapter),
    hasContextSuggestions,
    // Export detailed matches for UI display
    detailedMatches: contextSuggestions,
  };
}
