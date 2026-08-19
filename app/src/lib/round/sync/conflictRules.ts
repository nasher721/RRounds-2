/**
 * Round continuity + draft field conflict rules (same clinician, two devices).
 *
 * - Non-overlapping field edits → last-write-wins per field
 * - Same field diverged offline → explicit Mine / Theirs / merge (never silent drop)
 * - Round position → newest device navigation wins
 * - Expanded system → last-focused device wins
 */

import type { Round } from "@/types/round";
import { resumeRound } from "@/lib/round/roundSessionStore";
import type {
  FieldConflict,
  FieldConflictChoice,
  RoundContinuityMeta,
  VersionedField,
} from "./types";

const toMillis = (iso: string): number => {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
};

const isNewer = (leftIso: string, rightIso: string): boolean =>
  toMillis(leftIso) >= toMillis(rightIso);

export interface ContinuityMergeInput {
  localRound: Round;
  localMeta: RoundContinuityMeta;
  remoteRound: Round;
  remoteMeta: RoundContinuityMeta;
  patientIds?: readonly string[];
  now?: string;
}

export interface ContinuityMergeResult {
  round: Round;
  continuity: RoundContinuityMeta;
  /** True when either side contributed continuity fields. */
  usedRemoteNav: boolean;
  usedRemoteExpand: boolean;
}

/**
 * Reconcile local and remote lifecycle before merging ordinary continuity.
 * A different active Round is a new generation and must never be completed by
 * an older terminal snapshot from another device.
 */
export const resolveHydratedRoundContinuity = (
  input: ContinuityMergeInput & { localIsFallback?: boolean },
): ContinuityMergeResult => {
  if (input.localIsFallback) {
    return {
      round: input.remoteRound,
      continuity: input.remoteMeta,
      usedRemoteNav: true,
      usedRemoteExpand: true,
    };
  }

  const sameRound = input.localRound.id === input.remoteRound.id;

  if (sameRound && input.localRound.status === "active" && input.remoteRound.status === "active") {
    return mergeRoundContinuity(input);
  }

  let useRemote: boolean;
  if (sameRound) {
    if (input.localRound.status !== input.remoteRound.status) {
      useRemote = input.remoteRound.status === "completed";
    } else {
      useRemote = isNewer(input.remoteRound.updatedAt, input.localRound.updatedAt);
    }
  } else if (input.localRound.status !== input.remoteRound.status) {
    // An active Round with a different id is the newer explicit generation.
    useRemote = input.remoteRound.status === "active";
  } else {
    useRemote = isNewer(input.remoteRound.updatedAt, input.localRound.updatedAt);
  }

  const round = useRemote ? input.remoteRound : input.localRound;
  const continuity = useRemote ? input.remoteMeta : input.localMeta;
  return {
    round,
    continuity,
    usedRemoteNav: useRemote,
    usedRemoteExpand: useRemote,
  };
};

/** Resolve dedicated continuity timestamps with Round.updatedAt fallback for older envelopes. */
export const resolveContinuityFieldUpdatedAt = (
  dedicatedIso: string | undefined,
  roundUpdatedAt: string,
): string => dedicatedIso ?? roundUpdatedAt;

/**
 * Merge Round session continuity.
 * Newest navigation wins for position/index; last-focused wins for expanded system.
 * Filters and active section use dedicated timestamps (not navigation-bumped Round.updatedAt).
 */
export const mergeRoundContinuity = (
  input: ContinuityMergeInput,
): ContinuityMergeResult => {
  const localWinsOverall = isNewer(
    input.localRound.updatedAt,
    input.remoteRound.updatedAt,
  );
  const base = localWinsOverall ? input.localRound : input.remoteRound;
  const other = localWinsOverall ? input.remoteRound : input.localRound;

  const usedRemoteNav = isNewer(
    input.remoteMeta.positionUpdatedAt,
    input.localMeta.positionUpdatedAt,
  );
  const navSource = usedRemoteNav ? input.remoteRound : input.localRound;
  const navMeta = usedRemoteNav ? input.remoteMeta : input.localMeta;

  const usedRemoteExpand = isNewer(
    input.remoteMeta.expandedUpdatedAt,
    input.localMeta.expandedUpdatedAt,
  );
  const expandSource = usedRemoteExpand ? input.remoteRound : input.localRound;
  const expandMeta = usedRemoteExpand ? input.remoteMeta : input.localMeta;

  const localFiltersAt = resolveContinuityFieldUpdatedAt(
    input.localMeta.filtersUpdatedAt,
    input.localRound.updatedAt,
  );
  const remoteFiltersAt = resolveContinuityFieldUpdatedAt(
    input.remoteMeta.filtersUpdatedAt,
    input.remoteRound.updatedAt,
  );
  const usedRemoteFilters = isNewer(remoteFiltersAt, localFiltersAt);
  const filtersSource = usedRemoteFilters ? input.remoteRound : input.localRound;
  const filtersMeta = usedRemoteFilters ? input.remoteMeta : input.localMeta;

  const localSectionAt = resolveContinuityFieldUpdatedAt(
    input.localMeta.sectionUpdatedAt,
    input.localRound.updatedAt,
  );
  const remoteSectionAt = resolveContinuityFieldUpdatedAt(
    input.remoteMeta.sectionUpdatedAt,
    input.remoteRound.updatedAt,
  );
  const usedRemoteSection = isNewer(remoteSectionAt, localSectionAt);
  const sectionSource = usedRemoteSection ? input.remoteRound : input.localRound;
  const sectionMeta = usedRemoteSection ? input.remoteMeta : input.localMeta;

  const mergedPatients =
    base.patients.length >= other.patients.length ? base.patients : other.patients;

  const preferredIndex =
    typeof navSource.currentIndex === "number" ? navSource.currentIndex : base.currentIndex;

  const draft: Round = {
    ...base,
    patients: mergedPatients,
    currentIndex: preferredIndex,
    filters: filtersSource.filters,
    activeSection: sectionSource.activeSection,
    expandedSystemId: expandSource.expandedSystemId,
    status: base.status === "completed" || other.status === "completed"
      ? base.status === "completed"
        ? base.status
        : other.status
      : "active",
  };

  const round = resumeRound({
    round: draft,
    patientIds: input.patientIds,
    now: input.now,
  });

  return {
    round: {
      ...round,
      currentIndex: preferredIndex >= 0 && preferredIndex < round.patients.length
        ? preferredIndex
        : round.currentIndex,
      expandedSystemId: expandSource.expandedSystemId,
    },
    continuity: {
      positionUpdatedAt: navMeta.positionUpdatedAt,
      expandedUpdatedAt: expandMeta.expandedUpdatedAt,
      filtersUpdatedAt: resolveContinuityFieldUpdatedAt(
        filtersMeta.filtersUpdatedAt,
        filtersSource.updatedAt,
      ),
      sectionUpdatedAt: resolveContinuityFieldUpdatedAt(
        sectionMeta.sectionUpdatedAt,
        sectionSource.updatedAt,
      ),
      deviceId: isNewer(input.localMeta.positionUpdatedAt, input.remoteMeta.positionUpdatedAt)
        ? input.localMeta.deviceId
        : input.remoteMeta.deviceId,
    },
    usedRemoteNav,
    usedRemoteExpand,
  };
};

