import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migrationPath = new URL(
  "../../supabase/migrations/20260711240000_add_atomic_phrase_usage.sql",
  import.meta.url,
);

test("phrase usage RPC updates the owner count and inserts metadata in one transaction", () => {
  const migration = readFileSync(migrationPath, "utf8");
  const functionBody = migration.match(
    /CREATE OR REPLACE FUNCTION public\.record_owned_phrase_usage[\s\S]*?\$function\$;/i,
  )?.[0] ?? "";

  assert.match(functionBody, /SECURITY DEFINER/i);
  assert.match(functionBody, /SET search_path = ''/i);
  assert.match(functionBody, /auth\.uid\(\)/i);
  assert.match(
    functionBody,
    /UPDATE public\.clinical_phrases[\s\S]*?usage_count = COALESCE\([\s\S]*?usage_count[\s\S]*?0\) \+ 1/i,
  );
  assert.match(functionBody, /phrase\.user_id = current_user_id/i);
  assert.match(
    functionBody,
    /INSERT INTO public\.phrase_usage_log\s*\(\s*user_id,\s*phrase_id,\s*patient_id,\s*target_field\s*\)/i,
  );
  assert.match(
    functionBody,
    /public\.patients[\s\S]*?patient\.id = p_patient_id[\s\S]*?patient\.user_id = current_user_id/i,
  );
  assert.doesNotMatch(functionBody, /p_input_values|p_inserted_content/i);
});

test("phrase usage RPC is callable only by authenticated browser users", () => {
  const migration = readFileSync(migrationPath, "utf8");

  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.record_owned_phrase_usage\(uuid, uuid, text\)\s+FROM PUBLIC, anon, authenticated/i,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.record_owned_phrase_usage\(uuid, uuid, text\)\s+TO authenticated/i,
  );
  assert.doesNotMatch(migration, /GRANT EXECUTE[\s\S]*?TO anon/i);
});
