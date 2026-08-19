/**
 * Safety limits and file-type checks for patient-list import.
 * Broader than editor document import: lists may arrive as spreadsheets,
 * HTML exports, JSON, images, or handoff text.
 */

export const MAX_PATIENT_LIST_TEXT_BYTES = 4 * 1024 * 1024;
export const MAX_PATIENT_LIST_DOCX_BYTES = 15 * 1024 * 1024;
export const MAX_PATIENT_LIST_SPREADSHEET_BYTES = 15 * 1024 * 1024;
export const MAX_PATIENT_LIST_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_PATIENT_LIST_JSON_BYTES = 8 * 1024 * 1024;
export const MAX_EXTRACTED_PATIENT_LIST_CHARS = 1_000_000;

export type PatientListImportKind =
  | "text"
  | "docx"
  | "spreadsheet"
  | "html"
  | "json"
  | "image"
  | "pdf"
  | "rtf";

const EXTENSION_TO_KIND: Record<string, PatientListImportKind> = {
  txt: "text",
  text: "text",
  md: "text",
  markdown: "text",
  csv: "spreadsheet",
  tsv: "spreadsheet",
  tab: "spreadsheet",
  xlsx: "spreadsheet",
  xls: "spreadsheet",
  ods: "spreadsheet",
  docx: "docx",
  html: "html",
  htm: "html",
  json: "json",
  rtf: "rtf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  pdf: "pdf",
};

const MIME_TO_KIND: Record<string, PatientListImportKind> = {
  "text/plain": "text",
  "text/markdown": "text",
  "text/csv": "spreadsheet",
  "text/tab-separated-values": "spreadsheet",
  "application/vnd.ms-excel": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet",
  "application/vnd.oasis.opendocument.spreadsheet": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/html": "html",
  "application/json": "json",
  "application/rtf": "rtf",
  "text/rtf": "rtf",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "application/pdf": "pdf",
};

const KIND_BYTE_LIMITS: Record<PatientListImportKind, number> = {
  text: MAX_PATIENT_LIST_TEXT_BYTES,
  docx: MAX_PATIENT_LIST_DOCX_BYTES,
  spreadsheet: MAX_PATIENT_LIST_SPREADSHEET_BYTES,
  html: MAX_PATIENT_LIST_TEXT_BYTES,
  json: MAX_PATIENT_LIST_JSON_BYTES,
  image: MAX_PATIENT_LIST_IMAGE_BYTES,
  pdf: MAX_PATIENT_LIST_DOCX_BYTES,
  rtf: MAX_PATIENT_LIST_TEXT_BYTES,
};

export const getFileExtension = (fileName: string): string => {
  const baseName = fileName.split(/[/\\]/).pop() ?? fileName;
  const dotIndex = baseName.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return baseName.slice(dotIndex + 1).toLowerCase();
};

export const detectPatientListImportKind = (
  fileName: string,
  mimeType = "",
): PatientListImportKind | null => {
  const extension = getFileExtension(fileName);
  if (extension && EXTENSION_TO_KIND[extension]) {
    return EXTENSION_TO_KIND[extension];
  }

  const normalizedMime = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (normalizedMime && MIME_TO_KIND[normalizedMime]) {
    return MIME_TO_KIND[normalizedMime];
  }

  if (normalizedMime.startsWith("text/")) {
    return "text";
  }

  return null;
};

export const validatePatientListImportFile = (
  fileName: string,
  fileBytes: number,
  mimeType = "",
): string | null => {
  const kind = detectPatientListImportKind(fileName, mimeType);
  if (!kind) {
    return "Unsupported file type. Try text, Word, Excel/CSV, HTML, JSON, RTF, or an image of the list.";
  }

  if (kind === "pdf") {
    return "PDF import is unavailable until the PDF processor is bundled securely. Export as text/Word/Excel or paste the list.";
  }

  if (!Number.isSafeInteger(fileBytes) || fileBytes < 0) {
    return "The selected file has an invalid size";
  }

  if (fileBytes === 0) {
    return "The selected file is empty";
  }

  if (fileBytes > KIND_BYTE_LIMITS[kind]) {
    return "The selected file is too large to import safely";
  }

  return null;
};

export const validateExtractedPatientListText = (content: string): string | null => {
  if (!content.trim()) {
    return "Could not extract any usable text from the file";
  }
  if (content.length > MAX_EXTRACTED_PATIENT_LIST_CHARS) {
    return "Extracted content is too large to parse in one request. Split the list and import in sections.";
  }
  return null;
};

export const PATIENT_LIST_ACCEPT_ATTRIBUTE = [
  ".txt",
  ".md",
  ".csv",
  ".tsv",
  ".xlsx",
  ".xls",
  ".docx",
  ".html",
  ".htm",
  ".json",
  ".rtf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  "text/plain",
  "text/csv",
  "text/html",
  "application/json",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/*",
].join(",");
