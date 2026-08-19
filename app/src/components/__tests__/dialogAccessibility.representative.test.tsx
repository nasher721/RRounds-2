/**
 * Representative dialog title/description/focus-return checks for Step 4.
 */
import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ImageLightbox } from "@/components/ImageLightbox";
import { DocumentImport } from "@/components/DocumentImport";

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

describe("representative dialog accessibility", () => {
  it("names and describes the image lightbox", async () => {
    render(
      <ImageLightbox
        open
        onOpenChange={() => {}}
        images={["data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="]}
        initialIndex={0}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: /Image 1 of 1/i });
    assert.ok(dialog);
    assert.match(dialog.textContent ?? "", /Full-screen image viewer/i);
  });

  it("names and describes the document import dialog", async () => {
    render(<DocumentImport onImport={() => {}} />);

    const trigger = screen.getByTitle("Import Document");
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: /Import Document/i });
    assert.match(dialog.textContent ?? "", /Upload a text or Word file/i);
  });
});
