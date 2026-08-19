import assert from "node:assert/strict";
import test from "node:test";
import type { QueuedMutation } from "@/lib/offline/indexedDBQueue";
import {
  createPendingRecoveryPayload,
  pendingRecoveryFilename,
  pendingRecoverySignature,
} from "@/lib/exportPendingRecovery";

const mutation: QueuedMutation = {
  id: "mutation-1",
  ownerId: "owner-1",
  type: "patient",
  operation: "update",
  table: "patients",
  entityId: "patient-1",
  payload: { clinical_summary: "Locally queued note" },
  conflictData: { clinical_summary: "Server note" },
  timestamp: Date.parse("2026-08-13T10:00:00.000Z"),
  retryCount: 2,
  maxRetries: 3,
  status: "failed",
};

test("pending recovery payload preserves identifiers and queued clinical content", () => {
  const exportedAt = new Date("2026-08-13T12:34:56.000Z");
  const payload = createPendingRecoveryPayload([mutation], exportedAt);

  assert.equal(payload.format, "rolling-rounds-pending-recovery-v1");
  assert.equal(payload.exportedAt, exportedAt.toISOString());
  assert.match(payload.warning, /contains PHI/i);
  assert.match(payload.recoveryInstructions, /authorized support/i);
  assert.equal(payload.mutations.length, 1);
  assert.deepEqual(payload.mutations[0], mutation);
});

test("pending recovery filename is timestamped and filesystem-safe", () => {
  assert.equal(
    pendingRecoveryFilename(new Date("2026-08-13T12:34:56.789Z")),
    "rolling-rounds-pending-recovery-2026-08-13T12-34-56Z.json",
  );
});

test("pending recovery confirmation is invalidated by queued content changes", () => {
  const originalSignature = pendingRecoverySignature([mutation]);
  const changedSignature = pendingRecoverySignature([
    {
      ...mutation,
      payload: { clinical_summary: "Newer locally queued note" },
    },
  ]);

  assert.notEqual(changedSignature, originalSignature);
});
