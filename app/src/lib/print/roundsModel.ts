import type { Patient } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";
import { htmlToSourceLines, medicationSourceLines } from "./htmlLines";
import { normalizePatientIdentityValue } from "@/lib/patientIdentity";
import {
  ROUNDS_SYSTEM_SECTION_KEYS,
  type RoundsSectionConfig,
  type RoundsSectionKey,
  type RoundsSettings,
} from "./roundsTypes";

export interface RoundsTodoLine {
  content: string;
  completed: boolean;
}

export interface RoundsSectionModel {
  key: RoundsSectionKey;
  label: string;
  color: string;
  /** Source lines, reproduced verbatim and in their original order. */
  lines: string[];
  todos?: RoundsTodoLine[];
  isEmpty: boolean;
}

export interface RoundsPatientModel {
  id: string;
  /** Bed label rendered in the banner, e.g. `BED 12`. Empty when hidden. */
  bedLabel: string;
  name: string;
  /** Secondary identifiers (MRN, patient number, age, code status). */
  metaLine: string;
  allergies: string[];
  summaryLines: string[];
  sections: RoundsSectionModel[];
  /** Present only when DISPO is enabled and rendered as its own bar. */
  dispo: RoundsSectionModel | null;
}

const CODE_STATUS_LABELS: Record<string, string> = {
  full: "Full Code",
  dnr: "DNR",
  dni: "DNI",
  comfort: "Comfort Care",
};

const isSystemSection = (key: RoundsSectionKey): boolean =>
  (ROUNDS_SYSTEM_SECTION_KEYS as readonly string[]).includes(key);

const sectionSourceLines = (
  key: RoundsSectionKey,
  patient: Patient,
  todos: PatientTodo[],
): string[] => {
  if (isSystemSection(key)) {
    const systems = patient.systems ?? ({} as Patient["systems"]);
    return htmlToSourceLines(systems[key as keyof Patient["systems"]] ?? "");
  }

  switch (key) {
    case "clinicalSummary":
      return htmlToSourceLines(patient.clinicalSummary);
    case "intervalEvents":
      return htmlToSourceLines(patient.intervalEvents);
    case "imaging":
      return htmlToSourceLines(patient.imaging);
    case "labs":
      return htmlToSourceLines(patient.labs);
    case "medications":
      return medicationSourceLines(patient.medications);
    case "todos":
      return todos.map((todo) => todo.content);
    case "notes":
      return [];
    default:
      return [];
  }
};

const buildSection = (
  config: RoundsSectionConfig,
  patient: Patient,
  todos: PatientTodo[],
): RoundsSectionModel => {
  const lines = sectionSourceLines(config.key, patient, todos);
  const model: RoundsSectionModel = {
    key: config.key,
    label: config.label,
    color: config.color,
    lines,
    isEmpty: lines.length === 0,
  };

  if (config.key === "todos") {
    model.todos = todos.map((todo) => ({ content: todo.content, completed: todo.completed }));
    model.isEmpty = model.todos.length === 0;
  }

  // A ruled notes block is intentionally blank; it is never "empty content".
  if (config.key === "notes") {
    model.isEmpty = false;
  }

  return model;
};

const patientMetaLine = (patient: Patient, settings: RoundsSettings): string => {
  const parts: string[] = [];
  if (settings.showPatientNumber && Number.isFinite(patient.patientNumber)) {
    parts.push(`#${patient.patientNumber}`);
  }
  if (settings.showMrn) {
    const mrn = normalizePatientIdentityValue(patient.mrn, "");
    if (mrn) parts.push(`MRN …${mrn.slice(-4)}`);
  }
  if (settings.showAge && typeof patient.age === "number" && Number.isFinite(patient.age)) {
    parts.push(`${patient.age}y`);
  }
  if (settings.showCodeStatus && patient.codeStatus) {
    parts.push(CODE_STATUS_LABELS[patient.codeStatus] ?? patient.codeStatus);
  }
  return parts.join(" · ");
};

const patientAllergies = (patient: Patient, settings: RoundsSettings): string[] => {
  if (!settings.showAllergies) return [];
  return (patient.alerts ?? [])
    .map((alert) => normalizePatientIdentityValue(alert, ""))
    .filter((alert): alert is string => Boolean(alert));
};

/**
 * Build the printable model for one patient.
 *
 * This only reorganizes stored content into the rounds layout — no line is
 * merged, reworded, summarized or invented.
 */
export const buildRoundsPatientModel = (
  patient: Patient,
  todos: PatientTodo[],
  settings: RoundsSettings,
): RoundsPatientModel => {
  const enabled = settings.sections.filter((section) => section.enabled);

  const built = enabled
    .map((config) => buildSection(config, patient, todos))
    .filter((section) => settings.showEmptySections || !section.isEmpty);

  const dispoAsBar = settings.dispoStyle === "bar";
  const dispo = dispoAsBar ? built.find((section) => section.key === "dispo") ?? null : null;
  const sections = dispoAsBar ? built.filter((section) => section.key !== "dispo") : built;

  const bed = normalizePatientIdentityValue(patient.bed, "");

  return {
    id: patient.id,
    bedLabel: settings.showBed && bed ? `BED ${bed}` : "",
    name: normalizePatientIdentityValue(patient.name, "Unnamed patient"),
    metaLine: patientMetaLine(patient, settings),
    allergies: patientAllergies(patient, settings),
    summaryLines: settings.showSummary ? htmlToSourceLines(patient.clinicalSummary) : [],
    sections,
    dispo,
  };
};

/**
 * A source line the clinician wrote as a heading — it ends with a colon and
 * carries no trailing data on the same line. Detecting this only changes the
 * weight the line is printed at; the text itself is untouched.
 */
export const isHeadingSourceLine = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.length > 0 && trimmed.length <= 60 && trimmed.endsWith(":");
};

export const buildRoundsDocumentModel = (
  patients: Patient[],
  patientTodos: Record<string, PatientTodo[]> | undefined,
  settings: RoundsSettings,
): RoundsPatientModel[] =>
  patients.map((patient) =>
    buildRoundsPatientModel(patient, patientTodos?.[patient.id] ?? [], settings),
  );

// ---------------------------------------------------------------------------
// Colour resolution
// ---------------------------------------------------------------------------

const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
};

const toHex = (channel: number): string =>
  Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0");

export const toGrayscale = (hex: string): string => {
  const [r, g, b] = hexToRgb(hex);
  if (![r, g, b].every(Number.isFinite)) return hex;
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  const value = toHex(luma);
  return `#${value}${value}${value}`;
};

/**
 * Resolve a configured colour for the active colour mode. `mono` drops fills
 * entirely so a section header can be drawn as ink-free text.
 */
export const resolveRoundsColor = (hex: string, mode: RoundsSettings["colorMode"]): string => {
  if (mode === "grayscale") return toGrayscale(hex);
  return hex;
};

/** Pick black or white text for adequate contrast on a filled bar. */
export const readableTextColor = (hex: string): string => {
  const [r, g, b] = hexToRgb(hex);
  if (![r, g, b].every(Number.isFinite)) return "#FFFFFF";
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.6 ? "#1F2D3D" : "#FFFFFF";
};
