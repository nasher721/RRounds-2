import assert from "node:assert/strict";
import test from "node:test";
import { createRound } from "../roundSessionStore";
import {
  applyFieldConflictChoice,
  detectDraftFieldConflict,
  mergeRoundContinuity,
  pickLastWriteField,
  resolveHydratedRoundContinuity,
} from "./conflictRules";
import type { RoundContinuityMeta, VersionedField } from "./types";

const BASE = "2026-08-11T10:00:00.000Z";
const T1 = "2026-08-11T10:01:00.000Z";
const T2 = "2026-08-11T10:02:00.000Z";
const T3 = "2026-08-11T10:03:00.000Z";

const meta = (
  partial: Partial<RoundContinuityMeta> & Pick<RoundContinuityMeta, "deviceId">,
): RoundContinuityMeta => ({
  positionUpdatedAt: BASE,
  expandedUpdatedAt: BASE,
  filtersUpdatedAt: BASE,
  sectionUpdatedAt: BASE,
  ...partial,
});

const field = (
  partial: Partial<VersionedField> & Pick<VersionedField, "value" | "updatedAt">,
): VersionedField => ({
  patientId: "p1",
  fieldKey: "clinicalSummary",
  baseUpdatedAt: BASE,
  deviceId: "device-a",
  ...partial,
});

test("newest device navigation wins for Round position", () => {
  const local = createRound({
    userId: "u1",
    patientIds: ["a", "b", "c"],
    id: "round-1",
    now: BASE,
  });
  const remote = {
    ...local,
    currentIndex: 2,
    updatedAt: T1,
  };
  const localMeta = meta({
    positionUpdatedAt: T1,
    deviceId: "phone",
  });
  const remoteMeta = meta({
    positionUpdatedAt: T3,
    deviceId: "workstation",
  });

  const merged = mergeRoundContinuity({
    localRound: { ...local, currentIndex: 0, updatedAt: T2 },
    localMeta,
    remoteRound: remote,
    remoteMeta,
  });

  assert.equal(merged.round.currentIndex, 2);
  assert.equal(merged.usedRemoteNav, true);
  assert.equal(merged.continuity.positionUpdatedAt, T3);
});

test("last-focused expanded system wins across devices", () => {
  const local = createRound({
    userId: "u1",
    patientIds: ["a"],
    id: "round-1",
    now: BASE,
  });
  const localRound = { ...local, expandedSystemId: "neuro", updatedAt: T2 };
  const remoteRound = { ...local, expandedSystemId: "cv", updatedAt: T1 };
  const merged = mergeRoundContinuity({
    localRound,
    localMeta: meta({
      expandedUpdatedAt: T1,
      deviceId: "phone",
    }),
    remoteRound,
    remoteMeta: meta({
      expandedUpdatedAt: T3,
      deviceId: "desk",
    }),
  });

  assert.equal(merged.round.expandedSystemId, "cv");
  assert.equal(merged.usedRemoteExpand, true);
  assert.equal(merged.continuity.expandedUpdatedAt, T3);
});

test("completed lifecycle wins for the same Round during hydration", () => {
  const active = createRound({
    userId: "u1",
    patientIds: ["a", "b"],
    id: "round-1",
    now: BASE,
  });
  const completed = {
    ...active,
    status: "completed" as const,
    currentIndex: 1,
    updatedAt: T2,
  };

  const resolved = resolveHydratedRoundContinuity({
    localRound: completed,
    localMeta: meta({ deviceId: "phone" }),
    remoteRound: { ...active, updatedAt: T3 },
    remoteMeta: meta({ deviceId: "workstation" }),
  });

  assert.equal(resolved.round.status, "completed");
  assert.equal(resolved.round.id, "round-1");
  assert.equal(resolved.round.currentIndex, 1);
});

test("a different active Round supersedes an older completed generation", () => {
  const completed = {
    ...createRound({
      userId: "u1",
      patientIds: ["a", "b"],
      id: "round-old",
      now: BASE,
    }),
    status: "completed" as const,
    updatedAt: T3,
  };
  const active = createRound({
    userId: "u1",
    patientIds: ["a", "b"],
    id: "round-new",
    now: T2,
  });

  const resolved = resolveHydratedRoundContinuity({
    localRound: completed,
    localMeta: meta({ deviceId: "stale-phone" }),
    remoteRound: active,
    remoteMeta: meta({ deviceId: "workstation" }),
  });

  assert.equal(resolved.round.status, "active");
  assert.equal(resolved.round.id, "round-new");
});

test("an unsynced active Round supersedes an older remote completion", () => {
  const active = createRound({
    userId: "u1",
    patientIds: ["a", "b"],
    id: "round-new",
    now: T2,
  });
  const completed = {
    ...createRound({
      userId: "u1",
      patientIds: ["a", "b"],
      id: "round-old",
      now: BASE,
    }),
    status: "completed" as const,
    updatedAt: T3,
  };

  const resolved = resolveHydratedRoundContinuity({
    localRound: active,
    localMeta: meta({ deviceId: "phone" }),
    remoteRound: completed,
    remoteMeta: meta({ deviceId: "workstation" }),
  });

  assert.equal(resolved.round.status, "active");
  assert.equal(resolved.round.id, "round-new");
});

