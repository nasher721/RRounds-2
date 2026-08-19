/**
 * IBCC Search Hook
 * Handles fuzzy search with debouncing for IBCC chapters
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { IBCCChapter, IBCCSearchResult } from '@/types/ibcc';

const EMPTY_CHAPTERS: IBCCChapter[] = [];

// Fuzzy match score calculation
function fuzzyMatch(text: string, query: string): number {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Exact match
  if (textLower.includes(queryLower)) return 1;
  
  // Word match
  const queryWords = queryLower.split(/\s+/);
  const matchedWords = queryWords.filter(w => textLower.includes(w));
  if (matchedWords.length > 0) return matchedWords.length / queryWords.length;
  
  // Character sequence match
  let score = 0;
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      score++;
      queryIndex++;
    }
  }
  return queryIndex === queryLower.length ? score / textLower.length : 0;
}

interface UseIBCCSearchOptions {
  debounceMs?: number;
  maxResults?: number;
  chapters?: IBCCChapter[];
}

export function useIBCCSearch(options: UseIBCCSearchOptions = {}) {
  const { debounceMs = 150, maxResults = 15, chapters = EMPTY_CHAPTERS } = options;

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search query update
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    if (searchQuery.trim()) {
      setIsSearching(true);
      debounceRef.current = setTimeout(() => {
        setDebouncedQuery(searchQuery);
        setIsSearching(false);
      }, debounceMs);
    } else {
      setDebouncedQuery('');
      setIsSearching(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, debounceMs]);

  // Memoized search results
  const searchResults = useMemo((): IBCCSearchResult[] | null => {
    if (!debouncedQuery.trim() || chapters.length === 0) return null;

    const results: IBCCSearchResult[] = [];
    const queryLower = debouncedQuery.toLowerCase();

    chapters.forEach(chapter => {
      let relevanceScore = 0;
      const matchedKeywords: string[] = [];

      // Title match (highest weight)
      const titleScore = fuzzyMatch(chapter.title, debouncedQuery);
      if (titleScore > 0) relevanceScore += titleScore * 3;

      // Keyword match
      chapter.keywords.forEach(keyword => {
        if (keyword.toLowerCase().includes(queryLower) || queryLower.includes(keyword.toLowerCase())) {
          relevanceScore += 1;
          matchedKeywords.push(keyword);
        }
      });

      // Summary match
      const summaryScore = fuzzyMatch(chapter.summary, debouncedQuery);
      if (summaryScore > 0) relevanceScore += summaryScore;

      // Category match
      if (chapter.category.name.toLowerCase().includes(queryLower)) {
        relevanceScore += 0.5;
      }

      if (relevanceScore > 0) {
        results.push({ chapter, relevanceScore, matchedKeywords });
      }
    });

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, maxResults);
  }, [debouncedQuery, maxResults, chapters]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    clearSearch,
    hasResults: searchResults !== null && searchResults.length > 0,
  };
}
