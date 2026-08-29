/**
 * Open Evidence context definition — types and the raw React context object
 * only, no components. Kept out of `OpenEvidenceContext.tsx` so that file
 * stays component-only (`OpenEvidenceProvider`) and `useOpenEvidenceState`
 * can live in `src/hooks/` without either module tripping the fast-refresh
 * "only export components" rule.
 */

import { createContext } from "react";

export type EvidenceSearchSource = "panel" | "selection" | "mobile";

/** Injectable so tests (and any future embed target) can observe/redirect the navigation. */
export type OpenEvidenceUrlOpener = (url: string) => void;

export interface OpenEvidenceContextValue {
  isOpen: boolean;
  openPanel: (prefillQuery?: string) => void;
  closePanel: () => void;
  togglePanel: () => void;

  query: string;
  setQuery: (query: string) => void;

  recentSearches: string[];
  clearRecentSearches: () => void;

  /** Sanitizes, records to recent searches, and opens the Open Evidence results tab. */
  search: (rawQuery: string, source?: EvidenceSearchSource) => boolean;
  lastSearchSource: EvidenceSearchSource | null;
}

export const OpenEvidenceContext = createContext<OpenEvidenceContextValue | null>(null);
