import { createClient } from "@supabase/supabase-js";

const FIXTURE_SUMMARIES = new Map([
  ["E2E Alpha", "E2E seed patient A"],
  ["E2E Bravo", "E2E seed patient B"],
  ["E2E Charlie", "E2E seed patient C"],
]);

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Full E2E fixture reset requires ${name}`);
  return value;
};

/**
 * Reset only the dedicated, synthetic E2E account. The full release suite
 * mutates summaries and Round continuity on purpose; setup and teardown both
 * restore a deterministic baseline so failed and repeated runs do not grow
 * fixture data indefinitely.
 */
export async function resetFullSuiteFixture(phase: "setup" | "teardown"): Promise<void> {
  if (process.env.E2E_REQUIRE_FULL_SUITE !== "1") return;

  const url = requiredEnv("VITE_SUPABASE_URL");
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.VITE_SUPABASE_ANON_KEY?.trim()
    || requiredEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  const email = requiredEnv("E2E_TEST_EMAIL");
  const password = requiredEnv("E2E_TEST_PASSWORD");
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: auth, error: authError } = await client.auth.signInWithPassword({ email, password });
  if (authError || !auth.user) {
    throw new Error(`Could not authenticate the full E2E fixture: ${authError?.message ?? "missing user"}`);
  }

  try {
    const fixtureNames = [...FIXTURE_SUMMARIES.keys()];
    const { data: patients, error: patientError } = await client
      .from("patients")
      .select("id,name,user_id")
      .eq("user_id", auth.user.id)
      .in("name", fixtureNames);
    if (patientError) throw new Error(`Could not inspect the full E2E fixture: ${patientError.message}`);

    const byName = new Map((patients ?? []).map((patient) => [patient.name, patient]));
    if (byName.size !== FIXTURE_SUMMARIES.size || (patients?.length ?? 0) !== FIXTURE_SUMMARIES.size) {
      throw new Error("Full E2E fixture must contain exactly one E2E Alpha, Bravo, and Charlie patient");
    }

    for (const [name, clinicalSummary] of FIXTURE_SUMMARIES) {
      const patient = byName.get(name);
      if (!patient || patient.user_id !== auth.user.id) {
        throw new Error(`Full E2E fixture ownership mismatch for ${name}`);
      }
      const { data: updated, error: updateError } = await client
        .from("patients")
        .update({ clinical_summary: clinicalSummary })
        .eq("id", patient.id)
        .eq("user_id", auth.user.id)
        .select("id");
      if (updateError || updated?.length !== 1) {
        throw new Error(`Could not reset ${name}: ${updateError?.message ?? "row not updated"}`);
      }
    }

    const { error: roundStateError } = await client
      .from("round_state")
      .delete()
      .eq("user_id", auth.user.id);
    if (roundStateError) {
      throw new Error(`Could not reset E2E Round continuity: ${roundStateError.message}`);
    }

    process.stdout.write(`Full E2E fixture ${phase} reset: 3 synthetic patients and Round continuity.\n`);
  } finally {
    await client.auth.signOut();
  }
}
