import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

type FetchEvent = {
  request: Request;
  respondWith: (response: Promise<Response> | Response) => void;
};

type ActivationEvent = {
  waitUntil: (completion: Promise<unknown>) => void;
};

type MessageEvent = {
  data?: { type?: string };
  ports: MessagePort[];
  waitUntil: (completion: Promise<unknown>) => void;
};

type ServiceWorkerListener = (event: FetchEvent | ActivationEvent | MessageEvent) => void;

type ServiceWorkerOptions = {
  cachedEntriesByCache?: Record<string, Array<{ requestUrl: string; response: Response }>>;
  cachedCacheName?: string;
  cachedResponse?: Response;
  cachedRequestUrl?: string;
  initialCacheNames?: string[];
  networkError?: Error;
  networkResponse?: Response;
};

const loadServiceWorker = ({
  cachedEntriesByCache = {},
  cachedCacheName,
  cachedResponse,
  cachedRequestUrl,
  initialCacheNames = [],
  networkError,
  networkResponse,
}: ServiceWorkerOptions = {}) => {
  const listeners = new Map<string, ServiceWorkerListener>();
  const deletedCaches: string[] = [];
  const clientMessages: unknown[] = [];
  let skipWaitingCalls = 0;
  let claimCalls = 0;
  const createCache = (cacheName: string) => ({
    addAll: async () => undefined,
    delete: async () => true,
    keys: async () => {
      const configuredRequests = (cachedEntriesByCache[cacheName] ?? [])
        .map(({ requestUrl }) => new Request(requestUrl));
      if (configuredRequests.length > 0) return configuredRequests;
      if (cachedRequestUrl && (!cachedCacheName || cacheName === cachedCacheName)) {
        return [new Request(cachedRequestUrl)];
      }
      return [];
    },
    match: async (request: Request) => {
      const configuredEntry = (cachedEntriesByCache[cacheName] ?? [])
        .find(({ requestUrl }) => requestUrl === request.url);
      if (configuredEntry) return configuredEntry.response.clone();
      if (cachedCacheName && cacheName !== cachedCacheName) return undefined;
      if (cachedRequestUrl && request.url !== cachedRequestUrl) return undefined;
      return cachedResponse?.clone();
    },
    put: async () => undefined,
  });
  const caches = {
    delete: async (name: string) => {
      deletedCaches.push(name);
      return true;
    },
    keys: async () => initialCacheNames,
    open: async (name: string) => createCache(name),
  };
  const self = {
    addEventListener: (type: string, listener: ServiceWorkerListener) => listeners.set(type, listener),
    clients: {
      claim: async () => { claimCalls += 1; },
      matchAll: async () => [{ postMessage: (message: unknown) => clientMessages.push(message) }],
    },
    location: { origin: "https://round-robin.test" },
    skipWaiting: async () => { skipWaitingCalls += 1; },
  };

  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL,
    Headers,
    Response,
    caches,
    console: { log: () => undefined, error: () => undefined },
    fetch: async () => {
      if (networkError) throw networkError;
      return networkResponse?.clone() ?? new Response("ok", {
        headers: { "content-type": "text/javascript" },
      });
    },
    performance,
    self,
  });

  return {
    deletedCaches,
    clientMessages,
    getClaimCalls: () => claimCalls,
    getSkipWaitingCalls: () => skipWaitingCalls,
    listeners,
  };
};

const loadFetchListener = () => {
  const { listeners } = loadServiceWorker();
  const listener = listeners.get("fetch");
  assert.ok(listener, "service worker must register a fetch listener");
  return listener;
};

const isHandledByServiceWorker = (listener: ServiceWorkerListener, request: Request) => {
  let handled = false;
  listener({
    request,
    respondWith: (response) => {
      handled = true;
      void Promise.resolve(response).catch(() => undefined);
    },
  } as FetchEvent);
  return handled;
};

const getServiceWorkerResponse = async (
  listener: ServiceWorkerListener,
  request: Request,
): Promise<Response> => {
  let responsePromise: Promise<Response> | undefined;
  listener({
    request,
    respondWith: (response) => {
      responsePromise = Promise.resolve(response);
    },
  } as FetchEvent);
  assert.ok(responsePromise, "service worker must handle the request");
  return responsePromise;
};

