import * as React from "react";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { cleanup, render, screen } from "@testing-library/react";
import { AuthProvider } from "@/hooks/useAuth";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { AICommandPalette } from "@/components/tools/AICommandPalette";
import { defaultMedications, defaultSystems, type Patient } from "@/types/patient";

declare global {
  var __SUPABASE_AUTH_MOCK__: unknown;
}

globalThis.MutationObserver = window.MutationObserver;
globalThis.NodeFilter = window.NodeFilter;
globalThis.HTMLInputElement = window.HTMLInputElement;
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;

if (typeof window.HTMLElement.prototype.scrollIntoView !== "function") {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  cleanup();
  delete globalThis.__SUPABASE_AUTH_MOCK__;
});

function setupAuthMock() {
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: "test-user-id" } } }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
}

function buildPatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "patient-1",
    patientNumber: 1,
    name: "Jane Doe",
    mrn: "12345",
    bed: "ICU-12",
    clinicalSummary: "Neuro ICU patient with evolving exam.",
    intervalEvents: "No acute events overnight.",
    imaging: "Stable head CT.",
    labs: "Na 140",
    systems: defaultSystems,
    medications: defaultMedications,
    fieldTimestamps: {},
    collapsed: false,
    createdAt: "2026-07-26T00:00:00.000Z",
    lastModified: "2026-07-26T00:00:00.000Z",
    ...overrides,
  };
}

function renderPalette(patient?: Patient) {
  setupAuthMock();

  return render(
    React.createElement(
      AuthProvider,
      null,
      React.createElement(
        SettingsProvider,
        null,
        React.createElement(AICommandPalette, { open: true, onOpenChange: () => {}, patient }),
      ),
    ),
  );
}

test("shows a visible no-patient reason and disables patient-required commands", async () => {
  renderPalette();

  assert.ok(
    await screen.findByText("No patient selected — choose a patient on the roster first"),
  );

  const differentialDiagnosisItem = screen
    .getByText("Differential Diagnosis")
    .closest("[cmdk-item]");

  assert.ok(differentialDiagnosisItem, "expected Differential Diagnosis command item");
  assert.equal(
    differentialDiagnosisItem?.getAttribute("aria-disabled") === "true" ||
      differentialDiagnosisItem?.getAttribute("data-disabled") === "true",
    true,
  );
  assert.ok(screen.getAllByText(/Unavailable — select a patient first/).length > 0);
});

test("shows the selected patient name when the palette opens", async () => {
  renderPalette(buildPatient({ name: "Jordan Smith" }));

  assert.ok(await screen.findByText("Selected: Jordan Smith"));
  assert.equal(
    screen.queryByText("No patient selected — choose a patient on the roster first"),
    null,
  );
});
