/**
 * Field conflict UI: explicit Mine / Theirs / merge (no silent drop).
 */
import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FieldConflictDialog } from "@/components/round/FieldConflictDialog";
import type { FieldConflict } from "@/lib/round/sync";

globalThis.MutationObserver = window.MutationObserver;
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

const sampleConflict: FieldConflict = {
  id: "conflict-1",
  patientId: "patient-01",
  fieldKey: "clinicalSummary",
  mine: {
    patientId: "patient-01",
    fieldKey: "clinicalSummary",
    value: "Mine summary from phone",
    updatedAt: "2026-08-11T12:01:00.000Z",
    baseUpdatedAt: "2026-08-11T12:00:00.000Z",
    deviceId: "phone",
  },
  theirs: {
    patientId: "patient-01",
    fieldKey: "clinicalSummary",
    value: "Theirs summary from workstation",
    updatedAt: "2026-08-11T12:02:00.000Z",
    baseUpdatedAt: "2026-08-11T12:00:00.000Z",
    deviceId: "workstation",
  },
};

describe("FieldConflictDialog", () => {
  it("shows both versions and resolves Mine without dropping Theirs from view first", () => {
    const resolutions: Array<{ choice: string; merge?: string }> = [];

    render(
      <FieldConflictDialog
        conflict={sampleConflict}
        open
        onOpenChange={() => {}}
        onResolve={(choice, mergedValue) => {
          resolutions.push({ choice, merge: mergedValue });
        }}
      />,
    );

    assert.ok(screen.getByTestId("field-conflict-dialog"));
    assert.match(screen.getByTestId("field-conflict-key").textContent ?? "", /clinicalSummary/);
    assert.match(screen.getByTestId("field-conflict-mine").textContent ?? "", /Mine summary/);
    assert.match(screen.getByTestId("field-conflict-theirs").textContent ?? "", /Theirs summary/);

    fireEvent.click(screen.getByTestId("field-conflict-choose-mine"));
    assert.deepEqual(resolutions, [{ choice: "mine", merge: undefined }]);
  });

  it("resolves Theirs", () => {
    const resolutions: Array<{ choice: string }> = [];

    render(
      <FieldConflictDialog
        conflict={sampleConflict}
        open
        onOpenChange={() => {}}
        onResolve={(choice) => {
          resolutions.push({ choice });
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("field-conflict-choose-theirs"));
    assert.deepEqual(resolutions, [{ choice: "theirs" }]);
  });

  it("supports merge editor before confirm", () => {
    const resolutions: Array<{ choice: string; merge?: string }> = [];

    render(
      <FieldConflictDialog
        conflict={sampleConflict}
        open
        onOpenChange={() => {}}
        onResolve={(choice, mergedValue) => {
          resolutions.push({ choice, merge: mergedValue });
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("field-conflict-start-merge"));
    const mergeBox = screen.getByTestId("field-conflict-merge");
    fireEvent.change(mergeBox, { target: { value: "Merged clinical summary" } });
    fireEvent.click(screen.getByTestId("field-conflict-confirm-merge"));

    assert.deepEqual(resolutions, [{ choice: "merge", merge: "Merged clinical summary" }]);
  });
});
