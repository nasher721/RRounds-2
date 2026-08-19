import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { act, cleanup, renderHook } from "@testing-library/react";
import type React from "react";
import {
  ChangeTrackingProvider,
  useChangeTracking,
} from "@/contexts/ChangeTrackingContext";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <ChangeTrackingProvider>{children}</ChangeTrackingProvider>;
}

test("change tracking wraps newly inserted text and escapes markup", () => {
  const { result } = renderHook(() => useChangeTracking(), { wrapper });

  assert.equal(result.current.wrapWithMarkup("new text"), "new text");

  act(() => result.current.toggleEnabled());

  const marked = result.current.wrapWithMarkup("<new & text>");
  assert.match(marked, /data-marked="true"/);
  assert.match(marked, /color: #0d9488/);
  assert.match(marked, /&lt;new &amp; text&gt;/);
  assert.doesNotMatch(marked, /<new & text>/);

  const formatted = result.current.wrapHtmlWithMarkup("<p>Imported <strong>text</strong></p>");
  assert.match(formatted, /<p><span[^>]*>Imported <\/span><strong><span[^>]*>text<\/span><\/strong><\/p>/);
});

test("change tracking settings persist for the current day", () => {
  const first = renderHook(() => useChangeTracking(), { wrapper });
  act(() => {
    first.result.current.toggleEnabled();
    first.result.current.setColor("#1864AB");
  });
  first.unmount();

  const second = renderHook(() => useChangeTracking(), { wrapper });
  assert.equal(second.result.current.enabled, true);
  assert.equal(second.result.current.color, "#1864AB");
});