/**
 * Detect same-field divergence.
 * Fast-forward (one side based on the other) is not a conflict — LWW applies.
 */
export const detectDraftFieldConflict = (
  local: VersionedField,
  remote: VersionedField,
): FieldConflict | null => {
  if (local.patientId !== remote.patientId || local.fieldKey !== remote.fieldKey) {
    return null;
  }
  if (local.value === remote.value) {
    return null;
  }

  // Local fast-forwarded from remote tip
  if (local.baseUpdatedAt !== null && local.baseUpdatedAt === remote.updatedAt) {
    return null;
  }
  // Remote fast-forwarded from local tip
  if (remote.baseUpdatedAt !== null && remote.baseUpdatedAt === local.updatedAt) {
    return null;
  }
  // Identical base, both diverged
  if (
    local.baseUpdatedAt !== null
    && remote.baseUpdatedAt !== null
    && local.baseUpdatedAt === remote.baseUpdatedAt
  ) {
    return {
      id: `conflict_${local.patientId}_${local.fieldKey}_${local.updatedAt}`,
      patientId: local.patientId,
      fieldKey: local.fieldKey,
      mine: local,
      theirs: remote,
    };
  }
  // Both have writes with different values and neither is a clean fast-forward
  if (local.updatedAt !== remote.updatedAt) {
    return {
      id: `conflict_${local.patientId}_${local.fieldKey}_${local.updatedAt}_${remote.updatedAt}`,
      patientId: local.patientId,
      fieldKey: local.fieldKey,
      mine: local,
      theirs: remote,
    };
  }
  return null;
};

/**
 * Apply clinician conflict choice. Merge requires an explicit merged string
 * so we never invent clinical text.
 */
export const applyFieldConflictChoice = (
  conflict: FieldConflict,
  choice: FieldConflictChoice,
  mergedValue?: string,
): VersionedField => {
  const now = new Date().toISOString();
  if (choice === "mine") {
    return {
      ...conflict.mine,
      baseUpdatedAt: conflict.theirs.updatedAt,
      updatedAt: now,
    };
  }
  if (choice === "theirs") {
    return {
      ...conflict.theirs,
      baseUpdatedAt: conflict.theirs.updatedAt,
      updatedAt: conflict.theirs.updatedAt,
      deviceId: conflict.theirs.deviceId,
    };
  }
  const text = typeof mergedValue === "string" ? mergedValue : conflict.mergeDraft;
  if (typeof text !== "string") {
    throw new Error("Merge choice requires an explicit merged value");
  }
  return {
    patientId: conflict.patientId,
    fieldKey: conflict.fieldKey,
    value: text,
    updatedAt: now,
    baseUpdatedAt: conflict.theirs.updatedAt,
    deviceId: conflict.mine.deviceId,
  };
};

/**
 * Pick LWW winner when there is no conflict (including fast-forward).
 */
export const pickLastWriteField = (
  local: VersionedField,
  remote: VersionedField,
): VersionedField => {
  const conflict = detectDraftFieldConflict(local, remote);
  if (conflict) {
    throw new Error("Field diverged; resolve with Mine/Theirs/merge");
  }
  if (local.value === remote.value) {
    return isNewer(local.updatedAt, remote.updatedAt) ? local : remote;
  }
  if (local.baseUpdatedAt === remote.updatedAt) return local;
  if (remote.baseUpdatedAt === local.updatedAt) return remote;
  return isNewer(local.updatedAt, remote.updatedAt) ? local : remote;
};

export const draftEntityKey = (patientId: string, fieldKey: string): string =>
  `${patientId}::${fieldKey}`;
