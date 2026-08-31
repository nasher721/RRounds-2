import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useEvidenceSelection } from "@/hooks/useEvidenceSelection";

afterEach(() => {
  cleanup();
  document.getSelection()?.removeAllRanges();
});

function selectTextIn(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

test("reports no selection when nothing is selected", () => {
  const { result } = renderHook(() => useEvidenceSelection());
  assert.equal(result.current.text, null);
  assert.equal(result.current.rect, null);
});

test("ignores a selection outside an evidence-selectable container", async () => {
  const host = document.createElement("div");
  host.innerHTML = "<p>tranexamic acid in trauma bleeding</p>";
  document.body.appendChild(host);

  const { result } = renderHook(() => useEvidenceSelection());

  await act(async () => {
    selectTextIn(host);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  assert.equal(result.current.text, null);
  host.remove();
});

test("reports sanitized text for a selection inside an evidence-selectable container", async () => {
  const host = document.createElement("div");
  host.setAttribute("data-evidence-selectable", "true");
  host.innerHTML = "<p>tranexamic  acid\nin trauma bleeding</p>";
  document.body.appendChild(host);
  // jsdom's Range.getBoundingClientRect() is zeroed by default; give the
  // hook a non-empty rect the way a real browser layout would.
  const originalRect = window.Range.prototype.getBoundingClientRect;
  window.Range.prototype.getBoundingClientRect = function stubRect(this: Range) {
    return { top: 10, left: 20, bottom: 30, right: 120, width: 100, height: 20, x: 20, y: 10, toJSON() { return this; } } as DOMRect;
  };

  try {
    const { result } = renderHook(() => useEvidenceSelection());

    await act(async () => {
      selectTextIn(host);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    assert.equal(result.current.text, "tranexamic acid in trauma bleeding");
    assert.ok(result.current.rect);
    assert.equal(result.current.rect?.width, 100);
  } finally {
    window.Range.prototype.getBoundingClientRect = originalRect;
    host.remove();
  }
});

test("ignores a selection shorter than the minimum length", async () => {
  const host = document.createElement("div");
  host.setAttribute("data-evidence-selectable", "true");
  host.innerHTML = "<p>ok</p>";
  document.body.appendChild(host);

  const { result } = renderHook(() => useEvidenceSelection());

  await act(async () => {
    selectTextIn(host);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  assert.equal(result.current.text, null);
  host.remove();
});

test("clears the reported selection once disabled", async () => {
  const host = document.createElement("div");
  host.setAttribute("data-evidence-selectable", "true");
  host.innerHTML = "<p>tranexamic acid</p>";
  document.body.appendChild(host);
  const originalRect = window.Range.prototype.getBoundingClientRect;
  window.Range.prototype.getBoundingClientRect = function stubRect(this: Range) {
    return { top: 1, left: 1, bottom: 2, right: 2, width: 10, height: 10, x: 1, y: 1, toJSON() { return this; } } as DOMRect;
  };

  try {
    const { result, rerender } = renderHook(({ enabled }) => useEvidenceSelection(enabled), {
      initialProps: { enabled: true },
    });

    await act(async () => {
      selectTextIn(host);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    assert.equal(result.current.text, "tranexamic acid");

    rerender({ enabled: false });
    assert.equal(result.current.text, null);
  } finally {
    window.Range.prototype.getBoundingClientRect = originalRect;
    host.remove();
  }
});
