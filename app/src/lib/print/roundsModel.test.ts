import assert from "node:assert/strict";
import test from "node:test";

import type { Patient } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";
import {
  buildRoundsDocumentModel,
  buildRoundsPatientModel,
  isHeadingSourceLine,
  readableTextColor,
  resolveRoundsColor,
  toGrayscale,
} from "./roundsModel";
import {
  DEFAULT_ROUNDS_SINGLE,
  DEFAULT_ROUNDS_TWO_COLUMN,
  ROUNDS_SECTION_DEFAULTS,
  getRoundsPageMetrics,
  normalizeRoundsSettings,
  type RoundsSettings,
} from "./roundsTypes";

const patient = {
  id: "patient-1",
  patientNumber: 4,
  name: "PATIENT NAME",
  mrn: "MRN-987654",
  bed: "12",
  clinicalSummary: "<p>62M POD2 craniotomy</p>",
  intervalEvents: "<p>Overnight line 1</p><p>[ ] Overnight plan</p>",
  imaging: "CT unchanged",
  labs: "Na 140 | WBC 8",
  systems: {
    neuro: "<p>Exam:</p><p>CTH 3/7: Stable</p><p>MRI 3/7: No change</p>",
    cv: "CV line",
    resp: "",
    renalGU: "Renal line",
    gi: "",
    endo: "",
    heme: "",
    infectious: "",
    skinLines: "",
    dispo: "ICU, full code",
  },
  medications: {
    infusions: ["Norepinephrine 4 mcg/min"],
    scheduled: ["Keppra 1g BID"],
    prn: [],
    rawText: "",
  },
  fieldTimestamps: {},
  collapsed: false,
  createdAt: "2026-08-12T12:00:00.000Z",
  lastModified: "2026-08-12T12:00:00.000Z",
  age: 62,
  codeStatus: "full",
  alerts: ["Penicillin allergy"],
} satisfies Patient;

const todos: PatientTodo[] = [
  {
    id: "todo-1",
    patientId: patient.id,
    userId: "user-1",
    section: null,
    content: "Call family",
    completed: false,
    createdAt: "2026-08-12T12:00:00.000Z",
    updatedAt: "2026-08-12T12:00:00.000Z",
  },
];

const settingsWith = (patch: Partial<RoundsSettings>): RoundsSettings =>
  normalizeRoundsSettings({ ...DEFAULT_ROUNDS_SINGLE, ...patch }, "single");

test("rounds model reproduces every source line verbatim and in order", () => {
  const model = buildRoundsPatientModel(patient, todos, DEFAULT_ROUNDS_SINGLE);
  const neuro = model.sections.find((section) => section.key === "neuro");

  assert.ok(neuro);
  assert.deepEqual(neuro.lines, ["Exam:", "CTH 3/7: Stable", "MRI 3/7: No change"]);

  const events = model.sections.find((section) => section.key === "intervalEvents");
  assert.deepEqual(events?.lines, ["Overnight line 1", "[ ] Overnight plan"]);

  const meds = model.sections.find((section) => section.key === "medications");
  assert.deepEqual(meds?.lines, [
    "Infusions: Norepinephrine 4 mcg/min",
    "Scheduled: Keppra 1g BID",
  ]);
});

test("empty systems are dropped unless empty sections are requested", () => {
  const hidden = buildRoundsPatientModel(patient, todos, DEFAULT_ROUNDS_SINGLE);
  assert.equal(hidden.sections.some((section) => section.key === "resp"), false);

  const shown = buildRoundsPatientModel(
    patient,
    todos,
    settingsWith({ showEmptySections: true }),
  );
  const resp = shown.sections.find((section) => section.key === "resp");
  assert.ok(resp);
  assert.deepEqual(resp.lines, []);
});

test("disposition renders as its own bar and leaves the section flow", () => {
  const barred = buildRoundsPatientModel(patient, todos, DEFAULT_ROUNDS_SINGLE);
  assert.deepEqual(barred.dispo?.lines, ["ICU, full code"]);
  assert.equal(barred.sections.some((section) => section.key === "dispo"), false);

  const inline = buildRoundsPatientModel(patient, todos, settingsWith({ dispoStyle: "section" }));
  assert.equal(inline.dispo, null);
  assert.equal(inline.sections.some((section) => section.key === "dispo"), true);
});

test("to-dos keep their completion state for checkbox rendering", () => {
  const model = buildRoundsPatientModel(
    patient,
    [...todos, { ...todos[0], id: "todo-2", content: "Wean sedation", completed: true }],
    DEFAULT_ROUNDS_SINGLE,
  );
  const section = model.sections.find((s) => s.key === "todos");
  assert.deepEqual(section?.todos, [
    { content: "Call family", completed: false },
    { content: "Wean sedation", completed: true },
  ]);
});

