import { expect, test, type Locator, type Page } from "@playwright/test";
import { loginWithShell } from "./helpers";

async function expectTouchTarget(locator: Locator, label: string): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, `${label} must render`).not.toBeNull();
  expect(box!.height, `${label} touch target height`).toBeGreaterThanOrEqual(44);
  expect(box!.width, `${label} touch target width`).toBeGreaterThanOrEqual(44);
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function stubRoundStateWrites(page: Page): Promise<void> {
  await page.route("**/rest/v1/rpc/upsert_owned_round_state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "null",
    });
  });
}

test.describe("Accessibility smoke", () => {
  test("Round keyboard navigation preserves focus and panel relationships", async ({
    page,
    browserName,
  }) => {
    await stubRoundStateWrites(page);
    await loginWithShell(page, { roundRunner: true });
    await page.goto("/");
    await expect(page.getByTestId("round-chrome")).toBeVisible({ timeout: 20_000 });

    // Playwright WebKit follows macOS Safari's keyboard-access convention:
    // Option+Tab includes links in focus traversal when the OS setting does not.
    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    const rosterTrigger = page.getByTestId("round-roster-entry");
    await rosterTrigger.focus();
    await page.keyboard.press("Enter");
    const rosterSearch = page.getByTestId("roster-search");
    await expect(rosterSearch).toBeFocused({ timeout: 5_000 });
    await page.keyboard.press("Escape");
    await expect(rosterTrigger).toBeFocused({ timeout: 5_000 });

    const summaryToggle = page.getByRole("button", { name: /clinical summary/i }).first();
    const controlledPanelId = await summaryToggle.getAttribute("aria-controls");
    expect(controlledPanelId).toBeTruthy();
    await expect(page.locator(`#${controlledPanelId}`)).toHaveCount(1);

    const position = page.getByTestId("round-position");
    await expect(position).toContainText("1/3");
    const next = page.getByTestId("round-next");
    await next.press("Enter");
    await expect(position).toContainText("2/3");
    const previous = page.getByTestId("round-prev");
    await previous.press("Enter");
    await expect(position).toContainText("1/3");
  });

  test("mobile Round honors touch, roving-tab, reduced-motion, and overflow contracts", async ({ page }) => {
    const requestedWorkspaceScripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() !== "script") return;
      const path = new URL(request.url()).pathname;
      if (/(Mobile|Desktop)(RoundShell|Dashboard)/.test(path)) {
        requestedWorkspaceScripts.push(path);
      }
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await stubRoundStateWrites(page);
    await loginWithShell(page, { roundRunner: true });

    expect(requestedWorkspaceScripts.some((path) => path.includes("MobileRoundShell"))).toBe(true);
    expect(requestedWorkspaceScripts.some((path) => (
      path.includes("DesktopRoundShell") || path.includes("DesktopDashboard")
    ))).toBe(false);
    expect(await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
    await expectNoDocumentOverflow(page);

    const primaryTargets = [
      ["Roster", page.getByTestId("round-roster-entry")],
      ["Round Home", page.getByTestId("round-go-home")],
      ["End Round", page.getByTestId("round-end-entry")],
      ["Tools", page.getByTestId("round-tools-entry")],
      ["Previous", page.getByTestId("round-prev")],
      ["Done", page.getByTestId("round-done")],
      ["Next", page.getByTestId("round-next")],
    ] as const;
    for (const [label, target] of primaryTargets) {
      await expectTouchTarget(target, label);
    }

    const tabs = page.getByRole("tablist", { name: "Mid-rounds sections" }).getByRole("tab");
    await expect(tabs).toHaveCount(3);
    for (const tab of await tabs.all()) {
      const controls = await tab.getAttribute("aria-controls");
      expect(controls).toBeTruthy();
      await expect(page.locator(`#${controls}`)).toHaveCount(1);
      await expectTouchTarget(tab, `Section tab ${await tab.textContent()}`);
    }

    const activeTab = page.getByRole("tab", { selected: true });
    await activeTab.focus();
    await activeTab.press("ArrowRight");
    await expect(page.getByRole("tab", { selected: true })).toBeFocused();
    await page.getByRole("tab", { selected: true }).press("End");
    await expect(tabs.last()).toBeFocused();
    await tabs.last().press("Home");
    await expect(tabs.first()).toBeFocused();
    expect(await tabs.evaluateAll((nodes) =>
      nodes.filter((node) => node.getAttribute("aria-selected") === "true").length
    )).toBe(1);

    await page.getByTestId("round-roster-entry").click();
    const roster = page.getByTestId("roster-overlay");
    await expect(roster).toBeVisible();
    await expectTouchTarget(page.getByTestId("roster-search"), "Roster search");
    await expectTouchTarget(roster.getByRole("button", { name: /^E2E Charlie, bed / }), "Roster patient row");
    await expectTouchTarget(page.getByTestId("roster-go-home"), "Roster Round Home");
    await expectTouchTarget(page.getByTestId("roster-end-round"), "Roster End Round");
    await page.keyboard.press("Escape");
    await expectNoDocumentOverflow(page);
  });

  test("mobile todo deletion stays visible without hover", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubRoundStateWrites(page);
    await loginWithShell(page, { roundRunner: true });

    const todoText = `RR-MOBILE-TODO-${Date.now()}`;
    await page.getByRole("tab", { name: "Todos" }).click();
    const input = page.getByRole("textbox", { name: "New todo" });
    await expect(input).toBeVisible();

    try {
      await input.fill(todoText);
      await input.press("Enter");
      await expect(page.getByText(todoText, { exact: true })).toBeVisible({ timeout: 20_000 });

      const deleteButton = page.getByRole("button", { name: `Delete todo: ${todoText}` });
      await expect(deleteButton).toBeVisible();
      await expectTouchTarget(deleteButton, "Mobile todo delete");
      await expectNoDocumentOverflow(page);

      const screenshotPath = process.env.E2E_VISUAL_SCREENSHOT_PATH?.trim();
      if (screenshotPath) {
        await page.screenshot({ path: screenshotPath, fullPage: false });
      }
    } finally {
      const deleteButton = page.getByRole("button", { name: `Delete todo: ${todoText}` });
      if (await deleteButton.isVisible().catch(() => false)) {
        await deleteButton.click();
        await expect(deleteButton).toBeHidden({ timeout: 20_000 });
      }
    }
  });
});
