import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ownershipMigration = readFileSync(
  "supabase/migrations/20260711200000_harden_child_record_ownership.sql",
  "utf8",
);

test("patient child records require an authenticated owner and an owned parent", () => {
  for (const relation of ["patient_todos", "patient_field_history"]) {
    assert.match(
      ownershipMigration,
      new RegExp(`ON\\s+public\\.${relation}[\\s\\S]+?patient\\.id\\s*=\\s*patient_id[\\s\\S]+?patient\\.user_id\\s*=\\s*auth\\.uid\\(\\)`, "i"),
    );
  }

  assert.match(ownershipMigration, /WITH CHECK\s*\([\s\S]*patient\.user_id\s*=\s*auth\.uid\(\)/i);
  assert.match(ownershipMigration, /FOR UPDATE[\s\S]*USING[\s\S]*WITH CHECK/i);
});

test("phrase usage accepts metadata only for owned phrase and patient parents", () => {
  assert.match(
    ownershipMigration,
    /phrase_usage_log_metadata_only[\s\S]*CHECK\s*\(input_values IS NULL AND inserted_content IS NULL\)[\s\S]*NOT VALID/i,
  );
  assert.match(ownershipMigration, /phrase\.id\s*=\s*phrase_id[\s\S]*phrase\.user_id\s*=\s*auth\.uid\(\)/i);
  assert.match(ownershipMigration, /patient_id IS NULL[\s\S]*patient\.user_id\s*=\s*auth\.uid\(\)/i);

  const hookSource = readFileSync("src/hooks/useClinicalPhrases.ts", "utf8");
  assert.doesNotMatch(hookSource, /input_values:/);
  assert.doesNotMatch(hookSource, /inserted_content:/);
  assert.doesNotMatch(hookSource, /retainMemory/);
  assert.doesNotMatch(hookSource, /Inserted content:/);
  assert.match(ownershipMigration, /REVOKE SELECT, INSERT ON TABLE public\.phrase_usage_log FROM authenticated/i);
  assert.match(ownershipMigration, /GRANT SELECT\s*\([\s\S]*created_at[\s\S]*\) ON TABLE public\.phrase_usage_log TO authenticated/i);
  assert.doesNotMatch(
    ownershipMigration.match(/GRANT SELECT\s*\([\s\S]*?\) ON TABLE public\.phrase_usage_log TO authenticated/i)?.[0] ?? "",
    /input_values|inserted_content/i,
  );
});

test("phrase folders and phrases cannot reference another owner's hierarchy", () => {
  assert.match(
    ownershipMigration,
    /SECURITY DEFINER[\s\S]+?SET search_path = ''[\s\S]+?folder\.id\s*=\s*target_folder_id[\s\S]+?folder\.user_id\s*=\s*auth\.uid\(\)/i,
  );
  assert.match(
    ownershipMigration,
    /team_id IS NULL[\s\S]+?private\.can_manage_phrase_team\(team_id\)/i,
  );
  assert.match(
    ownershipMigration,
    /ON\s+public\.clinical_phrases[\s\S]+?folder_id IS NULL[\s\S]+?private\.is_owned_phrase_folder\(folder_id\)/i,
  );
  assert.match(ownershipMigration, /parent_id IS NULL[\s\S]+?private\.is_owned_phrase_folder\(parent_id\)/i);
  assert.match(
    ownershipMigration,
    /Owners can update nested phrase folders[\s\S]+?USING[\s\S]+?WITH CHECK/i,
  );
  assert.match(
    ownershipMigration,
    /Owners can update phrases in owned folders[\s\S]+?USING[\s\S]+?WITH CHECK/i,
  );
});
