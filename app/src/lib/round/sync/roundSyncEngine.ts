/**
 * Round sync engine — drains Round outbox on reconnect, merges remote continuity,
 * surfaces field conflicts for Mine/Theirs/merge UI.
 */

import { logInfo } from "@/lib/observability/logger";
import { recordTelemetryEvent } from "@/lib/observability/telemetry";
import { isBrowserKnownOffline } from "@/lib/networkConnectivity";
import type { Round, RoundSyncStatus } from "@/types/round";
import {
  applyFieldConflictChoice,
  detectDraftFieldConflict,
  resolveHydratedRoundContinuity,
} from "./conflictRules";
import {
  resolveDraftFieldPushOutcome,
  resolveRoundStateUpsertOutcome,
  shouldDrainOutboxAfterHydrate,
} from "./outboxMerge";
import {
  createContinuityMeta,
  getOrCreateRoundDeviceId,
  loadCachedRoundSession,
  normalizeContinuityMeta,
  saveCachedRoundSession,
  setCachedConflicts,
} from "./roundSessionCache";
import { roundOutbox } from "./roundOutbox";
import {
  fetchRemoteRoundState,
  pushDraftFieldToPatient,
  upsertRemoteRoundState,
} from "./roundRemote";
import type {
  FieldConflict,
  FieldConflictChoice,
  RoundContinuityMeta,
  VersionedField,
} from "./types";

type StatusListener = (status: RoundSyncStatus) => void;
type ConflictListener = (conflicts: FieldConflict[]) => void;
type SyncSuccessListener = (syncedAt: string) => void;

/** Light interval so pending clears after reload without needing a new edit. */
const DRAIN_INTERVAL_MS = 30_000;

export interface RoundSyncDrainResult {
  success: number;
  failed: number;
  softFailed: number;
  conflicts: FieldConflict[];
  missingTable: boolean;
}

class RoundSyncEngine {
  private status: RoundSyncStatus = "idle";
  private statusListeners = new Set<StatusListener>();
  private conflictListeners = new Set<ConflictListener>();
  private syncSuccessListeners = new Set<SyncSuccessListener>();
  private activeDrain: Promise<RoundSyncDrainResult> | null = null;
  private deviceId: string | null = null;
  private openConflicts: FieldConflict[] = [];
  private networkBound = false;
  private drainIntervalId: ReturnType<typeof setInterval> | null = null;

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  onConflicts(listener: ConflictListener): () => void {
    this.conflictListeners.add(listener);
    listener(this.openConflicts);
    return () => {
      this.conflictListeners.delete(listener);
    };
  }

  onSyncSuccess(listener: SyncSuccessListener): () => void {
    this.syncSuccessListeners.add(listener);
    return () => {
      this.syncSuccessListeners.delete(listener);
    };
  }

  private markSyncSuccess(syncedAt = new Date().toISOString()): void {
    this.syncSuccessListeners.forEach((listener) => listener(syncedAt));
  }

  getStatus(): RoundSyncStatus {
    return this.status;
  }

  getConflicts(): FieldConflict[] {
    return [...this.openConflicts];
  }

