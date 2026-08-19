/**
 * Test setup for hook tests: provides a minimal DOM via jsdom so React and
 * @testing-library/react can run. Load with: node --import ./scripts/test-setup.mjs ...
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"root\"></div></body></html>", {
  url: "http://localhost",
  pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.self = dom.window;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLFormElement = dom.window.HTMLFormElement;
globalThis.localStorage = dom.window.localStorage;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

// jsdom exposes scrollTo but routes it to a noisy "not implemented" error.
// Tests only need to verify the call path; browser scrolling is covered by E2E.
Object.defineProperty(dom.window, "scrollTo", {
  configurable: true,
  writable: true,
  value: () => undefined,
});
globalThis.scrollTo = dom.window.scrollTo.bind(dom.window);

// Anime.js target parsing uses global NodeList (jsdom only puts it on window).
globalThis.NodeList = dom.window.NodeList;
globalThis.HTMLCollection = dom.window.HTMLCollection;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.DocumentFragment = dom.window.DocumentFragment;
globalThis.Event = dom.window.Event;
globalThis.CustomEvent = dom.window.CustomEvent;

// Import after installing the DOM so Testing Library captures this document.
// CI starts many TypeScript/jsdom files concurrently, so state-based waits need
// more headroom than the default without falling back to fixed sleeps.
const { configure } = await import("@testing-library/dom");
configure({ asyncUtilTimeout: 5_000 });

// Anime.js and other browser APIs read global requestAnimationFrame at module load.
if (typeof globalThis.requestAnimationFrame !== "function") {
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
}
if (typeof globalThis.cancelAnimationFrame !== "function") {
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
if (dom.window && typeof dom.window.requestAnimationFrame !== "function") {
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame.bind(globalThis);
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame.bind(globalThis);
}

/** Stable MediaQueryList stub for hooks that call window.matchMedia in effects. */
const createMatchMediaStub = (matches = false) => (query) => ({
  matches,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
});

if (typeof dom.window.matchMedia !== "function") {
  Object.defineProperty(dom.window, "matchMedia", {
    configurable: true,
    writable: true,
    value: createMatchMediaStub(false),
  });
}
if (typeof globalThis.matchMedia !== "function") {
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    writable: true,
    value: dom.window.matchMedia,
  });
}
globalThis.installTestMatchMedia = (matches = false) => {
  const stub = createMatchMediaStub(matches);
  Object.defineProperty(dom.window, "matchMedia", {
    configurable: true,
    writable: true,
    value: stub,
  });
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    writable: true,
    value: stub,
  });
  return stub;
};

if (typeof globalThis.IntersectionObserver !== "function") {
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}
if (typeof dom.window.IntersectionObserver !== "function") {
  dom.window.IntersectionObserver = globalThis.IntersectionObserver;
}
if (typeof globalThis.ResizeObserver !== "function") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (typeof dom.window.ResizeObserver !== "function") {
  dom.window.ResizeObserver = globalThis.ResizeObserver;
}
