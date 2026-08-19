import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ROUNDS_SINGLE,
  DEFAULT_ROUNDS_TWO_COLUMN,
  ROUNDS_SECTION_DEFAULTS,
  ROUNDS_STYLE_PRESETS,
  normalizeRoundsSettings,
} from "./roundsTypes";

test("stored settings fall back to the variant default", () => {
  const single = normalizeRoundsSettings(undefined, "single");
  assert.deepEqual(single, DEFAULT_ROUNDS_SINGLE);

  const two = normalizeRoundsSettings(undefined, "twoColumn");
  assert.deepEqual(two, DEFAULT_ROUNDS_TWO_COLUMN);
});

test("out-of-range and malformed values are clamped instead of trusted", () => {
  const settings = normalizeRoundsSettings(
    {
      bodyPt: 400,
      marginMm: -20,
      columnCount: 99,
      lineHeight: 0,
      notesLineCount: 0,
      headerBg: "javascript:alert(1)",
      dispoBg: "#GGGGGG",
      pageSize: "poster",
      colorMode: "neon",
      documentTitle: "   ",
    } as never,
    "single",
  );

  assert.equal(settings.bodyPt, 20);
  assert.equal(settings.marginMm, 3);
  assert.equal(settings.columnCount, 4);
  assert.equal(settings.lineHeight, 0.9);
  assert.equal(settings.notesLineCount, 1);
  assert.equal(settings.headerBg, DEFAULT_ROUNDS_SINGLE.headerBg);
  assert.equal(settings.dispoBg, DEFAULT_ROUNDS_SINGLE.dispoBg);
  assert.equal(settings.pageSize, "letter");
  assert.equal(settings.colorMode, "color");
  assert.equal(settings.documentTitle, DEFAULT_ROUNDS_SINGLE.documentTitle);
});

test("valid customizations survive normalization", () => {
  const settings = normalizeRoundsSettings(
    {
      bodyPt: 7.5,
      marginMm: 10.2,
      columnCount: 3,
      columnFill: "sequential",
      colorMode: "mono",
      sectionHeaderStyle: "underline",
      headerBg: "#123456",
      documentTitle: "Night Rounds",
      showAllergies: true,
      onePatientPerPage: false,
    },
    "twoColumn",
  );

  assert.equal(settings.bodyPt, 7.5);
  assert.equal(settings.marginMm, 10.2);
  assert.equal(settings.columnCount, 3);
  assert.equal(settings.columnFill, "sequential");
  assert.equal(settings.colorMode, "mono");
  assert.equal(settings.sectionHeaderStyle, "underline");
  assert.equal(settings.headerBg, "#123456");
  assert.equal(settings.documentTitle, "Night Rounds");
  assert.equal(settings.showAllergies, true);
  assert.equal(settings.onePatientPerPage, false);
});

test("a stored section order is preserved and newly shipped sections are appended", () => {
  const stored = normalizeRoundsSettings(
    {
      sections: [
        { key: "medications", label: "MEDS", color: "#111111", enabled: true },
        { key: "neuro", label: "Neuro", color: "#1F4E79", enabled: false },
      ],
    } as never,
    "single",
  );

  assert.equal(stored.sections[0].key, "medications");
  assert.equal(stored.sections[0].label, "MEDS");
  assert.equal(stored.sections[0].color, "#111111");
  assert.equal(stored.sections[1].key, "neuro");
  assert.equal(stored.sections[1].enabled, false);

  // Nothing shipped in this build may go missing just because it was not stored.
  assert.equal(stored.sections.length, ROUNDS_SECTION_DEFAULTS.length);
  const keys = new Set(stored.sections.map((section) => section.key));
  ROUNDS_SECTION_DEFAULTS.forEach((section) => assert.equal(keys.has(section.key), true));
});

test("unknown or duplicated stored sections are discarded", () => {
  const settings = normalizeRoundsSettings(
    {
      sections: [
        { key: "neuro", label: "First", color: "#1F4E79", enabled: true },
        { key: "neuro", label: "Duplicate", color: "#000000", enabled: false },
        { key: "not-a-section", label: "Bogus", color: "#000000", enabled: true },
      ],
    } as never,
    "single",
  );

  const neuro = settings.sections.filter((section) => section.key === "neuro");
  assert.equal(neuro.length, 1);
  assert.equal(neuro[0].label, "First");
  assert.equal(settings.sections.length, ROUNDS_SECTION_DEFAULTS.length);
});

test("style presets return usable settings and keep the section list", () => {
  const start = normalizeRoundsSettings(
    {
      sections: ROUNDS_SECTION_DEFAULTS.map((section) =>
        section.key === "labs" ? { ...section, enabled: false } : { ...section },
      ),
    } as never,
    "twoColumn",
  );

  ROUNDS_STYLE_PRESETS.forEach((preset) => {
    const applied = normalizeRoundsSettings(preset.apply(start), start.variant);
    assert.equal(applied.sections.length, ROUNDS_SECTION_DEFAULTS.length);
    assert.ok(applied.bodyPt >= 5 && applied.bodyPt <= 20, `${preset.id} body size`);
    assert.ok(applied.marginMm >= 3, `${preset.id} margin`);
  });

  const inkSaver = ROUNDS_STYLE_PRESETS.find((preset) => preset.id === "ink-saver");
  assert.equal(inkSaver?.apply(start).colorMode, "mono");

  const houseSingle = ROUNDS_STYLE_PRESETS.find((preset) => preset.id === "house-single");
  // Presets restyle the page; they never switch the chosen column variant.
  assert.equal(houseSingle?.apply(start).variant, "twoColumn");
});
