import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const hasCredentials = Boolean(E2E_EMAIL && E2E_PASSWORD);

const collectPageErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message || error.name || "Error"));
  return errors;
};

const useClassicDashboard = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.localStorage.setItem("rr-round-runner", "0");
  });
};

test.describe("Auth and dashboard", () => {
  test("auth page loads and shows login form @public", async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Continue with Apple" })).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("auth bootstrap releases a cached workspace before a stalled refresh finishes @public", async ({ page }) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    expect(supabaseUrl, "VITE_SUPABASE_URL is required for the auth bootstrap contract").toBeTruthy();
    const projectRef = new URL(supabaseUrl!).hostname.split(".")[0];
    const storageKey = `sb-${projectRef}-auth-token`;
    const userId = "00000000-0000-4000-8000-000000000999";

    await page.addInitScript(({ key, ownerId }) => {
      const nowSeconds = Math.floor(Date.now() / 1_000);
      window.localStorage.setItem(key, JSON.stringify({
        access_token: "e2e-stalled-access-token",
        refresh_token: "e2e-stalled-refresh-token",
        expires_at: nowSeconds + 30,
        expires_in: 30,
        token_type: "bearer",
        user: {
          id: ownerId,
          aud: "authenticated",
          role: "authenticated",
          email: "offline-bootstrap@example.invalid",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      }));
    }, { key: storageKey, ownerId: userId });

    await page.route("**/auth/v1/token**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 8_000));
      await route.abort("timedout");
    });

    const startedAt = Date.now();
    await page.goto("/security");
    await expect(page.getByRole("heading", { name: "Security deployment guidance" })).toBeVisible({
      timeout: 5_000,
    });
    expect(Date.now() - startedAt).toBeLessThan(6_000);
    await expect(page.getByText("Loading workspace", { exact: true })).toHaveCount(0);
  });

  test("landing page matches provisioned access and safe contact configuration @public", async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "A cleaner command center for rounds." })).toBeVisible();
    await expect(
      page.getByRole("banner").getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in to workspace", exact: true })).toBeVisible();
    await expect(page.getByText(/create an account/i)).toHaveCount(0);

    const prelaunchContactNotice = page.getByText(
      "Public contact details are not available during this prelaunch deployment.",
      { exact: true },
    );
    const contactLink = page.locator('#contact a[href^="mailto:"]');
    if (await prelaunchContactNotice.isVisible().catch(() => false)) {
      await expect(contactLink).toHaveCount(0);
    } else {
      const contactHref = await contactLink.getAttribute("href");
      expect(contactHref).toMatch(/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(contactHref).not.toBe("mailto:hello@rollingrounds.app");
    }

    const canonicalUrl = await page.locator('link[rel="canonical"]').getAttribute("href");
    const openGraphUrl = await page.locator('meta[property="og:url"]').getAttribute("content");
    const openGraphImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(canonicalUrl).toMatch(/^https:\/\//);
    expect(openGraphUrl).toBe(canonicalUrl);
    expect(openGraphImage).toMatch(new RegExp(`^${canonicalUrl}icons/`));
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
    await expect(page.locator('meta[name="session-idle-timeout"]')).toHaveAttribute(
      "content",
      /^(?:[3-9]\d{2}|[1-2]\d{3}|3[0-5]\d{2}|3600)$/,
    );
    await expect(page.locator('script[type="application/ld+json"][data-rolling-rounds]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:site"]')).toHaveCount(0);

    const privacyHref = await page.getByRole("link", { name: "Privacy", exact: true }).getAttribute("href");
    if (privacyHref === "/privacy") {
      await expect(page.getByRole("link", { name: "Privacy", exact: true })).toHaveAttribute(
        "href",
        "/privacy",
      );
    } else {
      expect(privacyHref).toMatch(/^https:\/\//);
      expect(privacyHref).not.toContain("example.com");
    }

    await page.getByRole("button", { name: "Explore features", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Everything important stays one click away." })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("saved and system themes are correct before the first painted frame @public", async ({ page }) => {
    const expectFirstThemeFrame = async (className: "dark" | "light", themeColor: string) => {
      await expect.poll(() => page.evaluate(() => (
        window as Window & {
          __rollingRoundsFirstThemeFrame?: { className: string; themeColor: string | null };
        }
      ).__rollingRoundsFirstThemeFrame)).toEqual({ className, themeColor });
    };

    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => {
      if (window.localStorage.getItem("rolling-rounds-theme-e2e-seeded") !== "true") {
        window.localStorage.setItem("vite-ui-theme", "dark");
        window.localStorage.setItem("rolling-rounds-theme-e2e-seeded", "true");
      }
      const observedWindow = window as Window & {
        __rollingRoundsFirstThemeFrame?: { className: string; themeColor: string | null };
      };
      document.addEventListener("DOMContentLoaded", () => {
        window.requestAnimationFrame(() => {
          observedWindow.__rollingRoundsFirstThemeFrame = {
            className: document.documentElement.className,
            themeColor: document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content ?? null,
          };
        });
      }, { once: true });
    });

    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0a0b0a");
    await expectFirstThemeFrame("dark", "#0a0b0a");

    await page.evaluate(() => window.localStorage.setItem("vite-ui-theme", "system"));
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0a0b0a");
    await expectFirstThemeFrame("dark", "#0a0b0a");

    await page.evaluate(() => window.localStorage.setItem("vite-ui-theme", "light"));
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#f5f7f3");
    await expectFirstThemeFrame("light", "#f5f7f3");
  });

  test("crawl assets publish only canonical public surfaces @public", async ({ request }) => {
    const robotsResponse = await request.get("/robots.txt");
    expect(robotsResponse.ok()).toBe(true);
    const robots = await robotsResponse.text();
    expect(robots).toContain("Disallow: /auth");
    expect(robots).toContain("Disallow: /fhir/");
    expect(robots).toMatch(/Sitemap: https:\/\/[^\s]+\/sitemap\.xml/);

    const sitemapResponse = await request.get("/sitemap.xml");
    expect(sitemapResponse.ok()).toBe(true);
    const sitemap = await sitemapResponse.text();
    expect(sitemap).toContain("<loc>https://");
    expect(sitemap).toContain("/security</loc>");
    expect(sitemap).not.toContain("/auth</loc>");
    expect(sitemap).not.toContain("/privacy</loc>");
    expect(sitemap).not.toContain("/fhir/callback</loc>");

    const llmsResponse = await request.get("/llms.txt");
    expect(llmsResponse.ok()).toBe(true);
    expect(llmsResponse.headers()["content-type"]).toMatch(/^text\/plain/);
    const llms = await llmsResponse.text();
    expect(llms).toMatch(/^# Rolling Rounds\n/);
    expect(llms).toContain("## Public pages");
    expect(llms).toMatch(/\[Product overview\]\(https:\/\/[^)]+\/\)/);
    expect(llms).toMatch(/\[Security and deployment guidance\]\(https:\/\/[^)]+\/security\)/);
    const privacyNoticeLines = llms
      .split("\n")
      .filter((line) => line.includes("[Privacy notice]"));
    expect(privacyNoticeLines.length).toBeLessThanOrEqual(1);
    if (privacyNoticeLines.length === 1) {
      expect(privacyNoticeLines[0]).toMatch(/\[Privacy notice\]\(https:\/\/[^)]+\)/);
    }
    expect(llms).not.toContain("/auth");
    expect(llms).not.toContain("/fhir/");
    expect(llms).not.toContain("patient data](");
  });

  test("auth supports keyboard skip navigation and 200% text at 320px @public", async ({ page, browserName }) => {
    const pageErrors = collectPageErrors(page);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    const touchTargets = [
      ["Back", page.getByRole("button", { name: "Back" })],
      ["Email", page.getByLabel("Email")],
      ["Password", page.locator("#password")],
      ["Show password", page.getByRole("button", { name: "Show password" })],
      ["Sign in", page.getByRole("button", { name: "Sign in" })],
    ] as const;
    for (const [label, target] of touchTargets) {
      const box = await target.boundingBox();
      expect(box, `missing touch target for ${label}`).not.toBeNull();
      expect(box!.height, `${label} touch target height`).toBeGreaterThanOrEqual(44);
    }

    const baseFontSize = await page.evaluate(() =>
      Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize)
    );
    await page.addStyleTag({
      content: `:root { font-size: ${baseFontSize * 2}px !important; }`,
    });
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    const overflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    expect(pageErrors).toEqual([]);
  });

  test("production update prompt is visible, accessible, and deferrable @public", async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.goto("/");

    await page.evaluate(() => {
      window.dispatchEvent(new Event("rolling-rounds:service-worker-update"));
    });

    const updateMessage = page.getByText("An updated version of Rolling Rounds is ready.", { exact: true });
    await expect(updateMessage).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh now" })).toBeVisible();
    await page.getByRole("button", { name: "Later" }).click();
    await expect(updateMessage).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("FHIR callback recovery shell fails safely when signed out @public", async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.goto("/fhir/callback");

    await expect(page.getByRole("heading", { name: "Import failed" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("You must be signed in to complete an EHR import.")).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("login redirects to dashboard and dashboard is visible", async ({ page }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set for login E2E (real Supabase required)");

    const pageErrors = collectPageErrors(page);
    await useClassicDashboard(page);
    await page.goto("/auth");
    await page.getByLabel(/email/i).fill(E2E_EMAIL!);
    await page.locator("#password").fill(E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await expect(page.getByRole("button", { name: /print/i }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Open AI Clinical Assistant" })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("clinical reference datasets load only after reference access", async ({ page }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");

    const referenceAssets = new Set<string>();
    page.on("request", (request) => {
      const assetName = new URL(request.url()).pathname.split("/").at(-1) ?? "";
      if (/^(?:ibccContent|clinicalGuidelinesData)-.*\.js$/.test(assetName)) {
        referenceAssets.add(assetName);
      }
    });

    await useClassicDashboard(page);
    await page.goto("/auth");
    await page.getByLabel(/email/i).fill(E2E_EMAIL!);
    await page.locator("#password").fill(E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });

    await page.waitForTimeout(2_500);
    expect([...referenceAssets]).toEqual([]);

    await page.getByRole("button", { name: "Open workspace tools" }).click();
    await expect.poll(
      () => [...referenceAssets].some((name) => name.startsWith("ibccContent-")),
      { timeout: 10_000 },
    ).toBe(true);

    await page.getByRole("tab", { name: "Guidelines", exact: true }).click();
    await expect.poll(
      () => [...referenceAssets].some((name) => name.startsWith("clinicalGuidelinesData-")),
      { timeout: 10_000 },
    ).toBe(true);
  });

  test("after login, print/export loads Excel and PDF engines on demand", async ({ page }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");

    await useClassicDashboard(page);
    await page.goto("/auth");
    await page.getByLabel(/email/i).fill(E2E_EMAIL!);
    await page.locator("#password").fill(E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/(\?.*)?$/);
    const printButton = page.getByRole("button", { name: /print/i }).first();
    await expect(printButton).toBeVisible({ timeout: 20_000 });

    await printButton.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/print|export/i).first()).toBeVisible();

    const excelDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export as Excel spreadsheet" }).click();
    expect((await excelDownload).suggestedFilename()).toMatch(/\.xlsx$/);

    const pdfDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export as PDF document" }).click();
    expect((await pdfDownload).suggestedFilename()).toMatch(/\.pdf$/);
  });
});
