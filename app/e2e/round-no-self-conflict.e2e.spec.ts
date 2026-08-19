/**
 * Round-runner editing regression: typing in the Focus shell must NOT raise
 * conflict UI. The Focus handlers used to dual-write every keystroke through
 * both updatePatient (revision-guarded) and the draft_field outbox; the two
 * writers raced and each flagged the other as a same-field conflict, popping
 * the Mine/Theirs/merge dialog on nearly every keystroke.
 *
 * Credential-gated (real Supabase). Without credentials, tests skip.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  deleteEditorMarker,
  loginWithShell,
  waitForPatientSave,
} from "./helpers";

async function loginToRoundRunner(page: Page) {
  await loginWithShell(page, { roundRunner: true });

  await page.getByTestId("round-roster-entry").click();
  const roster = page.getByTestId("roster-overlay");
  await expect(roster).toBeVisible({ timeout: 5_000 });
  await roster.getByRole("button", { name: /^E2E Charlie, bed / }).click();

  await expect(page.getByTestId("patient-focus")).toBeVisible({ timeout: 20_000 });
}

async function openSummaryEditor(page: Page): Promise<Locator> {
  const editor = page
    .getByTestId("patient-focus")
    .locator('[contenteditable="true"]')
    .first();
  if (!await editor.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /Clinical summary/i }).first().click();
  }
  await expect(editor).toBeVisible({ timeout: 15_000 });
  return editor;
}

test.describe("Round runner editing", () => {
  test("typing in a Focus editor never raises self-conflict UI", async ({ page }) => {
    test.setTimeout(150_000);

    await loginToRoundRunner(page);

    // The conflict dialog ("Resolve" / Mine-Theirs-merge) and the conflict
    // toast are the two surfaces the bug appeared on.
    const conflictDialog = page.getByRole("dialog").filter({ hasText: /conflict/i });
    const conflictToast = page.getByText(/Save conflict/i);

    let editor = await openSummaryEditor(page);
    const originalHtml = await editor.evaluate((node) => node.innerHTML);
    const stamp = `ROUND ${new Date().toISOString()}`;

    try {
      await editor.click();
      await page.keyboard.press("End");

      // Type with human-ish pacing so both write paths interleave per keystroke.
      await waitForPatientSave(page, async () => {
        for (const ch of ` ${stamp}`) {
          await page.keyboard.type(ch, { delay: 120 });
        }
      }, { requireSavedStatus: false });

      // Give the drain loop time to process every queued keystroke write.
      await page.waitForTimeout(6_000);

      await expect(conflictDialog).toHaveCount(0);
      await expect(conflictToast).toHaveCount(0);

      // Truth check: the typed content persists after a reload.
      await page.reload();
      await expect(page.getByTestId("patient-focus")).toBeVisible({ timeout: 20_000 });
      editor = await openSummaryEditor(page);
      await expect(editor).toContainText(stamp, { timeout: 15_000 });
    } finally {
      await page.reload();
      await expect(page.getByTestId("patient-focus")).toBeVisible({ timeout: 20_000 });
      editor = await openSummaryEditor(page);
      if (!await deleteEditorMarker(page, editor, stamp, { requireSavedStatus: false })) {
        await expect.poll(() => editor.evaluate((node) => node.innerHTML)).toBe(originalHtml);
      }
      await page.reload();
      await expect(page.getByTestId("patient-focus")).toBeVisible({ timeout: 20_000 });
      editor = await openSummaryEditor(page);
      await expect.poll(() => editor.evaluate((node) => node.innerHTML)).toBe(originalHtml);
    }
  });
});
