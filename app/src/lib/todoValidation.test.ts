import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_TODO_LENGTH, validateTodoInput } from "./todoValidation";

describe("todo validation", () => {
  it("trims valid content", () => {
    assert.deepEqual(validateTodoInput("  Recheck potassium  "), {
      valid: true,
      value: "Recheck potassium",
    });
  });

  it("rejects empty and whitespace-only content", () => {
    assert.deepEqual(validateTodoInput("   \n "), {
      valid: false,
      error: "Enter a todo before adding it.",
    });
  });

  it("rejects content beyond the safe maximum", () => {
    assert.deepEqual(validateTodoInput("x".repeat(MAX_TODO_LENGTH + 1)), {
      valid: false,
      error: `Todos must be ${MAX_TODO_LENGTH} characters or fewer.`,
    });
  });
});
