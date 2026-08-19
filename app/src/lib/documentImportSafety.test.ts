import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_DOCX_EXPANDED_BYTES,
  MAX_DOCX_FILE_BYTES,
  MAX_IMPORTED_DOCUMENT_BYTES,
  MAX_TEXT_IMPORT_BYTES,
  validateDocumentImportFile,
  validateDocxArchive,
  validateImportedDocumentContent,
} from "@/lib/documentImportSafety";

function makeCentralDirectoryArchive(uncompressedBytes: number): ArrayBuffer {
  const centralDirectoryBytes = 46;
  const endOfCentralDirectoryBytes = 22;
  const bytes = new Uint8Array(centralDirectoryBytes + endOfCentralDirectoryBytes);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint32(20, 1, true);
  view.setUint32(24, uncompressedBytes, true);

  const eocdOffset = centralDirectoryBytes;
  view.setUint32(eocdOffset, 0x06054b50, true);
  view.setUint16(eocdOffset + 8, 1, true);
  view.setUint16(eocdOffset + 10, 1, true);
  view.setUint32(eocdOffset + 12, centralDirectoryBytes, true);
  view.setUint32(eocdOffset + 16, 0, true);

  return bytes.buffer;
}

describe("document import limits", () => {
  it("rejects oversized input files before they are read", () => {
    assert.match(
      validateDocumentImportFile("notes.txt", MAX_TEXT_IMPORT_BYTES + 1) ?? "",
      /too large/i,
    );
    assert.match(
      validateDocumentImportFile("notes.docx", MAX_DOCX_FILE_BYTES + 1) ?? "",
      /too large/i,
    );
    assert.equal(validateDocumentImportFile("notes.txt", 100), null);
    assert.equal(validateDocumentImportFile("notes.docx", 100), null);
  });

  it("rejects DOCX archives whose declared expansion exceeds the cap", () => {
    assert.equal(
      validateDocxArchive(makeCentralDirectoryArchive(1_024)),
      null,
    );
    assert.match(
      validateDocxArchive(
        makeCentralDirectoryArchive(MAX_DOCX_EXPANDED_BYTES + 1),
      ) ?? "",
      /expanded size limit/i,
    );
    assert.match(validateDocxArchive(new ArrayBuffer(8)) ?? "", /invalid/i);
  });

  it("caps converted content before editor insertion", () => {
    assert.equal(validateImportedDocumentContent("short"), null);
    assert.match(
      validateImportedDocumentContent("x".repeat(MAX_IMPORTED_DOCUMENT_BYTES + 1)) ?? "",
      /too much content/i,
    );
  });
});
