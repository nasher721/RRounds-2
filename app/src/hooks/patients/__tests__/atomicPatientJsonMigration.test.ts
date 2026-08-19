import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260711210000_add_atomic_patient_json_patch.sql",
  "utf8",
);

test("atomic patient JSON RPC is owner-scoped, allowlisted, and invoker-secured", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.update_owned_patient_json_field/i);
  assert.match(migration, /SECURITY INVOKER/i);
  assert.doesNotMatch(migration, /SECURITY DEFINER/i);
  assert.match(migration, /WHERE id = p_patient_id\s+AND user_id = auth\.uid\(\)/i);
  assert.match(migration, /p_parent_field = 'systems'[\s\S]*p_child_field NOT IN/i);
  assert.match(migration, /p_parent_field = 'medications'[\s\S]*p_child_field NOT IN/i);
  assert.match(migration, /IF p_value IS NULL THEN[\s\S]*Invalid patient JSON field/i);
  assert.match(migration, /IF p_last_modified IS NULL THEN[\s\S]*Invalid modification timestamp/i);
  assert.match(migration, /jsonb_array_elements\(p_value\)[\s\S]*jsonb_typeof\(element\.value\) <> 'string'/i);
  assert.match(migration, /jsonb_set\(COALESCE\(systems/i);
  assert.match(migration, /jsonb_set\(COALESCE\(medications/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]*TO authenticated/i);
});
