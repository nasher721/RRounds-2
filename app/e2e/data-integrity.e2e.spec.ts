/**
 * Data-integrity E2E: multi-tab optimistic-concurrency conflict and
 * offline queue recovery (plan Phase 3, scenarios 3 and 5).
 *
 * Credential-gated (real Supabase). Without credentials, tests skip.
 * Run with:
 *   E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run test:e2e -- --grep "Data integrity"
 *
 * Evidence captured here feeds docs/qa/2026-08-12-data-integrity-matrix.md.
 */

import { test, expect, type Browser, type Download, type Page, type Route } from "@playwright/test";
import {
  appendEditorMarker,
  deleteEditorMarker,
  hasCredentials,
  loginWithShell,
  selectClassicPatient,
  waitForPatientSave,
} from "./helpers";

const DATA_PATIENT_NAME = "E2E Bravo";

async function readJsonDownload(download: Download): Promise<unknown> {
  const stream = await download.createReadStream();
  let content = "";
  for await (const chunk of stream) content += chunk.toString();
  return JSON.parse(content);
}

async function loginToDashboard(page: Page) {
  test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set for data-integrity E2E");

  // Diagnostics: surface failed requests and console errors in test output.
  page.on("response", (res) => {
    if (res.status() >= 400) console.log(`[http ${res.status()}]`, res.url().slice(0, 220));
  });
  page.on("requestfailed", (req) => {
    console.log("[requestfailed]", req.url().slice(0, 220), req.failure()?.errorText);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console.error]", msg.text().slice(0, 300));
  });

  await loginWithShell(page, { roundRunner: false });
}

