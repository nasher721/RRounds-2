import type { Patient } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";
import {
  buildRoundsDocumentModel,
  isHeadingSourceLine,
  readableTextColor,
  resolveRoundsColor,
  type RoundsPatientModel,
  type RoundsSectionModel,
} from "./roundsModel";
import {
  ROUNDS_PAGE_SIZES_MM,
  type RoundsSettings,
} from "./roundsTypes";
import { fontFamilies } from "@/components/print/constants";

const MM_PER_INCH = 25.4;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const inches = (mm: number): string => `${(mm / MM_PER_INCH).toFixed(3)}in`;

const fontStack = (value: string): string =>
  fontFamilies.find((font) => font.value === value)?.css ?? fontFamilies[0].css;

const labelText = (label: string, uppercase: boolean): string =>
  uppercase ? label.toUpperCase() : label;

const sectionHtml = (section: RoundsSectionModel, settings: RoundsSettings): string => {
  const mono = settings.colorMode === "mono";
  const color = mono ? settings.bodyTextColor : resolveRoundsColor(section.color, settings.colorMode);
  const headerStyle = mono && settings.sectionHeaderStyle === "bar" ? "underline" : settings.sectionHeaderStyle;

  const headerCss =
    headerStyle === "bar"
      ? `background:${color};color:${readableTextColor(color)};padding:1.5pt 5pt;`
      : headerStyle === "underline"
        ? `color:${color};border-bottom:1pt solid ${color};padding-bottom:1pt;`
        : `color:${color};`;

  const header =
    `<p class="sys" style="${headerCss}font-size:${settings.systemPt}pt;">` +
    `${escapeHtml(labelText(section.label, settings.uppercaseSectionLabels))}</p>`;

  let body = "";

  if (section.key === "notes") {
    body = Array.from({ length: Math.max(1, settings.notesLineCount) })
      .map(() => `<p class="rule">&nbsp;</p>`)
      .join("");
  } else if (section.todos) {
    body = section.todos
      .map((todo) => {
        const box = settings.showTodoCheckboxes ? (todo.completed ? "&#9745; " : "&#9744; ") : "";
        return `<p class="line">${box}${escapeHtml(todo.content)}</p>`;
      })
      .join("");
  } else {
    body = section.lines
      .map((line) =>
        settings.boldHeadingLines && isHeadingSourceLine(line)
          ? `<p class="title">${escapeHtml(line)}</p>`
          : `<p class="line">${escapeHtml(line)}</p>`,
      )
      .join("");
  }

  return `${header}<div class="body">${body}</div>`;
};

const patientHtml = (
  patient: RoundsPatientModel,
  settings: RoundsSettings,
  isFirst: boolean,
): string => {
  const mono = settings.colorMode === "mono";
  const bannerCss = mono
    ? `border-bottom:1.5pt solid ${settings.bodyTextColor};color:${settings.bodyTextColor};padding:3pt 0;`
    : `background:${resolveRoundsColor(settings.headerBg, settings.colorMode)};color:${settings.headerTextColor};padding:4pt 6pt;`;

  const nameColor = mono
    ? settings.bodyTextColor
    : resolveRoundsColor(settings.headerAccentColor, settings.colorMode);
  const bedColor = mono ? settings.bodyTextColor : settings.headerTextColor;
  const softColor = mono ? settings.bodyTextColor : settings.summaryTextColor;

  const pageBreak =
    !isFirst && settings.onePatientPerPage
      ? `<br clear="all" style="mso-special-character:line-break;page-break-before:always" />`
      : "";

  const separator =
    !isFirst && !settings.onePatientPerPage && settings.patientSeparator === "rule"
      ? `<p class="sep">&nbsp;</p>`
      : "";

  const banner =
    `<div class="banner" style="${bannerCss}">` +
    `<p class="banner-title" style="font-size:${settings.headerPt}pt;">` +
    (patient.bedLabel
      ? `<span style="color:${bedColor};font-weight:bold;">${escapeHtml(patient.bedLabel)}&nbsp;&nbsp;</span>`
      : "") +
    `<span style="color:${nameColor};font-weight:bold;">${escapeHtml(patient.name)}</span></p>` +
    (patient.metaLine
      ? `<p class="banner-sub" style="color:${softColor};">${escapeHtml(patient.metaLine)}</p>`
      : "") +
    (patient.allergies.length
      ? `<p class="banner-sub" style="color:${softColor};font-weight:bold;">${escapeHtml(patient.allergies.join(" · "))}</p>`
      : "") +
    patient.summaryLines
      .map(
        (line) =>
          `<p class="banner-sub" style="color:${softColor};font-style:italic;">${escapeHtml(line)}</p>`,
      )
      .join("") +
    `</div>`;

  const sections = patient.sections.map((section) => sectionHtml(section, settings)).join("");

  const dispo = patient.dispo
    ? `<div class="dispo" style="background:${mono ? "#FFFFFF" : resolveRoundsColor(settings.dispoBg, settings.colorMode)};color:${settings.dispoTextColor};">` +
      `<p class="line"><span style="font-weight:bold;">${escapeHtml(labelText(patient.dispo.label, settings.uppercaseSectionLabels))}:</span> ` +
      escapeHtml(patient.dispo.lines.join(" ")) +
      `</p></div>`
    : "";

  return `${pageBreak}${separator}<div class="patient">${banner}${sections}${dispo}</div>`;
};

