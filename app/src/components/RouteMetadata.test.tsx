import * as React from "react";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { RouteMetadata } from "@/components/RouteMetadata";

const renderRoute = (path: string, authenticated = false) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <RouteMetadata authenticated={authenticated} />
    </MemoryRouter>,
  );
};

const headContent = (selector: string, attribute: string): string | null =>
  document.head.querySelector(selector)?.getAttribute(attribute) ?? null;

beforeEach(() => {
  document.head.innerHTML = "";
});

afterEach(() => {
  cleanup();
  document.head.innerHTML = "";
});

test("public landing metadata is canonical, indexable, and structured", () => {
  renderRoute("/");

  assert.equal(document.title, "Rolling Rounds | Clinical Rounding Workspace");
  assert.equal(headContent('meta[name="robots"]', "content"), "index, follow");
  assert.equal(headContent('link[rel="canonical"]', "href"), "https://remix-of-remix-of-round-robin-notes.vercel.app/");
  assert.equal(headContent('meta[property="og:url"]', "content"), "https://remix-of-remix-of-round-robin-notes.vercel.app/");
  const structuredData = document.head.querySelector('script[type="application/ld+json"][data-rolling-rounds]');
  assert.ok(structuredData?.textContent);
  const product = JSON.parse(structuredData.textContent);
  assert.equal(product["@type"], "SoftwareApplication");
  assert.equal(product.name, "Rolling Rounds");
  assert.equal("aggregateRating" in product, false);
  assert.equal("offers" in product, false);
});

test("security is independently canonical while placeholder and private routes are noindex", () => {
  renderRoute("/security");
  assert.equal(document.title, "Security | Rolling Rounds");
  assert.equal(headContent('meta[name="robots"]', "content"), "index, follow");
  assert.equal(headContent('link[rel="canonical"]', "href"), "https://remix-of-remix-of-round-robin-notes.vercel.app/security");
  cleanup();

  renderRoute("/privacy");
  assert.equal(headContent('meta[name="robots"]', "content"), "noindex, follow");
  cleanup();

  renderRoute("/auth");
  assert.equal(headContent('meta[name="robots"]', "content"), "noindex, nofollow");
  assert.equal(document.head.querySelector('script[data-rolling-rounds]'), null);
});

test("authenticated workspace and unknown routes cannot be indexed", () => {
  renderRoute("/", true);
  assert.equal(headContent('meta[name="robots"]', "content"), "noindex, nofollow");
  cleanup();

  renderRoute("/missing");
  assert.equal(headContent('meta[name="robots"]', "content"), "noindex, nofollow");
});
