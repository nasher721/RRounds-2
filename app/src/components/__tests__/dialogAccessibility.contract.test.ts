import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const fromRoot = (...segments: string[]) => path.join(process.cwd(), ...segments);

const countMatches = (source: string, pattern: RegExp) => [...source.matchAll(pattern)].length;

const readSource = (relativePath: string) => readFileSync(fromRoot(relativePath), "utf8");

const titleSignalPattern = /<(DialogTitle|SheetTitle|AlertDialogTitle)(?:\s|>)/g;
const descriptionComponentPattern = /<(DialogDescription|SheetDescription|AlertDialogDescription)(?:\s|>)/g;
const ariaOverridePattern = /aria-describedby=\{undefined\}/g;

/**
 * High-traffic dialogs from the production-readiness report.
 * Each file must expose accessible title + description (or documented opt-out).
 */
const dialogA11yTargets = [
  {
    file: "src/components/MultiPatientComparison.tsx",
    expectedTitles: 1,
    expectedDescriptions: 1,
  },
  {
    file: "src/components/VoiceCommandPanel.tsx",
    expectedTitles: 2,
    expectedDescriptions: 2,
  },
  {
    file: "src/components/UnifiedAIDropdown.tsx",
    expectedTitles: 3,
    expectedDescriptions: 3,
  },
  {
    file: "src/components/ui/command.tsx",
    expectedTitles: 1,
    expectedDescriptions: 1,
  },
  {
    file: "src/components/phrases/PhraseManager.tsx",
    expectedTitles: 4,
    expectedDescriptions: 4,
  },
  {
    file: "src/components/phrases/PhraseFormDialog.tsx",
    expectedTitles: 1,
    expectedDescriptions: 1,
  },
  {
    file: "src/components/PatientInfoToolbarCustomizeDialog.tsx",
    expectedTitles: 1,
    expectedDescriptions: 1,
  },
  {
    file: "src/components/PrintExportModalFull.tsx",
    expectedTitles: 1,
    expectedDescriptions: 2,
  },
  {
    file: "src/components/print/CustomCombinationDialog.tsx",
    expectedTitles: 1,
    expectedDescriptions: 1,
  },
  {
    file: "src/components/EpicHandoffImport.tsx",
    expectedTitles: 1,
    expectedDescriptions: 1,
  },
  {
    file: "src/components/import/CSVColumnMapper.tsx",
    expectedTitles: 1,
    expectedDescriptions: 1,
  },
  {
    file: "src/components/DocumentImport.tsx",
    expectedTitles: 1,
    expectedDescriptions: 1,
  },
  {
    file: "src/components/SmartPatientImport.tsx",
    expectedTitles: 1,
    expectedDescriptions: 1,
  },
  {
    file: "src/components/tools/timeline/TimelineDialog.tsx",
    expectedTitles: 1,
    expectedDescriptions: 1,
  },
  {
    file: "src/components/ImageLightbox.tsx",
    expectedTitles: 1,
    expectedDescriptions: 1,
  },
  {
    file: "src/components/dashboard/MobileDashboard.tsx",
    expectedTitles: 3,
    expectedDescriptions: 3,
  },
] as const;

test("dialog surfaces provide title and description signals in targeted files", () => {
  for (const target of dialogA11yTargets) {
    const source = readSource(target.file);
    const titleCount = countMatches(source, titleSignalPattern);
    const descriptionCount =
      countMatches(source, descriptionComponentPattern) +
      countMatches(source, ariaOverridePattern);

    assert.ok(
      titleCount >= target.expectedTitles,
      `${target.file} should include at least ${target.expectedTitles} dialog title signal(s); found ${titleCount}.`,
    );
    assert.ok(
      descriptionCount >= target.expectedDescriptions,
      `${target.file} should include at least ${target.expectedDescriptions} dialog description signal(s); found ${descriptionCount}.`,
    );
  }
});
