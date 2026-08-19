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
      // Hoist to a const so the guard narrows inside the find() callback. Do NOT
      // default to "" here: includes("") is always true and would make the
      // assertion below pass vacuously.
      const stamp = offlineStamp;
      if (!stamp) {
        throw new Error("offlineStamp was not captured before the recovery export assertion");
      }
      const exportedMutation = recoveryPayload.mutations?.find((mutation) => (
        JSON.stringify(mutation.payload).includes(stamp)
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
        // Hoist to a const so the undefined-check narrows inside the closures below.
        const restoreText = originalText;
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
          await page.keyboard.insertText(restoreText);
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

/**
 * Log in to the Focus-first Round shell and open one named seeded patient from
 * the roster overlay. Mirrors the roster idiom used by round-runner and the
 * backend-outage scenario above.
 */
async function loginToRoundFocus(page: Page, patientName: string): Promise<void> {
  test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set for data-integrity E2E");

  await loginWithShell(page, { roundRunner: true });
  const shell = page.getByTestId("desktop-round-shell").or(page.getByTestId("mobile-round-shell"));
  await expect(shell).toHaveAttribute("data-round-ready", "true", { timeout: 30_000 });

  const start = page.getByTestId("round-home-start");
  if (await start.isVisible().catch(() => false)) {
    await start.click();
  }
  await expect(page.getByTestId("patient-focus")).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("round-roster-entry").click();
  const roster = page.getByTestId("roster-overlay");
  await expect(roster).toBeVisible({ timeout: 10_000 });
  await roster.locator(`button[aria-label^="${patientName}, bed "]`).click();
  if (await roster.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
  }
  await expect(roster).toBeHidden({ timeout: 10_000 });
  await expect(page.getByTestId("patient-focus-identity")).toContainText(patientName, { timeout: 20_000 });
}

test.describe("Data integrity — interaction isolation", () => {
  // Shares the same account and roster as the scenarios above.
  test.describe.configure({ mode: "serial" });

  // Data-integrity matrix row 1 (Todo isolation): expand and collapse every
  // Focus editor, then type in the Todo input. The Todo input must keep focus
  // for every keystroke, no keystroke may reach a clinical note, and no patient
  // write may be issued. Nothing is submitted, so this scenario creates no data.
  test("todo input keeps focus across editor expand/collapse and clinical notes stay unchanged", async ({
    page,
  }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
    test.setTimeout(150_000);

    let capturePatientPatches = false;
    const patientPatches: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        capturePatientPatches
        && request.method() === "PATCH"
        && url.pathname === "/rest/v1/patients"
      ) {
        patientPatches.push(request.url());
      }
    });

    await loginToRoundFocus(page, DATA_PATIENT_NAME);

    const summaryToggle = page.locator("#focus-summary-heading");
    const summaryBody = page.locator("#focus-summary-body");
    const systemRows = page.locator("[data-systems-row]");

    // Clinical summary: expand, capture the persisted markup, collapse, expand.
    await expect(summaryToggle).toHaveAttribute("aria-expanded", "false");
    await summaryToggle.click();
    await expect(summaryToggle).toHaveAttribute("aria-expanded", "true");
    const summaryEditable = summaryBody.locator('[contenteditable="true"]').first();
    await expect(summaryEditable).toBeVisible({ timeout: 15_000 });
    const originalSummaryHtml = await summaryEditable.evaluate((node) => node.innerHTML);

    // Every system editor: expand (mounts a rich-text editor) then collapse.
    const systemCount = await systemRows.count();
    expect(systemCount, "Focus must render at least one system editor").toBeGreaterThan(0);
    for (let index = 0; index < systemCount; index += 1) {
      const row = systemRows.nth(index);
      const rowToggle = row.getByRole("button").first();
      await rowToggle.click();
      await expect(row).toHaveAttribute("data-expanded", "true");
      await expect(row.locator('[contenteditable="true"]').first()).toBeVisible({ timeout: 15_000 });
      await rowToggle.click();
      await expect(row).toHaveAttribute("data-expanded", "false");
    }

    await summaryToggle.click();
    await expect(summaryToggle).toHaveAttribute("aria-expanded", "false");
    await summaryToggle.click();
    await expect(summaryToggle).toHaveAttribute("aria-expanded", "true");
    await expect(summaryEditable).toBeVisible({ timeout: 15_000 });

    // Typing a Todo draft must never leave the Todo input.
    capturePatientPatches = true;
    const todoInput = page.getByTestId("focus-todos").getByRole("textbox", { name: "New todo" });
    await expect(todoInput).toBeVisible({ timeout: 15_000 });
    await todoInput.click();
    await expect(todoInput).toBeFocused();

    const draftChunks = ["RR-TODO-", "ISOLATION-", "DRAFT"];
    let typed = "";
    for (const chunk of draftChunks) {
      await page.keyboard.type(chunk, { delay: 20 });
      typed += chunk;
      await expect(todoInput).toBeFocused();
      await expect(todoInput).toHaveValue(typed);
    }

    // Clinical truth: the note is byte-identical and never attempted a save.
    expect(
      await summaryEditable.evaluate((node) => node.innerHTML),
      "typing a Todo must not modify the clinical summary",
    ).toBe(originalSummaryHtml);
    await expect(summaryEditable).not.toContainText(typed);
    expect(
      patientPatches,
      "typing a Todo must not issue a patient write",
    ).toEqual([]);

    // Leave no draft behind; the Todo was never submitted so nothing persisted.
    capturePatientPatches = false;
    await todoInput.fill("");
    await expect(todoInput).toHaveValue("");
    await summaryToggle.click();
    await expect(summaryToggle).toHaveAttribute("aria-expanded", "false");
  });

  // Data-integrity matrix row 2 (Toolbar routing): the customize-toolbar
  // preference, the AI surfaces, the phrase library, the formatting buttons and
  // the overflow menu must each open only their own surface. None of them may
  // rewrite the clinical note or issue a patient write.
  test("editor toolbar controls open only their own surface and never mutate the note", async ({
    page,
  }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
    test.setTimeout(150_000);

    let capturePatientPatches = false;
    const patientPatches: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        capturePatientPatches
        && request.method() === "PATCH"
        && url.pathname === "/rest/v1/patients"
      ) {
        patientPatches.push(request.url());
      }
    });

    const dashboard = page.getByTestId("dashboard");
    const toolbarStyleSelect = page.getByLabel("Toolbar style for all text boxes");
    const settingsTab = page.getByRole("tab", { name: "Settings" });

    const exitFocusMode = async () => {
      await page.keyboard.press("Escape");
      await expect(dashboard).toHaveAttribute("data-focus-mode", "false");
    };
    const openWorkspaceSettings = async () => {
      await page.getByRole("button", { name: "Open workspace tools" }).click();
      await settingsTab.click();
      await expect(toolbarStyleSelect).toBeVisible({ timeout: 15_000 });
    };
    const closeWorkspaceTools = async () => {
      const closeButton = page.getByRole("button", { name: "Close workspace tools" });
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click();
      }
      await expect(settingsTab).toBeHidden({ timeout: 10_000 });
    };
    const setToolbarStyle = async (style: "minimal" | "full") => {
      await openWorkspaceSettings();
      await toolbarStyleSelect.selectOption(style);
      await closeWorkspaceTools();
    };

    let toolbarStylePinned = false;
    try {
      await loginToDashboard(page);
      const editorContainer = await selectClassicPatient(page, DATA_PATIENT_NAME);
      const summaryEditable = editorContainer.getByRole("textbox").first();
      await expect(summaryEditable).toBeVisible({ timeout: 20_000 });
      const originalSummaryHtml = await summaryEditable.evaluate((node) => node.innerHTML);
      const originalSummaryText = await summaryEditable.evaluate((node) => node.textContent ?? "");

      // The toolbar layout is a persisted per-account preference, so pin it
      // instead of inheriting whatever a previous run left behind.
      await setToolbarStyle("minimal");
      toolbarStylePinned = true;

      capturePatientPatches = true;
      await summaryEditable.click();
      const toolbar = page.getByRole("toolbar", { name: "Text formatting" }).first();
      await expect(toolbar).toBeVisible({ timeout: 15_000 });

      // Minimal mode keeps essentials in the bar and everything else behind More.
      await expect(toolbar.getByRole("button", { name: "Bold (Ctrl+B)" })).toBeVisible();
      await expect(toolbar.getByRole("button", { name: "Underline (Ctrl+U)" })).toHaveCount(0);

      // Overflow: opens the overflow menu and nothing else.
      await toolbar.getByRole("button", { name: "More formatting options" }).click();
      const overflowMenu = page.getByRole("menu").first();
      await expect(overflowMenu.getByRole("menuitem", { name: "Underline" })).toBeVisible({
        timeout: 10_000,
      });
      await page.keyboard.press("Escape");
      await expect(overflowMenu).toBeHidden({ timeout: 10_000 });

      // Phrase library: opens the phrase picker and nothing else.
      await summaryEditable.click();
      await toolbar.getByRole("button", { name: "Insert clinical phrase from library" }).click();
      const phraseSearch = page.getByPlaceholder("Search phrases...");
      await expect(phraseSearch).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press("Escape");
      await expect(phraseSearch).toBeHidden({ timeout: 10_000 });

      // AI writing tools: opens its own menu; no item is invoked.
      await summaryEditable.click();
      await toolbar.getByRole("button", { name: "AI writing tools" }).click();
      const aiMenu = page.getByRole("menu").first();
      await expect(aiMenu).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press("Escape");
      await expect(aiMenu).toBeHidden({ timeout: 10_000 });

      // Customize toolbar: changes chrome composition only.
      await exitFocusMode();
      await setToolbarStyle("full");
      await summaryEditable.click();
      await expect(toolbar.getByRole("button", { name: "Underline (Ctrl+U)" })).toBeVisible({
        timeout: 15_000,
      });
      await expect(toolbar.getByRole("button", { name: "More formatting options" })).toHaveCount(0);

      await exitFocusMode();
      await setToolbarStyle("minimal");
      await summaryEditable.click();
      await expect(toolbar.getByRole("button", { name: "More formatting options" })).toBeVisible({
        timeout: 15_000,
      });

      // AI model surface: opens the Clinical AI dialog and nothing else.
      await exitFocusMode();
      await openWorkspaceSettings();
      await page.getByRole("button", { name: "Clinical AI" }).click();
      const aiDialog = page.getByRole("dialog", { name: "Clinical AI" });
      await expect(aiDialog).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press("Escape");
      await expect(aiDialog).toBeHidden({ timeout: 10_000 });
      await closeWorkspaceTools();

      // Clinical truth for every chrome surface: nothing changed, nothing saved.
      expect(
        await summaryEditable.evaluate((node) => node.innerHTML),
        "toolbar chrome must not modify the clinical summary",
      ).toBe(originalSummaryHtml);
      expect(
        patientPatches,
        "toolbar chrome must not issue a patient write",
      ).toEqual([]);

      // Formatting buttons with a collapsed caret must not rewrite the field.
      // Engines may attach an empty inline style node for the pending typing
      // state, so this asserts the note text rather than its exact markup.
      capturePatientPatches = false;
      await summaryEditable.click();
      await page.keyboard.press("End");
      await toolbar.getByRole("button", { name: "Bold (Ctrl+B)" }).click();
      await toolbar.getByRole("button", { name: "Italic (Ctrl+I)" }).click();
      expect(
        await summaryEditable.evaluate((node) => node.textContent ?? ""),
        "collapsed-caret formatting must not rewrite the note text",
      ).toBe(originalSummaryText);
    } finally {
      capturePatientPatches = false;
      if (toolbarStylePinned && !page.isClosed()) {
        // Restore the app default so this persisted preference cannot leak.
        await setToolbarStyle("minimal").catch(() => undefined);
      }
    }
  });
});

