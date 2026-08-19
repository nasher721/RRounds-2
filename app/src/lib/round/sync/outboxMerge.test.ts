import assert from "node:assert/strict";
import test from "node:test";
import {
  coalesceRoundOutboxEntry,
  computeOutboxNextRetryAt,
  countConflictOutbox,
  countFailedOutbox,
  countUnresolvedOutbox,
  countPendingOutbox,
  isOutboxEntryReady,
  mergeOutboxQueue,
  OUTBOX_BACKOFF_BASE_MS,
  OUTBOX_SOFT_FAIL_RETRY_MS,
  resolveDraftFieldPushOutcome,
  resolveRoundStateUpsertOutcome,
  selectPendingOutbox,
  shouldDrainOutboxAfterHydrate,
  withOutboxDefaults,
} from "./outboxMerge";
import type { RoundOutboxEntry } from "./types";

const entry = (
  partial: Partial<RoundOutboxEntry> & Pick<RoundOutboxEntry, "kind" | "entityKey" | "payload">,
): RoundOutboxEntry =>
  withOutboxDefaults({
    ownerId: "user-a",
    baseUpdatedAt: "2026-08-11T10:00:00.000Z",
    updatedAt: "2026-08-11T10:01:00.000Z",
    deviceId: "phone",
    ...partial,
  });

test("coalesce draft_field keeps earliest base and latest value", () => {
  const existing = entry({
    kind: "draft_field",
    entityKey: "p1::clinicalSummary",
    payload: { value: "first" },
    baseUpdatedAt: "2026-08-11T09:00:00.000Z",
    updatedAt: "2026-08-11T10:00:00.000Z",
    timestamp: 1,
  });
  const incoming = entry({
    kind: "draft_field",
    entityKey: "p1::clinicalSummary",
    payload: { value: "second" },
    baseUpdatedAt: "2026-08-11T10:00:00.000Z",
    updatedAt: "2026-08-11T11:00:00.000Z",
    timestamp: 2,
  });

  const coalesced = coalesceRoundOutboxEntry(existing, incoming);
  assert.ok(coalesced);
  assert.equal(coalesced?.payload.value, "second");
  assert.equal(coalesced?.baseUpdatedAt, "2026-08-11T09:00:00.000Z");
  assert.equal(coalesced?.status, "pending");
  assert.equal(coalesced?.retryCount, 0);
});

test("conflict rows are not overwritten by later coalesces", () => {
  const existing = entry({
    kind: "draft_field",
    entityKey: "p1::systems.neuro",
    payload: { value: "local" },
    status: "conflict",
  });
  const incoming = entry({
    kind: "draft_field",
    entityKey: "p1::systems.neuro",
    payload: { value: "newer local" },
  });
  const coalesced = coalesceRoundOutboxEntry(existing, incoming);
  assert.equal(coalesced?.status, "conflict");
  assert.equal(coalesced?.payload.value, "local");
});

test("mergeOutboxQueue coalesces same entity and counts pending/conflict", () => {
  const first = entry({
    kind: "round_state",
    entityKey: "round-1",
    payload: { currentIndex: 0 },
    timestamp: 1,
  });
  const second = entry({
    kind: "round_state",
    entityKey: "round-1",
    payload: { currentIndex: 2 },
    updatedAt: "2026-08-11T12:00:00.000Z",
    timestamp: 2,
  });
  const draft = entry({
    kind: "draft_field",
    entityKey: "p1::clinicalSummary",
    payload: { value: "note" },
    timestamp: 3,
  });

  let queue = mergeOutboxQueue([], first);
  queue = mergeOutboxQueue(queue, second);
  queue = mergeOutboxQueue(queue, draft);

  assert.equal(queue.length, 2);
  const roundEntry = queue.find((row) => row.kind === "round_state");
  assert.equal(roundEntry?.payload.currentIndex, 2);
  assert.equal(countPendingOutbox(queue, "user-a"), 2);

  queue = queue.map((row) =>
    row.kind === "draft_field" ? { ...row, status: "conflict" as const } : row,
  );
  assert.equal(countConflictOutbox(queue, "user-a"), 1);
  assert.equal(countFailedOutbox(queue, "user-a"), 0);
  assert.equal(countUnresolvedOutbox(queue, "user-a"), 2);
  assert.equal(selectPendingOutbox(queue, "user-a").length, 1);
});

