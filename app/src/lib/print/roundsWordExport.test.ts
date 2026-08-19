import assert from "node:assert/strict";
import test from "node:test";

import type { Patient } from "@/types/patient";
import { buildRoundsWordHtml, generateRoundsWordFilename } from "./roundsWordExport";
import { DEFAULT_ROUNDS_SINGLE, DEFAULT_ROUNDS_TWO_COLUMN } from "./roundsTypes";

const patient = {
  id: "patient-1",
  patientNumber: 1,
  name: "PATIENT <NAME>",
  mrn: "MRN-1",
  bed: "12",
  clinicalSummary: "62M POD2",
  intervalEvents: "<p>Overnight line 1</p>",
  imaging: "",
  labs: "Na 140 | WBC 8",
  systems: {
    neuro: "Neuro line",
    cv: "",
    resp: "",
    renalGU: "",
    gi: "",
    endo: "",
    heme: "",
    infectious: "",
    skinLines: "",
    dispo: "ICU, full code",
  },
  medications: { infusions: [], scheduled: [], prn: [], rawText: "" },
  fieldTimestamps: {},
  collapsed: false,
  createdAt: "2026-08-12T12:00:00.000Z",
  lastModified: "2026-08-12T12:00:00.000Z",
} satisfies Patient;

test("word export carries the page geometry Word needs", () => {
  const html = buildRoundsWordHtml([patient], {}, DEFAULT_ROUNDS_SINGLE);

  assert.match(html, /@page WordSection1/);
  assert.match(html, /size: 8\.500in 11\.000in/);
  assert.match(html, /margin: 0\.500in/);
  assert.equal(html.includes("mso-column-count"), false);
});

test("the two-column variant asks Word for real newspaper columns", () => {
  const html = buildRoundsWordHtml([patient], {}, DEFAULT_ROUNDS_TWO_COLUMN);

  assert.match(html, /mso-column-count:2/);
  assert.match(html, /mso-column-separator:yes/);
  assert.match(html, /column-count: 2/);
});

test("clinical content is escaped and reproduced verbatim", () => {
  const html = buildRoundsWordHtml([patient], {}, DEFAULT_ROUNDS_SINGLE);

  assert.equal(html.includes("PATIENT &lt;NAME&gt;"), true);
  assert.equal(html.includes("PATIENT <NAME>"), false);
  assert.equal(html.includes("Overnight line 1"), true);
  assert.equal(html.includes("Na 140 | WBC 8"), true);
  assert.equal(html.includes("ICU, full code"), true);
  assert.equal(html.includes("BED 12"), true);
});

test("a page break separates patients when one per page is set", () => {
  const second = { ...patient, id: "patient-2", bed: "13", name: "SECOND" };
  const html = buildRoundsWordHtml([patient, second], {}, DEFAULT_ROUNDS_SINGLE);

  assert.equal(html.split("page-break-before:always").length - 1, 1);

  const continuous = buildRoundsWordHtml([patient, second], {}, {
    ...DEFAULT_ROUNDS_SINGLE,
    onePatientPerPage: false,
  });
  assert.equal(continuous.includes("page-break-before:always"), false);
});

test("filenames record the variant and date", () => {
  const date = new Date("2026-03-08T12:00:00.000Z");
  assert.equal(generateRoundsWordFilename({ variant: "single" }, date), "Rounds_3-8-26.doc");
  assert.equal(generateRoundsWordFilename({ variant: "twoColumn" }, date), "Rounds_2col_3-8-26.doc");
});