test.describe("Data integrity", () => {
  // Both tests share one E2E account and patient roster; running them in
  // parallel makes their writes conflict with each other.
  test.describe.configure({ mode: "serial" });

  test("multi-tab: second stale write becomes an explicit Save conflict, never a silent overwrite", async ({
    browser,
  }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
    // Two full logins plus save debounces need more than the 30s default.
    test.setTimeout(150_000);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    let originalHtml: string | undefined;
    let stampA: string | undefined;
    let captureStalePatientPatches = false;
    const stalePatientPatches: string[] = [];
    pageB.on("request", (request) => {
      const url = new URL(request.url());
      if (
        captureStalePatientPatches
        && request.method() === "PATCH"
        && url.pathname === "/rest/v1/patients"
      ) {
        stalePatientPatches.push(request.url());
      }
    });

    try {
      // Both tabs load the same roster. Tab B's copy becomes stale once A saves.
      await loginToDashboard(pageA);
      await loginToDashboard(pageB);

      const editorB = await selectClassicPatient(pageB, DATA_PATIENT_NAME);

      // Tab A edits and persists first.
      const editorA = await selectClassicPatient(pageA, DATA_PATIENT_NAME);
      originalHtml = await editorA.evaluate((node) => node.innerHTML);
      stampA = `TAB-A ${new Date().toISOString()}`;
      await appendEditorMarker(pageA, editorA, stampA);

      // Tab B edits from its stale snapshot and attempts to save.
      captureStalePatientPatches = true;
      await editorB.click();
      await pageB.keyboard.press("End");
      await pageB.keyboard.insertText(` TAB-B ${new Date().toISOString()}`);

      // The stale write must surface an explicit conflict notification and the
      // save-state indicator must not claim a successful save.
      await expect(pageB.getByText("Save conflict")).toBeVisible({ timeout: 25_000 });
      await expect(pageB.getByRole("status").filter({ hasText: "Review conflict" })).toBeVisible();
      captureStalePatientPatches = false;
      expect(
        stalePatientPatches,
        "one stale browser edit must issue one revision-guarded write",
      ).toHaveLength(1);

      // Truth check: after B refreshes, A's content is what persisted.
      await pageB.reload();
      await expect(pageB.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
      await expect(await selectClassicPatient(pageB, DATA_PATIENT_NAME)).toContainText(stampA, { timeout: 15_000 });
    } finally {
      try {
        if (originalHtml !== undefined && stampA && !pageA.isClosed()) {
          await pageA.reload();
          await expect(pageA.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
          let cleanupEditor = await selectClassicPatient(pageA, DATA_PATIENT_NAME);
          if (!await deleteEditorMarker(pageA, cleanupEditor, stampA)) {
            await expect.poll(() => cleanupEditor.evaluate((node) => node.innerHTML)).toBe(originalHtml);
          }
          await pageA.reload();
          await expect(pageA.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
          cleanupEditor = await selectClassicPatient(pageA, DATA_PATIENT_NAME);
          await expect.poll(() => cleanupEditor.evaluate((node) => node.innerHTML)).toBe(originalHtml);
        }
      } finally {
        await contextA.close();
        await contextB.close();
      }
    }
  });

  test("offline: explicit warning, durable queue, reconnect drains without duplication", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
    test.setTimeout(150_000);

    let originalHtml: string | undefined;
    let originalText: string | undefined;
    let onlineStamp: string | undefined;
    let offlineStamp: string | undefined;
    let offline = false;
    let webkitTransportBlocked = false;
    let captureOfflinePatientPatches = false;
    const offlinePatientPatches: string[] = [];
    const abortSupabaseTransport = (route: Route) => route.abort("internetdisconnected");
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        captureOfflinePatientPatches
        && request.method() === "PATCH"
        && url.pathname === "/rest/v1/patients"
      ) {
        offlinePatientPatches.push(request.url());
      }
    });

    try {
      await loginToDashboard(page);
      await page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return;
        await navigator.serviceWorker.ready;
      });
      await page.reload();
      await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
      await page.waitForFunction(() => (
        !("serviceWorker" in navigator) || navigator.serviceWorker.controller !== null
      ));
      let editor = await selectClassicPatient(page, DATA_PATIENT_NAME);
      originalHtml = await editor.evaluate((node) => node.innerHTML);
      originalText = await editor.textContent() ?? "";

      // Baseline: an online edit saves normally (also warms lazy editor modules
      // so going offline does not trip the lazy-panel error boundary).
      onlineStamp = `ONLINE ${new Date().toISOString()}`;
      await appendEditorMarker(page, editor, onlineStamp);

      // Go offline: the app must surface an explicit, persistent warning.
      captureOfflinePatientPatches = true;
      await context.setOffline(true);
      offline = true;
      await expect(page.getByText("You are offline").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(
        /Only patient changes showing Offline queued or Queued are stored on this device/,
      ).first()).toBeVisible();

      // An offline edit must NOT be silently lost: the write fails as retryable,
      // lands in the durable IndexedDB queue, and the header reports it.
      offlineStamp = `OFFLINE ${new Date().toISOString()}`;
      await editor.click();
      await page.keyboard.press("End");
      await page.keyboard.type(` ${offlineStamp}`);

      await expect(
        page.getByRole("status").filter({ hasText: /^Offline queued$/ }).first(),
      ).toBeVisible({ timeout: 25_000 });
      expect(
        offlinePatientPatches,
        "known-offline edits should queue locally without attempting patient PATCH requests",
      ).toEqual([]);

      // Recovery-first boundary: a clinician cannot permanently discard the
      // queued PHI until the exact current queue has been downloaded. Canceling
      // the dialog must preserve the queue and its visible save state.
      await page.getByTestId("offline-indicator").click();
      await page.getByRole("button", { name: "Review discarding pending changes" }).click();
      const discardDialog = page.getByRole("alertdialog");
      await expect(discardDialog).toContainText("Discard local pending changes?");
      const discardButton = discardDialog.getByRole("button", { name: "Discard local changes" });
      await expect(discardButton).toBeDisabled();

      const recoveryDownload = page.waitForEvent("download");
      await discardDialog.getByRole("button", { name: "Download recovery copy" }).click();
      const recoveryPayload = await readJsonDownload(await recoveryDownload) as {
        format?: string;
        mutations?: Array<{ id?: string; entityId?: string; payload?: Record<string, unknown> }>;
      };
      expect(recoveryPayload.format).toBe("rolling-rounds-pending-recovery-v1");
      const exportedMutation = recoveryPayload.mutations?.find((mutation) => (
        JSON.stringify(mutation.payload).includes(offlineStamp)
      ));
      expect(exportedMutation?.id).toBeTruthy();
      expect(exportedMutation?.entityId).toBeTruthy();
      await expect(discardButton).toBeEnabled();
      await discardDialog.getByRole("button", { name: "Keep changes" }).click();
      await expect(discardDialog).toBeHidden();
      await expect(
        page.getByRole("status").filter({ hasText: /^Offline queued$/ }).first(),
      ).toBeVisible();

      if (browserName === "webkit") {
        captureOfflinePatientPatches = false;
        await page.route("https://*.supabase.co/**", abortSupabaseTransport);
        webkitTransportBlocked = true;
        await page.evaluate(() => sessionStorage.setItem("__rr_e2e_force_offline", "1"));
        await page.addInitScript(() => {
          if (sessionStorage.getItem("__rr_e2e_force_offline") === "1") {
            Object.defineProperty(navigator, "onLine", {
              configurable: true,
              get: () => false,
            });
          }
        });
        await context.setOffline(false);
        offline = false;
        offlinePatientPatches.length = 0;
        captureOfflinePatientPatches = true;
      }

      // Cold-reload while the mutation is still pending. The stale roster
      // snapshot must be projected through the durable queue before any chart
      // or End/Export surface can render it.
      await page.reload();
      await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("You are offline").first()).toBeVisible();
      editor = await selectClassicPatient(page, DATA_PATIENT_NAME);
      await expect(editor).toContainText(offlineStamp, { timeout: 15_000 });
      await expect(
        page.getByRole("status").filter({ hasText: /^Offline queued$/ }).first(),
      ).toBeVisible();
      expect(
        offlinePatientPatches,
        "cold offline hydration must not attempt a patient PATCH",
      ).toEqual([]);

      // Reconnect: the sync engine drains the queue automatically.
      captureOfflinePatientPatches = false;
      if (browserName === "webkit") {
        await page.evaluate(() => sessionStorage.removeItem("__rr_e2e_force_offline"));
        await page.unroute("https://*.supabase.co/**", abortSupabaseTransport);
        webkitTransportBlocked = false;
        await page.reload();
        await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 30_000 });
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
      } else {
        await context.setOffline(false);
        offline = false;
        // After a service-worker navigation Chromium may already expose
        // navigator.onLine=true and therefore omit the transition event. Real
        // browsers emit `online` when transport returns; dispatch it here so
        // the sticky known-offline guard and replay engine observe the same
        // lifecycle under Playwright.
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
      }
      await expect(page.getByText(
        /confirm Queued clears or Saved appears/,
      ).first()).toBeVisible({ timeout: 10_000 });

      // A failed lazy fetch while offline may have tripped the panel error
      // boundary; recover it before asserting the drained state.
      const tryAgain = page.getByRole("button", { name: "Try Again" });
      if (await tryAgain.isVisible().catch(() => false)) {
        await tryAgain.click();
        await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 30_000 });
      }

      await expect(
        page.getByRole("status").filter({ hasText: /^Saved/ }).first(),
      ).toBeVisible({ timeout: 45_000 });

      // Reload truth: the queued content persisted exactly once.
      await page.reload();
      await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
      const reloaded = await selectClassicPatient(page, DATA_PATIENT_NAME);
      await expect(reloaded).toContainText(offlineStamp, { timeout: 15_000 });
      const occurrences = ((await reloaded.textContent()) ?? "").split(offlineStamp).length - 1;
      expect(occurrences).toBe(1);
    } finally {
      if (offline) {
        await context.setOffline(false);
        await page.evaluate(() => window.dispatchEvent(new Event("online"))).catch(() => undefined);
      }
      if (webkitTransportBlocked) {
        await page.unroute("https://*.supabase.co/**", abortSupabaseTransport);
      }
      if (!page.isClosed()) {
        await page.evaluate(() => sessionStorage.removeItem("__rr_e2e_force_offline")).catch(() => undefined);
        await page.evaluate(() => window.dispatchEvent(new Event("online"))).catch(() => undefined);
      }
      if (originalHtml !== undefined && originalText !== undefined && !page.isClosed()) {
        await page.waitForTimeout(2_000);
        await page.reload();
        await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
        let cleanupEditor = await selectClassicPatient(page, DATA_PATIENT_NAME);
        // Restore the fixture with one revision-guarded write. Deleting the two
        // markers as separate saves allows the second debounced editor state to
        // race the first response and reintroduce the first marker.
        await cleanupEditor.click();
        await waitForPatientSave(page, async () => {
          await page.keyboard.press("ControlOrMeta+A");
          await page.keyboard.insertText(originalText);
        });
        await page.reload();
        await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
        cleanupEditor = await selectClassicPatient(page, DATA_PATIENT_NAME);
        await expect.poll(() => cleanupEditor.evaluate((node) => node.innerHTML)).toBe(originalHtml);
      }
    }
  });

  test("backend outage: locally cached roster remains visible and completion waits for verification", async ({
    browser,
  }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
    test.setTimeout(120_000);

    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const patientReadPattern = "**/rest/v1/patients**";
    const failPatientReads = async (route: Route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "temporary patient roster outage" }),
      });
    };
    let patientReadsBlocked = false;
    const expectRosterPatient = async () => {
      await page.getByTestId("round-roster-entry").click();
      const roster = page.getByTestId("roster-overlay");
      await expect(roster).toBeVisible();
      await expect(roster.getByText(DATA_PATIENT_NAME, { exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(roster).toBeHidden();
    };

    try {
      // A successful first load persists the owner-scoped roster snapshot.
      await loginWithShell(page, { roundRunner: true });
      await expectRosterPatient();

      // Keep the browser online while only the patient-read endpoint fails.
      // This reproduces backend 5xx/captive-portal behavior that navigator.onLine cannot detect.
      await page.route(patientReadPattern, failPatientReads);
      patientReadsBlocked = true;
      await page.reload();

      await expect(page.getByTestId("desktop-round-shell")).toBeVisible({ timeout: 30_000 });
      await expectRosterPatient();
      await expect(page.getByTestId("patient-roster-status-banner")).toContainText(
        "Patient-list recovery could not be verified",
      );
      await expect(page.getByTestId("round-sync-cue")).toContainText(
        "Clinical data needs verification",
      );
      await expect(page.getByTestId("round-done")).toBeDisabled();

      await page.getByTestId("round-end-entry").click();
      await expect(page.getByTestId("round-end-patients-unverified")).toBeVisible();
      await expect(page.getByTestId("round-end-complete")).toBeDisabled();
      await expect(page.getByTestId("round-end-print")).toBeEnabled();

      // Restore the endpoint and prove the user-facing retry performs a real
      // forced read instead of accepting the fresh timestamp on stale cache data.
      await page.unroute(patientReadPattern, failPatientReads);
      patientReadsBlocked = false;
      const verifiedRead = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.request().method() === "GET"
          && url.pathname === "/rest/v1/patients"
          && response.ok();
      }, { timeout: 30_000 });
      await page.getByRole("button", { name: "Retry patient list" }).click();
      await verifiedRead;
      await expect(page.getByTestId("patient-roster-status-banner")).toBeHidden({ timeout: 20_000 });
      await expect(page.getByTestId("round-end-patients-unverified")).toBeHidden();
    } finally {
      if (patientReadsBlocked) {
        await page.unroute(patientReadPattern, failPatientReads);
      }
      await context.close();
    }
  });

  test("offline todo: task survives reload, replays once, and remains removable", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
    test.setTimeout(150_000);
    const todoStamp = `RR-OFFLINE-TODO-${Date.now()}`;
    const reloadTodoStamp = `RR-OFFLINE-RELOAD-TODO-${Date.now()}`;
    let offline = false;
    let webkitTransportBlocked = false;
    let captureOfflineSupabaseRequests = false;
    const offlineSupabaseRequests: string[] = [];
    const abortSupabaseTransport = (route: Route) => route.abort("internetdisconnected");
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (captureOfflineSupabaseRequests && url.hostname.endsWith(".supabase.co")) {
        offlineSupabaseRequests.push(`${request.method()} ${url.pathname}`);
      }
    });

    const readQueuedTodoStates = (content = todoStamp) => page.evaluate(async (queuedContent) => {
      const records = await new Promise<Array<{
        payload?: { content?: string };
        status?: string;
        retryCount?: number;
      }>>((resolve, reject) => {
        const request = indexedDB.open("RoundRobinNotesDB");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("mutations", "readonly");
          const getAll = transaction.objectStore("mutations").getAll();
          getAll.onerror = () => reject(getAll.error);
          getAll.onsuccess = () => resolve(getAll.result);
        };
      });
      return records
        .filter((record) => record.payload?.content === queuedContent)
        .map((record) => `${record.status ?? "pending"}:${record.retryCount ?? 0}`);
    }, content);

    const readTodoSnapshotContents = () => page.evaluate(async () => {
      const snapshot = await new Promise<{ data?: Record<string, Array<{ content?: string }>> } | undefined>(
        (resolve, reject) => {
          const request = indexedDB.open("RoundRobinNotesDB");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction("todoSnapshots", "readonly");
            const get = transaction.objectStore("todoSnapshots").get("__patient_todo_snapshot__");
            get.onerror = () => reject(get.error);
            get.onsuccess = () => resolve(get.result);
          };
        },
      );
      return Object.values(snapshot?.data ?? {})
        .flat()
        .map((todo) => todo.content)
        .filter((content): content is string => typeof content === "string");
    });

    const openPatientTasks = async () => {
      await selectClassicPatient(page, DATA_PATIENT_NAME);
      const trigger = page.getByRole("button", {
        name: /^Patient tasks: add or manage tasks\./,
      }).first();
      await expect(trigger).toBeVisible({ timeout: 20_000 });
      await trigger.click();
      await expect(page.getByRole("textbox", { name: "New todo" })).toBeVisible();
    };

    try {
      await loginToDashboard(page);
      await page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return;
        await navigator.serviceWorker.ready;
      });
      // The first navigation can finish before the production service worker
      // claims the page. Reload once online so the app shell is controlled and
      // cached before exercising an offline reload.
      await page.reload();
      await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
      await page.waitForFunction(() => (
        !("serviceWorker" in navigator) || navigator.serviceWorker.controller !== null
      ));
      await openPatientTasks();
      await context.setOffline(true);
      offline = true;
      await expect(page.getByText("You are offline").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(
        /Only patient changes showing Offline queued or Queued are stored on this device/,
      ).first()).toBeVisible();
      captureOfflineSupabaseRequests = true;

      const input = page.getByRole("textbox", { name: "New todo" });
      await input.fill(todoStamp);
      await input.press("Enter");
      expect(await readQueuedTodoStates()).toEqual(["pending:0"]);
      await expect(page.getByText(todoStamp, { exact: true })).toBeVisible();
      await expect(page.getByText("Queued", { exact: true })).toBeVisible();
      await expect.poll(readTodoSnapshotContents).toContain(todoStamp);

      // WebKit currently raises an internal navigation error when Playwright's
      // browser-wide offline transport is combined with a service-worker
      // navigation. Keep the app logically offline and abort only Supabase
      // transport while allowing WebKit to load the cached shell. This still
      // proves the owner-scoped queue survives a real document reload and that
      // the reloaded app makes no clinical-data request while known offline.
      if (browserName === "webkit") {
        captureOfflineSupabaseRequests = false;
        await page.route("https://*.supabase.co/**", abortSupabaseTransport);
        webkitTransportBlocked = true;
        await page.evaluate(() => sessionStorage.setItem("__rr_e2e_force_offline", "1"));
        await page.addInitScript(() => {
          if (sessionStorage.getItem("__rr_e2e_force_offline") === "1") {
            Object.defineProperty(navigator, "onLine", {
              configurable: true,
              get: () => false,
            });
          }
        });
        await context.setOffline(false);
        offline = false;
        offlineSupabaseRequests.length = 0;
        captureOfflineSupabaseRequests = true;
      }

      // Prove the task survives a document reload in the owner-scoped queue,
      // not just in React state.
      await page.reload();
      await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("You are offline").first()).toBeVisible();
      expect(await readQueuedTodoStates()).toEqual(["pending:0"]);

      // The reloaded document can expose navigator.onLine=true while its CDP
      // transport remains offline. Prove the cached patient workspace uses the
      // sticky connectivity signal for new writes and edits after that reload.
      await openPatientTasks();
      await expect(page.getByText(todoStamp, { exact: true })).toBeVisible();
      await expect.poll(readTodoSnapshotContents).toContain(todoStamp);
      await page.getByRole("textbox", { name: "New todo" }).fill(reloadTodoStamp);
      await page.getByRole("textbox", { name: "New todo" }).press("Enter");
      await expect(page.getByText(reloadTodoStamp, { exact: true })).toBeVisible();
      expect(await readQueuedTodoStates(reloadTodoStamp)).toEqual(["pending:0"]);
      await page.getByRole("checkbox", { name: `Mark todo complete: ${todoStamp}` }).click();
      await expect(page.getByRole("checkbox", { name: `Mark todo incomplete: ${todoStamp}` })).toBeVisible();
      const isClinicalMutation = (request: string) => (
        /^(POST|PATCH|PUT|DELETE) \/(rest\/v1|functions\/v1)\/(patients|patient_todos|round_state|patient_field_history)(?:\/|$)/
          .test(request)
      );
      const unexpectedOfflineRequests = browserName === "webkit"
        // Re-enabling WebKit's transport for the service-worker navigation can
        // start blocked reads and PHI-free telemetry in the old document. The
        // release invariant is that accepted offline edits never attempt a
        // remote clinical-data write; Chromium retains the stricter
        // zero-request assertion.
        ? offlineSupabaseRequests.filter(isClinicalMutation)
        : offlineSupabaseRequests;
      expect(
        unexpectedOfflineRequests,
        "known-offline reload and post-reload mutations must not attempt Supabase writes",
      ).toEqual([]);

      captureOfflineSupabaseRequests = false;
      if (webkitTransportBlocked) {
        await page.unroute("https://*.supabase.co/**", abortSupabaseTransport);
        webkitTransportBlocked = false;
        await page.evaluate(() => {
          sessionStorage.removeItem("__rr_e2e_force_offline");
          Object.defineProperty(navigator, "onLine", {
            configurable: true,
            get: () => true,
          });
        });
      } else {
        await context.setOffline(false);
        offline = false;
      }
      await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
      // A browser offline toggle can restore transport without emitting a
      // second DOM `online` event after an offline service-worker navigation.
      // Dispatch it explicitly so this test exercises the browser contract the
      // sync engine listens to in real devices.
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect.poll(() => readQueuedTodoStates(todoStamp), { timeout: 45_000 }).toEqual([]);
      await expect.poll(() => readQueuedTodoStates(reloadTodoStamp), { timeout: 45_000 }).toEqual([]);
      // Refresh the network-backed roster after the deliberately offline boot,
      // then verify the replay produced exactly one removable server row.
      await page.reload();
      await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
      await openPatientTasks();
      await expect(page.getByText(todoStamp, { exact: true })).toHaveCount(1);
      await expect(page.getByText(reloadTodoStamp, { exact: true })).toHaveCount(1);
      await expect(page.getByText("Queued", { exact: true })).toBeHidden();
    } finally {
      captureOfflineSupabaseRequests = false;
      if (offline) await context.setOffline(false);
      if (webkitTransportBlocked) {
        await page.unroute("https://*.supabase.co/**", abortSupabaseTransport);
        webkitTransportBlocked = false;
      }
      if (!page.isClosed()) {
        await page.evaluate(() => {
          sessionStorage.removeItem("__rr_e2e_force_offline");
          Object.defineProperty(navigator, "onLine", {
            configurable: true,
            get: () => true,
          });
        }).catch(() => undefined);
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
        await page.reload();
        await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
        await openPatientTasks();
        for (const content of [todoStamp, reloadTodoStamp]) {
          const deleteButton = page.getByRole("button", { name: `Delete todo: ${content}` });
          if (await deleteButton.isVisible().catch(() => false)) {
            await deleteButton.click();
            await expect(deleteButton).toBeHidden({ timeout: 20_000 });
          }
        }
      }
    }
  });
});
