import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearCurrentWalkStatus,
  createRound,
  getCurrentPatientRef,
  getRoundPosition,
  markCurrentDone,
  markCurrentSkipped,
  markDoneAndNext,
  nextPatient,
  prevPatient,
  replaceRoundPatients,
  resumeRound,
  selectPatient,
  setActiveSection,
  setExpandedSystem,
  setRoundFilters,
  setRoundSyncStatus,
  completeRound,
} from "@/lib/round/roundSessionStore";
import type { Round } from "@/types/round";

const FIXED_NOW = "2026-08-11T12:00:00.000Z";
const LATER = "2026-08-11T12:05:00.000Z";

const createSampleRound = (patientIds: string[] = ["p1", "p2", "p3"]): Round =>
  createRound({
    userId: "user-1",
    patientIds,
    id: "round-1",
    now: FIXED_NOW,
  });

describe("createRound", () => {
  it("creates an active Round from a patient id list at index 0", () => {
    const round = createSampleRound();

    assert.equal(round.id, "round-1");
    assert.equal(round.userId, "user-1");
    assert.equal(round.status, "active");
    assert.equal(round.currentIndex, 0);
    assert.deepEqual(
      round.patients.map((ref) => ref.patientId),
      ["p1", "p2", "p3"],
    );
    assert.ok(round.patients.every((ref) => ref.status === "pending"));
    assert.equal(round.expandedSystemId, null);
    assert.equal(round.activeSection, "clinicalSummary");
    assert.deepEqual(round.filters, {
      search: "",
      hideDone: false,
      hideSkipped: false,
    });
    assert.equal(round.syncStatus, "idle");
    assert.equal(round.createdAt, FIXED_NOW);
    assert.equal(round.updatedAt, FIXED_NOW);
  });

  it("drops blank and duplicate patient ids", () => {
    const round = createRound({
      userId: "user-1",
      patientIds: ["p1", "", "  ", "p1", "p2"],
      now: FIXED_NOW,
    });
    assert.deepEqual(
      round.patients.map((ref) => ref.patientId),
      ["p1", "p2"],
    );
  });

  it("uses currentIndex -1 for an empty patient list", () => {
    const round = createRound({ userId: "user-1", patientIds: [], now: FIXED_NOW });
    assert.equal(round.currentIndex, -1);
    assert.equal(getCurrentPatientRef(round), null);
    assert.deepEqual(getRoundPosition(round), { current: 0, total: 0 });
  });
});

describe("resumeRound", () => {
  it("clamps an out-of-range index and sanitizes continuity fields", () => {
    const existing = createSampleRound();
    const resumed = resumeRound({
      round: {
        ...existing,
        currentIndex: 99,
        activeSection: "not-a-section" as Round["activeSection"],
        expandedSystemId: "  neuro  ",
        filters: { search: "icu", hideDone: true, hideSkipped: false },
      },
      now: LATER,
    });

    assert.equal(resumed.currentIndex, 2);
    assert.equal(resumed.activeSection, "clinicalSummary");
    assert.equal(resumed.expandedSystemId, "neuro");
    assert.equal(resumed.filters.search, "icu");
    assert.equal(resumed.filters.hideDone, true);
    assert.equal(resumed.updatedAt, LATER);
  });

  it("rebinds patient order while preserving walk status", () => {
    const existing = markCurrentDone(createSampleRound(), FIXED_NOW);
    const resumed = resumeRound({
      round: existing,
      patientIds: ["p3", "p1"],
      now: LATER,
    });

    assert.deepEqual(
      resumed.patients.map((ref) => ({ id: ref.patientId, status: ref.status })),
      [
        { id: "p3", status: "pending" },
        { id: "p1", status: "done" },
      ],
    );
    assert.equal(resumed.currentIndex, 0);
  });
});

describe("select / next / prev / done", () => {
  it("selectPatient jumps by id and clears expanded system", () => {
    const opened = setExpandedSystem(createSampleRound(), "neuro", FIXED_NOW);
    const selected = selectPatient(opened, "p3", LATER);

    assert.equal(selected.currentIndex, 2);
    assert.equal(selected.expandedSystemId, null);
    assert.equal(getCurrentPatientRef(selected)?.patientId, "p3");
    assert.deepEqual(getRoundPosition(selected), { current: 3, total: 3 });
  });

  it("selectPatient is a no-op for unknown ids", () => {
    const round = createSampleRound();
    const next = selectPatient(round, "missing");
    assert.equal(next.currentIndex, 0);
    assert.equal(next, round);
  });

  it("nextPatient and prevPatient update index deterministically", () => {
    const round = createSampleRound();
    const atSecond = nextPatient(round, LATER);
    assert.equal(atSecond.currentIndex, 1);
    assert.equal(getCurrentPatientRef(atSecond)?.patientId, "p2");

    const atThird = nextPatient(atSecond, LATER);
    assert.equal(atThird.currentIndex, 2);

    const stillThird = nextPatient(atThird, LATER);
    assert.equal(stillThird.currentIndex, 2);
    assert.equal(stillThird, atThird);

    const backToSecond = prevPatient(atThird, LATER);
    assert.equal(backToSecond.currentIndex, 1);

    const atFirst = prevPatient(prevPatient(backToSecond, LATER), LATER);
    assert.equal(atFirst.currentIndex, 0);
    assert.equal(prevPatient(atFirst, LATER), atFirst);
  });

  it("markCurrentDone sets the current done flag without advancing", () => {
    const round = createSampleRound();
    const done = markCurrentDone(round, LATER);

    assert.equal(done.currentIndex, 0);
    assert.equal(done.patients[0]?.status, "done");
    assert.equal(done.patients[1]?.status, "pending");
    assert.equal(done.updatedAt, LATER);
  });

  it("markDoneAndNext marks done then advances when possible", () => {
    const round = createSampleRound();
    const advanced = markDoneAndNext(round, LATER);

    assert.equal(advanced.patients[0]?.status, "done");
    assert.equal(advanced.currentIndex, 1);
    assert.equal(getCurrentPatientRef(advanced)?.patientId, "p2");
  });

  it("markCurrentSkipped and clearCurrentWalkStatus toggle walk flags", () => {
    const skipped = markCurrentSkipped(createSampleRound(), LATER);
    assert.equal(skipped.patients[0]?.status, "skipped");

    const cleared = clearCurrentWalkStatus(skipped, LATER);
    assert.equal(cleared.patients[0]?.status, "pending");
  });
});

