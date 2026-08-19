import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeRoundSync } from "./syncPresentation";

const lastRemoteSyncAt = "2026-08-12T14:30:00.000Z";

describe("round sync presentation", () => {
  it("distinguishes remote save from local pending save", () => {
    assert.equal(describeRoundSync("idle", 0, 0, 0, lastRemoteSyncAt).label, "Saved remotely");
    assert.equal(
      describeRoundSync("offline", 2, 0, 0, lastRemoteSyncAt).label,
      "Saved locally · 2 pending",
    );
  });

  it("distinguishes active sync and failed sync", () => {
    assert.equal(describeRoundSync("syncing", 1, 0, 0, lastRemoteSyncAt).label, "Syncing · 1 pending");
    assert.equal(describeRoundSync("failed", 1, 1, 0, lastRemoteSyncAt).label, "Sync failed · 1 failed");
  });

  it("makes a soft-failed write visibly actionable", () => {
    const state = describeRoundSync("failed", 1, 0, 1, lastRemoteSyncAt);
    assert.equal(state.label, "Sync blocked · 1 stalled");
    assert.match(state.description, /awaiting remote acknowledgement/);
  });

  it("always exposes the last successful remote sync when known", () => {
    const state = describeRoundSync("failed", 1, 1, 0, lastRemoteSyncAt);
    assert.equal(state.lastSuccessfulSyncAt, lastRemoteSyncAt);
    assert.match(state.description, /Last remote sync/);
  });
});