test("a persisted remote completion supersedes an unpersisted synthetic fallback", () => {
  const fallback = createRound({
    userId: "u1",
    patientIds: ["a", "b"],
    id: "synthetic-fallback",
    now: T3,
  });
  const completed = {
    ...createRound({
      userId: "u1",
      patientIds: ["a", "b"],
      id: "persisted-round",
      now: BASE,
    }),
    status: "completed" as const,
    updatedAt: T2,
  };

  const resolved = resolveHydratedRoundContinuity({
    localRound: fallback,
    localMeta: meta({ deviceId: "new-browser" }),
    remoteRound: completed,
    remoteMeta: meta({ deviceId: "workstation" }),
    localIsFallback: true,
  });

  assert.equal(resolved.round.status, "completed");
  assert.equal(resolved.round.id, "persisted-round");
});

test("filters use dedicated timestamp, not navigation-bumped updatedAt", () => {
  const local = createRound({
    userId: "u1",
    patientIds: ["a", "b"],
    id: "round-1",
    now: BASE,
  });
  const localRound = {
    ...local,
    currentIndex: 1,
    filters: { search: "local-filter", hideDone: true, hideSkipped: false },
    updatedAt: T3,
  };
  const remoteRound = {
    ...local,
    currentIndex: 0,
    filters: { search: "remote-filter", hideDone: false, hideSkipped: true },
    updatedAt: T1,
  };
  const merged = mergeRoundContinuity({
    localRound,
    localMeta: meta({
      positionUpdatedAt: T3,
      filtersUpdatedAt: T1,
      deviceId: "phone",
    }),
    remoteRound,
    remoteMeta: meta({
      positionUpdatedAt: BASE,
      filtersUpdatedAt: T2,
      deviceId: "desk",
    }),
  });

  assert.equal(merged.round.currentIndex, 1);
  assert.equal(merged.round.filters.search, "remote-filter");
  assert.equal(merged.round.filters.hideSkipped, true);
  assert.equal(merged.continuity.filtersUpdatedAt, T2);
});

test("active section uses dedicated timestamp, not navigation-bumped updatedAt", () => {
  const local = createRound({
    userId: "u1",
    patientIds: ["a"],
    id: "round-1",
    now: BASE,
  });
  const localRound = {
    ...local,
    activeSection: "clinicalSummary" as const,
    updatedAt: T3,
  };
  const remoteRound = {
    ...local,
    activeSection: "systems" as const,
    updatedAt: T1,
  };
  const merged = mergeRoundContinuity({
    localRound,
    localMeta: meta({
      positionUpdatedAt: T3,
      sectionUpdatedAt: T1,
      deviceId: "phone",
    }),
    remoteRound,
    remoteMeta: meta({
      positionUpdatedAt: BASE,
      sectionUpdatedAt: T2,
      deviceId: "desk",
    }),
  });

  assert.equal(merged.round.activeSection, "systems");
  assert.equal(merged.continuity.sectionUpdatedAt, T2);
});

test("fast-forward draft is not a conflict (LWW)", () => {
  const remote = field({ value: "server tip", updatedAt: T1, baseUpdatedAt: BASE });
  const local = field({
    value: "local ahead",
    updatedAt: T2,
    baseUpdatedAt: T1,
    deviceId: "phone",
  });
  assert.equal(detectDraftFieldConflict(local, remote), null);
  const winner = pickLastWriteField(local, remote);
  assert.equal(winner.value, "local ahead");
});

test("same-field offline divergence surfaces explicit conflict", () => {
  const local = field({ value: "mine text", updatedAt: T2, baseUpdatedAt: BASE });
  const remote = field({
    value: "theirs text",
    updatedAt: T3,
    baseUpdatedAt: BASE,
    deviceId: "desk",
  });
  const conflict = detectDraftFieldConflict(local, remote);
  assert.ok(conflict);
  assert.equal(conflict?.mine.value, "mine text");
  assert.equal(conflict?.theirs.value, "theirs text");
});

test("Mine / Theirs / merge choices never silent-drop", () => {
  const conflict = detectDraftFieldConflict(
    field({ value: "mine", updatedAt: T2, baseUpdatedAt: BASE }),
    field({ value: "theirs", updatedAt: T3, baseUpdatedAt: BASE, deviceId: "desk" }),
  );
  assert.ok(conflict);

  const mine = applyFieldConflictChoice(conflict!, "mine");
  assert.equal(mine.value, "mine");

  const theirs = applyFieldConflictChoice(conflict!, "theirs");
  assert.equal(theirs.value, "theirs");

  const merged = applyFieldConflictChoice(conflict!, "merge", "mine + theirs");
  assert.equal(merged.value, "mine + theirs");

  assert.throws(() => applyFieldConflictChoice(conflict!, "merge"));
});