describe("expanded system and continuity fields", () => {
  it("expanded system is single-id; expanding replaces the prior", () => {
    const round = createSampleRound();
    const neuro = setExpandedSystem(round, "neuro", LATER);
    assert.equal(neuro.expandedSystemId, "neuro");

    const cv = setExpandedSystem(neuro, "cv", LATER);
    assert.equal(cv.expandedSystemId, "cv");

    const collapsed = setExpandedSystem(cv, null, LATER);
    assert.equal(collapsed.expandedSystemId, null);
  });

  it("setActiveSection updates the active mid-rounds section", () => {
    const round = createSampleRound();
    const systems = setActiveSection(round, "systems", LATER);
    assert.equal(systems.activeSection, "systems");

    const todos = setActiveSection(systems, "todos", LATER);
    assert.equal(todos.activeSection, "todos");
  });

  it("setRoundFilters merges search and visibility flags", () => {
    const round = createSampleRound();
    const filtered = setRoundFilters(
      round,
      { search: "bed 4", hideDone: true },
      LATER,
    );
    assert.equal(filtered.filters.search, "bed 4");
    assert.equal(filtered.filters.hideDone, true);
    assert.equal(filtered.filters.hideSkipped, false);
  });

  it("setRoundSyncStatus and completeRound update session meta", () => {
    const round = createSampleRound();
    const offline = setRoundSyncStatus(round, "offline", LATER);
    assert.equal(offline.syncStatus, "offline");

    const completed = completeRound(offline, LATER);
    assert.equal(completed.status, "completed");
    assert.equal(completed.expandedSystemId, null);
  });

  it("treats a completed Round as immutable clinical lifecycle state", () => {
    const completed = completeRound(
      markCurrentDone(createSampleRound(), FIXED_NOW),
      LATER,
    );

    const attemptedTransitions = [
      selectPatient(completed, "p3", "2026-08-11T12:06:00.000Z"),
      nextPatient(completed, "2026-08-11T12:06:00.000Z"),
      prevPatient(completed, "2026-08-11T12:06:00.000Z"),
      markCurrentSkipped(completed, "2026-08-11T12:06:00.000Z"),
      clearCurrentWalkStatus(completed, "2026-08-11T12:06:00.000Z"),
      markDoneAndNext(completed, "2026-08-11T12:06:00.000Z"),
      setRoundFilters(completed, { hideDone: true }, "2026-08-11T12:06:00.000Z"),
      setActiveSection(completed, "todos", "2026-08-11T12:06:00.000Z"),
      setExpandedSystem(completed, "resp", "2026-08-11T12:06:00.000Z"),
      setRoundSyncStatus(completed, "failed", "2026-08-11T12:06:00.000Z"),
      replaceRoundPatients(completed, ["p3", "p4"], "2026-08-11T12:06:00.000Z"),
    ];

    for (const attempted of attemptedTransitions) {
      assert.strictEqual(
        attempted,
        completed,
        "completed rounds must remain unchanged until a new Round is explicitly created",
      );
    }
  });

  it("accepts failed sync status without sanitization fallback", () => {
    const round = setRoundSyncStatus(createSampleRound(), "failed", LATER);
    assert.equal(round.syncStatus, "failed");
  });

  it("replaceRoundPatients preserves statuses and current selection when possible", () => {
    const started = markCurrentDone(selectPatient(createSampleRound(), "p2", FIXED_NOW), FIXED_NOW);
    const replaced = replaceRoundPatients(started, ["p2", "p4", "p1"], LATER);

    assert.deepEqual(
      replaced.patients.map((ref) => ({ id: ref.patientId, status: ref.status })),
      [
        { id: "p2", status: "done" },
        { id: "p4", status: "pending" },
        { id: "p1", status: "pending" },
      ],
    );
    assert.equal(replaced.currentIndex, 0);
    assert.equal(getCurrentPatientRef(replaced)?.patientId, "p2");
  });
});
