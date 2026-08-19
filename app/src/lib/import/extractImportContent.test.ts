import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { extractPatientListContent } from "@/lib/import/extractImportContent";

describe("extractPatientListContent", () => {
  it("keeps document parsers behind the file-selection boundary", () => {
    const importDialogSource = readFileSync("src/components/EpicHandoffImport.tsx", "utf8");
    assert.doesNotMatch(
      importDialogSource,
      /^import .*extractImportContent/m,
      "SheetJS and Mammoth must not load with the authenticated workspace",
    );
    assert.match(
      importDialogSource,
      /await import\("@\/lib\/import\/extractImportContent"\)/,
    );

    for (const sourcePath of [
      "src/lib/import/extractImportContent.ts",
      "src/components/DocumentImport.tsx",
    ]) {
      const source = readFileSync(sourcePath, "utf8");
      assert.doesNotMatch(source, /^import .* from "mammoth"/m, sourcePath);
      assert.match(source, /await import\("mammoth"\)/, sourcePath);
    }

    const extractorSource = readFileSync("src/lib/import/extractImportContent.ts", "utf8");
    assert.doesNotMatch(extractorSource, /^import \* as XLSX from "xlsx"/m);
    assert.match(extractorSource, /await import\("xlsx"\)/);
  });

  it("extracts plain text lists", async () => {
    const file = new File(
      ["ICU-1 Jane Doe (111)\nNeuro: AOx3\nICU-2 John Smith"],
      "list.txt",
      { type: "text/plain" },
    );

    const actual = await extractPatientListContent(file);
    assert.equal(actual.mode, "text");
    if (actual.mode !== "text") return;
    assert.match(actual.text, /ICU-1 Jane Doe/);
    assert.equal(actual.kind, "text");
  });

  it("converts csv rows into labeled patient blocks", async () => {
    const csv = "Name,Bed,Diagnosis\nJane Doe,ICU-1,Sepsis\nJohn Smith,ICU-2,ICH\n";
    const file = new File([csv], "census.csv", { type: "text/csv" });

    const actual = await extractPatientListContent(file);
    assert.equal(actual.mode, "text");
    if (actual.mode !== "text") return;
    assert.match(actual.text, /Patient\/Row 1/);
    assert.match(actual.text, /Name: Jane Doe/);
    assert.match(actual.text, /Bed: ICU-1/);
    assert.match(actual.text, /Diagnosis: Sepsis/);
  });

  it("reads image files as OCR image payloads", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const file = new File([bytes], "scan.png", { type: "image/png" });

    const actual = await extractPatientListContent(file);
    assert.equal(actual.mode, "images");
    if (actual.mode !== "images") return;
    assert.equal(actual.images.length, 1);
    assert.match(actual.images[0] ?? "", /^data:image\/png;base64,/);
  });

  it("rejects pdf uploads with a clear message", async () => {
    const file = new File(["%PDF-1.4"], "list.pdf", { type: "application/pdf" });
    await assert.rejects(
      () => extractPatientListContent(file),
      /pdf import is unavailable/i,
    );
  });
});