  private setStatus(status: RoundSyncStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private setConflicts(conflicts: FieldConflict[]): void {
    this.openConflicts = conflicts;
    this.conflictListeners.forEach((listener) => listener(conflicts));
    if (conflicts.length > 0) {
      this.setStatus("conflict");
    }
  }

  bindOwner(ownerId: string | null): void {
    roundOutbox.setOwner(ownerId);
  }

  ensureNetworkListeners(): void {
    if (this.networkBound || typeof window === "undefined") return;
    this.networkBound = true;
    window.addEventListener("online", () => {
      logInfo("[RoundSync] Online — draining outbox");
      void this.drain();
    });
    window.addEventListener("offline", () => {
      this.setStatus("offline");
    });
    if (isBrowserKnownOffline()) {
      this.setStatus("offline");
    }
    if (!this.drainIntervalId) {
      this.drainIntervalId = setInterval(() => {
        void this.drainIfPending();
      }, DRAIN_INTERVAL_MS);
    }
  }

  /** Interval / post-hydrate helper: drain only when online with work queued. */
  async drainIfPending(): Promise<void> {
    if (isBrowserKnownOffline()) return;
    const pending = await roundOutbox.getPendingCount();
    if (pending <= 0) return;
    await this.drain();
  }

  async getDeviceId(): Promise<string> {
    if (this.deviceId) return this.deviceId;
    this.deviceId = await getOrCreateRoundDeviceId();
    return this.deviceId;
  }

  /**
   * Explicitly adopt the authoritative Round after the server rejects a
   * competing local generation. Clinical chart drafts are stored separately;
   * this only replaces Round walk continuity after clinician confirmation.
   */
  async reconcileRoundGeneration(
    ownerId: string,
    dependencies: {
      fetchRemote?: typeof fetchRemoteRoundState;
      saveRemoteCache?: typeof saveCachedRoundSession;
    } = {},
  ): Promise<{ round: Round; continuity: RoundContinuityMeta } | null> {
    if (roundOutbox.getOwner() !== ownerId || isBrowserKnownOffline()) return null;
    const fetchRemote = dependencies.fetchRemote ?? fetchRemoteRoundState;
    const saveRemoteCache = dependencies.saveRemoteCache ?? saveCachedRoundSession;
    const remote = await fetchRemote(ownerId);
    if (!remote) return null;

    // Durable adoption must succeed before removing the blocker. If IndexedDB
    // is unavailable/full, completion stays fail-closed and the user can retry.
    await saveRemoteCache({
      round: remote.round,
      continuity: remote.continuity,
      syncStatus: "idle",
    });

    const queue = await roundOutbox.getQueue();
    const rejectedGenerationIds = queue
      .filter((entry) => (
        entry.ownerId === ownerId
        && entry.kind === "round_state"
        && entry.softFailReason === "round_generation_conflict"
      ))
      .map((entry) => entry.id);
    for (const id of rejectedGenerationIds) {
      await roundOutbox.remove(id);
    }
    this.setStatus("idle");
    this.markSyncSuccess(remote.round.updatedAt);
    return remote;
  }

  /**
   * Persist Round locally and enqueue a round_state outbox patch.
   */
  async persistRoundSession(input: {
    round: Round;
    continuity: RoundContinuityMeta;
    patientIds?: readonly string[];
  }): Promise<void> {
    const ownerId = input.round.userId;
    if (roundOutbox.getOwner() !== ownerId) return;

    const syncStatus: RoundSyncStatus = isBrowserKnownOffline()
      ? "offline"
      : this.openConflicts.length > 0
        ? "conflict"
        : "syncing";

    await saveCachedRoundSession({
      round: { ...input.round, syncStatus },
      continuity: input.continuity,
      syncStatus,
    });

    // The cache write can yield to an auth transition. Never enqueue its stale
    // snapshot after the active owner has changed.
    if (roundOutbox.getOwner() !== ownerId) return;

    await roundOutbox.enqueueRoundState({
      roundId: input.round.id,
      payload: {
        round: input.round,
        continuity: input.continuity,
        patientIds: input.patientIds ? [...input.patientIds] : undefined,
      },
      updatedAt: input.round.updatedAt,
      deviceId: input.continuity.deviceId,
      ownerId,
    });

    this.setStatus(syncStatus);
    if (!isBrowserKnownOffline()) {
      void this.drain();
    }
  }

  async enqueueDraft(field: VersionedField, ownerId: string, roundId?: string): Promise<void> {
    await roundOutbox.enqueueDraftField({ field, ownerId });
    if (roundId) {
      const cached = await loadCachedRoundSession(ownerId);
      if (cached && cached.id === roundId) {
        await saveCachedRoundSession({
          round: cached.round,
          continuity: cached.continuity,
          draftFields: {
            ...cached.draftFields,
            [`${field.patientId}::${field.fieldKey}`]: field,
          },
          conflicts: cached.conflicts,
          syncStatus: isBrowserKnownOffline() ? "offline" : "syncing",
        });
      }
    }
    this.setStatus(isBrowserKnownOffline() ? "offline" : "syncing");
    if (!isBrowserKnownOffline()) {
      void this.drain();
    }
  }

  /**
   * Hydrate local Round from IndexedDB, optionally merge remote continuity.
   * When already online, drain pending outbox so reload does not wait for a new edit.
   */
  async hydrateRoundSession(input: {
    userId: string;
    patientIds: readonly string[];
    fallbackRound: Round;
  }): Promise<{
    round: Round;
    continuity: RoundContinuityMeta;
  }> {
    this.bindOwner(input.userId);
    this.ensureNetworkListeners();
    const deviceId = await this.getDeviceId();
    const cached = await loadCachedRoundSession(input.userId);

    let localRound = input.fallbackRound;
    let localMeta = createContinuityMeta(deviceId, input.fallbackRound.updatedAt);

    if (cached && cached.round.userId === input.userId) {
      localRound = cached.round;
      localMeta = normalizeContinuityMeta(cached.continuity, cached.round.updatedAt);
      if (cached.conflicts.length > 0) {
        this.setConflicts(cached.conflicts);
      }
    }

    if (isBrowserKnownOffline()) {
      this.setStatus("offline");
      return { round: localRound, continuity: localMeta };
    }

    let resultRound = localRound;
    let resultMeta = localMeta;

    try {
      const remote = await fetchRemoteRoundState(input.userId);
      if (!remote) {
        this.setStatus(this.openConflicts.length > 0 ? "conflict" : "idle");
      } else {
        const merged = resolveHydratedRoundContinuity({
          localRound,
          localMeta,
          remoteRound: remote.round,
          remoteMeta: remote.continuity,
          patientIds: input.patientIds,
          localIsFallback: !cached,
        });

        await saveCachedRoundSession({
          round: merged.round,
          continuity: merged.continuity,
          draftFields: cached?.draftFields,
          conflicts: cached?.conflicts ?? this.openConflicts,
          syncStatus: this.openConflicts.length > 0 ? "conflict" : "idle",
        });

        this.setStatus(this.openConflicts.length > 0 ? "conflict" : "idle");
        this.markSyncSuccess(remote.round.updatedAt);
        resultRound = merged.round;
        resultMeta = merged.continuity;
      }
    } catch (error) {
      recordTelemetryEvent("sync_error", error, { operation: "round_hydrate" });
      this.setStatus(isBrowserKnownOffline() ? "offline" : "idle");
    }

    if (shouldDrainOutboxAfterHydrate(!isBrowserKnownOffline())) {
      void this.drain();
    }

    return { round: resultRound, continuity: resultMeta };
  }

  drain(): Promise<RoundSyncDrainResult> {
    if (this.activeDrain) return this.activeDrain;
    const operation = this.runDrain();
    this.activeDrain = operation;
    void operation.finally(() => {
      if (this.activeDrain === operation) {
        this.activeDrain = null;
      }
    });
    return operation;
  }

  private async runDrain(): Promise<RoundSyncDrainResult> {
    const result: RoundSyncDrainResult = {
      success: 0,
      failed: 0,
      softFailed: 0,
      conflicts: [],
      missingTable: false,
    };

    if (isBrowserKnownOffline()) {
      this.setStatus("offline");
      return result;
    }

    this.setStatus(this.openConflicts.length > 0 ? "conflict" : "syncing");
    const batch = await roundOutbox.getPendingBatch(20);

    for (const entry of batch) {
      try {
        await roundOutbox.updateStatus(entry.id, "syncing");

        if (entry.kind === "round_state") {
          const round = entry.payload.round as Round | undefined;
          const continuity = entry.payload.continuity as RoundContinuityMeta | undefined;
          if (!round || !continuity) {
            await roundOutbox.remove(entry.id);
            result.success += 1;
            continue;
          }
          const upsert = await upsertRemoteRoundState({ round, continuity });
          const outcome = resolveRoundStateUpsertOutcome({
            ...upsert,
            requestedRoundId: round.id,
          });
          if (outcome === "soft_fail") {
            result.missingTable = true;
            result.softFailed += 1;
            // Keep row pending/soft_fail — never falsely ack local continuity.
            await roundOutbox.markSoftFail(entry.id, "missing_table");
            continue;
          }
          if (outcome === "generation_conflict") {
            result.softFailed += 1;
            await roundOutbox.markSoftFail(entry.id, "round_generation_conflict");
            continue;
          }
          await roundOutbox.remove(entry.id);
          result.success += 1;
          continue;
        }

        const field = entry.payload as unknown as VersionedField;
        const push = await pushDraftFieldToPatient({
          patientId: field.patientId,
          fieldKey: field.fieldKey,
          value: field.value,
          updatedAt: field.updatedAt,
          baseUpdatedAt: field.baseUpdatedAt,
        });

        const draftOutcome = resolveDraftFieldPushOutcome({ status: push.status });
        if (draftOutcome === "ack") {
          await roundOutbox.remove(entry.id);
          result.success += 1;
          continue;
        }
        if (draftOutcome === "soft_fail") {
          result.softFailed += 1;
          // Keep row pending/soft_fail — never falsely ack a missing patient row.
          await roundOutbox.markSoftFail(entry.id, "missing_patient");
          continue;
        }
        if (push.status !== "conflict") {
          continue;
        }

        const theirs: VersionedField = {
          patientId: field.patientId,
          fieldKey: field.fieldKey,
          value: push.serverValue,
          updatedAt: push.serverUpdatedAt,
          baseUpdatedAt: null,
          deviceId: "remote",
        };
        const conflict = detectDraftFieldConflict(field, theirs) ?? {
          id: `conflict_${entry.id}`,
          patientId: field.patientId,
          fieldKey: field.fieldKey,
          mine: field,
          theirs,
        };
        await roundOutbox.updateStatus(entry.id, "conflict", {
          mine: field,
          theirs,
        });
        result.conflicts.push(conflict);
        const nextConflicts = [
          ...this.openConflicts.filter(
            (item) =>
              !(item.patientId === conflict.patientId && item.fieldKey === conflict.fieldKey),
          ),
          conflict,
        ];
        this.setConflicts(nextConflicts);
        const cached = await loadCachedRoundSession(entry.ownerId);
        if (cached) {
          await setCachedConflicts(cached.id, nextConflicts);
        }
      } catch (error) {
        recordTelemetryEvent("sync_error", error, { operation: "round_outbox_entry" });
        const canRetry = await roundOutbox.markFailed(entry.id);
        if (!canRetry) result.failed += 1;
      }
    }

    const pending = await roundOutbox.getPendingCount();
    const conflicts = await roundOutbox.getConflictCount();
    const failed = await roundOutbox.getFailedCount();
    const softFailed = await roundOutbox.getSoftFailedCount();
    this.setStatus(
      this.deriveChromeStatus({
        isOnline: !isBrowserKnownOffline(),
        pendingCount: pending,
        conflictCount: conflicts,
        failedCount: failed,
        softFailedCount: softFailed,
      }),
    );
    if (result.success > 0 && failed === 0 && conflicts === 0 && pending === 0) {
      this.markSyncSuccess();
    }

    if (failed > result.failed) {
      result.failed = failed;
    }

    result.conflicts = [...this.openConflicts];
    return result;
  }

  async resolveConflict(
    conflict: FieldConflict,
    choice: FieldConflictChoice,
    mergedValue?: string,
    ownerId?: string,
  ): Promise<VersionedField> {
    const resolved = applyFieldConflictChoice(conflict, choice, mergedValue);
    const nextConflicts = this.openConflicts.filter((item) => item.id !== conflict.id);
    this.setConflicts(nextConflicts);

    const queue = await roundOutbox.getQueue();
    const entityKey = `${conflict.patientId}::${conflict.fieldKey}`;
    const stuck = queue.find(
      (entry) => entry.kind === "draft_field" && entry.entityKey === entityKey,
    );
    if (stuck) {
      await roundOutbox.remove(stuck.id);
    }

    if (ownerId) {
      await this.enqueueDraft(resolved, ownerId);
      const cached = await loadCachedRoundSession(ownerId);
      if (cached) {
        await setCachedConflicts(cached.id, nextConflicts);
      }
    }

    if (nextConflicts.length === 0 && !isBrowserKnownOffline()) {
      this.setStatus("syncing");
      void this.drain();
    }

    return resolved;
  }

  async retryFailedWrites(): Promise<RoundSyncDrainResult> {
    const emptyResult: RoundSyncDrainResult = {
      success: 0,
      failed: 0,
      softFailed: 0,
      conflicts: [],
      missingTable: false,
    };
    if (isBrowserKnownOffline()) {
      this.setStatus("offline");
      return emptyResult;
    }
    const retried = await roundOutbox.retryFailedWrites();
    if (retried > 0) {
      this.setStatus("syncing");
      return this.drain();
    }
    return emptyResult;
  }

  deriveChromeStatus(input: {
    isOnline: boolean;
    pendingCount: number;
    conflictCount: number;
    failedCount: number;
    softFailedCount: number;
  }): RoundSyncStatus {
    if (!input.isOnline) return "offline";
    if (input.conflictCount > 0 || this.openConflicts.length > 0) return "conflict";
    if (input.failedCount > 0 || input.softFailedCount > 0) return "failed";
    if (input.pendingCount > 0 || this.status === "syncing") return "syncing";
    return "idle";
  }
}

export const roundSyncEngine = new RoundSyncEngine();
