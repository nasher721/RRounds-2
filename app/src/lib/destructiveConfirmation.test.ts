import assert from "node:assert/strict";
import test from "node:test";
import { formatClearAllPatientsConfirmation } from "./destructiveConfirmation";

test("clear-all confirmation states the exact affected record count and recovery guidance", () => {
  assert.equal(
    formatClearAllPatientsConfirmation(3),
    "Remove all 3 patient records from today’s rounds? This cannot be undone. Export a recovery copy first if these notes are needed.",
  );
  assert.match(formatClearAllPatientsConfirmation(1), /1 patient record\b/);
});
