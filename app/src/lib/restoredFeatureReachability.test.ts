import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("restored chart tools are reachable on desktop and mobile", async () => {
  const patientCard = await read("src/components/PatientCard.tsx");
  const mobileDetail = await read("src/components/mobile/MobilePatientDetail.tsx");

  for (const source of [patientCard, mobileDetail]) {
    assert.match(source, /<SmartLabParser/);
    assert.match(source, /<OpenFDAChecker/);
    assert.match(source, /patient\.labs\.trim\(\)/);
  }
});

test("restored desktop utilities expose backup export and shortcut customization", async () => {
  const dashboard = await read("src/components/dashboard/DesktopDashboard.tsx");

  assert.match(dashboard, /Export roster backup \(JSON\)/);
  assert.match(dashboard, /aria-label="Workflow shortcuts"/);
  assert.match(dashboard, /aria-label="Smart patient import"/);
  assert.match(dashboard, /aria-label="Import patient list"/);
  assert.match(dashboard, /aria-label="Import patient list from CSV"/);
  assert.match(dashboard, /aria-label="Open clinical AI setup"/);
  assert.match(dashboard, /Print \/ Export/);
  assert.match(dashboard, /<KeyboardShortcutSystem/);
  assert.match(dashboard, /<MedicationDoseCalculators/);
  assert.match(dashboard, /onExportRoster=\{handleExport\}/);
});

test("mobile settings expose timeline and renal-function tools", async () => {
  const settings = await read("src/components/mobile/MobileSettingsPanel.tsx");

  assert.match(settings, /<TimelineDialog/);
  assert.match(settings, /<MedicationDoseCalculators/);
});

test("mobile patient-list import exposes both smart parsing and deterministic CSV mapping", async () => {
  const dashboard = await read("src/components/dashboard/MobileDashboard.tsx");

  assert.match(dashboard, /<TabsTrigger value="smart-list">Smart list<\/TabsTrigger>/);
  assert.match(dashboard, /<TabsTrigger value="csv">CSV mapping<\/TabsTrigger>/);
  assert.match(dashboard, /<EpicHandoffImport/);
  assert.match(dashboard, /<CSVColumnMapper/);
  assert.match(dashboard, /records\.map\(organizeCsvImportRecord\)/);
});

test("roster search includes all documented clinical sections", async () => {
  const filter = await read("src/hooks/usePatientFilter.ts");

  assert.match(filter, /patient\.imaging/);
  assert.match(filter, /patient\.labs/);
  assert.match(filter, /Object\.values\(patient\.systems\)/);
  assert.match(filter, /patient\.medications\.infusions/);
});