test("countFailedOutbox and countUnresolvedOutbox track explicit failed rows", () => {
  const queue = [
    entry({
      kind: "round_state",
      entityKey: "r1",
      payload: {},
      status: "failed",
    }),
    entry({
      kind: "draft_field",
      entityKey: "p1::clinicalSummary",
      payload: {},
      status: "syncing",
    }),
    entry({
      kind: "draft_field",
      entityKey: "p2::clinicalSummary",
      payload: {},
      status: "conflict",
    }),
    entry({
      kind: "round_state",
      entityKey: "r2",
      payload: {},
      status: "completed",
    }),
  ];

  assert.equal(countFailedOutbox(queue, "user-a"), 1);
  assert.equal(countUnresolvedOutbox(queue, "user-a"), 3);
});

test("selectPendingOutbox ignores other owners and completed rows", () => {
  const queue = [
    entry({
      kind: "round_state",
      entityKey: "r1",
      payload: {},
      ownerId: "user-a",
      status: "pending",
    }),
    entry({
      kind: "round_state",
      entityKey: "r2",
      payload: {},
      ownerId: "user-b",
      status: "pending",
    }),
    entry({
      kind: "draft_field",
      entityKey: "p1::x",
      payload: {},
      ownerId: "user-a",
      status: "completed",
    }),
  ];
  const pending = selectPendingOutbox(queue, "user-a");
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.entityKey, "r1");
});

test("exponential backoff doubles between retries and caps", () => {
  const now = 1_000_000;
  assert.equal(computeOutboxNextRetryAt(0, now), now + OUTBOX_BACKOFF_BASE_MS);
  assert.equal(computeOutboxNextRetryAt(1, now), now + OUTBOX_BACKOFF_BASE_MS * 2);
  assert.equal(computeOutboxNextRetryAt(2, now), now + OUTBOX_BACKOFF_BASE_MS * 4);
  assert.equal(computeOutboxNextRetryAt(10, now), now + 60_000);
});

test("selectPendingOutbox respects nextRetryAt backoff window", () => {
  const now = 5_000;
  const ready = entry({
    kind: "round_state",
    entityKey: "ready",
    payload: {},
    status: "pending",
    nextRetryAt: 4_000,
    timestamp: 1,
  });
  const waiting = entry({
    kind: "round_state",
    entityKey: "waiting",
    payload: {},
    status: "pending",
    nextRetryAt: 9_000,
    timestamp: 2,
  });
  const batch = selectPendingOutbox([ready, waiting], "user-a", 20, now);
  assert.equal(batch.length, 1);
  assert.equal(batch[0]?.entityKey, "ready");
  assert.equal(isOutboxEntryReady(waiting, now), false);
  assert.equal(isOutboxEntryReady(waiting, 9_000), true);
});

test("missingTable soft-fail is not an ack and still counts pending", () => {
  assert.equal(resolveRoundStateUpsertOutcome({ missingTable: true }), "soft_fail");
  assert.equal(resolveRoundStateUpsertOutcome({ missingTable: false }), "ack");
  assert.equal(
    resolveRoundStateUpsertOutcome({
      missingTable: false,
      requestedRoundId: "round-new",
      acceptedRoundId: "round-current",
    }),
    "generation_conflict",
  );

  const soft = entry({
    kind: "round_state",
    entityKey: "round-soft",
    payload: {},
    status: "soft_fail",
    softFailReason: "missing_table",
    nextRetryAt: Date.now() + OUTBOX_SOFT_FAIL_RETRY_MS,
  });
  assert.equal(countPendingOutbox([soft], "user-a"), 1);
  assert.equal(isOutboxEntryReady(soft, Date.now()), false);
  assert.equal(
    isOutboxEntryReady(soft, Date.now() + OUTBOX_SOFT_FAIL_RETRY_MS + 1),
    true,
  );
});

test("draft push missing is soft_fail not silent ack", () => {
  assert.equal(resolveDraftFieldPushOutcome({ status: "ok" }), "ack");
  assert.equal(resolveDraftFieldPushOutcome({ status: "missing" }), "soft_fail");
  assert.equal(resolveDraftFieldPushOutcome({ status: "conflict" }), "conflict");

  const soft = entry({
    kind: "draft_field",
    entityKey: "p1::clinicalSummary",
    payload: {},
    status: "soft_fail",
    softFailReason: "missing_patient",
    nextRetryAt: Date.now() + OUTBOX_SOFT_FAIL_RETRY_MS,
  });
  assert.equal(countPendingOutbox([soft], "user-a"), 1);
  assert.equal(isOutboxEntryReady(soft, Date.now()), false);
});

test("drain after hydrate only when already online", () => {
  assert.equal(shouldDrainOutboxAfterHydrate(true), true);
  assert.equal(shouldDrainOutboxAfterHydrate(false), false);
});
