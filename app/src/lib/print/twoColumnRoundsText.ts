import type { Patient } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";
import { htmlToSourceLines, medicationSourceLines as medicationLines } from "./htmlLines";

type PatientTodosMap = Record<string, PatientTodo[]>;

interface TextSection {
  label: string;
  lines: string[];
}

const COLUMN_WIDTH = 62;
const COLUMN_GUTTER = "   |   ";
const PAGE_WIDTH = COLUMN_WIDTH * 2 + COLUMN_GUTTER.length;

const section = (label: string, lines: string[]): TextSection | null =>
  lines.length ? { label, lines } : null;

const compactSections = (sections: Array<TextSection | null>): TextSection[] =>
  sections.filter((value): value is TextSection => value !== null);

const buildPatientSections = (
  patient: Patient,
  patientTodos: PatientTodo[],
): { left: TextSection[]; right: TextSection[] } => ({
  left: compactSections([
    section("ADMIT", htmlToSourceLines(patient.intervalEvents)),
    section("NEURO", htmlToSourceLines(patient.systems.neuro)),
    section("CARDIO/VASC", htmlToSourceLines(patient.systems.cv)),
  ]),
  right: compactSections([
    section("RESP", htmlToSourceLines(patient.systems.resp)),
    section("RENAL/GU", htmlToSourceLines(patient.systems.renalGU)),
    section("GI", htmlToSourceLines(patient.systems.gi)),
    section("ENDO", htmlToSourceLines(patient.systems.endo)),
    section("HEME", htmlToSourceLines(patient.systems.heme)),
    section("ID/INFECT", htmlToSourceLines(patient.systems.infectious)),
    section("SKIN/LINES", htmlToSourceLines(patient.systems.skinLines)),
    section("IMAGING", htmlToSourceLines(patient.imaging)),
    section("LABS", htmlToSourceLines(patient.labs)),
    section("CURRENT MEDICATIONS", medicationLines(patient.medications)),
    section(
      "TODOS",
      patientTodos.map((todo) => `${todo.completed ? "[x]" : "[ ]"} ${todo.content}`),
    ),
    section("DISPO", htmlToSourceLines(patient.systems.dispo)),
  ]),
});

const wrapLine = (line: string, width: number): string[] => {
  if (line.length <= width) return [line];

  const wrapped: string[] = [];
  let remaining = line;
  while (remaining.length > width) {
    const whitespaceIndex = remaining.lastIndexOf(" ", width);
    const splitAt = whitespaceIndex > 0 ? whitespaceIndex : width;
    wrapped.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt + (whitespaceIndex > 0 ? 1 : 0));
  }
  if (remaining) wrapped.push(remaining);
  return wrapped;
};

const renderSections = (sections: TextSection[]): string[] => {
  const lines: string[] = [];
  sections.forEach((current, index) => {
    if (index > 0) lines.push("");
    lines.push(`-- ${current.label} --`);
    current.lines.forEach((line) => lines.push(...wrapLine(line, COLUMN_WIDTH)));
  });
  return lines;
};

const renderPatient = (patient: Patient, patientTodos: PatientTodo[]): string => {
  const header = `${patient.bed ? `BED ${patient.bed}  ` : ""}${patient.name}`;
  const summaryLines = htmlToSourceLines(patient.clinicalSummary);
  const { left, right } = buildPatientSections(patient, patientTodos);
  const leftLines = renderSections(left);
  const rightLines = renderSections(right);
  const rowCount = Math.max(leftLines.length, rightLines.length);
  const rows: string[] = ["=".repeat(PAGE_WIDTH), header, ...summaryLines, "=".repeat(PAGE_WIDTH)];

  for (let index = 0; index < rowCount; index += 1) {
    const leftLine = leftLines[index] ?? "";
    const rightLine = rightLines[index] ?? "";
    rows.push(`${leftLine.padEnd(COLUMN_WIDTH)}${COLUMN_GUTTER}${rightLine}`.trimEnd());
  }

  return rows.join("\n");
};

/**
 * Render the formatter skill's landscape, one-patient-per-page section split
 * as portable fixed-width text. Clinical wording is never synthesized.
 */
export const buildTwoColumnRoundsText = (
  patients: Patient[],
  patientTodos: PatientTodosMap,
): string =>
  patients
    .map((patient) => renderPatient(patient, patientTodos[patient.id] ?? []))
    .join("\n\f\n");

export const generateTwoColumnRoundsFilename = (date = new Date()): string =>
  `NICU_Rounds_${date.getMonth() + 1}-${date.getDate()}-${String(date.getFullYear()).slice(-2)}_two-column.txt`;

export const downloadTwoColumnRoundsText = (
  patients: Patient[],
  patientTodos: PatientTodosMap,
): string => {
  const content = buildTwoColumnRoundsText(patients, patientTodos);
  const fileName = generateTwoColumnRoundsFilename();
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return fileName;
};