test.describe("Data integrity — cross-device concurrency", () => {
  test.describe.configure({ mode: "serial" });

  // Data-integrity matrix row 4 (Cross-device concurrency): a phone-sized Round
  // Focus session and a workstation classic session edit the same clinical
  // summary. The phone's stale write must become an explicit Save conflict with
  // exactly one revision-guarded PATCH, and the workstation content is what
  // persists. Emulated with a mobile viewport, which is what selects the
  // touch Round shell (`useIsMobile` is a width media query).
  test("phone edit from a stale snapshot becomes an explicit Save conflict, never a silent overwrite", async ({
    browser,
  }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
    test.setTimeout(180_000);

    const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const deskContext = await browser.newContext();
    const phonePage = await phoneContext.newPage();
    const deskPage = await deskContext.newPage();

    let originalHtml: string | undefined;
    let deskStamp: string | undefined;
    let captureStalePatientPatches = false;
    const stalePatientPatches: string[] = [];
    phonePage.on("request", (request) => {
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
      // The phone loads first; its snapshot goes stale once the workstation saves.
      await loginToRoundFocus(phonePage, DATA_PATIENT_NAME);
      await expect(phonePage.getByTestId("mobile-round-shell")).toBeVisible({ timeout: 20_000 });
      await phonePage.locator("#focus-mobile-tab-clinicalSummary").click();
      const phoneEditable = phonePage
        .locator("#focus-summary-panel")
        .locator('[contenteditable="true"]')
        .first();
      await expect(phoneEditable).toBeVisible({ timeout: 20_000 });

      // Workstation edits and persists first.
      await loginToDashboard(deskPage);
      const deskEditor = await selectClassicPatient(deskPage, DATA_PATIENT_NAME);
      originalHtml = await deskEditor.evaluate((node) => node.innerHTML);
      deskStamp = `WORKSTATION ${new Date().toISOString()}`;
      await appendEditorMarker(deskPage, deskEditor, deskStamp);

      // Phone edits from its stale snapshot.
      captureStalePatientPatches = true;
      await phoneEditable.click();
      await phonePage.keyboard.press("End");
      await phonePage.keyboard.insertText(` PHONE ${new Date().toISOString()}`);

      await expect(phonePage.getByText("Save conflict")).toBeVisible({ timeout: 30_000 });
      captureStalePatientPatches = false;
      expect(
        stalePatientPatches,
        "one stale device edit must issue one revision-guarded write",
      ).toHaveLength(1);

      // Truth check: after the phone reloads, the workstation edit is what persisted.
      await phonePage.reload();
      await expect(
        phonePage.getByTestId("mobile-round-shell"),
      ).toHaveAttribute("data-round-ready", "true", { timeout: 30_000 });
      await expect(phonePage.getByTestId("patient-focus-identity")).toContainText(
        DATA_PATIENT_NAME,
        { timeout: 20_000 },
      );
      await phonePage.locator("#focus-mobile-tab-clinicalSummary").click();
      const reloadedPhoneEditable = phonePage
        .locator("#focus-summary-panel")
        .locator('[contenteditable="true"]')
        .first();
      await expect(reloadedPhoneEditable).toContainText(deskStamp, { timeout: 20_000 });
      await expect(reloadedPhoneEditable).not.toContainText("PHONE ");
    } finally {
      try {
        if (originalHtml !== undefined && deskStamp && !deskPage.isClosed()) {
          await deskPage.reload();
          await expect(deskPage.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
          let cleanupEditor = await selectClassicPatient(deskPage, DATA_PATIENT_NAME);
          if (!await deleteEditorMarker(deskPage, cleanupEditor, deskStamp)) {
            await expect.poll(() => cleanupEditor.evaluate((node) => node.innerHTML)).toBe(originalHtml);
          }
          await deskPage.reload();
          await expect(deskPage.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
          cleanupEditor = await selectClassicPatient(deskPage, DATA_PATIENT_NAME);
          await expect.poll(() => cleanupEditor.evaluate((node) => node.innerHTML)).toBe(originalHtml);
        }
      } finally {
        await phoneContext.close();
        await deskContext.close();
      }
    }
  });
});

test.describe("Data integrity — failure injection", () => {
  test.describe.configure({ mode: "serial" });

  const PATIENT_WRITE_PATTERN = "**/rest/v1/patients**";

  /** Reject only patient writes; reads continue so the workspace stays usable. */
  const rejectPatientWrites = (status: number, message: string, code: string) =>
    async (route: Route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ message, code }),
      });
    };

  // Data-integrity matrix row 6 (Failure injection — backend 5xx / timeout class
  // on a write): a rejected but retryable patient write must never report a
  // save. It must enter the durable queue, expose the shared pending-changes
  // surface, and drain exactly once when the backend recovers.
  test("rejected patient write queues durably instead of reporting a false save, then drains on retry", async ({
    page,
  }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
    test.setTimeout(180_000);

    // The client classifies retryability from the PostgREST error message, so
    // "temporary" keeps this injection on the retryable/queueable branch that a
    // real 503 or gateway timeout takes.
    const failWrite = rejectPatientWrites(503, "temporary backend outage", "53300");
    let writesRejected = false;
    let originalHtml: string | undefined;
    let originalText: string | undefined;
    const stamp = `REJECTED ${new Date().toISOString()}`;

    try {
      await loginToDashboard(page);
      const editor = await selectClassicPatient(page, DATA_PATIENT_NAME);
      originalHtml = await editor.evaluate((node) => node.innerHTML);
      originalText = await editor.textContent() ?? "";

      await page.route(PATIENT_WRITE_PATTERN, failWrite);
      writesRejected = true;

      await editor.click();
      await page.keyboard.press("End");
      await page.keyboard.type(` ${stamp}`);

      // No false save: the rejected write is durably queued and says so.
      await expect(
        page.getByRole("status").filter({ hasText: /^Offline queued$/ }).first(),
      ).toBeVisible({ timeout: 45_000 });
      // Actionable path: the shared pending-changes surface is reachable.
      await expect(page.getByTestId("offline-indicator")).toBeVisible();

      await page.unroute(PATIENT_WRITE_PATTERN, failWrite);
      writesRejected = false;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));

      await expect(
        page.getByRole("status").filter({ hasText: /^Offline queued$/ }),
      ).toHaveCount(0, { timeout: 60_000 });

      // Reload truth: the recovered write persisted exactly once.
      await page.reload();
      await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
      const reloaded = await selectClassicPatient(page, DATA_PATIENT_NAME);
      await expect(reloaded).toContainText(stamp, { timeout: 20_000 });
      const occurrences = ((await reloaded.textContent()) ?? "").split(stamp).length - 1;
      expect(occurrences).toBe(1);
    } finally {
      if (writesRejected) {
        await page.unroute(PATIENT_WRITE_PATTERN, failWrite);
      }
      if (originalHtml !== undefined && originalText !== undefined && !page.isClosed()) {
        // Hoist to a const so the undefined-check narrows inside the closures below.
        const restoreText = originalText;
        await page.reload();
        await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
        let cleanupEditor = await selectClassicPatient(page, DATA_PATIENT_NAME);
        // One revision-guarded restore, matching the offline scenario cleanup.
        await cleanupEditor.click();
        await waitForPatientSave(page, async () => {
          await page.keyboard.press("ControlOrMeta+A");
          await page.keyboard.insertText(restoreText);
        });
        await page.reload();
        await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
        cleanupEditor = await selectClassicPatient(page, DATA_PATIENT_NAME);
        await expect.poll(() => cleanupEditor.evaluate((node) => node.innerHTML)).toBe(originalHtml);
      }
    }
  });

  // Data-integrity matrix row 6 (Failure injection — non-retryable 4xx): a write
  // the backend refuses outright must fail loudly. It must not be queued, must
  // not claim a save, and must persist nothing.
  test("non-retryable rejected write reports Save failed and persists nothing", async ({ page }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
    test.setTimeout(150_000);

    // Deliberately free of network/timeout/temporary wording so this lands on
    // the non-retryable branch instead of the durable queue.
    const failWrite = rejectPatientWrites(400, "patient update rejected by validation", "22023");
    let writesRejected = false;
    let originalHtml: string | undefined;
    const stamp = `NONRETRYABLE ${new Date().toISOString()}`;

    try {
      await loginToDashboard(page);
      const editor = await selectClassicPatient(page, DATA_PATIENT_NAME);
      originalHtml = await editor.evaluate((node) => node.innerHTML);

      await page.route(PATIENT_WRITE_PATTERN, failWrite);
      writesRejected = true;

      await editor.click();
      await page.keyboard.press("End");
      await page.keyboard.type(` ${stamp}`);

      await expect(page.getByText("Save failed").first()).toBeVisible({ timeout: 45_000 });
      await expect(
        page.getByRole("status").filter({ hasText: /^Save failed$/ }).first(),
      ).toBeVisible({ timeout: 20_000 });

      await page.unroute(PATIENT_WRITE_PATTERN, failWrite);
      writesRejected = false;

      // Reload truth: a refused write leaves the persisted chart untouched.
      await page.reload();
      await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
      const reloaded = await selectClassicPatient(page, DATA_PATIENT_NAME);
      await expect(reloaded).not.toContainText(stamp);
      await expect.poll(() => reloaded.evaluate((node) => node.innerHTML)).toBe(originalHtml);
    } finally {
      if (writesRejected) {
        await page.unroute(PATIENT_WRITE_PATTERN, failWrite);
      }
    }
  });

  // Data-integrity matrix row 8 (Recovery export): the offline scenario above
  // already proves the recovery-first boundary while the browser is offline.
  // This covers the other half of the row — a change left pending by a rejected
  // write while the browser is still online — and inspects the exported
  // mutation identifiers and local content before choosing Keep changes.
  test("online pending-change recovery export names the mutation and Keep changes preserves the queue", async ({
    page,
  }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
    test.setTimeout(180_000);

    const failWrite = rejectPatientWrites(503, "temporary backend outage", "53300");
    let writesRejected = false;
    let originalHtml: string | undefined;
    let originalText: string | undefined;
    const stamp = `RECOVERY ${new Date().toISOString()}`;

    try {
      await loginToDashboard(page);
      const editor = await selectClassicPatient(page, DATA_PATIENT_NAME);
      originalHtml = await editor.evaluate((node) => node.innerHTML);
      originalText = await editor.textContent() ?? "";

      await page.route(PATIENT_WRITE_PATTERN, failWrite);
      writesRejected = true;

      await editor.click();
      await page.keyboard.press("End");
      await page.keyboard.type(` ${stamp}`);
      await expect(
        page.getByRole("status").filter({ hasText: /^Offline queued$/ }).first(),
      ).toBeVisible({ timeout: 45_000 });

      await page.getByTestId("offline-indicator").click();
      const reviewDiscard = page.getByRole("button", { name: "Review discarding pending changes" });
      await expect(reviewDiscard).toBeVisible({ timeout: 20_000 });
      await reviewDiscard.click();

      const discardDialog = page.getByRole("alertdialog");
      await expect(discardDialog).toContainText("Discard local pending changes?");
      // Destructive discard stays unavailable until a recovery copy exists.
      await expect(discardDialog.getByRole("button", { name: "Discard local changes" })).toBeDisabled();

      const recoveryDownload = page.waitForEvent("download");
      await discardDialog.getByRole("button", { name: "Download recovery copy" }).click();
      const recoveryPayload = await readJsonDownload(await recoveryDownload) as {
        format?: string;
        mutations?: Array<{ id?: string; entityId?: string; payload?: Record<string, unknown> }>;
      };
      expect(recoveryPayload.format).toBe("rolling-rounds-pending-recovery-v1");
      const exportedMutation = recoveryPayload.mutations?.find((mutation) => (
        JSON.stringify(mutation.payload).includes(stamp)
      ));
      expect(exportedMutation?.id, "the recovery copy must identify the mutation").toBeTruthy();
      expect(exportedMutation?.entityId, "the recovery copy must identify the patient").toBeTruthy();

      // Cancel must leave the queue and its visible save state intact.
      await discardDialog.getByRole("button", { name: "Keep changes" }).click();
      await expect(discardDialog).toBeHidden({ timeout: 10_000 });
      await expect(
        page.getByRole("status").filter({ hasText: /^Offline queued$/ }).first(),
      ).toBeVisible();

      // The preserved queue still recovers once the backend accepts writes.
      await page.unroute(PATIENT_WRITE_PATTERN, failWrite);
      writesRejected = false;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(
        page.getByRole("status").filter({ hasText: /^Offline queued$/ }),
      ).toHaveCount(0, { timeout: 60_000 });

      await page.reload();
      await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
      const reloaded = await selectClassicPatient(page, DATA_PATIENT_NAME);
      await expect(reloaded).toContainText(stamp, { timeout: 20_000 });
      const occurrences = ((await reloaded.textContent()) ?? "").split(stamp).length - 1;
      expect(occurrences).toBe(1);
    } finally {
      if (writesRejected) {
        await page.unroute(PATIENT_WRITE_PATTERN, failWrite);
      }
      if (originalHtml !== undefined && originalText !== undefined && !page.isClosed()) {
        // Hoist to a const so the undefined-check narrows inside the closures below.
        const restoreText = originalText;
        await page.reload();
        await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
        let cleanupEditor = await selectClassicPatient(page, DATA_PATIENT_NAME);
        await cleanupEditor.click();
        await waitForPatientSave(page, async () => {
          await page.keyboard.press("ControlOrMeta+A");
          await page.keyboard.insertText(restoreText);
        });
        await page.reload();
        await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
        cleanupEditor = await selectClassicPatient(page, DATA_PATIENT_NAME);
        await expect.poll(() => cleanupEditor.evaluate((node) => node.innerHTML)).toBe(originalHtml);
      }
    }
  });
});
