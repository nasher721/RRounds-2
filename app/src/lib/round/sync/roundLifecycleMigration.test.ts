import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../../../supabase/migrations/20260813030000_guard_round_lifecycle_generations.sql", import.meta.url),
  "utf8",
);

test("Round persistence addresses an exact lifecycle generation", () => {
  assert.match(migration, /target_state\.status = 'completed'[\s\S]*p_status = 'active'/i);
  assert.match(migration, /active_state\.id <> p_round_id[\s\S]*p_status = 'active'/i);
  assert.match(migration, /WHERE user_id = auth\.uid\(\)[\s\S]*AND id = p_round_id/i);
  assert.doesNotMatch(
    migration,
    /UPDATE public\.round_state[\s\S]*WHERE id = active_state\.id/i,
    "a delayed old-Round write must never update whichever active generation was found",
  );
});
