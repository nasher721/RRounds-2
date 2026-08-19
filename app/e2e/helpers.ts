/**
 * Shared E2E helpers. All specs here run against one real Supabase account,
 * so they share login flow and must agree on which shell is active: the
 * Focus-first Round runner is default ON, while older specs assert classic
 * dashboard chrome.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";

export const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
export const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
export const hasCredentials = Boolean(E2E_EMAIL && E2E_PASSWORD);

export function requireCredentials() {
  test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
}

/**
 * Log in and land on the app with the requested shell.
 * roundRunner=true keeps the Focus-first shell; false pins the classic
 * dashboard via the rr-round-runner localStorage flag.
 */
export async function loginWithShell(page: Page, options: { roundRunner: boolean }) {
  requireCredentials();

  await page.addInitScript((roundRunner) => {
    window.localStorage.setItem("rr-round-runner", roundRunner ? "1" : "0");
  }, options.roundRunner);
  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(E2E_EMAIL!);
  await page.locator("#password").fill(E2E_PASSWORD!);
  const roundHydration = options.roundRunner
    ? page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.request().method() === "GET"
          && url.pathname === "/rest/v1/round_state";
      }, { timeout: 30_000 })
    : null;
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);

  if (options.roundRunner) {
    await expect(
      page.getByTestId("desktop-round-shell").or(page.getByTestId("mobile-round-shell")),
    ).toBeVisible({ timeout: 20_000 });
    const response = await roundHydration!;
    expect(response.ok(), `Round hydration returned HTTP ${response.status()}`).toBe(true);
  } else {
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
  }
}

export const firstSummaryEditor = (page: Page): Locator =>
  page.locator('[data-editor-type="clinical-summary"]').first();

export async function selectClassicPatient(page: Page, patientName: string): Promise<Locator> {
  const expandRoster = page.getByRole("button", { name: "Expand patient list" });
  if (await expandRoster.isVisible().catch(() => false)) {
    await expandRoster.click();
  }

  const row = page.locator(
    `aside[aria-label="Patient list"] button[aria-label^="Select ${patientName},"]`,
  );
  await expect(row).toHaveCount(1, { timeout: 20_000 });
  await row.click();

  const editor = firstSummaryEditor(page);
  await expect(editor).toBeVisible({ timeout: 20_000 });
  return editor;
}

export async function waitForPatientSave(
  page: Page,
  action: () => Promise<void>,
  options: { requireSavedStatus?: boolean } = {},
): Promise<void> {
  const savedResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "PATCH"
      && url.pathname === "/rest/v1/patients";
  }, { timeout: 30_000 });

  await action();

  const response = await savedResponse;
  expect(response.ok(), `patient save returned HTTP ${response.status()}`).toBe(true);
  const payload = await response.json().catch(() => null) as unknown;
  if (Array.isArray(payload)) {
    expect(payload.length, "patient save matched no revision-guarded row").toBeGreaterThan(0);
  }
  if (options.requireSavedStatus !== false) {
    await expect(
      page.getByRole("status").filter({ hasText: /^Saved/ }).first(),
    ).toBeVisible({ timeout: 20_000 });
  }
}

export async function appendEditorMarker(
  page: Page,
  editor: Locator,
  marker: string,
  delay = 20,
): Promise<void> {
  await editor.click();
  await page.keyboard.press("End");
  await waitForPatientSave(page, () => page.keyboard.type(` ${marker}`, { delay }));
}

export async function deleteEditorMarker(
  page: Page,
  editor: Locator,
  marker: string,
  options: { requireSavedStatus?: boolean } = {},
): Promise<boolean> {
  const selected = await editor.evaluate((node, target) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      const content = textNode.textContent ?? "";
      const markerIndex = content.indexOf(target);
      if (markerIndex >= 0) {
        const range = document.createRange();
        const parent = textNode.parentElement;
        if (parent && parent !== node && parent.textContent?.trim() === target) {
          range.selectNode(parent);
        } else {
          const leadingSpace = markerIndex > 0 && content[markerIndex - 1] === " " ? 1 : 0;
          range.setStart(textNode, markerIndex - leadingSpace);
          range.setEnd(textNode, markerIndex + target.length);
        }
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        (node as HTMLElement).focus();
        return true;
      }
      textNode = walker.nextNode();
    }
    return false;
  }, marker);

  if (!selected) return false;
  await waitForPatientSave(page, () => page.keyboard.press("Backspace"), options);
  return true;
}
