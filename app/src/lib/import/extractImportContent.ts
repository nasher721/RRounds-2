/**
 * Multi-format patient-list content extraction.
 * Turns nearly any common clinical export into text (or images for OCR).
 */

import type { WorkBook } from "xlsx";
import { validateDocxArchive } from "@/lib/documentImportSafety";
import {
  detectPatientListImportKind,
  validateExtractedPatientListText,
  validatePatientListImportFile,
  type PatientListImportKind,
} from "@/lib/import/patientListImportSafety";

export type ExtractedPatientListContent =
  | {
      mode: "text";
      text: string;
      kind: PatientListImportKind;
      label: string;
    }
  | {
      mode: "images";
      images: string[];
      kind: "image";
      label: string;
    };

const stripHtmlToText = (html: string): string => {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  return withoutScripts
    .replace(/<\/(p|div|tr|li|h[1-6]|br|hr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

const stripRtfToText = (rtf: string): string => {
  return rtf
    .replace(/\\par[d]?/gi, "\n")
    .replace(/\\tab/gi, "\t")
    .replace(/\\'[0-9a-fA-F]{2}/g, "")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\r?\n+/g, "\n")
    .trim();
};

const sheetToLabeledText = (
  workbook: WorkBook,
  utils: typeof import("xlsx").utils,
): string => {
  const chunks: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    if (rows.length === 0) {
      const matrix = utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });
      if (matrix.length === 0) continue;
      chunks.push(`### Sheet: ${sheetName}`);
      for (const row of matrix) {
        const cells = row.map((cell) => String(cell ?? "").trim()).filter(Boolean);
        if (cells.length > 0) {
          chunks.push(cells.join(" | "));
        }
      }
      continue;
    }

    chunks.push(`### Sheet: ${sheetName}`);
    rows.forEach((row, index) => {
      const fields = Object.entries(row)
        .map(([key, value]) => {
          const text = String(value ?? "").trim();
          if (!text) return null;
          return `${key}: ${text}`;
        })
        .filter((entry): entry is string => Boolean(entry));

      if (fields.length === 0) return;
      chunks.push(`--- Patient/Row ${index + 1} ---`);
      chunks.push(fields.join("\n"));
    });
  }

  return chunks.join("\n\n").trim();
};

const normalizeJsonPatientList = (raw: unknown): string => {
  if (typeof raw === "string") {
    return raw.trim();
  }

  if (Array.isArray(raw)) {
    return raw
      .map((entry, index) => {
        if (typeof entry === "string") {
          return `--- Patient/Row ${index + 1} ---\n${entry}`;
        }
        if (entry && typeof entry === "object") {
          const fields = Object.entries(entry as Record<string, unknown>)
            .map(([key, value]) => {
              const text =
                typeof value === "string"
                  ? value
                  : value == null
                    ? ""
                    : JSON.stringify(value);
              return text.trim() ? `${key}: ${text}` : null;
            })
            .filter((field): field is string => Boolean(field));
          return `--- Patient/Row ${index + 1} ---\n${fields.join("\n")}`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.patients)) {
      return normalizeJsonPatientList(record.patients);
    }
    if (Array.isArray(record.entry)) {
      return record.entry
        .map((item, index) => {
          const resource =
            item && typeof item === "object" && "resource" in item
              ? (item as { resource?: unknown }).resource
              : item;
          return `--- Entry ${index + 1} ---\n${JSON.stringify(resource, null, 2)}`;
        })
        .join("\n\n");
    }
    return Object.entries(record)
      .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
      .join("\n");
  }

  return String(raw ?? "");
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const readAsDataUrl = async (file: File): Promise<string> => {
  const mimeType = file.type || "application/octet-stream";
  const buffer = await file.arrayBuffer();
  const base64 = bytesToBase64(new Uint8Array(buffer));
  return `data:${mimeType};base64,${base64}`;
};

/**
 * Extract parseable content from an uploaded patient-list file.
 */
export const extractPatientListContent = async (
  file: File,
): Promise<ExtractedPatientListContent> => {
  const validationError = validatePatientListImportFile(file.name, file.size, file.type);
  if (validationError) {
    throw new Error(validationError);
  }

  const kind = detectPatientListImportKind(file.name, file.type);
  if (!kind) {
    throw new Error("Unsupported file type");
  }

  if (kind === "image") {
    const dataUrl = await readAsDataUrl(file);
    if (!dataUrl.startsWith("data:image/")) {
      throw new Error("Could not read the selected image");
    }
    return {
      mode: "images",
      images: [dataUrl],
      kind: "image",
      label: file.name,
    };
  }

  let text = "";

  switch (kind) {
    case "text":
    case "rtf": {
      const raw = await file.text();
      text = kind === "rtf" ? stripRtfToText(raw) : raw;
      break;
    }
    case "html": {
      text = stripHtmlToText(await file.text());
      break;
    }
    case "json": {
      const rawText = await file.text();
      try {
        text = normalizeJsonPatientList(JSON.parse(rawText));
      } catch {
        text = rawText;
      }
      break;
    }
    case "docx": {
      const arrayBuffer = await file.arrayBuffer();
      const archiveError = validateDocxArchive(arrayBuffer);
      if (archiveError) {
        throw new Error(archiveError);
      }
      const { default: mammoth } = await import("mammoth");
      const result = await mammoth.extractRawText({ arrayBuffer });
      text = result.value;
      break;
    }
    case "spreadsheet": {
      const XLSX = await import("xlsx");
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".csv") || lowerName.endsWith(".tsv") || lowerName.endsWith(".tab")) {
        const raw = await file.text();
        const delimiter = lowerName.endsWith(".csv") ? "," : "\t";
        const workbook = XLSX.read(raw, { type: "string", FS: delimiter });
        text = sheetToLabeledText(workbook, XLSX.utils);
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        text = sheetToLabeledText(workbook, XLSX.utils);
      }
      break;
    }
    case "pdf":
      throw new Error(
        "PDF import is unavailable until the PDF processor is bundled securely. Export as text/Word/Excel or paste the list.",
      );
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unhandled import kind: ${String(exhaustive)}`);
    }
  }

  const textError = validateExtractedPatientListText(text);
  if (textError) {
    throw new Error(textError);
  }

  return {
    mode: "text",
    text,
    kind,
    label: file.name,
  };
};
