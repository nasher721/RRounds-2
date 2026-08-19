import assert from "node:assert/strict";
import test from "node:test";

import {
  DOCUMENTATION_SECTIONS,
  DOCUMENTATION_STATUS_LABELS,
  getPatientDocumentationSummary,
  type DocumentationPatient,
} from "./patientDocumentation";

const emptyPatient = (): DocumentationPatient => ({
  clinicalSummary: "",
  intervalEvents: "",
  imaging: "",
  labs: "",
  systems: {
    neuro: "",
    cv: "",
    resp: "",
    renalGU: "",
    gi: "",
    endo: "",
    heme: "",
    infectious: "",
    skinLines: "",
    dispo: "",
  },
  medications: { infusions: [], scheduled: [], prn: [], rawText: "" },
});

test("exposes sections in the shared desktop and mobile order", () => {
  assert.deepEqual(
    DOCUMENTATION_SECTIONS.map(({ id, label, focusTarget }) => ({ id, label, focusTarget })),
    [
      { id: "summary", label: "Summary", focusTarget: "documentation-section-summary" },
      { id: "events", label: "Events", focusTarget: "documentation-section-events" },
      { id: "systems", label: "Systems", focusTarget: "documentation-section-systems" },
      { id: "results", label: "Results", focusTarget: "documentation-section-results" },
      {
        id: "medications",
        label: "Medications",
        focusTarget: "documentation-section-medications",
      },
    ],
  );
});

test("reports an empty patient as not started", () => {
  const progress = getPatientDocumentationSummary(emptyPatient());

  assert.equal(progress.status, "not-started");
  assert.equal(DOCUMENTATION_STATUS_LABELS[progress.status], "Not started");
  assert.equal(progress.completed, 0);
  assert.equal(progress.total, 5);
  assert.equal(progress.percentage, 0);
  assert.ok(progress.sections.every((section) => !section.complete));
});

test("does not count empty rich-text markup as documentation", () => {
  const patient = emptyPatient();
  patient.clinicalSummary = "<p><br></p>";
  patient.intervalEvents = "<div>&nbsp;</div>";

  assert.equal(getPatientDocumentationSummary(patient).status, "not-started");
});

test("reports partial grouped documentation as in progress", () => {
  const patient = emptyPatient();
  patient.clinicalSummary = "Admitted after witnessed seizure.";
  patient.systems.neuro = "Following commands.";
  patient.labs = "Na 139, K 4.1";

  const progress = getPatientDocumentationSummary(patient);

  assert.equal(progress.status, "in-progress");
  assert.equal(progress.completed, 3);
  assert.equal(progress.percentage, 60);
  assert.deepEqual(
    progress.sections.filter((section) => section.complete).map((section) => section.id),
    ["summary", "systems", "results"],
  );
});

test("accepts either results source and any medication category", () => {
  const patient = emptyPatient();
  patient.imaging = '<p><img src="scan.png" alt="CT head" /></p>';
  patient.medications.prn = ["  ", "Acetaminophen"];

  const states = getPatientDocumentationSummary(patient).sections;

  assert.equal(states.find(({ id }) => id === "results")?.complete, true);
  assert.equal(states.find(({ id }) => id === "medications")?.complete, true);
});

test("reports ready only when all five documentation groups have content", () => {
  const patient = emptyPatient();
  patient.clinicalSummary = "Status epilepticus, now controlled.";
  patient.intervalEvents = "No seizures overnight.";
  patient.systems.resp = "Room air.";
  patient.imaging = "CT head stable.";
  patient.medications.rawText = "Levetiracetam 1 g twice daily";

  const progress = getPatientDocumentationSummary(patient);

  assert.equal(progress.status, "ready");
  assert.equal(DOCUMENTATION_STATUS_LABELS[progress.status], "Ready");
  assert.equal(progress.completed, 5);
  assert.equal(progress.percentage, 100);
  assert.ok(progress.sections.every((section) => section.complete));
});
