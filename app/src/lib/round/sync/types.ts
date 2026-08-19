/**
 * Round session sync types: outbox entries, versioned draft fields, conflicts.
 * Mid-rounds continuity + chart drafts queue locally and drain on reconnect.
 */

import type { Round, RoundSyncStatus } from "@/types/round";

export type RoundOutboxKind = "round_state" | "draft_field";

export type RoundOutboxStatus =
  | "pending"
  | "syncing"
  | "failed"
  /** Kept queued (e.g. missing `round_state` table) — not acked, still counts as pending. */
  | "soft_fail"
  | "conflict"
  | "completed";

/** Explicit clinician choice for same-field divergence. Never silent-drop. */
export type FieldConflictChoice = "mine" | "theirs" | "merge";

/** Per-field version for LWW / conflict detection across devices. */
export interface VersionedField {
  /** Dot path, e.g. clinicalSummary or systems.neuro */
  fieldKey: string;
  patientId: string;
  value: string;
  /** When this device last wrote the value. */
  updatedAt: string;
  /**
   * Remote/base timestamp this edit started from.
   * Used to detect true divergence vs fast-forward.
   */
  baseUpdatedAt: string | null;
  deviceId: string;
}

export interface FieldConflict {
  id: string;
  patientId: string;
  fieldKey: string;
  mine: VersionedField;
  theirs: VersionedField;
  /** Optional clinician-edited merge text when choice is merge. */
  mergeDraft?: string;
}

export interface RoundOutboxEntry {
  id: string;
  ownerId: string;
  kind: RoundOutboxKind;
  /** roundId for round_state; `${patientId}::${fieldKey}` for drafts. */
  entityKey: string;
  payload: Record<string, unknown>;
  /** Base remote timestamp for conflict checks (draft fields). */
  baseUpdatedAt: string | null;
  updatedAt: string;
  deviceId: string;
  retryCount: number;
  maxRetries: number;
  status: RoundOutboxStatus;
  timestamp: number;
  /** Earliest time this entry may be drained again (exponential backoff). */
  nextRetryAt?: number;
  /** Why a soft_fail was recorded (kept for diagnostics; not an ack). */
  softFailReason?: string;
  conflictData?: {
    mine: VersionedField;
    theirs: VersionedField;
  };
}

/**
 * Continuity envelope around Round for device-hop merge rules.
 * Position, expanded system, filters, and active section carry their own timestamps
 * so navigation bumps do not steal filter/section LWW.
 */
export interface RoundContinuityMeta {
  positionUpdatedAt: string;
  expandedUpdatedAt: string;
  /** When filters last changed on this device (falls back to Round.updatedAt when absent). */
  filtersUpdatedAt: string;
  /** When activeSection last changed on this device (falls back to Round.updatedAt when absent). */
  sectionUpdatedAt: string;
  deviceId: string;
}

export interface CachedRoundSession {
  id: string;
  userId: string;
  round: Round;
  continuity: RoundContinuityMeta;
  /** Pending field drafts keyed by `${patientId}::${fieldKey}`. */
  draftFields: Record<string, VersionedField>;
  /** Open field conflicts awaiting Mine/Theirs/merge. */
  conflicts: FieldConflict[];
  cachedAt: number;
  lastModified: number;
  syncStatus: RoundSyncStatus;
}

export interface RoundStateRemoteRow {
  id: string;
  user_id: string;
  status: string;
  state: Record<string, unknown>;
  position_updated_at: string;
  expanded_updated_at: string;
  device_id: string;
  updated_at: string;
  created_at: string;
}

export type RoundOutboxInput = Omit<
  RoundOutboxEntry,
  "id" | "timestamp" | "retryCount" | "maxRetries" | "status" | "ownerId"
> & {
  ownerId?: string;
  status?: RoundOutboxStatus;
};
