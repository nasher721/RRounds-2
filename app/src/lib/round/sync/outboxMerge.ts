/**
 * Outbox coalesce rules for Round state patches and draft field writes.
 * Keeps retries; never drops an unresolved conflict entry.
 */

import type { RoundOutboxEntry, RoundOutboxKind } from "./types";

const MAX_RETRIES = 5;
export const OUTBOX_BACKOFF_BASE_MS = 1_000;
export const OUTBOX_BACKOFF_MAX_MS = 60_000;
/** Soft-fail (missing table) recheck cadence — still pending, not acked. */
export const OUTBOX_SOFT_FAIL_RETRY_MS = 60_000;

/**
 * Exponential backoff deadline for the next drain attempt.
 * attempt 0 → +1s, 1 → +2s, 2 → +4s … capped at OUTBOX_BACKOFF_MAX_MS.
 */
export const computeOutboxNextRetryAt = (
  retryCount: number,
  now = Date.now(),
): number => {
  const attempt = Math.max(0, retryCount);
  const delay = Math.min(
    OUTBOX_BACKOFF_BASE_MS * 2 ** attempt,
    OUTBOX_BACKOFF_MAX_MS,
  );
  return now + delay;
};

/** True when the entry is eligible for the next drain batch. */
export const isOutboxEntryReady = (
  entry: RoundOutboxEntry,
  now = Date.now(),
): boolean => {
  const status = entry.status || "pending";
  if (status !== "pending" && status !== "soft_fail") return false;
  if (typeof entry.nextRetryAt === "number" && entry.nextRetryAt > now) {
    return false;
  }
  return true;
};

/**
 * After hydrate, drain immediately when already online so reload clears
 * pending without waiting for a new edit / online event.
 */
export const shouldDrainOutboxAfterHydrate = (isOnline: boolean): boolean => isOnline;

/**
 * missingTable must not ack/remove the row — keep soft_fail so continuity
 * stays pending until a real remote ack exists.
 */
export const resolveRoundStateUpsertOutcome = (input: {
  missingTable: boolean;
  requestedRoundId?: string;
  acceptedRoundId?: string | null;
}): "ack" | "soft_fail" | "generation_conflict" => {
  if (input.missingTable) return "soft_fail";
  if (
    input.requestedRoundId
    && input.acceptedRoundId
    && input.requestedRoundId !== input.acceptedRoundId
  ) {
    return "generation_conflict";
  }
  return "ack";
};

/**
 * Draft push `missing` (patient row absent) must not silent-ack — keep soft_fail
 * like round_state missingTable so the outbox stays pending.
 */
export const resolveDraftFieldPushOutcome = (input: {
  status: "ok" | "missing" | "conflict";
}): "ack" | "soft_fail" | "conflict" => {
  if (input.status === "ok") return "ack";
  if (input.status === "missing") return "soft_fail";
  return "conflict";
};

