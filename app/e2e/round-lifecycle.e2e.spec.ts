/**
 * Terminal Round lifecycle E2E (plan Phase 3, data-integrity matrix row 10).
 *
 * Credential-gated (real Supabase). Without credentials, tests skip.
 * Run with:
 *   E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run test:e2e -- --grep "Round lifecycle"
 *
 * This spec mutates the shared E2E account's Round continuity on purpose, so it
 * always starts a fresh Round again before finishing. It is named to sort ahead
 * of `round-runner`, whose walk path assumes an active Round at position 1.
 *
 * Evidence captured here feeds docs/qa/2026-08-12-data-integrity-matrix.md.
 */

import { test, expect, type Page } from "@playwright/test";
import { hasCredentials, loginWithShell } from "./helpers";

/** Log in to the Focus-first shell and wait for hydrated Round continuity. */
async function loginToRoundShell(page: Page): Promise<void> {
  test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set for Round lifecycle E2E");

  await loginWithShell(page, { roundRunner: true });
  const shell = page.getByTestId("desktop-round-shell").or(page.getByTestId("mobile-round-shell"));
  await expect(shell).toHaveAttribute("data-round-ready", "true", { timeout: 30_000 });
}

test.describe("Round lifecycle", () => {
  // Shares one real account and one Round continuity row.
  test.describe.configure({ mode: "serial" });

  // Data-integrity matrix row 10 (Terminal Round lifecycle): a completed Round
  // must survive a local reload and a brand-new browser profile as review-only
  // Round Home, and re-entering an editable Round must be an explicit
  // "Start New Round" action rather than an implicit resume.
  //
  // The remaining half of row 10 — a stale device reconnecting and trying to
  // complete over a newer active Round — is not automated here; see the matrix
  // note for why it stays manual.
  test("completed Round stays review-only after reload and in a new browser, and Start New Round is explicit", async ({
    browser,
  }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
    test.setTimeout(180_000);

    const context = await browser.newContext();
    const page = await context.newPage();
    let secondContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;

    try {
      await loginToRoundShell(page);

      const start = page.getByTestId("round-home-start");
      if (await start.isVisible().catch(() => false)) {
        await start.click();
      }
      await expect(page.getByTestId("patient-focus")).toBeVisible({ timeout: 20_000 });

      // Complete the Round from End Round.
      await page.getByTestId("round-end-entry").click();
      await expect(page.getByTestId("round-end")).toBeVisible({ timeout: 10_000 });
      const completeButton = page.getByTestId("round-end-complete");
      await expect(completeButton).toBeEnabled({ timeout: 60_000 });
      await completeButton.click();

      // Terminal state is immutable: no second "Mark Round complete".
      await expect(page.getByTestId("round-end-completed")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("round-end-complete")).toHaveCount(0);
      await expect(page.getByTestId("round-end-print")).toBeEnabled();

      // Round Home opens review-only with an explicit Start New Round boundary.
      await page.getByRole("button", { name: "Back to Round Home" }).click();
      await expect(page.getByTestId("round-home")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("round-home-start")).toHaveText("Start New Round");
      await expect(page.getByTestId("round-home-end")).toHaveCount(0);

      // Local reload: the terminal state survives and still opens on Home.
      await page.reload();
      const shell = page.getByTestId("desktop-round-shell").or(page.getByTestId("mobile-round-shell"));
      await expect(shell).toHaveAttribute("data-round-ready", "true", { timeout: 30_000 });
      await expect(shell).toHaveAttribute("data-round-surface", "home", { timeout: 20_000 });
      await expect(page.getByTestId("round-home-start")).toHaveText("Start New Round", { timeout: 20_000 });
      await expect(page.getByTestId("round-home-end")).toHaveCount(0);

      // New browser profile (no local storage): remote hydration must reach the
      // same review-only terminal state, not a resumable active Round.
      secondContext = await browser.newContext();
      const freshPage = await secondContext.newPage();
      await loginToRoundShell(freshPage);
      const freshShell = freshPage
        .getByTestId("desktop-round-shell")
        .or(freshPage.getByTestId("mobile-round-shell"));
      await expect(freshShell).toHaveAttribute("data-round-surface", "home", { timeout: 30_000 });
      await expect(freshPage.getByTestId("round-home")).toBeVisible({ timeout: 20_000 });
      await expect(freshPage.getByTestId("round-home-start")).toHaveText("Start New Round", {
        timeout: 20_000,
      });
      await expect(freshPage.getByTestId("round-home-end")).toHaveCount(0);
    } finally {
      // Leave the shared account on a fresh active Round so the round-runner
      // walk path still starts at position 1.
      if (!page.isClosed()) {
        const goHome = page.getByTestId("round-go-home");
        if (await goHome.isVisible().catch(() => false)) {
          await goHome.click();
        }
        const restart = page.getByTestId("round-home-start");
        if (await restart.isVisible().catch(() => false)) {
          await restart.click();
          await expect(page.getByTestId("round-position")).toContainText("Round · 1/", {
            timeout: 30_000,
          });
        }
      }
      if (secondContext) await secondContext.close();
      await context.close();
    }
  });
});
