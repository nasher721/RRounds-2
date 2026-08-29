/**
 * Open Evidence search — pure URL/query helpers.
 *
 * Open Evidence has no public search API, so integration is a deep link:
 * we build a search URL and hand it to the caller to open in a new tab.
 * These helpers stay dependency-free and side-effect-free so they can be
 * unit tested without a DOM.
 */

export const OPEN_EVIDENCE_BASE_URL = "https://www.openevidence.com";

/** Upper bound on a search query we will hand off to Open Evidence. */
export const MAX_EVIDENCE_QUERY_LENGTH = 300;

/** Shortest selection worth offering an Open Evidence lookup for. */
export const MIN_EVIDENCE_SELECTION_LENGTH = 3;

/**
 * Normalize free text (a manual query or a text selection) into a single
 * trimmed line safe to hand to Open Evidence. Collapses internal whitespace
 * (selections across block elements carry newlines) and caps length —
 * never throws, never silently drops the caller's intent beyond truncation.
 */
export function sanitizeEvidenceQuery(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_EVIDENCE_QUERY_LENGTH) return collapsed;
  return collapsed.slice(0, MAX_EVIDENCE_QUERY_LENGTH).trim();
}

/** Build the openevidence.com search URL for a (already sanitized) query. */
export function buildOpenEvidenceSearchUrl(query: string): string {
  const sanitized = sanitizeEvidenceQuery(query);
  const params = new URLSearchParams({ q: sanitized });
  return `${OPEN_EVIDENCE_BASE_URL}/search?${params.toString()}`;
}

/** True when a query is non-empty after sanitizing — the only gate to search. */
export function isSearchableEvidenceQuery(raw: string): boolean {
  return sanitizeEvidenceQuery(raw).length > 0;
}