/**
 * Render the rounds document as Word-compatible HTML.
 *
 * Word reads the `mso-*` page properties, so the exported file opens with the
 * same paper size, margins and column count the preview shows. Content is the
 * same verbatim source lines the on-screen document renders.
 */
export const buildRoundsWordHtml = (
  patients: Patient[],
  patientTodos: Record<string, PatientTodo[]> | undefined,
  settings: RoundsSettings,
  physicianName?: string,
): string => {
  const models = buildRoundsDocumentModel(patients, patientTodos, settings);
  const size = ROUNDS_PAGE_SIZES_MM[settings.pageSize] ?? ROUNDS_PAGE_SIZES_MM.letter;
  const landscape = settings.orientation === "landscape";
  const widthMm = landscape ? size.height : size.width;
  const heightMm = landscape ? size.width : size.height;

  const columnCount = settings.variant === "twoColumn" ? Math.max(1, settings.columnCount) : 1;
  const columnCss =
    columnCount > 1
      ? `mso-column-count:${columnCount};mso-column-spacing:${inches(settings.columnGapMm)};` +
        `mso-column-separator:${settings.columnRule ? "yes" : "no"};`
      : "";

  const documentHeader = settings.showDocumentHeader
    ? `<div class="dochead"><p class="dochead-title">${escapeHtml(settings.documentTitle)}</p>` +
      `<p class="dochead-meta">${escapeHtml(physicianName ?? "")}${physicianName && settings.showTimestamp ? " · " : ""}` +
      `${settings.showTimestamp ? escapeHtml(new Date().toLocaleString()) : ""}</p></div>`
    : "";

  const body = models.map((patient, index) => patientHtml(patient, settings, index === 0)).join("");

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(settings.documentTitle)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page WordSection1 {
  size: ${inches(widthMm)} ${inches(heightMm)};
  margin: ${inches(settings.marginMm)};
  mso-paper-source: 0;
  ${columnCss}
}
div.WordSection1 { page: WordSection1; column-count: ${columnCount}; column-gap: ${inches(settings.columnGapMm)}; }
body {
  font-family: ${fontStack(settings.fontFamily)};
  font-size: ${settings.bodyPt}pt;
  color: ${settings.bodyTextColor};
  line-height: ${settings.lineHeight};
}
p { margin: 0 0 1pt 0; }
.banner { margin-top: ${settings.sectionSpacingPt}pt; }
.banner-title { line-height: 1.15; }
.banner-sub { font-size: ${settings.summaryPt}pt; }
.sys { margin-top: ${settings.sectionSpacingPt}pt; font-weight: bold; }
.body { margin-left: ${settings.indentPt}pt; margin-top: 2pt; }
.line { font-size: ${settings.bodyPt}pt; }
.title { font-size: ${settings.titlePt}pt; font-weight: bold; color: ${settings.titleColor}; margin-left: -${settings.indentPt}pt; margin-top: 2pt; }
.rule { border-bottom: 0.75pt solid #94A3B8; height: ${(settings.bodyPt * 1.9).toFixed(1)}pt; }
.dispo { margin-top: ${settings.sectionSpacingPt}pt; border: 0.75pt solid #CBD5E1; padding: 3pt 6pt; }
.sep { border-top: 1pt solid #CBD5E1; margin-top: ${settings.sectionSpacingPt}pt; }
.dochead { border-bottom: 1pt solid #CBD5E1; padding-bottom: 4pt; margin-bottom: ${settings.sectionSpacingPt}pt; }
.dochead-title { font-size: ${(settings.headerPt * 1.05).toFixed(1)}pt; font-weight: bold; }
.dochead-meta { font-size: ${settings.summaryPt}pt; color: #475569; }
</style>
</head>
<body><div class="WordSection1">${documentHeader}${body}</div></body>
</html>`;
};

export const generateRoundsWordFilename = (
  settings: Pick<RoundsSettings, "variant">,
  date = new Date(),
): string => {
  const stamp = `${date.getMonth() + 1}-${date.getDate()}-${String(date.getFullYear()).slice(-2)}`;
  const suffix = settings.variant === "twoColumn" ? "_2col" : "";
  return `Rounds${suffix}_${stamp}.doc`;
};

export const downloadRoundsWordDocument = (
  patients: Patient[],
  patientTodos: Record<string, PatientTodo[]> | undefined,
  settings: RoundsSettings,
  physicianName?: string,
): string => {
  const html = buildRoundsWordHtml(patients, patientTodos, settings, physicianName);
  const fileName = generateRoundsWordFilename(settings);
  const blob = new Blob(["﻿", html], { type: "application/msword;charset=utf-8" });
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
