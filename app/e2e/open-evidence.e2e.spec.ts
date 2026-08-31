/**
 * Open Evidence integration E2E
 *
 * Credential-gated (real Supabase). Without credentials, tests skip.
 * Run with:
 *   E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run test:e2e -- --grep "Open Evidence"
 */

import { test, expect } from "@playwright/test";
import { loginWithShell, firstSummaryEditor } from "./helpers";

async function selectAllTextIn(page: import("@playwright/test").Page, locator: import("@playwright/test").Locator) {
  await locator.click();
  await page.keyboard.press("Control+A");
}

test.describe("Open Evidence — Round runner shell", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithShell(page, { roundRunner: true });
  });

  test("Tools sheet exposes Open Evidence and opens the search panel", async ({ page }) => {
    await page.getByTestId("round-tools-entry").click();
    const tools = page.getByTestId("tools-sheet");
    await expect(tools).toBeVisible({ timeout: 5_000 });

    const openEvidenceRow = tools.getByTestId("tools-open-evidence");
    await expect(openEvidenceRow).toBeVisible();
    await openEvidenceRow.click();

    // Clicking the row closes the sheet and opens the Open Evidence overlay panel.
    await expect(tools).toBeHidden({ timeout: 5_000 });
    const panel = page.getByRole("dialog", { name: "Open Evidence" });
    await expect(panel).toBeVisible({ timeout: 5_000 });
    await expect(panel.getByLabel(/search open evidence/i)).toBeVisible();
  });

  test("submitting a query in the Open Evidence panel opens openevidence.com in a new tab", async ({ page }) => {
    await page.getByTestId("round-tools-entry").click();
    await page.getByTestId("tools-sheet").getByTestId("tools-open-evidence").click();

    const panel = page.getByRole("dialog", { name: "Open Evidence" });
    await expect(panel).toBeVisible({ timeout: 5_000 });

    await panel.getByLabel(/search open evidence/i).fill("tranexamic acid trauma bleeding");
    const popupPromise = page.waitForEvent("popup");
    await panel.getByRole("button", { name: /^search open evidence$/i }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded").catch(() => undefined);

    expect(popup.url()).toContain("openevidence.com/search");
    expect(popup.url()).toContain("tranexamic+acid+trauma+bleeding");
    await popup.close();
  });

  test("Ctrl+E toggles the Open Evidence panel", async ({ page }) => {
    const panel = page.getByRole("dialog", { name: "Open Evidence" });
    await expect(panel).toBeHidden();

    await page.keyboard.press("Control+E");
    await expect(panel).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden({ timeout: 5_000 });
  });

  test("highlighting text in the note editor quietly surfaces an Open Evidence popover", async ({ page }) => {
    const editor = firstSummaryEditor(page);
    await editor.click();
    await page.keyboard.type("Discussed norepinephrine first line for septic shock per guidelines.");

    const popoverButton = page.getByRole("button", { name: /search open evidence for/i });
    await expect(popoverButton).toBeHidden();

    await selectAllTextIn(page, editor);
    await expect(popoverButton).toBeVisible({ timeout: 5_000 });

    const popupPromise = page.waitForEvent("popup");
    await popoverButton.click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded").catch(() => undefined);

    expect(popup.url()).toContain("openevidence.com/search");
    await popup.close();

    // Clicking collapses the selection, so the quiet popover disappears again.
    await expect(popoverButton).toBeHidden({ timeout: 5_000 });
  });
});

test.describe("Open Evidence — classic dashboard shell", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithShell(page, { roundRunner: false });
  });

  test("Resources tab in the Tools menu offers an Open Evidence search", async ({ page }) => {
    await page.getByRole("button", { name: /open workspace tools/i }).click();
    await expect(page.getByRole("tab", { name: /resources/i })).toBeVisible();
    await page.getByRole("tab", { name: /resources/i }).click();

    await page.getByRole("tab", { name: "Open Evidence" }).click();
    const searchInput = page.getByLabel(/search open evidence/i);
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    await searchInput.fill("DOAC vs warfarin in AFib");
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: /^search open evidence$/i }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded").catch(() => undefined);

    expect(popup.url()).toContain("openevidence.com/search");
    expect(popup.url()).toContain("DOAC+vs+warfarin+in+AFib");
    await popup.close();
  });
});
