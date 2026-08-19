/**
 * Local Round session cache (IndexedDB) for reload + device continuity.
 */

import { db } from "@/lib/offline/database";
import type { Round, RoundSyncStatus } from "@/types/round";
import type {
  CachedRoundSession,
  FieldConflict,
  RoundContinuityMeta,
  VersionedField,
} from "./types";

const DEVICE_META_ID = "__round_device_id__";

const createDeviceId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

/** Stable per-browser device id for continuity merge + outbox authorship. */
export async function getOrCreateRoundDeviceId(): Promise<string> {
  await db.open();
  const existing = await db.syncMetadata.get(DEVICE_META_ID);
  if (existing?.checksum) return existing.checksum;
  const deviceId = createDeviceId();
  await db.syncMetadata.put({
    id: DEVICE_META_ID,
    tableName: DEVICE_META_ID,
    lastSyncAt: Date.now(),
    lastSuccessfulSyncAt: Date.now(),
    pendingChanges: 0,
    conflictCount: 0,
    checksum: deviceId,
  });
  return deviceId;
}

export const createContinuityMeta = (
  deviceId: string,
  now = new Date().toISOString(),
): RoundContinuityMeta => ({
  positionUpdatedAt: now,
  expandedUpdatedAt: now,
  filtersUpdatedAt: now,
  sectionUpdatedAt: now,
  deviceId,
});

/**
 * Fill dedicated filter/section timestamps for older cached/remote envelopes.
 */
export const normalizeContinuityMeta = (
  meta: Partial<RoundContinuityMeta> & Pick<RoundContinuityMeta, "deviceId">,
  fallbackIso: string,
): RoundContinuityMeta => ({
  positionUpdatedAt: meta.positionUpdatedAt ?? fallbackIso,
  expandedUpdatedAt: meta.expandedUpdatedAt ?? fallbackIso,
  filtersUpdatedAt: meta.filtersUpdatedAt ?? fallbackIso,
  sectionUpdatedAt: meta.sectionUpdatedAt ?? fallbackIso,
  deviceId: meta.deviceId,
});

export async function loadCachedRoundSession(
  userId: string,
): Promise<CachedRoundSession | null> {
  await db.open();
  const rows = await db.roundSessions.where("userId").equals(userId).toArray();
  if (rows.length === 0) return null;
  const active = rows
    .filter((row) => row.round.status === "active")
    .sort((left, right) => right.lastModified - left.lastModified);
  return active[0] ?? rows.sort((a, b) => b.lastModified - a.lastModified)[0] ?? null;
}

export async function saveCachedRoundSession(input: {
  round: Round;
  continuity: RoundContinuityMeta;
  draftFields?: Record<string, VersionedField>;
  conflicts?: FieldConflict[];
  syncStatus?: RoundSyncStatus;
}): Promise<CachedRoundSession> {
  await db.open();
  const now = Date.now();
  const existing = await db.roundSessions.get(input.round.id);
  const record: CachedRoundSession = {
    id: input.round.id,
    userId: input.round.userId,
    round: input.round,
    continuity: input.continuity,
    draftFields: input.draftFields ?? existing?.draftFields ?? {},
    conflicts: input.conflicts ?? existing?.conflicts ?? [],
    cachedAt: existing?.cachedAt ?? now,
    lastModified: now,
    syncStatus: input.syncStatus ?? input.round.syncStatus,
  };
  await db.roundSessions.put(record);
  return record;
}

export async function patchCachedDraftField(
  roundId: string,
  field: VersionedField,
): Promise<void> {
  await db.open();
  const existing = await db.roundSessions.get(roundId);
  if (!existing) return;
  const key = `${field.patientId}::${field.fieldKey}`;
  await db.roundSessions.put({
    ...existing,
    draftFields: { ...existing.draftFields, [key]: field },
    lastModified: Date.now(),
    syncStatus: "syncing",
  });
}

export async function setCachedConflicts(
  roundId: string,
  conflicts: FieldConflict[],
): Promise<void> {
  await db.open();
  const existing = await db.roundSessions.get(roundId);
  if (!existing) return;
  await db.roundSessions.put({
    ...existing,
    conflicts,
    lastModified: Date.now(),
    syncStatus: conflicts.length > 0 ? "conflict" : existing.syncStatus,
  });
}

export async function clearCachedRoundSession(roundId: string): Promise<void> {
  await db.open();
  await db.roundSessions.delete(roundId);
}
