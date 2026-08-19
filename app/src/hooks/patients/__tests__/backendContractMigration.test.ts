import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../../../supabase/migrations/20260812000000_harden_patient_and_round_contracts.sql", import.meta.url),
  "utf8",
);
const patientFetch = readFileSync(
  new URL("../usePatientFetch.ts", import.meta.url),
  "utf8",
);
const cacheWarming = readFileSync(
  new URL("../../../lib/cache/cacheWarming.ts", import.meta.url),
  "utf8",
);

test("backend contract migration persists the UI patient fields and tenant-scopes ordering", () => {
  for (const column of [
    "age",
    "service_line",
    "attending_physician",
    "consulting_team",
    "acuity",
    "code_status",
    "alerts",
    "vitals",
    "assigned_to",
  ]) {
    assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`, "i"));
  }
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_user_patient_number[\s\S]*ON public\.patients \(user_id, patient_number\)/i);
  assert.match(migration, /idx_patient_todos_user_patient_created[\s\S]*ON public\.patient_todos \(user_id, patient_id, created_at DESC\)/i);
});

test("backend contract migration exposes an authenticated atomic Round upsert", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.upsert_owned_round_state/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.upsert_owned_round_state/i);
  assert.match(migration, /jsonb_typeof\(p_state\) <> 'object'/i);
  assert.match(migration, /pg_column_size\(p_state\) > 262144/i);
  assert.match(migration, /ELSIF p_updated_at >= current_state\.updated_at/i);
});

test("patient roster readers share the session-sticky compatibility projection", () => {
  for (const source of [patientFetch, cacheWarming]) {
    assert.match(source, /getPatientRosterSelectColumns\(\)/);
    assert.match(source, /markPatientRosterProjectionLegacy\(\)/);
  }
});
