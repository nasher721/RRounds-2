/**
 * Round session domain types for the Today’s Round Focus-first runner.
 * Round is the top-level working session: ordered list, position, filters,
 * done/skip, active section, and single expanded system.
 */

/** Quiet sync cue values surfaced in Round chrome. */
export type RoundSyncStatus =
  | "idle"
  | "offline"
  | "syncing"
  | "conflict"
  | "failed";

/** Per-patient walk state within a Round. */
export type RoundPatientWalkStatus = "pending" | "done" | "skipped";

/**
 * Lightweight patient pointer in Round order.
 * Chart payload lives elsewhere; the Round only tracks id + walk flags.
 */
export interface RoundPatientRef {
  patientId: string;
  status: RoundPatientWalkStatus;
}

/**
 * Mid-rounds Focus sections that can be restored across devices.
 * Identity is always visible; these track which chart slice is active.
 */
export type RoundActiveSection =
  | "clinicalSummary"
  | "systems"
  | "todos";

/** Roster search / visibility filters restored with the session. */
export interface RoundFilters {
  search: string;
  hideDone: boolean;
  hideSkipped: boolean;
}

export type RoundLifecycleStatus = "active" | "completed";

/**
 * Today’s Round — ordered patient list plus session continuity fields.
 */
export interface Round {
  id: string;
  userId: string;
  status: RoundLifecycleStatus;
  patients: RoundPatientRef[];
  /** Index into `patients`; -1 when the list is empty. */
  currentIndex: number;
  filters: RoundFilters;
  activeSection: RoundActiveSection;
  /** Single expanded systems-review row id; null when all collapsed. */
  expandedSystemId: string | null;
  syncStatus: RoundSyncStatus;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_ROUND_FILTERS: RoundFilters = {
  search: "",
  hideDone: false,
  hideSkipped: false,
};

export const DEFAULT_ROUND_ACTIVE_SECTION: RoundActiveSection = "clinicalSummary";
