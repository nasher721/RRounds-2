import assert from "node:assert/strict";
import test from "node:test";

import { printElement } from "./printElement";

test("printElement clones only the prepared report into a temporary print root", () => {
  const source = document.createElement("div");
  source.dataset.printDocument = "";
  source.textContent = "Prepared patient report";
  document.body.appendChild(source);

  let printedRoot: Element | null = null;
  const originalPrint = window.print;
  window.print = () => {
    printedRoot = document.querySelector("[data-browser-print-root]");
    window.dispatchEvent(new Event("afterprint"));
  };

  try {
    printElement(source);
    assert.ok(printedRoot);
    assert.match((printedRoot as Element).textContent ?? "", /Prepared patient report/);
    assert.equal(document.documentElement.classList.contains("print-export-active"), false);
    assert.equal(document.querySelector("[data-browser-print-root]"), null);
  } finally {
    window.print = originalPrint;
    source.remove();
  }
});

test("printElement rejects a missing report instead of printing unrelated page chrome", () => {
  assert.throws(() => printElement(null), /report is not ready/i);
});
