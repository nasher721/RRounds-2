import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveRoundCompletionSafety } from "./roundCompletionSafety";
import type { QueuedMutationDB } from "@/lib/offline/database";

const mutation = (status: QueuedMutationDB["status"]): QueuedMutationDB => ({
  id: `mutation-${status ?? "pending"}`,
  ownerId: "owner-1",
  type: "todo",
  operation: "create",
  table: "patient_todos",
  payload: {},
  timestamp: 1,
  retryCount: 0,
  maxRetries: 3,
  status,
});

describe("Round completion safety", () => {
  it("allows completion only when both outboxes and patient saves are resolved", () => {
    assert.equal(deriveRoundCompletionSafety({
      roundUnresolvedCount: 0,
      roundConflictCount: 0,
      mutations: [mutation("completed")],
      patientSaveStates: { patientA: "saved", patientB: "idle" },
    }).canComplete, true);
  });

  it("blocks in-flight patient saves before a durable queue row exists", () => {
    const result = deriveRoundCompletionSafety({
      roundUnresolvedCount: 0,
      roundConflictCount: 0,
      mutations: [],
      patientSaveStates: { patientA: "saving" },
    });

    assert.equal(result.canComplete, false);
    assert.equal(result.patientSaveBlockerCount, 1);
  });

  it("blocks pending, failed, and conflicted patient or Todo mutations", () => {
    const result = deriveRoundCompletionSafety({
      roundUnresolvedCount: 0,
      roundConflictCount: 0,
      mutations: [mutation("pending"), mutation("failed"), mutation("conflict")],
      patientSaveStates: {},
    });

    assert.equal(result.canComplete, false);
    assert.equal(result.mutationUnresolvedCount, 3);
    assert.equal(result.mutationPendingCount, 1);
    assert.equal(result.mutationFailedCount, 1);
    assert.equal(result.mutationConflictCount, 1);
  });

  it("blocks completion while shared clinical truth cannot be server-verified", () => {
    const result = deriveRoundCompletionSafety({
      roundUnresolvedCount: 0,
      roundConflictCount: 0,
      mutations: [],
      patientSaveStates: {},
      dataVerificationBlockerCount: 1,
    });

    assert.equal(result.canComplete, false);
    assert.equal(result.dataVerificationBlockerCount, 1);
  });
});
