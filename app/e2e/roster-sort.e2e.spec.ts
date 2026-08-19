/**
 * Roster Sort Order E2E Tests
 *
 * Credential-gated because the authenticated workspace renders from `/`.
 * Run with: E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run test:e2e -- --grep "Roster sort"
 *
 * Asserts the PatientRosterRail sort dropdown actually re-orders the rendered
 * patient rows. Seeded e2e roster on e2e-round-runner@roundrobin.local
 * (patient_number / name / bed):
 *   2 · E2E Alpha   · Z-9
 *   3 · E2E Bravo   · A-1
 *   1 · E2E Charlie · M-5
 * Beds, names, and numbers are deliberately scrambled so each sort key yields
 * a distinct order.
 */

import { test, expect, type Page } from "@playwright/test";
import { loginWithShell } from "./helpers";

const BY_ROOM = ["E2E Bravo", "E2E Charlie", "E2E Alpha"]; // A-1 < M-5 < Z-9 (app default: DEFAULT_SORT_BY = 'room')
const ORDER_ADDED = ["E2E Charlie", "E2E Alpha", "E2E Bravo"]; // patient_number 1 < 2 < 3
const BY_NAME = ["E2E Alpha", "E2E Bravo", "E2E Charlie"];

/** Visible roster row names, top to bottom (robust to virtualization). */
async function visibleRosterNames(page: Page): Promise<string[]> {
  const rows = page.locator('aside[aria-label="Patient list"] button[aria-label^="Select "]');
  const labels = await rows.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute("aria-label") ?? ""),
  );
  return labels.map((label) => label.replace(/^Select /, "").split(",")[0].trim());
}

async function chooseSort(page: Page, option: string) {
  await page.getByRole("button", { name: /filter and sort patients/i }).click();
  await page.getByRole("menuitemradio", { name: option }).click();
}

test.describe("Roster sort order", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithShell(page, { roundRunner: false });
    // Wait for the seeded roster to load before asserting order.
    await expect(
      page.locator('aside[aria-label="Patient list"] button[aria-label^="Select "]'),
    ).toHaveCount(3, { timeout: 15_000 });
  });

  test("room, order-added, and name sorting re-order rows", async ({ page }) => {
    // Sort choice is intentionally persisted, so establish the first mode
    // instead of coupling this contract to the test account's prior run.
    await chooseSort(page, "Room");
    await expect.poll(() => visibleRosterNames(page)).toEqual(BY_ROOM);

    await chooseSort(page, "Order added");
    await expect.poll(() => visibleRosterNames(page)).toEqual(ORDER_ADDED);

    await chooseSort(page, "Name");
    await expect.poll(() => visibleRosterNames(page)).toEqual(BY_NAME);

    // Restore the default so persisted prefs can't leak into other specs.
    await chooseSort(page, "Room");
    await expect.poll(() => visibleRosterNames(page)).toEqual(BY_ROOM);
  });
});
