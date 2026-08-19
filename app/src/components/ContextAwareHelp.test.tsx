import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ContextAwareHelp } from "@/components/ContextAwareHelp";

globalThis.NodeFilter = window.NodeFilter;
globalThis.HTMLInputElement = window.HTMLInputElement;
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;

afterEach(() => {
  cleanup();
});

describe("ContextAwareHelp", () => {
  it("opens dashboard-specific help from the floating help button", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ContextAwareHelp />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Get Help" }));

    assert.ok(await screen.findByText("Dashboard Help"));
    assert.ok(screen.getByText(/Add Patient:/));
    assert.ok(screen.getByText(/Smart Import/));
    assert.ok(screen.getByText(/Shortcuts:/));
    assert.ok(screen.getByText(/Dictation:/));
    assert.ok(screen.getByText(/Quick Actions:/));
  });

  it("closes help from the popover close button", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ContextAwareHelp />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: "Get Help" });
    trigger.focus();
    fireEvent.click(trigger);
    assert.ok(await screen.findByText("Dashboard Help"));

    const closeButton = screen
      .getAllByRole("button")
      .find((button) => button !== trigger && button.closest('[data-radix-popper-content-wrapper]'));
    assert.ok(closeButton, "expected a close button inside help content");
    fireEvent.click(closeButton);

    assert.equal(screen.queryByText("Dashboard Help"), null);
  });

  it("shows patient-context help content when opened from a patient route", async () => {
    render(
      <MemoryRouter initialEntries={["/patient/patient-01"]}>
        <ContextAwareHelp />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Get Help" }));

    assert.ok(await screen.findByText("Patient Chart Help"));
    assert.ok(screen.getByText(/Document systems review/i));
    assert.ok(screen.getByText(/Duplicate:/i));
    assert.ok(screen.getByText(/microphone access/i));
  });
});