test("the notes section is never treated as empty content", () => {
  const model = buildRoundsPatientModel(
    patient,
    todos,
    settingsWith({
      sections: ROUNDS_SECTION_DEFAULTS.map((section) =>
        section.key === "notes" ? { ...section, enabled: true } : section,
      ),
    }),
  );
  assert.equal(model.sections.some((section) => section.key === "notes"), true);
});

test("banner identifiers appear only when their toggle is on", () => {
  const bare = buildRoundsPatientModel(patient, todos, DEFAULT_ROUNDS_SINGLE);
  assert.equal(bare.bedLabel, "BED 12");
  assert.equal(bare.metaLine, "");
  assert.deepEqual(bare.allergies, []);
  assert.deepEqual(bare.summaryLines, ["62M POD2 craniotomy"]);

  const detailed = buildRoundsPatientModel(
    patient,
    todos,
    settingsWith({
      showBed: false,
      showMrn: true,
      showPatientNumber: true,
      showAge: true,
      showCodeStatus: true,
      showAllergies: true,
      showSummary: false,
    }),
  );
  assert.equal(detailed.bedLabel, "");
  assert.equal(detailed.metaLine, "#4 · MRN …7654 · 62y · Full Code");
  assert.deepEqual(detailed.allergies, ["Penicillin allergy"]);
  assert.deepEqual(detailed.summaryLines, []);
});

test("section order follows the configured order", () => {
  const reordered = settingsWith({
    sections: [...ROUNDS_SECTION_DEFAULTS].reverse().map((section) => ({ ...section })),
  });
  const model = buildRoundsPatientModel(patient, todos, reordered);
  const keys = model.sections.map((section) => section.key);
  assert.ok(keys.indexOf("medications") < keys.indexOf("neuro"));
});

test("document model covers every patient", () => {
  const second = { ...patient, id: "patient-2", bed: "13", name: "SECOND" };
  const models = buildRoundsDocumentModel([patient, second], { [patient.id]: todos }, DEFAULT_ROUNDS_SINGLE);
  assert.deepEqual(models.map((model) => model.id), ["patient-1", "patient-2"]);
  assert.equal(models[1].sections.some((section) => section.key === "todos"), false);
});

test("typed heading lines are detected without altering their text", () => {
  assert.equal(isHeadingSourceLine("Exam:"), true);
  assert.equal(isHeadingSourceLine("CTH 3/7: Stable"), false);
  assert.equal(isHeadingSourceLine(""), false);
  assert.equal(isHeadingSourceLine(`${"x".repeat(80)}:`), false);
});

test("colour helpers respect the selected colour mode", () => {
  assert.equal(resolveRoundsColor("#1F4E79", "color"), "#1F4E79");
  assert.equal(resolveRoundsColor("#1F4E79", "grayscale"), toGrayscale("#1F4E79"));
  assert.match(toGrayscale("#C00000"), /^#[0-9a-f]{6}$/);
  assert.equal(readableTextColor("#1F4E79"), "#FFFFFF");
  assert.equal(readableTextColor("#FFD966"), "#1F2D3D");
});

test("page metrics follow paper size and orientation", () => {
  const letter = getRoundsPageMetrics(DEFAULT_ROUNDS_SINGLE);
  assert.equal(letter.widthMm, 215.9);
  assert.equal(letter.heightMm, 279.4);

  const landscape = getRoundsPageMetrics({ ...DEFAULT_ROUNDS_SINGLE, orientation: "landscape" });
  assert.equal(landscape.widthMm, 279.4);
  assert.equal(landscape.heightMm, 215.9);

  const a4 = getRoundsPageMetrics({ ...DEFAULT_ROUNDS_SINGLE, pageSize: "a4" });
  assert.equal(a4.widthMm, 210);
});

test("the two-column default matches the condensed house style", () => {
  assert.equal(DEFAULT_ROUNDS_TWO_COLUMN.variant, "twoColumn");
  assert.equal(DEFAULT_ROUNDS_TWO_COLUMN.bodyPt, 7.5);
  assert.equal(DEFAULT_ROUNDS_TWO_COLUMN.columnCount, 2);
  assert.equal(DEFAULT_ROUNDS_TWO_COLUMN.onePatientPerPage, true);
  assert.equal(DEFAULT_ROUNDS_SINGLE.bodyPt, 9);
  assert.equal(DEFAULT_ROUNDS_SINGLE.onePatientPerPage, true);
});
