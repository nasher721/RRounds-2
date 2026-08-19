import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Null Safety Guards", () => {
  it("returns null for empty array access", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patients: any[] = [];
    const firstId = patients[0]?.id ?? null;
    assert.strictEqual(firstId, null);
  });

  it("returns empty string for null user email", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: { email?: string } | null = null as any;
    const email = user?.email ?? "";
    assert.strictEqual(email, "");
  });

  it("returns empty array for missing todosMap key", () => {
    const todosMap: Record<string, string[]> = {};
    const todos = todosMap["missing-id"] ?? [];
    assert.deepStrictEqual(todos, []);
  });

  it("handles undefined codeStatus to toUpperCase safely", () => {
    const codeStatus: string | undefined = undefined;
    const upper = (codeStatus ?? "").toUpperCase();
    assert.strictEqual(upper, "");
  });

  it("handles undefined clinicalSummary length safely", () => {
    const summary: string | undefined = undefined;
    const len = (summary ?? "").length;
    assert.strictEqual(len, 0);
  });
});
