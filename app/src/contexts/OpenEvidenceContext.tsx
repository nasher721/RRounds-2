/**
 * Open Evidence Context
 * Panel state, recent-search history, and the actual search action for the
 * Open Evidence integration. Open Evidence has no public search API, so a
 * "search" here sanitizes the query and opens openevidence.com's own search
 * results in a new tab — nothing is sent anywhere except that direct,
 * user-initiated navigation.
 */

import React, { useCallback, useEffect, useMemo, useState, ReactNode } from "react";
import { buildOpenEvidenceSearchUrl, isSearchableEvidenceQuery, sanitizeEvidenceQuery } from "@/lib/openEvidence";
import { safeLocalStorage } from "@/utils/safeStorage";
import {
  OpenEvidenceContext,
  type EvidenceSearchSource,
  type OpenEvidenceContextValue,
  type OpenEvidenceUrlOpener,
} from "@/contexts/openEvidenceContextCore";

export type { EvidenceSearchSource, OpenEvidenceUrlOpener } from "@/contexts/openEvidenceContextCore";

const RECENT_SEARCHES_KEY = "open-evidence-recent-searches";
const MAX_RECENT_SEARCHES = 8;

const defaultUrlOpener: OpenEvidenceUrlOpener = (url) => {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
};

interface OpenEvidenceProviderProps {
  children: ReactNode;
  /** Test/embed hook — defaults to `window.open` in a new tab. */
  urlOpener?: OpenEvidenceUrlOpener;
}

function loadRecentSearches(): string[] {
  try {
    const stored = safeLocalStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string").slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function OpenEvidenceProvider({ children, urlOpener = defaultUrlOpener }: OpenEvidenceProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const [lastSearchSource, setLastSearchSource] = useState<EvidenceSearchSource | null>(null);

  useEffect(() => {
    try {
      safeLocalStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
    } catch (e) {
      console.warn("Failed to save Open Evidence recent searches:", e);
    }
  }, [recentSearches]);

  const openPanel = useCallback((prefillQuery?: string) => {
    if (prefillQuery !== undefined) setQuery(prefillQuery);
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => setIsOpen(false), []);
  const togglePanel = useCallback(() => setIsOpen((prev) => !prev), []);

  const clearRecentSearches = useCallback(() => setRecentSearches([]), []);

  const search = useCallback((rawQuery: string, source: EvidenceSearchSource = "panel"): boolean => {
    if (!isSearchableEvidenceQuery(rawQuery)) return false;
    const sanitized = sanitizeEvidenceQuery(rawQuery);

    urlOpener(buildOpenEvidenceSearchUrl(sanitized));
    setLastSearchSource(source);
    setRecentSearches((prev) => {
      const withoutDuplicate = prev.filter((entry) => entry.toLowerCase() !== sanitized.toLowerCase());
      return [sanitized, ...withoutDuplicate].slice(0, MAX_RECENT_SEARCHES);
    });
    return true;
  }, [urlOpener]);

  // Escape closes the panel; Ctrl/Cmd+E toggles it (mirrors the Guidelines/IBCC pattern).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        togglePanel();
        return;
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        closePanel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, togglePanel, closePanel]);

  const value: OpenEvidenceContextValue = useMemo(() => ({
    isOpen,
    openPanel,
    closePanel,
    togglePanel,
    query,
    setQuery,
    recentSearches,
    clearRecentSearches,
    search,
    lastSearchSource,
  }), [isOpen, openPanel, closePanel, togglePanel, query, recentSearches, clearRecentSearches, search, lastSearchSource]);

  return (
    <OpenEvidenceContext.Provider value={value}>
      {children}
    </OpenEvidenceContext.Provider>
  );
}
