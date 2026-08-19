import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROSTER_PAGE_STEP, resolveRosterNavigationIndex } from "@/lib/rosterNavigation";

describe("resolveRosterNavigationIndex", () => {
  it("steps forward and backward one row at a time", () => {
    assert.equal(resolveRosterNavigationIndex("ArrowDown", 0, 4), 1);
    assert.equal(resolveRosterNavigationIndex("ArrowUp", 3, 4), 2);
  });

  it("wraps around both ends so the roster is a loop", () => {
    assert.equal(resolveRosterNavigationIndex("ArrowDown", 3, 4), 0);
    assert.equal(resolveRosterNavigationIndex("ArrowUp", 0, 4), 3);
  });

  it("enters the list from the matching end when nothing is selected", () => {
    assert.equal(resolveRosterNavigationIndex("ArrowDown", -1, 4), 0);
    assert.equal(resolveRosterNavigationIndex("ArrowUp", -1, 4), 3);
  });

  it("treats an out-of-range index as no selection instead of navigating off the list", () => {
    assert.equal(resolveRosterNavigationIndex("ArrowDown", 99, 4), 0);
    assert.equal(resolveRosterNavigationIndex("ArrowUp", 99, 4), 3);
  });

  it("jumps to the first and last patient", () => {
    assert.equal(resolveRosterNavigationIndex("Home", 2, 4), 0);
    assert.equal(resolveRosterNavigationIndex("End", 2, 4), 3);
    assert.equal(resolveRosterNavigationIndex("Home", -1, 4), 0);
    assert.equal(resolveRosterNavigationIndex("End", -1, 4), 3);
  });

  it("pages by a fixed step and clamps rather than wrapping", () => {
    const count = ROSTER_PAGE_STEP * 3;
    assert.equal(resolveRosterNavigationIndex("PageDown", 0, count), ROSTER_PAGE_STEP);
    assert.equal(resolveRosterNavigationIndex("PageUp", ROSTER_PAGE_STEP, count), 0);
    assert.equal(resolveRosterNavigationIndex("PageDown", count - 1, count), count - 1);
    assert.equal(resolveRosterNavigationIndex("PageUp", 0, count), 0);
  });

  it("returns null for keys the rail must not intercept", () => {
    for (const key of ["a", "Enter", " ", "Escape", "Tab", "ArrowLeft", "ArrowRight"]) {
      assert.equal(resolveRosterNavigationIndex(key, 0, 4), null, `expected ${key} to pass through`);
    }
  });

  it("returns null when there is nothing to navigate", () => {
    assert.equal(resolveRosterNavigationIndex("ArrowDown", -1, 0), null);
    assert.equal(resolveRosterNavigationIndex("Home", -1, 0), null);
  });

  it("keeps a single-patient roster on that patient", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"]) {
      assert.equal(resolveRosterNavigationIndex(key, 0, 1), 0, `expected ${key} to stay put`);
    }
  });
});
