/**
 * Clinical Guidelines Search Hook
 * Provides debounced search functionality across guidelines
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ClinicalGuideline, GuidelineSearchResult, MedicalSpecialty } from '@/types/clinicalGuidelines';

const EMPTY_GUIDELINES: ClinicalGuideline[] = [];
const EMPTY_KEYWORD_MAP: Record<string, string[]> = {};

interface UseGuidelinesSearchOptions {
  debounceMs?: number;
  guidelines?: ClinicalGuideline[];
  keywordMap?: Record<string, string[]>;
}

interface UseGuidelinesSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: GuidelineSearchResult[];
  isSearching: boolean;
  clearSearch: () => void;
}

export function useGuidelinesSearch({
  debounceMs = 150,
  guidelines = EMPTY_GUIDELINES,
  keywordMap = EMPTY_KEYWORD_MAP,
}: UseGuidelinesSearchOptions = {}): UseGuidelinesSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Debounce the search query
  useEffect(() => {
    if (searchQuery.length === 0) {
      setDebouncedQuery('');
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);

  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return [];

    const query = debouncedQuery.toLowerCase().trim();
    const queryWords = query.split(/\s+/);

    // Expand query with keyword mappings
    const expandedTerms = new Set<string>(queryWords);
    Object.entries(keywordMap).forEach(([key, synonyms]) => {
      const keyLower = key.toLowerCase();
      const synonymsLower = synonyms.map(synonym => synonym.toLowerCase());
      if (queryWords.some(w => keyLower.includes(w) || synonymsLower.some(s => s.includes(w)))) {
        expandedTerms.add(keyLower);
        synonymsLower.forEach(s => expandedTerms.add(s));
      }
    });

    // Materialize once: the per-keyword match below runs for every keyword of every guideline.
    const expandedTermList = [...expandedTerms];

    const results: GuidelineSearchResult[] = [];

    guidelines.forEach(guideline => {
      let score = 0;
      const matchedKeywords: string[] = [];
      let matchedInTitle = false;
      let matchedInSummary = false;

      // Check title
      const titleLower = guideline.title.toLowerCase();
      const shortTitleLower = guideline.shortTitle.toLowerCase();
      queryWords.forEach(word => {
        if (titleLower.includes(word)) {
          score += 10;
          matchedInTitle = true;
        }
        if (shortTitleLower.includes(word)) {
          score += 8;
          matchedInTitle = true;
        }
      });

      // Check condition
      const conditionLower = guideline.condition.toLowerCase();
      queryWords.forEach(word => {
        if (conditionLower.includes(word)) {
          score += 12;
        }
      });

      // Check keywords
      guideline.keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        if (expandedTermList.some(term => keywordLower.includes(term) || term.includes(keywordLower))) {
          score += 5;
          matchedKeywords.push(keyword);
        }
      });

      // Check summary
      const summaryLower = guideline.summary.toLowerCase();
      queryWords.forEach(word => {
        if (summaryLower.includes(word)) {
          score += 2;
          matchedInSummary = true;
        }
      });

      // Check organization
      if (guideline.organization.name.toLowerCase().includes(query) ||
          guideline.organization.abbreviation.toLowerCase().includes(query)) {
        score += 6;
      }

      // Check specialty
      if (guideline.specialty.toLowerCase().includes(query)) {
        score += 4;
      }

      if (score > 0) {
        results.push({
          guideline,
          relevanceScore: score,
          matchedKeywords: [...new Set(matchedKeywords)],
          matchedInTitle,
          matchedInSummary
        });
      }
    });

    // Sort by relevance score descending
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }, [debouncedQuery, guidelines, keywordMap]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    clearSearch
  };
}
