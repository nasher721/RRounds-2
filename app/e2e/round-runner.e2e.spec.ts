/**
 * Today's Round Focus-first runner E2E
 *
 * Credential-gated (real Supabase). Without credentials, tests skip.
 * Run with:
 *   E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run test:e2e -- --grep "Round runner"
 *
 * Prefer enabling the runner shell: localStorage rr-round-runner=1 (default ON).
 */

import { test, expect } from "@playwright/test";
import { loginWithShell } from "./helpers";

test.describe("Round runner Focus-first path", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithShell(page, { roundRunner: true });
  });

  test("primary chrome has Tools + roster, not demoted megabar utilities", async ({ page }) => {
    const chrome = page.getByTestId("round-chrome");
    await expect(chrome).toBeVisible();
    await expect(chrome.getByTestId("round-tools-entry")).toBeVisible();
    await expect(chrome.getByTestId("round-roster-entry")).toBeVisible();

    await expect(chrome.getByText(/ibcc/i)).toHaveCount(0);
    await expect(chrome.getByRole("button", { name: /compare/i })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Open AI Clinical Assistant" }),
    ).toHaveCount(0);

    await chrome.getByTestId("round-tools-entry").click();
    const tools = page.getByTestId("tools-sheet");
    await expect(tools).toBeVisible({ timeout: 5_000 });
    await expect(tools.getByTestId("tools-ai")).toBeVisible();
    await expect(tools.getByTestId("tools-ibcc")).toBeVisible();
    await expect(tools.getByTestId("tools-compare")).toBeVisible();
  });

  test("roster overlay opens and closes without leaving Focus surface", async ({ page }) => {
    const shell = page.getByTestId("desktop-round-shell").or(page.getByTestId("mobile-round-shell"));
    await expect(shell).toHaveAttribute("data-round-surface", /focus|home/);

    // Ensure Focus surface when patients exist.
    const start = page.getByTestId("round-home-start");
    if (await start.isVisible().catch(() => false)) {
      await start.click();
    }

    await expect(page.getByTestId("patient-focus").or(page.getByTestId("patient-focus-empty"))).toBeVisible();

    await page.getByTestId("round-roster-entry").click();
    await expect(page.getByTestId("roster-overlay")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("roster-search")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("roster-overlay")).toBeHidden({ timeout: 5_000 });
  });

  test("walk next/prev/done across roster then reach End print", async ({ page }) => {
    const start = page.getByTestId("round-home-start");
    if (await start.isVisible().catch(() => false)) {
      await start.click();
    }

    const position = page.getByTestId("round-position");
    await expect(position).toBeVisible({ timeout: 15_000 });

    const positionText = (await position.textContent()) ?? "";
    const match = positionText.match(/Round · (\d+)\/(\d+)/);
    if (
      process.env.E2E_REQUIRE_FULL_SUITE === "1"
      && (!match || Number(match[2]) < 3)
    ) {
      throw new Error("Release E2E fixture must contain at least three patients");
    }
    test.skip(!match || Number(match[2]) < 3, "Seeded roster needs ≥3 patients for walk path");

    const total = Number(match![2]);
    expect(total).toBeGreaterThanOrEqual(3);

    await page.getByTestId("round-next").click();
    await expect(position).toContainText(`Round · 2/${total}`);

    await page.getByTestId("round-prev").click();
    await expect(position).toContainText(`Round · 1/${total}`);

    await page.getByTestId("round-done").click();
    await expect(position).toContainText(`Round · 2/${total}`);

    await page.getByTestId("round-end-entry").click();
    await expect(page.getByTestId("round-end")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("round-end-print")).toBeVisible();

    await page.getByTestId("round-end-print").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8_000 });
  });

  test("unresolved offline Todo blocks completion but preserves review and export", async ({
    page,
    context,
  }) => {
    test.setTimeout(90_000);
    const todoStamp = `RR-END-GUARD-${Date.now()}`;
    let offline = false;

    try {
      const start = page.getByTestId("round-home-start");
      if (await start.isVisible().catch(() => false)) {
        await start.click();
      }

      const todoInput = page.getByRole("textbox", { name: "New todo" });
      await expect(todoInput).toBeVisible({ timeout: 15_000 });
      await page.waitForFunction(() => performance
        .getEntriesByType("resource")
        .some((entry) => entry.name.includes("PrintExportModal")));

      await context.setOffline(true);
      offline = true;
      await expect(page.getByText("You are offline").first()).toBeVisible({ timeout: 15_000 });

      await todoInput.fill(todoStamp);
      await todoInput.press("Enter");
      await expect(page.getByText(todoStamp, { exact: true })).toBeVisible();
      await expect(page.getByText("Queued", { exact: true })).toBeVisible();

      await expect(page.getByTestId("round-done")).toBeDisabled();
      await expect(page.getByTestId("round-end-entry")).toBeEnabled();
      await page.getByTestId("round-end-entry").click({ timeout: 5_000 });

      const guard = page.getByTestId("round-completion-guard");
      await expect(guard).toContainText("Finish syncing before marking complete", { timeout: 5_000 });
      await expect(guard).toContainText("Print / Export remains available");
      await expect(page.getByTestId("round-end-complete")).toBeDisabled();
      await expect(page.getByTestId("round-end-print")).toBeEnabled();
      await page.getByTestId("round-end-print").click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
      await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      const screenshotPath = process.env.E2E_COMPLETION_GUARD_SCREENSHOT_PATH;
      if (screenshotPath) {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }

      await context.setOffline(false);
      offline = false;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(page.getByText("Queued", { exact: true })).toBeHidden({ timeout: 45_000 });
      await expect(page.getByTestId("round-completion-guard")).toBeHidden({ timeout: 45_000 });
      await expect(page.getByTestId("round-end-complete")).toBeEnabled();
    } finally {
      if (offline && !page.isClosed()) {
        await context.setOffline(false).catch(() => undefined);
      }
      if (!page.isClosed()) {
        await page.evaluate(() => window.dispatchEvent(new Event("online"))).catch(() => undefined);
        const backToFocus = page.getByRole("button", { name: "Back to patient Focus" });
        if (await backToFocus.isVisible().catch(() => false)) {
          await backToFocus.click();
        }
        const deleteButton = page.getByRole("button", { name: `Delete todo: ${todoStamp}` });
        if (await deleteButton.isVisible().catch(() => false)) {
          await deleteButton.click({ timeout: 5_000 }).catch(() => undefined);
          await expect(deleteButton).toBeHidden({ timeout: 20_000 });
        }
      }
    }
  });

  test("Round Home keeps Import Patient List first-class", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const goHome = page.getByTestId("round-go-home");
    if (await goHome.isVisible().catch(() => false)) {
      await goHome.click();
    } else {
      // Already on home when empty, or open via roster.
      await page.getByTestId("round-roster-entry").click();
      const rosterHome = page.getByTestId("roster-go-home");
      if (await rosterHome.isVisible().catch(() => false)) {
        await rosterHome.click();
      }
    }

    await expect(page.getByTestId("round-home")).toBeVisible({ timeout: 8_000 });
    const importButton = page.getByTestId("round-home-import");
    await expect(importButton).toBeVisible();
    await importButton.click();

    const importer = page.getByRole("dialog", { name: "Import Patient List" });
    await expect(importer).toBeVisible();
    await expect(importer.getByTestId("round-import-csv-tab")).toHaveAttribute("aria-selected", "true");
    await expect(importer.getByTestId("round-import-csv-tab")).toHaveCSS("min-height", "40px");
    await expect(importer.getByLabel("Or paste CSV content here:")).toBeVisible();

    await importer.getByTestId("round-import-document-tab").click();
    await expect(importer.getByRole("button", { name: "Upload patient list file" })).toBeVisible();
  });
});
