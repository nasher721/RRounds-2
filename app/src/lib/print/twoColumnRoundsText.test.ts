import assert from "node:assert/strict";
import test from "node:test";

import type { Patient } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";
import { buildTwoColumnRoundsText } from "./twoColumnRoundsText";

const patient = {
  id: "patient-1",
  patientNumber: 1,
  name: "PATIENT NAME",
  mrn: "MRN-1",
  bed: "12",
  clinicalSummary: "Source summary line",
  intervalEvents: "<p>Overnight line 1</p><p>[ ] Overnight plan</p>",
  imaging: "CT unchanged",
  labs: "Na 140 | WBC 8",
  systems: {
    neuro: "Neuro line",
    cv: "CV line",
    resp: "Resp line",
    renalGU: "Renal line",
    gi: "GI line",
    endo: "Endo line",
    heme: "Heme line",
    infectious: "ID line",
    skinLines: "Skin line",
    dispo: "Disposition line",
  },
  medications: {
    infusions: ["Medication infusion"],
    scheduled: [],
    prn: [],
    rawText: "",
  },
  fieldTimestamps: {},
  collapsed: false,
  createdAt: "2026-08-12T12:00:00.000Z",
  lastModified: "2026-08-12T12:00:00.000Z",
} satisfies Patient;

const todo = {
  id: "todo-1",
  patientId: patient.id,
  userId: "user-1",
  section: null,
  content: "Source todo",
  completed: false,
  createdAt: "2026-08-12T12:00:00.000Z",
  updatedAt: "2026-08-12T12:00:00.000Z",
} satisfies PatientTodo;

test("two-column rounds text follows the skill's section split without losing source lines", () => {
  const output = buildTwoColumnRoundsText([patient], { [patient.id]: [todo] });

  assert.equal(output.includes("BED 12  PATIENT NAME"), true);
  assert.match(output, /Source summary line/);
  assert.match(output, /ADMIT/);
  assert.match(output, /NEURO/);
  assert.match(output, /CARDIO\/VASC/);
  assert.match(output, /RESP/);
  assert.match(output, /RENAL\/GU/);
  assert.match(output, /CURRENT MEDICATIONS/);
  assert.match(output, /DISPO/);

  for (const sourceLine of [
    "Overnight line 1",
    "[ ] Overnight plan",
    "Neuro line",
    "CV line",
    "Resp line",
    "Na 140 | WBC 8",
    "Medication infusion",
    "[ ] Source todo",
    "Disposition line",
  ]) {
    assert.equal(output.includes(sourceLine), true, `missing source line: ${sourceLine}`);
  }

  assert.equal(output.includes("☐"), false);
  assert.equal(output.includes("☑"), false);
});

test("two-column rounds text inserts a printable page boundary between patients", () => {
  const secondPatient = { ...patient, id: "patient-2", bed: "13", name: "SECOND" };
  const output = buildTwoColumnRoundsText([patient, secondPatient], {});

  assert.equal(output.split("\f").length, 2);
  assert.equal(output.includes("BED 12  PATIENT NAME"), true);
  assert.equal(output.includes("BED 13  SECOND"), true);
});
