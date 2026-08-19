import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyClinicalFragmentToChartSection,
  organizeCsvImportRecord,
  organizeImportedPatient,
} from "@/lib/import/organizeImportedPatient";

describe("organizeImportedPatient", () => {
  it("maps core identity and system fields into chart payload", () => {
    const actual = organizeImportedPatient({
      name: "Jane Doe",
      mrn: "123",
      age: "72 yo",
      sex: "F",
      bed: "ICU-4",
      handoffSummary: "Septic shock",
      intervalEvents: "Started norepi",
      systems: {
        neuro: "AOx3",
        resp: "Intubated",
      },
      medications: {
        infusions: ["Norepinephrine 5 mcg/kg/min"],
        scheduled: [],
        prn: [],
      },
    });

    assert.equal(actual.bed, "ICU-4");
    assert.match(actual.name, /Jane Doe/);
    assert.equal(actual.name, "Jane Doe");
    assert.equal(actual.mrn, "123");
    assert.equal(actual.clinicalSummary, "Septic shock");
    assert.equal(actual.intervalEvents, "Started norepi");
    assert.equal(actual.systems.neuro, "AOx3");
    assert.equal(actual.systems.resp, "Intubated");
    assert.deepEqual(actual.medications.infusions, ["Norepinephrine 5 mcg/kg/min"]);
    assert.equal(actual.age, 72);
    assert.equal(actual.gender, "female");
  });

  it("preserves structured CSV identity and status fields outside clinical prose", () => {
    const actual = organizeCsvImportRecord({
      name: "Jane Doe",
      mrn: "123",
      bed: "MICU 4",
      diagnosis: "Septic shock",
      dob: "1980-01-02T00:00:00.000Z",
      gender: "F",
      admissionDate: "2026-08-01T00:00:00.000Z",
      attending: "Dr Smith",
      service: "MICU",
      codeStatus: "DNR",
      isolation: "Contact",
    });

    assert.equal(actual.name, "Jane Doe");
    assert.equal(actual.clinicalSummary, "Septic shock");
    assert.equal(actual.dateOfBirth, "1980-01-02");
    assert.equal(actual.gender, "female");
    assert.equal(actual.admissionDate, "2026-08-01T00:00:00.000Z");
    assert.equal(actual.attendingPhysician, "Dr Smith");
    assert.equal(actual.serviceLine, "MICU");
    assert.equal(actual.codeStatus, "dnr");
    assert.deepEqual(actual.alerts, ["Isolation: Contact"]);
  });

  it("uses room when bed is missing", () => {
    const actual = organizeImportedPatient({
      name: "John Smith",
      room: "H022-01",
      clinicalSummary: "ICH",
    });
    assert.equal(actual.bed, "H022-01");
  });

  it("routes common handoff labels into the matching chart sections", () => {
    const cases = [
      ["What we did on rounds", "intervalEvents"],
      ["Overnight events", "intervalEvents"],
      ["CXR / Imaging", "imaging"],
      ["Laboratory results", "labs"],
      ["Meds / Drips", "medications"],
      ["Neurologic", "systems.neuro"],
      ["Hemodynamics", "systems.cv"],
      ["Pulm / Vent", "systems.resp"],
      ["Vent settings", "systems.resp"],
      ["Renal & GU", "systems.renalGU"],
      ["Nutrition / GI", "systems.gi"],
      ["Endocrine", "systems.endo"],
      ["Hematology / Coag", "systems.heme"],
      ["Infectious Disease", "systems.infectious"],
      ["Access / Lines", "systems.skinLines"],
      ["Disposition / Goals of Care", "systems.dispo"],
      ["Renal labs", "systems.renalGU"],
      ["Resp imaging", "systems.resp"],
      ["Heme / CBC", "systems.heme"],
      ["Date of birth", "clinicalSummary"],
      ["Assessment & Plan", "clinicalSummary"],
      ["Patient ID", "clinicalSummary"],
      ["Response", "clinicalSummary"],
      ["Endorsement", "clinicalSummary"],
      ["Baseline note", "clinicalSummary"],
      ["Collaborative assessment", "clinicalSummary"],
      ["Clinical timeline", "clinicalSummary"],
      ["Unmapped clinical detail", "clinicalSummary"],
    ] as const;

    for (const [label, expected] of cases) {
      assert.equal(
        classifyClinicalFragmentToChartSection(label, "clinical content"),
        expected,
        label,
      );
    }
  });

  it("organizes extra labeled fragments without mixing them into the summary", () => {
    const actual = organizeImportedPatient({
      name: "Ada",
      bed: "1",
      clinicalSummary: "Base",
      Pulm: "Intubated on volume control",
      "Overnight events": "Started norepinephrine",
      "Access / Lines": "Right IJ central line",
      "Home meds": "Aspirin 81 mg daily",
      BMP: { sodium: 140, creatinine: 1.1 },
      HR: 90,
    });

    assert.equal(actual.clinicalSummary, "Base\n90");
    assert.equal(actual.intervalEvents, "Started norepinephrine");
    assert.equal(actual.systems.resp, "Intubated on volume control");
    assert.equal(actual.systems.skinLines, "Right IJ central line");
    assert.equal(actual.medications.rawText, "Aspirin 81 mg daily");
    assert.equal(actual.labs, "sodium: 140, creatinine: 1.1");
  });
});
