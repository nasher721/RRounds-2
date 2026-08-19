import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect, type Page } from "@playwright/test";

const workerTemplate = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
const VERSION_PATTERN = /const CACHE_VERSION = '[^']+';/;
const TEST_VERSIONS = ["browser-a", "browser-b", "browser-c"] as const;

let server: Server;
let origin = "";
let activeVersion: string = TEST_VERSIONS[0];

const renderWorker = (version: string): string =>
  workerTemplate.replace(VERSION_PATTERN, `const CACHE_VERSION = '${version}';`);

const setServedVersion = async (version: string): Promise<void> => {
  const response = await fetch(`${origin}/__worker-version?value=${encodeURIComponent(version)}`, {
    method: "POST",
  });
  expect(response.ok).toBe(true);
};

const waitForController = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
};

const installFirstWorker = async (page: Page, version: string): Promise<void> => {
  await setServedVersion(version);
  await page.goto(origin);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
  });
  await waitForController(page);
};

type WorkerLifecycleSnapshot = {
  active: ServiceWorkerState | undefined;
  waiting: ServiceWorkerState | undefined;
};

const installWaitingWorker = async (
  page: Page,
  version: string,
): Promise<WorkerLifecycleSnapshot> => {
  await setServedVersion(version);
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) throw new Error("Missing service worker registration");
    await registration.update();

    if (registration.waiting?.state !== "installed") {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          reject(new Error("Updated service worker did not enter the waiting state"));
        }, 5_000);
        const installingWorker = registration.installing;
        if (!installingWorker) {
          window.clearTimeout(timer);
          reject(new Error("Updated service worker was neither installing nor waiting"));
          return;
        }
        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && registration.waiting) {
            window.clearTimeout(timer);
            resolve();
          } else if (installingWorker.state === "redundant") {
            window.clearTimeout(timer);
            reject(new Error("Updated service worker became redundant before waiting"));
          }
        });
      });
    }

    return {
      active: registration.active?.state,
      waiting: registration.waiting?.state,
    };
  });
};

const activateWaitingWorker = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration?.waiting) throw new Error("Missing waiting service worker");
    const waitingWorker = registration.waiting;
    await new Promise<void>((resolve, reject) => {
      let controllerChanged = false;
      let workerActivated = false;
      const timer = window.setTimeout(() => {
        reject(new Error("Service worker activation did not complete"));
      }, 5_000);
      const maybeResolve = () => {
        if (!controllerChanged || !workerActivated) return;
        window.clearTimeout(timer);
        resolve();
      };
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        controllerChanged = true;
        maybeResolve();
      }, { once: true });
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type !== "WORKER_ACTIVATED") return;
        if (event.source && event.source !== waitingWorker) return;
        workerActivated = true;
        maybeResolve();
      }, { once: true });
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    });
  });
};

const seedVersionedChunk = async (
  page: Page,
  version: string,
  chunkName: string,
  body: string,
): Promise<void> => {
  await page.evaluate(async ({ cacheName, requestPath, source }) => {
    const cache = await caches.open(cacheName);
    await cache.put(requestPath, new Response(source, {
      status: 200,
      headers: {
        "content-type": "text/javascript",
        "sw-cache-time": Date.now().toString(),
      },
    }));
  }, {
    cacheName: `dynamic-${version}`,
    requestPath: `/assets/${chunkName}`,
    source: body,
  });
};

