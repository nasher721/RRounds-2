import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { OpenEvidenceProvider } from "@/contexts/OpenEvidenceContext";
import { useOpenEvidenceState } from "@/hooks/useOpenEvidenceState";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderWithProvider(urlOpener: (url: string) => void) {
  return renderHook(() => useOpenEvidenceState(), {
    wrapper: ({ children }) => (
      <OpenEvidenceProvider urlOpener={urlOpener}>{children}</OpenEvidenceProvider>
    ),
  });
}

test("useOpenEvidenceState throws outside a provider", () => {
  assert.throws(() => renderHook(() => useOpenEvidenceState()), /within an OpenEvidenceProvider/);
});

test("search opens the sanitized Open Evidence URL and records recent history", () => {
  const opened: string[] = [];
  const { result } = renderWithProvider((url) => opened.push(url));

  let didSearch = false;
  act(() => {
    didSearch = result.current.search("  DOAC  vs\nwarfarin  ", "panel");
  });

  assert.equal(didSearch, true);
  assert.deepEqual(opened, ["https://www.openevidence.com/search?q=DOAC+vs+warfarin"]);
  assert.deepEqual(result.current.recentSearches, ["DOAC vs warfarin"]);
  assert.equal(result.current.lastSearchSource, "panel");
});

test("search on a blank query does nothing and reports failure", () => {
  const opened: string[] = [];
  const { result } = renderWithProvider((url) => opened.push(url));

  let didSearch = true;
  act(() => {
    didSearch = result.current.search("   ");
  });

  assert.equal(didSearch, false);
  assert.deepEqual(opened, []);
  assert.deepEqual(result.current.recentSearches, []);
});

test("recent searches dedupe case-insensitively and stay most-recent-first, capped at 8", () => {
  const { result } = renderWithProvider(() => {});

  act(() => {
    for (let i = 0; i < 10; i++) {
      result.current.search(`topic ${i}`);
    }
    result.current.search("Topic 9"); // duplicate of "topic 9" (case-insensitive)
  });

  assert.equal(result.current.recentSearches.length, 8);
  assert.equal(result.current.recentSearches[0], "Topic 9");
  assert.equal(result.current.recentSearches.filter((s) => s.toLowerCase() === "topic 9").length, 1);
});

test("clearRecentSearches empties the history", () => {
  const { result } = renderWithProvider(() => {});

  act(() => {
    result.current.search("sepsis bundle");
  });
  assert.equal(result.current.recentSearches.length, 1);

  act(() => {
    result.current.clearRecentSearches();
  });
  assert.deepEqual(result.current.recentSearches, []);
});

test("openPanel opens the panel and optionally prefills the query; closePanel closes it", () => {
  const { result } = renderWithProvider(() => {});

  assert.equal(result.current.isOpen, false);

  act(() => {
    result.current.openPanel("pulmonary embolism anticoagulation");
  });
  assert.equal(result.current.isOpen, true);
  assert.equal(result.current.query, "pulmonary embolism anticoagulation");

  act(() => {
    result.current.closePanel();
  });
  assert.equal(result.current.isOpen, false);
});

test("Ctrl/Cmd+E toggles the panel and Escape closes it", () => {
  const { result } = renderWithProvider(() => {});

  act(() => {
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "e", ctrlKey: true }));
  });
  assert.equal(result.current.isOpen, true);

  act(() => {
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
  });
  assert.equal(result.current.isOpen, false);
});

test("recent searches persist across provider instances via localStorage", () => {
  const first = renderWithProvider(() => {});
  act(() => {
    first.result.current.search("massive transfusion protocol");
  });
  first.unmount();

  const second = renderWithProvider(() => {});
  assert.deepEqual(second.result.current.recentSearches, ["massive transfusion protocol"]);
});
