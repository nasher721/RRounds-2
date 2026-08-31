import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { OpenEvidenceProvider } from "@/contexts/OpenEvidenceContext";
import { EvidenceSelectionPopover } from "@/components/open-evidence/EvidenceSelectionPopover";

afterEach(() => {
  cleanup();
  localStorage.clear();
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

function stubSelectionRect() {
  const originalRect = window.Range.prototype.getBoundingClientRect;
  window.Range.prototype.getBoundingClientRect = function stubRect(this: Range) {
    return { top: 200, left: 50, bottom: 220, right: 250, width: 200, height: 20, x: 50, y: 200, toJSON() { return this; } } as DOMRect;
  };
  return () => {
    window.Range.prototype.getBoundingClientRect = originalRect;
  };
}

test("stays hidden with no selection, then quietly appears once eligible text is selected", async () => {
  const restoreRect = stubSelectionRect();
  const host = document.createElement("div");
  host.setAttribute("data-evidence-selectable", "true");
  host.innerHTML = "<p>norepinephrine first line for septic shock</p>";
  document.body.appendChild(host);

  const opened: string[] = [];
  render(
    <OpenEvidenceProvider urlOpener={(url) => opened.push(url)}>
      <EvidenceSelectionPopover />
    </OpenEvidenceProvider>,
  );

  assert.equal(screen.queryByRole("button", { name: /search open evidence/i }), null);

  await act(async () => {
    selectTextIn(host);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  const button = screen.getByRole("button", { name: /search open evidence/i });
  assert.ok(button);

  restoreRect();
  host.remove();
});

test("clicking the popover searches the selected text and clears the selection", async () => {
  const restoreRect = stubSelectionRect();
  const host = document.createElement("div");
  host.setAttribute("data-evidence-selectable", "true");
  host.innerHTML = "<p>norepinephrine first line for septic shock</p>";
  document.body.appendChild(host);

  const opened: string[] = [];
  render(
    <OpenEvidenceProvider urlOpener={(url) => opened.push(url)}>
      <EvidenceSelectionPopover />
    </OpenEvidenceProvider>,
  );

  await act(async () => {
    selectTextIn(host);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  const button = screen.getByRole("button", { name: /search open evidence/i });

  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  assert.deepEqual(opened, ["https://www.openevidence.com/search?q=norepinephrine+first+line+for+septic+shock"]);
  assert.equal(document.getSelection()?.isCollapsed, true);
  assert.equal(screen.queryByRole("button", { name: /search open evidence/i }), null);

  restoreRect();
  host.remove();
});

test("a selection outside an evidence-selectable container never shows the popover", async () => {
  const restoreRect = stubSelectionRect();
  const host = document.createElement("div");
  host.innerHTML = "<p>free text with no evidence opt-in attribute</p>";
  document.body.appendChild(host);

  render(
    <OpenEvidenceProvider urlOpener={() => {}}>
      <EvidenceSelectionPopover />
    </OpenEvidenceProvider>,
  );

  await act(async () => {
    selectTextIn(host);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  assert.equal(screen.queryByRole("button", { name: /search open evidence/i }), null);

  restoreRect();
  host.remove();
});
