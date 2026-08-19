/**
 * Round outbox manager — queues Round state + chart draft field writes.
 * Extends the same IndexedDB database as the legacy mutation queue without
 * claiming that patient CRUD is offline-queued.
 */

import { db } from "@/lib/offline/database";
import { logInfo } from "@/lib/observability/logger";
import {
  coalesceRoundOutboxEntry,
  computeOutboxNextRetryAt,
  countConflictOutbox,
  countFailedOutbox,
  countPendingOutbox,
  countSoftFailedOutbox,
  createOutboxId,
  mergeOutboxQueue,
  OUTBOX_SOFT_FAIL_RETRY_MS,
  selectPendingOutbox,
  countUnresolvedOutbox,
  withOutboxDefaults,
} from "./outboxMerge";
import type { RoundOutboxEntry, RoundOutboxKind, VersionedField } from "./types";
import { draftEntityKey } from "./conflictRules";

type OutboxListener = (queue: RoundOutboxEntry[]) => void;

class RoundOutboxManager {
  private listeners = new Set<OutboxListener>();
  private ownerId: string | null = null;
  private memoryQueue: RoundOutboxEntry[] = [];
  private initialized = false;
  private initialization: Promise<void>;

  constructor() {
    this.initialization = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await db.open();
      if (this.memoryQueue.length > 0) {
        await db.roundOutbox.bulkPut(this.memoryQueue);
        this.memoryQueue = [];
      }
      this.initialized = true;
      logInfo("[RoundOutbox] Initialized");
    } catch (error) {
      console.error("[RoundOutbox] Falling back to memory:", error);
      this.initialized = false;
    }
  }

  private notify(): void {
    void this.getQueue().then((queue) => {
      this.listeners.forEach((listener) => listener(queue));
    });
  }

  setOwner(ownerId: string | null): void {
    this.ownerId = ownerId;
    this.notify();
  }

  getOwner(): string | null {
    return this.ownerId;
  }

  subscribe(listener: OutboxListener): () => void {
    this.listeners.add(listener);
    void this.getQueue().then(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async enqueue(
    input: Omit<
      RoundOutboxEntry,
      "id" | "timestamp" | "retryCount" | "maxRetries" | "status" | "ownerId"
    > & { ownerId?: string },
  ): Promise<string> {
    await this.initialization;
    const ownerId = input.ownerId ?? this.ownerId;
    if (!ownerId) {
      throw new Error("Cannot queue Round outbox entry without an authenticated owner");
    }
    if (ownerId !== this.ownerId) {
      throw new Error("Cannot queue Round outbox entry after the authenticated owner changed");
    }

    const entry = withOutboxDefaults({
      ...input,
      ownerId,
      id: createOutboxId(),
    });

    if (this.initialized) {
      const existing = await db.roundOutbox
        .where("[kind+entityKey]")
        .equals([entry.kind, entry.entityKey])
        .filter((row) => row.ownerId === ownerId && row.status !== "completed")
        .first();

      if (!existing) {
        await db.roundOutbox.add(entry);
        this.notify();
        return entry.id;
      }

      const coalesced = coalesceRoundOutboxEntry(existing, entry);
      if (coalesced) {
        await db.roundOutbox.put(coalesced);
        this.notify();
        return coalesced.id;
      }
      await db.roundOutbox.delete(existing.id);
      this.notify();
      return existing.id;
    }

    this.memoryQueue = mergeOutboxQueue(this.memoryQueue, entry);
    this.notify();
    const coalesced = this.memoryQueue.find(
      (row) => row.kind === entry.kind && row.entityKey === entry.entityKey,
    );
    return coalesced?.id ?? entry.id;
  }

  async enqueueRoundState(input: {
    roundId: string;
    payload: Record<string, unknown>;
    updatedAt: string;
    deviceId: string;
    ownerId?: string;
  }): Promise<string> {
    return this.enqueue({
      kind: "round_state",
      entityKey: input.roundId,
      payload: input.payload,
      baseUpdatedAt: null,
      updatedAt: input.updatedAt,
      deviceId: input.deviceId,
      ownerId: input.ownerId,
    });
  }

  async enqueueDraftField(input: {
    field: VersionedField;
    ownerId?: string;
  }): Promise<string> {
    const { field } = input;
    return this.enqueue({
      kind: "draft_field",
      entityKey: draftEntityKey(field.patientId, field.fieldKey),
      payload: {
        patientId: field.patientId,
        fieldKey: field.fieldKey,
        value: field.value,
        updatedAt: field.updatedAt,
        baseUpdatedAt: field.baseUpdatedAt,
        deviceId: field.deviceId,
      },
      baseUpdatedAt: field.baseUpdatedAt,
      updatedAt: field.updatedAt,
      deviceId: field.deviceId,
      ownerId: input.ownerId,
    });
  }

  async getQueue(): Promise<RoundOutboxEntry[]> {
    if (!this.ownerId) return [];
    await this.initialization;
    if (this.initialized) {
      return (await db.roundOutbox.toArray())
        .filter((entry) => entry.ownerId === this.ownerId)
        .sort((left, right) => left.timestamp - right.timestamp);
    }
    return this.memoryQueue
      .filter((entry) => entry.ownerId === this.ownerId)
      .sort((left, right) => left.timestamp - right.timestamp);
  }

  async getPendingBatch(limit = 20): Promise<RoundOutboxEntry[]> {
    return selectPendingOutbox(await this.getQueue(), this.ownerId, limit);
  }

  async getPendingCount(): Promise<number> {
    return countPendingOutbox(await this.getQueue(), this.ownerId);
  }

  async getConflictCount(): Promise<number> {
    return countConflictOutbox(await this.getQueue(), this.ownerId);
  }

  async getFailedCount(): Promise<number> {
    return countFailedOutbox(await this.getQueue(), this.ownerId);
  }

  async getSoftFailedCount(): Promise<number> {
    return countSoftFailedOutbox(await this.getQueue(), this.ownerId);
  }

  async getUnresolvedCount(): Promise<number> {
    return countUnresolvedOutbox(await this.getQueue(), this.ownerId);
  }

  async updateStatus(
    id: string,
    status: RoundOutboxEntry["status"],
    conflictData?: RoundOutboxEntry["conflictData"],
    patch?: Partial<Pick<RoundOutboxEntry, "nextRetryAt" | "softFailReason" | "retryCount">>,
  ): Promise<void> {
    await this.initialization;
    if (this.initialized) {
      const existing = await db.roundOutbox.get(id);
      if (!existing || existing.ownerId !== this.ownerId) return;
      await db.roundOutbox.put({
        ...existing,
        status,
        conflictData: conflictData ?? existing.conflictData,
        ...patch,
      });
    } else {
      this.memoryQueue = this.memoryQueue.map((entry) =>
        entry.id === id && entry.ownerId === this.ownerId
          ? {
              ...entry,
              status,
              conflictData: conflictData ?? entry.conflictData,
              ...patch,
            }
          : entry,
      );
    }
    this.notify();
  }

  async remove(id: string): Promise<void> {
    await this.initialization;
    if (this.initialized) {
      const existing = await db.roundOutbox.get(id);
      if (existing?.ownerId === this.ownerId) {
        await db.roundOutbox.delete(id);
      }
    } else {
      this.memoryQueue = this.memoryQueue.filter(
        (entry) => !(entry.id === id && entry.ownerId === this.ownerId),
      );
    }
    this.notify();
  }

  async markFailed(id: string, now = Date.now()): Promise<boolean> {
    await this.initialization;
    const queue = await this.getQueue();
    const entry = queue.find((row) => row.id === id);
    if (!entry) return false;
    const retryCount = entry.retryCount + 1;
    if (retryCount >= entry.maxRetries) {
      await this.updateStatus(id, "failed", undefined, {
        retryCount,
        nextRetryAt: undefined,
        softFailReason: undefined,
      });
      return false;
    }
    const nextRetryAt = computeOutboxNextRetryAt(retryCount - 1, now);
    await this.updateStatus(id, "pending", undefined, {
      retryCount,
      nextRetryAt,
      softFailReason: undefined,
    });
    return true;
  }

  /**
   * Keep the row queued without treating it as acked (e.g. missing round_state).
   * Soft-fail still counts toward pending visibility.
   */
  async markSoftFail(
    id: string,
    reason: string,
    now = Date.now(),
  ): Promise<void> {
    await this.updateStatus(id, "soft_fail", undefined, {
      softFailReason: reason,
      nextRetryAt: now + OUTBOX_SOFT_FAIL_RETRY_MS,
    });
  }

  async retryFailedWrites(now = Date.now()): Promise<number> {
    await this.initialization;
    const queue = await this.getQueue();
    const failed = queue.filter(
      (entry) => entry.status === "failed" || entry.status === "soft_fail",
    );
    if (failed.length === 0) return 0;
    for (const entry of failed) {
      const nextRetryCount = Math.min(Math.max(entry.retryCount - 1, 0), entry.maxRetries);
      await this.updateStatus(entry.id, "pending", undefined, {
        retryCount: nextRetryCount,
        nextRetryAt: now,
        softFailReason: undefined,
      });
    }
    this.notify();
    return failed.length;
  }

  async clear(): Promise<void> {
    await this.initialization;
    if (!this.ownerId) {
      this.memoryQueue = [];
      this.notify();
      return;
    }
    if (this.initialized) {
      const ids = await db.roundOutbox
        .filter((entry) => entry.ownerId === this.ownerId)
        .primaryKeys();
      await db.roundOutbox.bulkDelete(ids);
    } else {
      this.memoryQueue = this.memoryQueue.filter((entry) => entry.ownerId !== this.ownerId);
    }
    this.notify();
  }
}

export const roundOutbox = new RoundOutboxManager();

export type { RoundOutboxKind };
