import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRound } from "../roundSessionStore";
import { createContinuityMeta } from "./roundSessionCache";
import { roundOutbox } from "./roundOutbox";
import { roundSyncEngine } from "./roundSyncEngine";

describe("roundSyncEngine deriveChromeStatus", () => {
  it("returns offline when disconnected", () => {
    assert.equal(
      roundSyncEngine.deriveChromeStatus({
        isOnline: false,
        pendingCount: 0,
        conflictCount: 0,
        failedCount: 0,
        softFailedCount: 0,
      }),
      "offline",
    );
  });

  it("returns conflict when conflict rows are present", () => {
    assert.equal(
      roundSyncEngine.deriveChromeStatus({
        isOnline: true,
        pendingCount: 0,
        conflictCount: 2,
        failedCount: 0,
        softFailedCount: 0,
      }),
      "conflict",
    );
  });

  it("returns failed over syncing and pending", () => {
    assert.equal(
      roundSyncEngine.deriveChromeStatus({
        isOnline: true,
        pendingCount: 3,
        conflictCount: 0,
        failedCount: 2,
        softFailedCount: 0,
      }),
      "failed",
    );
  });

  it("returns syncing for active queue when no failures", () => {
    assert.equal(
      roundSyncEngine.deriveChromeStatus({
        isOnline: true,
        pendingCount: 3,
        conflictCount: 0,
        failedCount: 0,
        softFailedCount: 0,
      }),
      "syncing",
    );
  });

  it("returns failed when a soft-failed write needs attention", () => {
    assert.equal(
      roundSyncEngine.deriveChromeStatus({
        isOnline: true,
        pendingCount: 1,
        conflictCount: 0,
        failedCount: 0,
        softFailedCount: 1,
      }),
      "failed",
    );
  });
});

describe("roundSyncEngine generation reconciliation", () => {
  it("retains the conflict blocker when authoritative cache persistence fails", async () => {
    roundOutbox.setOwner("user-a");
    const local = createRound({
      userId: "user-a",
      patientIds: ["patient-a"],
      id: "local-round",
      now: "2026-08-13T14:00:00.000Z",
    });
    const outboxId = await roundOutbox.enqueueRoundState({
      roundId: local.id,
      payload: { round: local },
      updatedAt: local.updatedAt,
      deviceId: "local-device",
      ownerId: "user-a",
    });
    await roundOutbox.markSoftFail(outboxId, "round_generation_conflict", 0);

    const remote = {
      ...local,
      id: "remote-round",
      status: "completed" as const,
    };
    const continuity = createContinuityMeta("remote-device", remote.updatedAt);

    await assert.rejects(
      roundSyncEngine.reconcileRoundGeneration("user-a", {
        fetchRemote: async () => ({ round: remote, continuity }),
        saveRemoteCache: async () => {
          throw new Error("simulated IndexedDB quota failure");
        },
      }),
      /quota failure/,
    );

    const queue = await roundOutbox.getQueue();
    assert.equal(queue.some((entry) => entry.id === outboxId), true);
    await roundOutbox.clear();
    roundOutbox.setOwner(null);
  });
});
