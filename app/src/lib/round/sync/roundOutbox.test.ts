import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { roundOutbox } from "@/lib/round/sync/roundOutbox";

afterEach(async () => {
  roundOutbox.setOwner(null);
  await roundOutbox.clear();
});

describe("roundOutbox owner boundary", () => {
  it("rejects an explicit stale owner after the active owner changes", async () => {
    roundOutbox.setOwner("user-b");

    await assert.rejects(
      () => roundOutbox.enqueueRoundState({
        roundId: "round-user-a",
        payload: {},
        updatedAt: "2026-08-13T00:00:00.000Z",
        deviceId: "device-a",
        ownerId: "user-a",
      }),
      /authenticated owner changed/,
    );
    assert.deepEqual(await roundOutbox.getQueue(), []);
  });

  it("makes a soft-failed write available to manual retry", async () => {
    roundOutbox.setOwner("user-a");
    const id = await roundOutbox.enqueueRoundState({
      roundId: "round-user-a",
      payload: {},
      updatedAt: "2026-08-13T00:00:00.000Z",
      deviceId: "device-a",
    });
    await roundOutbox.markSoftFail(id, "missing_table");

    assert.equal(await roundOutbox.getSoftFailedCount(), 1);
    assert.equal(await roundOutbox.retryFailedWrites(), 1);
    assert.equal((await roundOutbox.getQueue())[0]?.status, "pending");
    assert.equal(await roundOutbox.getSoftFailedCount(), 0);
  });
});
