import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Auth Race Condition Fix", () => {
  it("setLoading guard prevents duplicate calls", () => {
    // Simulate the useRef(false) guard pattern
    let initialized = false;
    const calls: boolean[] = [];
    
    const finishLoading = () => {
      if (initialized) return;
      initialized = true;
      calls.push(false);
    };

    // First call should succeed
    finishLoading();
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0], false);

    // Second call should be skipped
    finishLoading();
    assert.strictEqual(calls.length, 1); // Still 1, not 2
  });

  it("reset allows re-initialization", () => {
    let initialized = false;
    const calls: boolean[] = [];
    
    const finishLoading = () => {
      if (initialized) return;
      initialized = true;
      calls.push(false);
    };

    finishLoading();
    assert.strictEqual(calls.length, 1);

    // Reset
    initialized = false;
    finishLoading();
    assert.strictEqual(calls.length, 2); // Now 2, re-initialized
  });
});
