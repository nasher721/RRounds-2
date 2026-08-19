/**
 * Dashboard Layout E2E Tests
 *
 * Credential-gated because the authenticated workspace renders from `/`.
 * Run with: E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run test:e2e -- --grep "Dashboard"
 */

import { test, expect } from "@playwright/test";
import { loginWithShell } from "./helpers";

test.describe("Dashboard Panel Collapse", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithShell(page, { roundRunner: false });
  });

  test("collapse and expand panel controls update shell state", async ({ page }) => {
    const dashboard = page.getByTestId("dashboard");
    await expect(dashboard).toHaveAttribute("data-left-panel-collapsed", "false");

    await page.getByRole("button", { name: /collapse patient list/i }).click();
    await expect(dashboard).toHaveAttribute("data-left-panel-collapsed", "true");

    await page.getByRole("button", { name: /expand patient list/i }).click();
    await expect(dashboard).toHaveAttribute("data-left-panel-collapsed", "false");
  });

  test("panel state persists after reload", async ({ page }) => {
    await page.getByRole("button", { name: /collapse patient list/i }).click();
    await expect(page.getByTestId("dashboard")).toHaveAttribute("data-left-panel-collapsed", "true");

    await page.reload();
    await expect(page.getByTestId("dashboard")).toHaveAttribute("data-left-panel-collapsed", "true");
  });
});

test.describe("Focus Mode", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithShell(page, { roundRunner: false });
  });

  test("clicking clinical summary enters focus mode and Escape exits", async ({ page }) => {
    const dashboard = page.getByTestId("dashboard");
    await page.locator('[data-editor-type="clinical-summary"]').first().click();

    await expect(dashboard).toHaveAttribute("data-focus-mode", "true");

    await page.keyboard.press("Escape");
    await expect(dashboard).toHaveAttribute("data-focus-mode", "false");
  });
});

test.describe("Dashboard Controls", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithShell(page, { roundRunner: false });
  });

  test("core command surfaces remain reachable", async ({ page }) => {
    await expect(page.getByLabel(/search patients/i)).toBeVisible();

    await page.getByRole("button", { name: /filter and sort patients/i }).click();
    await expect(page.getByRole("menuitemradio", { name: /with notes/i })).toBeVisible();
    // Dismiss the menu before continuing: Radix's modal dropdown overlay
    // otherwise swallows the next pointer click.
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /open workspace tools/i }).click();
    await expect(page.getByRole("tab", { name: /resources/i })).toBeVisible();

    await page.getByRole("button", { name: /print/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
  });
});
