/**
 * Standalone browser smoke test for Round Robin Notes.
 *
 * Scope: screens reachable WITHOUT Supabase auth credentials (no demo/mock
 * mode exists in this app). Verifies the landing page, auth page + its
 * client-side validation and failed-login error surface, static legal pages,
 * the global focus-first motion policy as computed styles, and collects
 * console errors / page errors across all flows.
 *
 * Usage: dev server must be running on :8080, then `node scripts/smoke-docs-interface.mjs`
 * NOT part of the e2e suite (e2e/).
 */
import { chromium } from "@playwright/test";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:8080";

const consoleErrors = [];
const pageErrors = [];
let failures = 0;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  PASS ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(`[${page.url()}] ${msg.text()}`);
});
page.on("pageerror", (err) => pageErrors.push(`[${page.url()}] ${err.message}`));

console.log("\n== Landing page (/) ==");
await page.goto(BASE + "/", { waitUntil: "networkidle" });
const heading = await page.locator("h1, h2").first().textContent().catch(() => null);
check("landing renders a heading", Boolean(heading && heading.trim()), `got: ${heading}`);
check(
  "landing shows a sign-in / get-started entry point",
  (await page.getByRole("link", { name: /sign in|get started|log in/i }).count()) > 0 ||
    (await page.getByRole("button", { name: /sign in|get started|log in/i }).count()) > 0,
);

console.log("\n== Auth page (/auth) ==");
await page.goto(BASE + "/auth", { waitUntil: "networkidle" });
check(
  "welcome heading visible",
  await page.getByRole("heading", { name: /welcome back/i }).isVisible(),
);
check("email field visible", await page.getByLabel(/email/i).isVisible());
check("password field visible", await page.locator("#password").isVisible());
const signInBtn = page.getByRole("button", { name: "Sign in", exact: true });
check("sign-in button visible", await signInBtn.isVisible());

// Focus-first motion policy, verified as computed styles in a real browser.
const emailInput = page.getByLabel(/email/i);
await emailInput.focus();
const motion = await emailInput.evaluate((el) => {
  const cs = getComputedStyle(el);
  return { transitionDuration: cs.transitionDuration, animationDuration: cs.animationDuration, boxShadow: cs.boxShadow };
});
check(
  "focused input has static (0.01ms) transition duration",
  motion.transitionDuration.split(",").every((d) => parseFloat(d) <= 0.01),
  `got transition-duration: ${motion.transitionDuration}`,
);
check(
  "focused input keeps a visible focus ring (box-shadow)",
  motion.boxShadow !== "none" && motion.boxShadow !== "",
  `got box-shadow: ${motion.boxShadow}`,
);

// Client-side validation: submit empty.
await signInBtn.click();
await page.waitForTimeout(500);
check(
  "empty submit does not navigate away from /auth",
  page.url().includes("/auth"),
  `url: ${page.url()}`,
);

// Failed login surfaces an error (hits real Supabase once with fake creds).
// Error is delivered via the shadcn toaster ("Login failed" / "Authentication error");
// toasts auto-dismiss after ~7s, so poll for the toast text itself.
await emailInput.fill("smoke-test@invalid.example");
await page.locator("#password").fill("not-a-real-password-123");
await signInBtn.click();
let errorShown = true;
try {
  await page.waitForFunction(
    () => /login failed|authentication error|something went wrong/i.test(document.body.innerText),
    undefined,
    { timeout: 15_000 },
  );
} catch {
  errorShown = false;
}
check("failed login surfaces an error message", errorShown);
check("still on /auth after failed login", page.url().includes("/auth"), `url: ${page.url()}`);

console.log("\n== Static pages ==");
await page.goto(BASE + "/privacy", { waitUntil: "networkidle" });
check("/privacy renders content", (await page.locator("main, body").first().textContent())?.length > 200);
await page.goto(BASE + "/security", { waitUntil: "networkidle" });
check("/security renders content", (await page.locator("main, body").first().textContent())?.length > 200);

console.log("\n== Unknown route ==");
await page.goto(BASE + "/definitely-not-a-route", { waitUntil: "networkidle" });
check("unknown route renders 404 page", await page.getByText(/404|not found/i).first().isVisible().catch(() => false));

console.log("\n== Console / page errors ==");
const benign = /supabase|favicon|Download the React DevTools|future flag|api_error|Failed to load resource/i;
const realConsoleErrors = consoleErrors.filter((e) => !benign.test(e));
check("no page errors (uncaught exceptions)", pageErrors.length === 0, pageErrors.join(" | "));
check("no console errors on reachable screens", realConsoleErrors.length === 0, realConsoleErrors.join(" | "));
if (consoleErrors.length > realConsoleErrors.length) {
  console.log(`  (filtered ${consoleErrors.length - realConsoleErrors.length} benign console messages)`);
}

await browser.close();
console.log(`\n${failures === 0 ? "SMOKE OK" : `SMOKE FAILURES: ${failures}`}\n`);
process.exit(failures === 0 ? 0 : 1);
