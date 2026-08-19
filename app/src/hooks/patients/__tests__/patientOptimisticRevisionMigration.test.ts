import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("patient revision migration installs a monotonic update trigger", () => {
  const sql = readFileSync(
    new URL("../../../../supabase/migrations/20260811000000_add_patient_optimistic_revision.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0/i);
  assert.match(sql, /NEW\.revision = OLD\.revision \+ 1/i);
  assert.match(sql, /BEFORE UPDATE ON public\.patients/i);
});
