/**
 * Clinical Guidelines Context Provider
 * Centralized state management for clinical guidelines lookup
 * Uses lazy loading for large data files to reduce initial bundle size
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import type { ClinicalGuideline, MedicalSpecialty, GuidelineSearchResult } from '@/types/clinicalGuidelines';
import { loadGuidelinesData } from '@/lib/lazyData';
import { useGuidelinesSearch, useGuidelinesBookmarks, useGuidelinesKeyboard } from '@/hooks/guidelines';
import { SPECIALTY_MAP, GUIDELINE_ORGANIZATIONS as ORG_LIST } from '@/types/clinicalGuidelines';

interface ClinicalGuidelinesContextValue {
  // Panel state
  isOpen: boolean;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;

  // Guideline state
  activeGuideline: ClinicalGuideline | null;
  viewGuideline: (guideline: ClinicalGuideline) => void;
  closeGuideline: () => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: GuidelineSearchResult[];
  isSearching: boolean;
  clearSearch: () => void;

  // Filters
  activeSpecialty: MedicalSpecialty | null;
  activeOrganization: string | null;
  setActiveSpecialty: (specialty: MedicalSpecialty | null) => void;
  setActiveOrganization: (orgId: string | null) => void;
  filteredGuidelines: ClinicalGuideline[];

  // Bookmarks & Recent
  bookmarkedGuidelines: ClinicalGuideline[];
  recentGuidelines: ClinicalGuideline[];
  toggleBookmark: (guidelineId: string) => void;
  isBookmarked: (guidelineId: string) => boolean;

  // Data accessors
  allGuidelines: ClinicalGuideline[];
  specialties: typeof SPECIALTY_MAP;
  organizations: typeof ORG_LIST;
  getGuidelineById: (id: string) => ClinicalGuideline | undefined;
  getGuidelinesBySpecialty: (specialty: MedicalSpecialty) => ClinicalGuideline[];
  getGuidelinesByOrganization: (orgId: string) => ClinicalGuideline[];

  // Loading state for lazy data
  isDataLoaded: boolean;
  ensureDataLoaded: () => Promise<void>;
}

const ClinicalGuidelinesContext = createContext<ClinicalGuidelinesContextValue | null>(null);

interface ClinicalGuidelinesProviderProps {
  children: ReactNode;
}

export function ClinicalGuidelinesProvider({ children }: ClinicalGuidelinesProviderProps) {
  // Panel visibility
  const [isOpen, setIsOpen] = useState(false);
  const [activeGuideline, setActiveGuideline] = useState<ClinicalGuideline | null>(null);

  // Lazy-loaded data
  const [guidelines, setGuidelines] = useState<ClinicalGuideline[]>([]);
  const [keywordMap, setKeywordMap] = useState<Record<string, string[]>>({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const dataLoadRef = React.useRef<Promise<void> | null>(null);
  const dataLoadedRef = React.useRef(false);

  const ensureDataLoaded = useCallback((): Promise<void> => {
    if (dataLoadedRef.current) return Promise.resolve();
    if (!dataLoadRef.current) {
      dataLoadRef.current = loadGuidelinesData()
        .then((mod) => {
          setGuidelines(mod.CLINICAL_GUIDELINES);
          setKeywordMap(mod.GUIDELINE_KEYWORD_MAP);
        })
        .catch((err: unknown) => {
          console.error('[ClinicalGuidelinesProvider] Failed to load guidelines data:', err);
        })
        .finally(() => {
          dataLoadedRef.current = true;
          setIsDataLoaded(true); // Allow the workspace to continue even without references.
          dataLoadRef.current = null;
        });
    }
    return dataLoadRef.current;
  }, []);

  useEffect(() => {
    if (isOpen) void ensureDataLoaded();
  }, [ensureDataLoaded, isOpen]);

  // Filters
  const [activeSpecialty, setActiveSpecialty] = useState<MedicalSpecialty | null>(null);
  const [activeOrganization, setActiveOrganization] = useState<string | null>(null);

  // Composable hooks
  const search = useGuidelinesSearch({ debounceMs: 150, guidelines, keywordMap });
  const bookmarks = useGuidelinesBookmarks(guidelines);

  // Panel actions
  const togglePanel = useCallback(() => setIsOpen(prev => !prev), []);
  const openPanel = useCallback(() => setIsOpen(true), []);
  const closePanel = useCallback(() => {
    setIsOpen(false);
    setActiveGuideline(null);
  }, []);

  // Guideline actions
  const viewGuideline = useCallback((guideline: ClinicalGuideline) => {
    setActiveGuideline(guideline);
    bookmarks.addToRecent(guideline.id);
  }, [bookmarks]);

  const closeGuideline = useCallback(() => {
    setActiveGuideline(null);
  }, []);

  // Filter actions with mutual exclusivity
  const handleSetActiveSpecialty = useCallback((specialty: MedicalSpecialty | null) => {
    setActiveSpecialty(specialty);
    setActiveOrganization(null);
  }, []);

  const handleSetActiveOrganization = useCallback((orgId: string | null) => {
    setActiveOrganization(orgId);
    setActiveSpecialty(null);
  }, []);

  // Keyboard shortcuts
  useGuidelinesKeyboard({
    isOpen,
    hasActiveGuideline: activeGuideline !== null,
    onTogglePanel: togglePanel,
    onClosePanel: closePanel,
    onCloseGuideline: closeGuideline,
  });

  // Memoized filtered guidelines
  const filteredGuidelines = useMemo(() => {
    let filtered = guidelines;
    if (activeSpecialty) {
      filtered = filtered.filter(g => g.specialty === activeSpecialty);
    }
    if (activeOrganization) {
      filtered = filtered.filter(g => g.organization.id === activeOrganization);
    }
    // Sort by year descending (most recent first)
    return [...filtered].sort((a, b) => b.year - a.year);
  }, [guidelines, activeSpecialty, activeOrganization]);

  // Data accessors
  const getGuidelineById = useCallback((id: string) => {
    return guidelines.find(g => g.id === id);
  }, [guidelines]);

  const getGuidelinesBySpecialty = useCallback((specialty: MedicalSpecialty) => {
    return guidelines.filter(g => g.specialty === specialty);
  }, [guidelines]);

  const getGuidelinesByOrganization = useCallback((orgId: string) => {
    return guidelines.filter(g => g.organization.id === orgId);
  }, [guidelines]);

  const value: ClinicalGuidelinesContextValue = useMemo(() => ({
    // Panel state
    isOpen,
    togglePanel,
    openPanel,
    closePanel,

    // Guideline state
    activeGuideline,
    viewGuideline,
    closeGuideline,

    // Search (from hook)
    searchQuery: search.searchQuery,
    setSearchQuery: search.setSearchQuery,
    searchResults: search.searchResults,
    isSearching: search.isSearching,
    clearSearch: search.clearSearch,

    // Filters
    activeSpecialty,
    activeOrganization,
    setActiveSpecialty: handleSetActiveSpecialty,
    setActiveOrganization: handleSetActiveOrganization,
    filteredGuidelines,

    // Bookmarks & Recent (from hook)
    bookmarkedGuidelines: bookmarks.bookmarkedGuidelines,
    recentGuidelines: bookmarks.recentGuidelines,
    toggleBookmark: bookmarks.toggleBookmark,
    isBookmarked: bookmarks.isBookmarked,

    // Data accessors
    allGuidelines: guidelines,
    specialties: SPECIALTY_MAP,
    organizations: ORG_LIST,
    getGuidelineById,
    getGuidelinesBySpecialty,
    getGuidelinesByOrganization,
    isDataLoaded,
    ensureDataLoaded,
  }), [
    isOpen, togglePanel, openPanel, closePanel,
    activeGuideline, viewGuideline, closeGuideline,
    search.searchQuery, search.setSearchQuery, search.searchResults, search.isSearching, search.clearSearch,
    activeSpecialty, activeOrganization, handleSetActiveSpecialty, handleSetActiveOrganization, filteredGuidelines,
    bookmarks.bookmarkedGuidelines, bookmarks.recentGuidelines, bookmarks.toggleBookmark, bookmarks.isBookmarked,
    getGuidelineById, getGuidelinesBySpecialty, getGuidelinesByOrganization,
    guidelines, isDataLoaded, ensureDataLoaded,
  ]);

  return (
    <ClinicalGuidelinesContext.Provider value={value}>
      {children}
    </ClinicalGuidelinesContext.Provider>
  );
}

export function useClinicalGuidelinesState() {
  const context = useContext(ClinicalGuidelinesContext);
  if (!context) {
    throw new Error('useClinicalGuidelinesState must be used within a ClinicalGuidelinesProvider');
  }
  return context;
}