const readCachedChunk = async (
  page: Page,
  version: string,
  chunkName: string,
): Promise<{ body: string; cachedAt: string | null } | null> => page.evaluate(
  async ({ cacheName, requestPath }) => {
    const response = await (await caches.open(cacheName)).match(requestPath);
    if (!response) return null;
    return {
      body: await response.text(),
      cachedAt: response.headers.get("sw-cache-time"),
    };
  },
  { cacheName: `dynamic-${version}`, requestPath: `/assets/${chunkName}` },
);

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "POST" && url.pathname === "/__worker-version") {
      activeVersion = url.searchParams.get("value") ?? TEST_VERSIONS[0];
      response.writeHead(204, { "cache-control": "no-store" });
      response.end();
      return;
    }

    if (url.pathname === "/sw.js") {
      response.writeHead(200, {
        "cache-control": "no-store, no-cache, must-revalidate",
        "content-type": "text/javascript; charset=utf-8",
        "service-worker-allowed": "/",
      });
      response.end(renderWorker(activeVersion));
      return;
    }

    if (url.pathname.startsWith("/icons/")) {
      response.writeHead(200, {
        "cache-control": "public, max-age=60",
        "content-type": "image/png",
      });
      response.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      return;
    }

    if (url.pathname === "/assets/html-fallback.js") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<!doctype html><title>SPA fallback</title>");
      return;
    }

    if (url.pathname === "/assets/network-failure.js") {
      request.socket.destroy();
      return;
    }

    if (url.pathname.startsWith("/assets/")) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("deployment asset no longer available");
      return;
    }

    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    });
    response.end("<!doctype html><html><body><main>Service worker upgrade harness</main></body></html>");
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind the service-worker test server"));
        return;
      }
      origin = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("real worker upgrades preserve exact chunks across rapid deployments @public", async ({ page }) => {
  await installFirstWorker(page, TEST_VERSIONS[0]);
  // Keep a second incumbent-controlled client alive so the next installed
  // worker cannot activate merely because the harness briefly loses its only
  // controlled client between Playwright evaluations.
  const incumbentClient = await page.context().newPage();
  await incumbentClient.goto(origin);
  await waitForController(incumbentClient);
  await seedVersionedChunk(page, TEST_VERSIONS[0], "chunk-a.js", "window.release = 'a';");
  await seedVersionedChunk(
    page,
    TEST_VERSIONS[0],
    "html-fallback.js",
    "window.release = 'html-fallback';",
  );
  await seedVersionedChunk(
    page,
    TEST_VERSIONS[0],
    "network-failure.js",
    "window.release = 'network-failure';",
  );

  const firstWaitingState = await installWaitingWorker(page, TEST_VERSIONS[1]);
  expect(firstWaitingState).toEqual({ active: "activated", waiting: "installed" });
  await activateWaitingWorker(page);
  await seedVersionedChunk(page, TEST_VERSIONS[1], "chunk-b.js", "window.release = 'b';");
  await expect.poll(() => readCachedChunk(page, TEST_VERSIONS[1], "chunk-b.js"))
    .toEqual({ body: "window.release = 'b';", cachedAt: expect.stringMatching(/^\d+$/) });

  expect(await installWaitingWorker(page, TEST_VERSIONS[2]))
    .toEqual({ active: "activated", waiting: "installed" });
  expect(await readCachedChunk(page, TEST_VERSIONS[1], "chunk-b.js"))
    .toEqual({ body: "window.release = 'b';", cachedAt: expect.stringMatching(/^\d+$/) });
  await activateWaitingWorker(page);

  await expect.poll(async () => page.evaluate(() => caches.keys())).toEqual(expect.arrayContaining([
    `dynamic-${TEST_VERSIONS[0]}`,
    `dynamic-${TEST_VERSIONS[1]}`,
    `dynamic-${TEST_VERSIONS[2]}`,
  ]));

  const twoReleasesOldChunk = await page.evaluate(async () => {
    const response = await fetch("/assets/chunk-a.js");
    return { body: await response.text(), status: response.status };
  });
  expect(twoReleasesOldChunk).toEqual({ body: "window.release = 'a';", status: 200 });

  const rewrittenAsset = await page.evaluate(async () => {
    const response = await fetch("/assets/html-fallback.js");
    return {
      body: await response.text(),
      contentType: response.headers.get("content-type"),
      status: response.status,
    };
  });
  expect(rewrittenAsset).toEqual({
    body: "window.release = 'html-fallback';",
    contentType: "text/javascript",
    status: 200,
  });

  const rejectedNetworkChunk = await page.evaluate(async () => {
    const response = await fetch("/assets/network-failure.js");
    return { body: await response.text(), status: response.status };
  });
  expect(rejectedNetworkChunk).toEqual({
    body: "window.release = 'network-failure';",
    status: 200,
  });

  const unrelatedChunk = await page.evaluate(async () => {
    const response = await fetch("/assets/not-cached.js");
    return { body: await response.text(), status: response.status };
  });
  expect(unrelatedChunk.status).toBe(404);
  expect(unrelatedChunk.body).toBe("deployment asset no longer available");
});
