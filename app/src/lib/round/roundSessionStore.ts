/**
 * Pure Round session store transitions.
 * Immutable helpers for create/resume, navigation, done/skip, filters,
 * active section, and single-id expanded system.
 */

import {
  DEFAULT_ROUND_ACTIVE_SECTION,
  DEFAULT_ROUND_FILTERS,
  type Round,
  type RoundActiveSection,
  type RoundFilters,
  type RoundPatientRef,
  type RoundPatientWalkStatus,
  type RoundSyncStatus,
} from "@/types/round";

export interface CreateRoundInput {
  userId: string;
  patientIds: readonly string[];
  /** Optional stable id (e.g. resumed persistence key). */
  id?: string;
  /** ISO timestamp; defaults to now. */
  now?: string;
}

export interface ResumeRoundInput {
  round: Round;
  /** Optional patient id list to re-bind order; omit to keep existing. */
  patientIds?: readonly string[];
  now?: string;
}

const ACTIVE_SECTIONS = new Set<RoundActiveSection>([
  "clinicalSummary",
  "systems",
  "todos",
]);

const WALK_STATUSES = new Set<RoundPatientWalkStatus>(["pending", "done", "skipped"]);

const SYNC_STATUSES = new Set<RoundSyncStatus>([
  "idle",
  "offline",
  "syncing",
  "conflict",
  "failed",
]);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const createRoundId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `round_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const toIsoNow = (now?: string): string => {
  if (isNonEmptyString(now)) return now;
  return new Date().toISOString();
};

const mapPatientRefs = (patientIds: readonly string[]): RoundPatientRef[] => {
  const seen = new Set<string>();
  const refs: RoundPatientRef[] = [];
  for (const rawId of patientIds) {
    if (!isNonEmptyString(rawId)) continue;
    const patientId = rawId.trim();
    if (seen.has(patientId)) continue;
    seen.add(patientId);
    refs.push({ patientId, status: "pending" });
  }
  return refs;
};

const clampIndex = (index: number, length: number): number => {
  if (length <= 0) return -1;
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
};

const touch = (round: Round, now?: string): Round => ({
  ...round,
  updatedAt: toIsoNow(now),
});

const withPatients = (
  round: Round,
  patients: RoundPatientRef[],
  preferredIndex: number,
  now?: string,
): Round => {
  const currentIndex = clampIndex(preferredIndex, patients.length);
  return touch(
    {
      ...round,
      patients,
      currentIndex,
      expandedSystemId: null,
    },
    now,
  );
};

const sanitizeFilters = (filters: Partial<RoundFilters> | RoundFilters): RoundFilters => ({
  search: typeof filters.search === "string" ? filters.search : DEFAULT_ROUND_FILTERS.search,
  hideDone:
    typeof filters.hideDone === "boolean" ? filters.hideDone : DEFAULT_ROUND_FILTERS.hideDone,
  hideSkipped:
    typeof filters.hideSkipped === "boolean"
      ? filters.hideSkipped
      : DEFAULT_ROUND_FILTERS.hideSkipped,
});

const sanitizeActiveSection = (section: unknown): RoundActiveSection => {
  if (typeof section === "string" && ACTIVE_SECTIONS.has(section as RoundActiveSection)) {
    return section as RoundActiveSection;
  }
  return DEFAULT_ROUND_ACTIVE_SECTION;
};

const sanitizeWalkStatus = (status: unknown): RoundPatientWalkStatus => {
  if (typeof status === "string" && WALK_STATUSES.has(status as RoundPatientWalkStatus)) {
    return status as RoundPatientWalkStatus;
  }
  return "pending";
};

const sanitizeSyncStatus = (status: unknown): RoundSyncStatus => {
  if (typeof status === "string" && SYNC_STATUSES.has(status as RoundSyncStatus)) {
    return status as RoundSyncStatus;
  }
  return "idle";
};

const sanitizePatientRefs = (patients: readonly RoundPatientRef[]): RoundPatientRef[] => {
  const seen = new Set<string>();
  const refs: RoundPatientRef[] = [];
  for (const patient of patients) {
    if (!patient || !isNonEmptyString(patient.patientId)) continue;
    const patientId = patient.patientId.trim();
    if (seen.has(patientId)) continue;
    seen.add(patientId);
    refs.push({
      patientId,
      status: sanitizeWalkStatus(patient.status),
    });
  }
  return refs;
};

/** Current patient ref, or null when the Round list is empty / index invalid. */
export const getCurrentPatientRef = (round: Round): RoundPatientRef | null => {
  if (round.currentIndex < 0 || round.currentIndex >= round.patients.length) {
    return null;
  }
  return round.patients[round.currentIndex] ?? null;
};

/** 1-based position for `Round · N/M` chrome; N is 0 when empty. */
export const getRoundPosition = (
  round: Round,
): { current: number; total: number } => {
  const total = round.patients.length;
  if (total === 0) return { current: 0, total: 0 };
  return { current: round.currentIndex + 1, total };
};

/**
 * Create a new active Round from an ordered patient id list.
 * Duplicate / blank ids are dropped; index starts at the first patient.
 */
export const createRound = (input: CreateRoundInput): Round => {
  const now = toIsoNow(input.now);
  const patients = mapPatientRefs(input.patientIds);
  return {
    id: isNonEmptyString(input.id) ? input.id.trim() : createRoundId(),
    userId: input.userId.trim(),
    status: "active",
    patients,
    currentIndex: patients.length > 0 ? 0 : -1,
    filters: { ...DEFAULT_ROUND_FILTERS },
    activeSection: DEFAULT_ROUND_ACTIVE_SECTION,
    expandedSystemId: null,
    syncStatus: "idle",
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Resume an existing Round, optionally rebinding patient order.
 * Preserves walk status for patients still present; clamps index.
 */
export const resumeRound = (input: ResumeRoundInput): Round => {
  const now = toIsoNow(input.now);
  const basePatients = sanitizePatientRefs(input.round.patients);

  let patients = basePatients;
  if (input.patientIds) {
    const previousById = new Map(basePatients.map((ref) => [ref.patientId, ref]));
    patients = mapPatientRefs(input.patientIds).map((ref) => {
      const previous = previousById.get(ref.patientId);
      return previous ? { ...ref, status: previous.status } : ref;
    });
  }

  const preferredIndex =
    typeof input.round.currentIndex === "number" ? input.round.currentIndex : 0;

  return {
    id: isNonEmptyString(input.round.id) ? input.round.id.trim() : createRoundId(),
    userId: isNonEmptyString(input.round.userId)
      ? input.round.userId.trim()
      : input.round.userId,
    status: input.round.status === "completed" ? "completed" : "active",
    patients,
    currentIndex: clampIndex(preferredIndex, patients.length),
    filters: sanitizeFilters(input.round.filters ?? DEFAULT_ROUND_FILTERS),
    activeSection: sanitizeActiveSection(input.round.activeSection),
    expandedSystemId:
      typeof input.round.expandedSystemId === "string" && input.round.expandedSystemId.trim()
        ? input.round.expandedSystemId.trim()
        : null,
    syncStatus: sanitizeSyncStatus(input.round.syncStatus),
    createdAt: isNonEmptyString(input.round.createdAt) ? input.round.createdAt : now,
    updatedAt: now,
  };
};

/** Jump to a patient by id; no-op when the id is not in the Round. */
export const selectPatient = (round: Round, patientId: string, now?: string): Round => {
  if (round.status === "completed") return round;
  if (!isNonEmptyString(patientId)) return round;
  const index = round.patients.findIndex((ref) => ref.patientId === patientId.trim());
  if (index < 0) return round;
  if (index === round.currentIndex && round.expandedSystemId === null) {
    return touch(round, now);
  }
  return touch(
    {
      ...round,
      currentIndex: index,
      expandedSystemId: null,
    },
    now,
  );
};

/** Advance to the next patient; stays on last when already at end. */
export const nextPatient = (round: Round, now?: string): Round => {
  if (round.status === "completed") return round;
  if (round.patients.length === 0) return round;
  if (round.currentIndex >= round.patients.length - 1) return round;
  return touch(
    {
      ...round,
      currentIndex: round.currentIndex + 1,
      expandedSystemId: null,
    },
    now,
  );
};

/** Move to the previous patient; stays on first when already at start. */
export const prevPatient = (round: Round, now?: string): Round => {
  if (round.status === "completed") return round;
  if (round.patients.length === 0) return round;
  if (round.currentIndex <= 0) return round;
  return touch(
    {
      ...round,
      currentIndex: round.currentIndex - 1,
      expandedSystemId: null,
    },
    now,
  );
};

const setCurrentWalkStatus = (
  round: Round,
  status: RoundPatientWalkStatus,
  now?: string,
): Round => {
  if (round.status === "completed") return round;
  const current = getCurrentPatientRef(round);
  if (!current) return round;
  if (current.status === status) return touch(round, now);
  const patients = round.patients.map((ref, index) =>
    index === round.currentIndex ? { ...ref, status } : ref,
  );
  return touch({ ...round, patients }, now);
};

/** Mark the current patient done (does not auto-advance). */
export const markCurrentDone = (round: Round, now?: string): Round =>
  setCurrentWalkStatus(round, "done", now);

/** Mark the current patient skipped (does not auto-advance). */
export const markCurrentSkipped = (round: Round, now?: string): Round =>
  setCurrentWalkStatus(round, "skipped", now);

/** Clear done/skip on the current patient back to pending. */
export const clearCurrentWalkStatus = (round: Round, now?: string): Round =>
  setCurrentWalkStatus(round, "pending", now);

/**
 * Convenience: mark current done and advance when a next patient exists.
 * Deterministic for bed-by-bed “Done” sticky action flows.
 */
export const markDoneAndNext = (round: Round, now?: string): Round => {
  const marked = markCurrentDone(round, now);
  return nextPatient(marked, now);
};

/** Replace Round filters (partial merge onto existing). */
export const setRoundFilters = (
  round: Round,
  patch: Partial<RoundFilters>,
  now?: string,
): Round => {
  if (round.status === "completed") return round;
  return touch(
    {
      ...round,
      filters: sanitizeFilters({ ...round.filters, ...patch }),
    },
    now,
  );
};

/** Set which mid-rounds section is active for continuity. */
export const setActiveSection = (
  round: Round,
  section: RoundActiveSection,
  now?: string,
): Round => {
  if (round.status === "completed") return round;
  const nextSection = sanitizeActiveSection(section);
  if (nextSection === round.activeSection) return touch(round, now);
  return touch({ ...round, activeSection: nextSection }, now);
};

/**
 * Expand one systems-review row. Passing the same id again is a no-op keep;
 * passing null collapses. Expanding a different id replaces the prior.
 */
export const setExpandedSystem = (
  round: Round,
  systemId: string | null,
  now?: string,
): Round => {
  if (round.status === "completed") return round;
  const nextId =
    systemId === null || !isNonEmptyString(systemId) ? null : systemId.trim();
  if (nextId === round.expandedSystemId) return touch(round, now);
  return touch({ ...round, expandedSystemId: nextId }, now);
};

/** Update quiet sync cue without changing clinical session fields. */
export const setRoundSyncStatus = (
  round: Round,
  syncStatus: RoundSyncStatus,
  now?: string,
): Round => {
  if (round.status === "completed") return round;
  const next = sanitizeSyncStatus(syncStatus);
  if (next === round.syncStatus) return touch(round, now);
  return touch({ ...round, syncStatus: next }, now);
};

/** Mark Round complete (End Round). */
export const completeRound = (round: Round, now?: string): Round =>
  round.status === "completed"
    ? round
    : touch({ ...round, status: "completed", expandedSystemId: null }, now);

/** Replace the ordered patient list while preserving walk status where possible. */
export const replaceRoundPatients = (
  round: Round,
  patientIds: readonly string[],
  now?: string,
): Round => {
  if (round.status === "completed") return round;
  const previousById = new Map(round.patients.map((ref) => [ref.patientId, ref]));
  const patients = mapPatientRefs(patientIds).map((ref) => {
    const previous = previousById.get(ref.patientId);
    return previous ? { ...ref, status: previous.status } : ref;
  });
  const currentId = getCurrentPatientRef(round)?.patientId;
  const preferredIndex =
    currentId !== undefined
      ? patients.findIndex((ref) => ref.patientId === currentId)
      : 0;
  return withPatients(
    round,
    patients,
    preferredIndex >= 0 ? preferredIndex : 0,
    now,
  );
};
