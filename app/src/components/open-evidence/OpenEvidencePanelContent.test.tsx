import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OpenEvidenceProvider } from "@/contexts/OpenEvidenceContext";
import OpenEvidencePanelContent from "@/components/open-evidence/OpenEvidencePanelContent";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderPanel(urlOpener: (url: string) => void = () => {}) {
  return render(
    <OpenEvidenceProvider urlOpener={urlOpener}>
      <OpenEvidencePanelContent />
    </OpenEvidenceProvider>,
  );
}

test("submitting the search form opens Open Evidence for the typed query", () => {
  const opened: string[] = [];
  renderPanel((url) => opened.push(url));

  const input = screen.getByLabelText(/search open evidence/i);
  fireEvent.change(input, { target: { value: "tPA in ischemic stroke" } });
  fireEvent.click(screen.getByRole("button", { name: /search open evidence/i }));

  assert.deepEqual(opened, ["https://www.openevidence.com/search?q=tPA+in+ischemic+stroke"]);
  assert.ok(screen.getByRole("status").textContent?.includes("tPA in ischemic stroke"));
});

test("the search button is disabled until a query is entered", () => {
  renderPanel();
  const submitButton = screen.getByRole("button", { name: /search open evidence/i });
  assert.equal(submitButton.hasAttribute("disabled"), true);

  fireEvent.change(screen.getByLabelText(/search open evidence/i), { target: { value: "sepsis" } });
  assert.equal(submitButton.hasAttribute("disabled"), false);
});

test("clicking a recent search re-runs it and clear empties the list", () => {
  const opened: string[] = [];
  renderPanel((url) => opened.push(url));

  fireEvent.change(screen.getByLabelText(/search open evidence/i), { target: { value: "sepsis bundle timing" } });
  fireEvent.click(screen.getByRole("button", { name: /^search open evidence$/i }));
  assert.equal(opened.length, 1);

  fireEvent.click(screen.getByRole("button", { name: "sepsis bundle timing" }));
  assert.equal(opened.length, 2);
  assert.equal(opened[1], opened[0]);

  fireEvent.click(screen.getByRole("button", { name: /clear/i }));
  assert.equal(screen.queryByRole("button", { name: "sepsis bundle timing" }), null);
  assert.ok(screen.getByText(/no recent searches/i));
});