export const createOutboxId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `outbox_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Merge an incoming mutation into an existing same-entity queue row.
 * Returns null only when the pair cancels (not used for Round kinds today).
 */
export const coalesceRoundOutboxEntry = (
  existing: RoundOutboxEntry,
  incoming: RoundOutboxEntry,
): RoundOutboxEntry | null => {
  if (existing.kind !== incoming.kind || existing.entityKey !== incoming.entityKey) {
    return incoming;
  }

  // Never coalesce over an unresolved conflict — keep conflict row intact.
  if (existing.status === "conflict") {
    return existing;
  }

  if (incoming.kind === "draft_field") {
    return {
      ...existing,
      payload: { ...existing.payload, ...incoming.payload },
      // Preserve earliest base so conflict detection still sees the original tip.
      baseUpdatedAt: existing.baseUpdatedAt ?? incoming.baseUpdatedAt,
      updatedAt: incoming.updatedAt,
      deviceId: incoming.deviceId,
      timestamp: incoming.timestamp,
      retryCount: 0,
      status: "pending",
      nextRetryAt: undefined,
      softFailReason: undefined,
      conflictData: incoming.conflictData ?? existing.conflictData,
    };
  }

  // round_state: latest continuity snapshot wins; merge payload shallowly.
  return {
    ...existing,
    payload: { ...existing.payload, ...incoming.payload },
    baseUpdatedAt: incoming.baseUpdatedAt ?? existing.baseUpdatedAt,
    updatedAt: incoming.updatedAt,
    deviceId: incoming.deviceId,
    timestamp: incoming.timestamp,
    retryCount: 0,
    status: "pending",
    nextRetryAt: undefined,
    softFailReason: undefined,
  };
};

export const mergeOutboxQueue = (
  queue: readonly RoundOutboxEntry[],
  incoming: RoundOutboxEntry,
): RoundOutboxEntry[] => {
  const index = queue.findIndex(
    (entry) =>
      entry.ownerId === incoming.ownerId
      && entry.kind === incoming.kind
      && entry.entityKey === incoming.entityKey
      && entry.status !== "completed",
  );

  if (index < 0) {
    return [...queue, incoming];
  }

  const coalesced = coalesceRoundOutboxEntry(queue[index]!, incoming);
  if (!coalesced) {
    return queue.filter((_, i) => i !== index);
  }
  const next = [...queue];
  next[index] = coalesced;
  return next;
};

export const selectPendingOutbox = (
  queue: readonly RoundOutboxEntry[],
  ownerId: string | null,
  limit = 20,
  now = Date.now(),
): RoundOutboxEntry[] => {
  if (!ownerId) return [];
  return queue
    .filter(
      (entry) =>
        entry.ownerId === ownerId
        && isOutboxEntryReady(entry, now),
    )
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(0, limit);
};

export const countPendingOutbox = (
  queue: readonly RoundOutboxEntry[],
  ownerId: string | null,
): number => {
  if (!ownerId) return 0;
  return queue.filter(
    (entry) =>
      entry.ownerId === ownerId
      && (
        entry.status === "pending"
        || entry.status === "syncing"
        || entry.status === "soft_fail"
        || !entry.status
      ),
  ).length;
};

export const countFailedOutbox = (
  queue: readonly RoundOutboxEntry[],
  ownerId: string | null,
): number => {
  if (!ownerId) return 0;
  return queue.filter(
    (entry) =>
      entry.ownerId === ownerId
      && entry.status === "failed",
  ).length;
};

export const countSoftFailedOutbox = (
  queue: readonly RoundOutboxEntry[],
  ownerId: string | null,
): number => {
  if (!ownerId) return 0;
  return queue.filter(
    (entry) => entry.ownerId === ownerId && entry.status === "soft_fail",
  ).length;
};

export const countUnresolvedOutbox = (
  queue: readonly RoundOutboxEntry[],
  ownerId: string | null,
): number => {
  if (!ownerId) return 0;
  return queue.filter(
    (entry) =>
      entry.ownerId === ownerId
      && (entry.status === "pending"
        || entry.status === "syncing"
        || entry.status === "soft_fail"
        || entry.status === "conflict"
        || entry.status === "failed"),
  ).length;
};

export const countConflictOutbox = (
  queue: readonly RoundOutboxEntry[],
  ownerId: string | null,
): number => {
  if (!ownerId) return 0;
  return queue.filter(
    (entry) => entry.ownerId === ownerId && entry.status === "conflict",
  ).length;
};

export const withOutboxDefaults = (
  partial: Omit<RoundOutboxEntry, "id" | "timestamp" | "retryCount" | "maxRetries" | "status"> & {
    id?: string;
    timestamp?: number;
    retryCount?: number;
    maxRetries?: number;
    status?: RoundOutboxEntry["status"];
    nextRetryAt?: number;
    softFailReason?: string;
  },
): RoundOutboxEntry => ({
  id: partial.id ?? createOutboxId(),
  ownerId: partial.ownerId,
  kind: partial.kind,
  entityKey: partial.entityKey,
  payload: partial.payload,
  baseUpdatedAt: partial.baseUpdatedAt,
  updatedAt: partial.updatedAt,
  deviceId: partial.deviceId,
  retryCount: partial.retryCount ?? 0,
  maxRetries: partial.maxRetries ?? MAX_RETRIES,
  status: partial.status ?? "pending",
  timestamp: partial.timestamp ?? Date.now(),
  nextRetryAt: partial.nextRetryAt,
  softFailReason: partial.softFailReason,
  conflictData: partial.conflictData,
});

export const isRoundOutboxKind = (value: unknown): value is RoundOutboxKind =>
  value === "round_state" || value === "draft_field";
