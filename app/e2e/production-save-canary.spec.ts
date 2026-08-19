import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  appendEditorMarker,
  deleteEditorMarker,
  loginWithShell,
  selectClassicPatient,
} from "./helpers";

const SYNTHETIC_PATIENT_NAME = "E2E Alpha";

const selectSyntheticPatient = (page: Page): Promise<Locator> =>
  selectClassicPatient(page, SYNTHETIC_PATIENT_NAME);

async function removeOrphanedMarkers(page: Page, editor: Locator): Promise<void> {
  for (let attempts = 0; attempts < 5; attempts += 1) {
    const text = await editor.textContent() ?? "";
    const staleMarker = text.match(/RR-SYNTHETIC-\d+/)?.[0];
    if (!staleMarker) return;
    if (!await deleteEditorMarker(page, editor, staleMarker)) {
      throw new Error("Could not select an orphaned synthetic marker for cleanup");
    }
  }
  throw new Error("Too many orphaned synthetic markers; refusing an unbounded cleanup");
}

test("production save canary persists and restores the synthetic patient summary", async ({ page }) => {
  test.setTimeout(120_000);
  expect(process.env.E2E_REQUIRE_SYNTHETIC).toBe("1");

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.name || "Error"));

  await loginWithShell(page, { roundRunner: false });
  let editor = await selectSyntheticPatient(page);
  // A cancelled runner should not happen, but scrub orphaned markers before
  // proceeding so the monitor self-heals after runner infrastructure failure.
  await removeOrphanedMarkers(page, editor);
  await page.reload();
  await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
  editor = await selectSyntheticPatient(page);
  const originalHtml = await editor.evaluate((node) => node.innerHTML);
  const stamp = `RR-SYNTHETIC-${Date.now()}`;
  let mutationAttempted = false;

  try {
    mutationAttempted = true;
    await appendEditorMarker(page, editor, stamp);

    await page.reload();
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
    editor = await selectSyntheticPatient(page);
    await expect(editor).toContainText(stamp, { timeout: 20_000 });
    // Let the remote roster refresh settle, then prove a second cold read still
    // contains the marker rather than a transient optimistic/cache value.
    await page.waitForTimeout(2_000);
    await page.reload();
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
    editor = await selectSyntheticPatient(page);
    await expect(editor).toContainText(stamp, { timeout: 20_000 });
    expect(pageErrors).toEqual([]);
  } finally {
    if (mutationAttempted) {
      await page.reload();
      await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
      editor = await selectSyntheticPatient(page);
      if (!await deleteEditorMarker(page, editor, stamp)) {
        await expect.poll(() => editor.evaluate((node) => node.innerHTML)).toBe(originalHtml);
      }

      await page.reload();
      await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
      editor = await selectSyntheticPatient(page);
      await expect.poll(() => editor.evaluate((node) => node.innerHTML)).toBe(originalHtml);
    }
  }
});
