import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MultiPatientComparison } from "@/components/MultiPatientComparison";
import { productionReadinessFixtures } from "@/test/dashboardRegressionFixtures";

globalThis.MutationObserver = window.MutationObserver;
globalThis.NodeFilter = window.NodeFilter;
globalThis.HTMLInputElement = window.HTMLInputElement;
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;
globalThis.ResizeObserver =
  window.ResizeObserver ??
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

afterEach(() => {
  cleanup();
});

describe("MultiPatientComparison dialog accessibility", () => {
  it("exposes an accessible name and description when open", async () => {
    render(
      <MultiPatientComparison
        open
        onOpenChange={() => {}}
        patients={productionReadinessFixtures.threePatientRoster}
        todosMap={{}}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "Patient Comparison" });
    assert.ok(dialog);
    assert.ok(dialog.contains(document.activeElement), "focus must move inside the modal");
    assert.ok(
      document.querySelectorAll('[data-radix-focus-guard]').length >= 2,
      "Radix focus guards must trap keyboard focus while the modal is open",
    );
    assert.match(
      dialog.textContent ?? "",
      /Compare patient notes, labs, systems, medications, and active todos/i,
    );
  });

  it("returns focus to the trigger after Escape closes the dialog", async () => {
    const Harness = () => {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open comparison
          </button>
          <MultiPatientComparison
            open={open}
            onOpenChange={setOpen}
            patients={productionReadinessFixtures.threePatientRoster}
            todosMap={{}}
          />
        </>
      );
    };

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open comparison" });
    trigger.focus();
    fireEvent.click(trigger);

    assert.ok(await screen.findByRole("dialog", { name: "Patient Comparison" }));
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    // Radix restores focus from a zero-delay task after the portal unmounts.
    // Yield before asserting so Testing Library does not install a document-wide
    // MutationObserver while the focus scope is still tearing down.
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(screen.queryByRole("dialog", { name: "Patient Comparison" }), null);
    assert.equal(document.activeElement, trigger);
  });
});