describe("service worker cache policy", () => {
  it("surfaces production worker updates through the application shell", () => {
    const main = readFileSync("src/main.tsx", "utf8");
    const app = readFileSync("src/App.tsx", "utf8");

    assert.match(main, /markServiceWorkerUpdateReady\((?:registration\.waiting|newWorker)\)/);
    assert.doesNotMatch(main, /New content available, refresh to update/);
    assert.match(app, /<ServiceWorkerUpdatePrompt \/>/);
  });

  it("keeps an installed update waiting until the clinician explicitly activates it", async () => {
    const worker = loadServiceWorker({
      initialCacheNames: ["dynamic-v1.0.8", "dynamic-v1.0.9"],
    });
    const install = worker.listeners.get("install");
    const activate = worker.listeners.get("activate");
    const message = worker.listeners.get("message");
    assert.ok(install && activate && message, "worker lifecycle listeners must be registered");

    let installCompletion = Promise.resolve<unknown>(undefined);
    install({
      waitUntil: (promise) => { installCompletion = promise; },
    } as ActivationEvent);
    await installCompletion;

    assert.equal(worker.getSkipWaitingCalls(), 0);
    assert.equal(worker.getClaimCalls(), 0);
    assert.deepEqual(worker.deletedCaches, []);

    let activationRequest = Promise.resolve<unknown>(undefined);
    message({
      data: { type: "SKIP_WAITING" },
      ports: [],
      waitUntil: (promise) => { activationRequest = promise; },
    } as MessageEvent);
    await activationRequest;
    assert.equal(worker.getSkipWaitingCalls(), 1);

    let activationCompletion = Promise.resolve<unknown>(undefined);
    activate({
      waitUntil: (promise) => { activationCompletion = promise; },
    } as ActivationEvent);
    await activationCompletion;
    assert.equal(worker.getClaimCalls(), 1);
    assert.equal(JSON.stringify(worker.clientMessages), JSON.stringify([{
      type: "WORKER_ACTIVATED",
      version: "v1.0.12",
    }]));
    assert.deepEqual(worker.deletedCaches, ["dynamic-v1.0.8", "dynamic-v1.0.9"]);
  });

  it("retains the prior dynamic generation for sibling tabs running old chunks", async () => {
    const worker = loadServiceWorker({
      cachedEntriesByCache: {
        "dynamic-v1.0.9": [{
          requestUrl: "https://round-robin.test/assets/chunk-v109.js",
          response: new Response("previous-generation chunk", {
            headers: {
              "content-type": "text/javascript",
              "sw-cache-time": Date.now().toString(),
            },
          }),
        }],
      },
      initialCacheNames: [
        "dynamic-v1.0.6",
        "dynamic-v1.0.7",
        "dynamic-v1.0.8",
        "dynamic-v1.0.9",
        "dynamic-v1.0.12",
        "api-v1.0.8",
        "images-v1.0.8",
        "static-v1.0.8",
      ],
    });
    const activate = worker.listeners.get("activate");
    assert.ok(activate, "service worker must register an activate listener");

    let completion = Promise.resolve<unknown>(undefined);
    activate({ waitUntil: (promise) => { completion = promise; } } as ActivationEvent);
    await completion;

    assert.deepEqual(worker.deletedCaches.sort(), [
      "api-v1.0.8",
      "dynamic-v1.0.6",
      "dynamic-v1.0.7",
      "dynamic-v1.0.8",
      "images-v1.0.8",
      "static-v1.0.8",
    ]);
    assert.equal(worker.deletedCaches.includes("dynamic-v1.0.9"), false);
  });

  it("retains every fresh dynamic generation needed by tabs spanning rapid deployments", async () => {
    const now = Date.now().toString();
    const worker = loadServiceWorker({
      cachedEntriesByCache: {
        "dynamic-v1.0.8": [{
          requestUrl: "https://round-robin.test/assets/chunk-v108.js",
          response: new Response("two-releases-old chunk", {
            headers: { "content-type": "text/javascript", "sw-cache-time": now },
          }),
        }],
        "dynamic-v1.0.9": [{
          requestUrl: "https://round-robin.test/assets/chunk-v109.js",
          response: new Response("one-release-old chunk", {
            headers: { "content-type": "text/javascript", "sw-cache-time": now },
          }),
        }],
      },
      initialCacheNames: [
        "dynamic-v1.0.8",
        "dynamic-v1.0.9",
        "dynamic-v1.0.12",
      ],
      networkResponse: new Response("missing", { status: 404 }),
    });
    const activate = worker.listeners.get("activate");
    assert.ok(activate, "service worker must register an activate listener");

    let completion = Promise.resolve<unknown>(undefined);
    activate({ waitUntil: (promise) => { completion = promise; } } as ActivationEvent);
    await completion;

    assert.equal(worker.deletedCaches.includes("dynamic-v1.0.8"), false);
    assert.equal(worker.deletedCaches.includes("dynamic-v1.0.9"), false);

    const fetchListener = worker.listeners.get("fetch");
    assert.ok(fetchListener, "service worker must register a fetch listener");
    const response = await getServiceWorkerResponse(
      fetchListener,
      new Request("https://round-robin.test/assets/chunk-v108.js"),
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "two-releases-old chunk");
  });

  it("expires retained dynamic generations after the bounded recovery window", async () => {
    const worker = loadServiceWorker({
      cachedEntriesByCache: {
        "dynamic-v1.0.8": [{
          requestUrl: "https://round-robin.test/assets/chunk-v108.js",
          response: new Response("expired chunk", {
            headers: {
              "sw-cache-time": (Date.now() - 25 * 60 * 60 * 1000).toString(),
            },
          }),
        }],
      },
      initialCacheNames: ["dynamic-v1.0.8", "dynamic-v1.0.12"],
    });
    const activate = worker.listeners.get("activate");
    assert.ok(activate, "service worker must register an activate listener");

    let completion = Promise.resolve<unknown>(undefined);
    activate({ waitUntil: (promise) => { completion = promise; } } as ActivationEvent);
    await completion;

    assert.deepEqual(worker.deletedCaches, ["dynamic-v1.0.8"]);
  });

  it("serves an old lazy chunk from the retained sibling-tab cache generation", async () => {
    const oldChunkUrl = "https://round-robin.test/assets/chunk-v109.js";
    const worker = loadServiceWorker({
      cachedCacheName: "dynamic-v1.0.9",
      cachedRequestUrl: oldChunkUrl,
      cachedResponse: new Response("previous-generation chunk", {
        status: 200,
        headers: {
          "content-type": "text/javascript",
          "sw-cache-time": Date.now().toString(),
        },
      }),
      initialCacheNames: ["dynamic-v1.0.9", "dynamic-v1.0.12"],
      networkResponse: new Response("missing", { status: 404 }),
    });
    const activate = worker.listeners.get("activate");
    const fetchListener = worker.listeners.get("fetch");
    assert.ok(activate && fetchListener, "worker must register lifecycle and fetch listeners");

    let activation = Promise.resolve<unknown>(undefined);
    activate({ waitUntil: (promise) => { activation = promise; } } as ActivationEvent);
    await activation;

    const response = await getServiceWorkerResponse(fetchListener, new Request(oldChunkUrl));
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "previous-generation chunk");
    assert.equal(worker.deletedCaches.includes("dynamic-v1.0.9"), false);
  });

  it("serves a retained lazy chunk when an old tab loses its network", async () => {
    const oldChunkUrl = "https://round-robin.test/assets/chunk-v109.js";
    const worker = loadServiceWorker({
      cachedCacheName: "dynamic-v1.0.9",
      cachedRequestUrl: oldChunkUrl,
      cachedResponse: new Response("offline retained chunk", {
        status: 200,
        headers: {
          "content-type": "text/javascript",
          "sw-cache-time": Date.now().toString(),
        },
      }),
      initialCacheNames: ["dynamic-v1.0.9", "dynamic-v1.0.12"],
      networkError: new TypeError("Failed to fetch"),
    });
    const fetchListener = worker.listeners.get("fetch");
    assert.ok(fetchListener, "worker must register a fetch listener");

    const response = await getServiceWorkerResponse(fetchListener, new Request(oldChunkUrl));
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "offline retained chunk");
  });

  it("rejects a rewritten HTML asset response in favor of the retained exact chunk", async () => {
    const oldChunkUrl = "https://round-robin.test/assets/chunk-v109.js";
    const worker = loadServiceWorker({
      cachedCacheName: "dynamic-v1.0.9",
      cachedRequestUrl: oldChunkUrl,
      cachedResponse: new Response("retained JavaScript chunk", {
        status: 200,
        headers: {
          "content-type": "text/javascript",
          "sw-cache-time": Date.now().toString(),
        },
      }),
      initialCacheNames: ["dynamic-v1.0.9", "dynamic-v1.0.12"],
      networkResponse: new Response("<!doctype html><title>SPA fallback</title>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    });
    const fetchListener = worker.listeners.get("fetch");
    assert.ok(fetchListener, "worker must register a fetch listener");

    const response = await getServiceWorkerResponse(fetchListener, new Request(oldChunkUrl));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/javascript");
    assert.equal(await response.text(), "retained JavaScript chunk");
  });

  it("deletes API and obsolete public cache generations", async () => {
    const { deletedCaches, listeners } = loadServiceWorker({
      initialCacheNames: [
        "api-v1.0.3",
        "dynamic-v1.0.3",
        "images-v1.0.3",
        "static-v1.0.3",
        "static-v1.0.4",
      ],
    });
    const listener = listeners.get("activate");
    assert.ok(listener, "service worker must register an activate listener");

    let completion = Promise.resolve<unknown>(undefined);
    listener({
      waitUntil: (promise) => {
        completion = promise;
      },
    } as ActivationEvent);
    await completion;

    assert.deepEqual(
      deletedCaches.sort(),
      ["api-v1.0.3", "dynamic-v1.0.3", "images-v1.0.3", "static-v1.0.3", "static-v1.0.4"],
    );
  });

  it("leaves Supabase data requests on the network", () => {
    const listener = loadFetchListener();

    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://project.supabase.co/rest/v1/patients?select=*"),
    ), false);
    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://project.supabase.co/functions/v1/parse-single-patient"),
    ), false);
    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://project.supabase.co/storage/v1/object/sign/patient-images/a.png"),
    ), false);
  });

  it("leaves requests carrying credentials on the network", () => {
    const listener = loadFetchListener();

    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://round-robin.test/assets/private.json", {
        headers: { Authorization: "Bearer secret" },
      }),
    ), false);
    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://round-robin.test/assets/private.json", {
        headers: { apikey: "secret" },
      }),
    ), false);
    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://round-robin.test/assets/private.json?key=secret"),
    ), false);
    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://round-robin.test/fhir/callback?code=one-time-code&state=opaque-state"),
    ), false);
    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://generativelanguage.googleapis.com/v1beta/models"),
    ), false);
  });

  it("continues to handle public static assets for offline use", () => {
    const listener = loadFetchListener();

    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://round-robin.test/assets/app.js"),
    ), true);
  });

  it("uses a fresh cached app shell when an HTML navigation receives HTTP 503", async () => {
    const cachedResponse = new Response("cached app shell", {
      status: 200,
      headers: {
        "content-type": "text/html",
        "sw-cache-time": Date.now().toString(),
      },
    });
    const { listeners } = loadServiceWorker({
      cachedResponse,
      networkResponse: new Response("upstream unavailable", { status: 503 }),
    });
    const listener = listeners.get("fetch");
    assert.ok(listener, "service worker must register a fetch listener");

    const response = await getServiceWorkerResponse(
      listener,
      new Request("https://round-robin.test/", {
        headers: { accept: "text/html" },
      }),
    );

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "cached app shell");
  });

  it("does not hide an authoritative HTTP 404 behind a cached app shell", async () => {
    const { listeners } = loadServiceWorker({
      cachedResponse: new Response("cached app shell", {
        status: 200,
        headers: { "sw-cache-time": Date.now().toString() },
      }),
      networkResponse: new Response("not found", { status: 404 }),
    });
    const listener = listeners.get("fetch");
    assert.ok(listener, "service worker must register a fetch listener");

    const response = await getServiceWorkerResponse(
      listener,
      new Request("https://round-robin.test/missing", {
        headers: { accept: "text/html" },
      }),
    );

    assert.equal(response.status, 404);
    assert.equal(await response.text(), "not found");
  });

  it("uses a cached hashed JavaScript chunk when deployment cleanup returns HTTP 404", async () => {
    const { listeners } = loadServiceWorker({
      cachedRequestUrl: "https://round-robin.test/assets/chunk-OLD.js",
      cachedResponse: new Response("cached chunk", {
        status: 200,
        headers: {
          "content-type": "text/javascript",
          "sw-cache-time": Date.now().toString(),
        },
      }),
      networkResponse: new Response("missing", { status: 404 }),
    });
    const listener = listeners.get("fetch");
    assert.ok(listener, "service worker must register a fetch listener");

    const response = await getServiceWorkerResponse(
      listener,
      new Request("https://round-robin.test/assets/chunk-OLD.js"),
    );

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "cached chunk");

    const unrelatedResponse = await getServiceWorkerResponse(
      listener,
      new Request("https://round-robin.test/assets/chunk-NEW.js"),
    );
    assert.equal(unrelatedResponse.status, 404);
    assert.equal(await unrelatedResponse.text(), "missing");
  });
});
