import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(
  path.join(process.cwd(), "src/components/import/CSVColumnMapper.tsx"),
  "utf8",
);

test("CSV import actions use native keyboard-operable controls", () => {
  assert.match(source, /<button[\s\S]*?type="button"[\s\S]*?aria-label="Upload CSV file"/);
  assert.match(source, /<button[\s\S]*?type="button"[\s\S]*?aria-label="Paste CSV content from clipboard"/);
  assert.match(source, /className="sr-only"[\s\S]*?aria-hidden="true"/);
});

test("CSV mapping controls expose a unique label and id for every header", () => {
  assert.match(source, /parsedData\.headers\.map\(\(header, headerIndex\) =>/);
  assert.match(source, /const mappingSelectId = `csv-column-mapping-\$\{headerIndex\}`/);
  assert.match(source, /<Label htmlFor=\{mappingSelectId\}/);
  assert.match(source, /id=\{mappingSelectId\}/);
  assert.match(source, /aria-label=\{`Map CSV column \$\{header\} to patient field`\}/);
});

test("CSV import blocks malformed structure and oversized browser input before mapping", () => {
  assert.match(source, /content\.length > MAX_EXTRACTED_PATIENT_LIST_CHARS/);
  assert.match(source, /file\.size > MAX_PATIENT_LIST_SPREADSHEET_BYTES/);
  assert.match(source, /if \(parsed\.errors\.length > 0\)/);
  assert.match(source, /title: "CSV needs correction"/);
});
