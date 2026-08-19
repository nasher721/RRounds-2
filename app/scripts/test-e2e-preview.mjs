#!/usr/bin/env node
/**
 * One-command local release-mode E2E run:
 *   npm run test:e2e:preview [-- <playwright args>]
 *
 * Steps:
 *   1. Resets the E2E test user's Round continuity (owner-scoped DELETE on
 *      public.round_state via PostgREST) so the round-runner walk path starts
 *      at a fresh round instead of resuming a stale one from a previous run.
 *   2. Builds the production bundle. Crawl assets (robots.txt, sitemap.xml,
 *      llms.txt), hashed lazy chunks (e.g. ibccContent-*, PrintExportModal-*),
 *      and the service worker only exist in this bundle, so auth-dashboard,
 *      data-integrity, and round-runner chunk assertions cannot pass against
 *      the dev server.
 *   3. Runs the Chromium suite with E2E_USE_PREVIEW=1 (same mode as CI).
 *
 * Reads .env / .env.local like playwright.config.ts. Never prints secrets.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch { /* file absent */ }
}
loadEnvFile(".env");
loadEnvFile(".env.local");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function resetRoundContinuity() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!SUPABASE_URL || !ANON_KEY || !email || !password) {
    console.log("[e2e-preview] E2E credentials not set; skipping round-state reset (credential-gated tests will skip).");
    return;
  }
  const signin = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!signin.ok) {
    console.warn(`[e2e-preview] E2E sign-in failed (HTTP ${signin.status}); round state NOT reset.`);
    return;
  }
  const { access_token: token, user } = await signin.json();
  if (!token || !user?.id) {
    console.warn("[e2e-preview] E2E sign-in returned no token; round state NOT reset.");
    return;
  }
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/round_state?user_id=eq.${user.id}`,
    {
      method: "DELETE",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) {
    console.warn(`[e2e-preview] round_state reset failed (HTTP ${res.status}); continuing anyway.`);
    return;
  }
  console.log("[e2e-preview] Round continuity reset for the E2E test user.");
}

// Defaults for a local release bundle; real values are only required in CI/Vercel.
process.env.VITE_PUBLIC_APP_URL ??= "https://rounds.hospital.org";
process.env.VITE_SESSION_IDLE_TIMEOUT_SECONDS ??= "1800";
process.env.VITE_TELEMETRY_INGEST_URL ??=
  SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/telemetry` : undefined;

await resetRoundContinuity();

console.log("[e2e-preview] Building production bundle...");
const build = spawnSync("npm", ["run", "build"], { stdio: "inherit", env: process.env });
if (build.status !== 0) process.exit(build.status ?? 1);

const extraArgs = process.argv.slice(2).filter((a) => a !== "--");
console.log("[e2e-preview] Running Chromium suite against the production preview...");
const run = spawnSync(
  "npx",
  ["playwright", "test", "--project=chromium", ...extraArgs],
  { stdio: "inherit", env: { ...process.env, E2E_USE_PREVIEW: "1" } },
);
process.exit(run.status ?? 1);
