/**
 * Backend contract rollout coverage.
 *
 * The roster projection includes fields introduced by the additive Supabase
 * migration. During a rolling deploy, an older API schema can reject that
 * projection once before the client retries with the legacy columns. This
 * test proves the user still receives a usable roster in either state.
 */

import { test, expect } from "@playwright/test";
import { loginWithShell } from "./helpers";

test.describe("Backend contract rollout", () => {
  test("patient roster remains usable across the additive schema rollout", async ({ page }) => {
    const patientReads: Array<{ status: number; select: string }> = [];
    page.on("response", (response) => {
      const request = response.request();
      const url = new URL(response.url());
      if (request.method() !== "GET" || url.pathname !== "/rest/v1/patients") return;
      patientReads.push({
        status: response.status(),
        select: url.searchParams.get("select") ?? "",
      });
    });

    await loginWithShell(page, { roundRunner: false });

    const rosterRows = page.locator('aside[aria-label="Patient list"] button[aria-label^="Select "]');
    await expect(rosterRows).toHaveCount(3, { timeout: 15_000 });

    expect(
      patientReads.some(({ status, select }) => status === 200 && select.includes("patient_number")),
      "an authenticated roster read must succeed even if the first projection is rejected",
    ).toBe(true);
  });
});
