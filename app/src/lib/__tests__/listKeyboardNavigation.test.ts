import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PAGE_STEP,
  resolveSequentialNavigationIndex,
} from "@/lib/listKeyboardNavigation";

describe("resolveSequentialNavigationIndex", () => {
  describe("vertical orientation", () => {
    const vertical = (key: string, current: number, count: number) =>
      resolveSequentialNavigationIndex(key, current, count, { orientation: "vertical" });

    it("steps and wraps with the vertical arrows", () => {
      assert.equal(vertical("ArrowDown", 0, 4), 1);
      assert.equal(vertical("ArrowDown", 3, 4), 0);
      assert.equal(vertical("ArrowUp", 3, 4), 2);
      assert.equal(vertical("ArrowUp", 0, 4), 3);
    });

    it("ignores the horizontal arrows", () => {
      assert.equal(vertical("ArrowRight", 0, 4), null);
      assert.equal(vertical("ArrowLeft", 0, 4), null);
    });
  });

  describe("horizontal orientation", () => {
    const horizontal = (key: string, current: number, count: number) =>
      resolveSequentialNavigationIndex(key, current, count, { orientation: "horizontal" });

    it("steps and wraps with the horizontal arrows", () => {
      assert.equal(horizontal("ArrowRight", 0, 5), 1);
      assert.equal(horizontal("ArrowRight", 4, 5), 0);
      assert.equal(horizontal("ArrowLeft", 4, 5), 3);
      assert.equal(horizontal("ArrowLeft", 0, 5), 4);
    });

    it("leaves the vertical arrows to the scroll container", () => {
      assert.equal(horizontal("ArrowDown", 0, 5), null);
      assert.equal(horizontal("ArrowUp", 0, 5), null);
    });
  });

  it("defaults to vertical when no orientation is given", () => {
    assert.equal(resolveSequentialNavigationIndex("ArrowDown", 0, 3), 1);
    assert.equal(resolveSequentialNavigationIndex("ArrowRight", 0, 3), null);
  });

  it("jumps to the first and last item in either orientation", () => {
    for (const orientation of ["vertical", "horizontal"] as const) {
      assert.equal(resolveSequentialNavigationIndex("Home", 2, 4, { orientation }), 0);
      assert.equal(resolveSequentialNavigationIndex("End", 2, 4, { orientation }), 3);
      assert.equal(resolveSequentialNavigationIndex("Home", -1, 4, { orientation }), 0);
      assert.equal(resolveSequentialNavigationIndex("End", -1, 4, { orientation }), 3);
    }
  });

  it("enters from the matching end when nothing is current", () => {
    assert.equal(resolveSequentialNavigationIndex("ArrowDown", -1, 4), 0);
    assert.equal(resolveSequentialNavigationIndex("ArrowUp", -1, 4), 3);
  });

  it("treats an out-of-range index as no current item", () => {
    assert.equal(resolveSequentialNavigationIndex("ArrowDown", 99, 4), 0);
    assert.equal(resolveSequentialNavigationIndex("ArrowUp", -7, 4), 3);
  });

  it("only pages when paging is enabled", () => {
    const count = PAGE_STEP * 3;
    assert.equal(resolveSequentialNavigationIndex("PageDown", 0, count), null);
    assert.equal(resolveSequentialNavigationIndex("PageUp", 0, count), null);
    assert.equal(
      resolveSequentialNavigationIndex("PageDown", 0, count, { paging: true }),
      PAGE_STEP,
    );
    assert.equal(
      resolveSequentialNavigationIndex("PageUp", PAGE_STEP, count, { paging: true }),
      0,
    );
  });

  it("clamps paging instead of wrapping", () => {
    const count = PAGE_STEP * 3;
    assert.equal(
      resolveSequentialNavigationIndex("PageDown", count - 1, count, { paging: true }),
      count - 1,
    );
    assert.equal(resolveSequentialNavigationIndex("PageUp", 0, count, { paging: true }), 0);
  });

  it("returns null for keys no widget should intercept", () => {
    for (const key of ["a", "Enter", " ", "Escape", "Tab"]) {
      assert.equal(
        resolveSequentialNavigationIndex(key, 0, 4, { paging: true }),
        null,
        `expected ${key} to pass through`,
      );
    }
  });

  it("returns null when there is nothing to navigate", () => {
    assert.equal(resolveSequentialNavigationIndex("ArrowDown", -1, 0), null);
    assert.equal(resolveSequentialNavigationIndex("Home", -1, 0), null);
  });

  it("keeps a single-item widget on that item", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
      assert.equal(resolveSequentialNavigationIndex(key, 0, 1), 0, `expected ${key} to stay put`);
    }
  });
});
