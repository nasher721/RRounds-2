import test from "node:test";
import assert from "node:assert/strict";
import { withTimeout, withCategoryTimeout, TimeoutError, TIMEOUT_DEFAULTS, createTimeoutController } from "@/lib/requestTimeout";

test("withTimeout resolves when promise completes before timeout", async () => {
  const result = await withTimeout(Promise.resolve("ok"), 100, "fast-op");
  assert.equal(result, "ok");
});

test("withTimeout rejects with TimeoutError when operation takes too long", async () => {
  await assert.rejects(
    withTimeout(new Promise((resolve) => setTimeout(resolve, 25)), 5, "slow-op"),
    (error: unknown) => {
      assert.ok(error instanceof TimeoutError);
      assert.equal(error.operation, "slow-op");
      assert.equal(error.timeoutMs, 5);
      return true;
    },
  );
});

test("withCategoryTimeout uses configured category default timeout", async () => {
  const previous = TIMEOUT_DEFAULTS.query;
  (TIMEOUT_DEFAULTS as { query: number }).query = 1;

  await assert.rejects(
    withCategoryTimeout(new Promise((resolve) => setTimeout(resolve, 15)), "query"),
    (error: unknown) => {
      assert.ok(error instanceof TimeoutError);
      assert.equal(error.timeoutMs, 1);
      assert.equal(error.operation, "query");
      return true;
    },
  );

  (TIMEOUT_DEFAULTS as { query: number }).query = previous;
});

test("createTimeoutController aborts when parent signal aborts", async () => {
  const parent = new AbortController();
  const { controller, clear } = createTimeoutController(1000, parent.signal);
  parent.abort(new Error("parent aborted"));

  assert.equal(controller.signal.aborted, true);
  assert.equal((controller.signal.reason as Error).message, "parent aborted");
  clear();
});
