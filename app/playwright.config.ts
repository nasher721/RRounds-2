import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Load local env files for credential-gated E2E without adding a dotenv dependency.
 * Existing process.env wins (CI secrets / shell exports).
 */
const loadEnvFile = (fileName: string): void => {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
};

loadEnvFile(".env");
loadEnvFile(".env.local");

const requireFullSuite = process.env.E2E_REQUIRE_FULL_SUITE === "1";
const requireSynthetic = process.env.E2E_REQUIRE_SYNTHETIC === "1";
if (
  (requireFullSuite || requireSynthetic)
  && (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD)
) {
  throw new Error(
    "Release E2E requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD",
  );
}

/**
 * Playwright E2E config for Round Robin Notes.
 * Run: npm run test:e2e (or npx playwright test)
 * For login flow, set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (real Supabase required).
 * Set E2E_PORT when 8080 is occupied by another local service. Existing
 * servers are reused only with E2E_REUSE_SERVER=1 so a port collision cannot
 * silently run this suite against an unrelated application.
 * @see e2e/README.md
 */
const e2ePort = process.env.E2E_PORT ?? "8080";
const externalBaseURL = process.env.E2E_BASE_URL?.trim();
if (requireSynthetic) {
  if (!externalBaseURL) {
    throw new Error("E2E_REQUIRE_SYNTHETIC=1 requires E2E_BASE_URL");
  }
  if (new URL(externalBaseURL).protocol !== "https:") {
    throw new Error("Production synthetic E2E_BASE_URL must use HTTPS");
  }
}
const e2eBaseURL = externalBaseURL || `http://localhost:${e2ePort}`;
const reuseExistingServer = process.env.E2E_REUSE_SERVER === "1";
const useProductionPreview = process.env.E2E_USE_PREVIEW === "1";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // All credential-gated specs share one real Supabase account and roster;
  // parallel workers make their writes conflict with each other.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [
        ["github"],
        ["./e2e/no-skipped-reporter.ts"],
      ]
    : [
        ["html"],
        ["./e2e/no-skipped-reporter.ts"],
      ],
  use: {
    baseURL: e2eBaseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /production-save-canary\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit",
      testIgnore: /production-save-canary\.spec\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "synthetic-chromium",
      testMatch: /production-save-canary\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: externalBaseURL ? undefined : {
    command: useProductionPreview
      ? `npm run preview -- --port ${e2ePort} --strictPort`
      : `npm run dev -- --port ${e2ePort} --strictPort`,
    url: e2eBaseURL,
    reuseExistingServer,
    timeout: 60_000,
  },
});
