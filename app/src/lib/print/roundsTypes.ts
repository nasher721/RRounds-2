/**
 * Rounds print format — configuration contract.
 *
 * The defaults reproduce the clinician's rounds formatter house style: a navy
 * patient banner with the bed number in white and the name in gold, colour
 * coded organ-system bars, bold problem titles, verbatim body lines and a
 * light-blue DISPO bar. Every visual decision in that style is exposed here as
 * a setting so the layout can be tuned without editing code.
 */

export type RoundsVariant = "single" | "twoColumn";

export type RoundsSectionKey =
  | "clinicalSummary"
  | "intervalEvents"
  | "neuro"
  | "cv"
  | "resp"
  | "renalGU"
  | "gi"
  | "endo"
  | "heme"
  | "infectious"
  | "skinLines"
  | "imaging"
  | "labs"
  | "medications"
  | "todos"
  | "dispo"
  | "notes";

export type RoundsPageSize = "letter" | "a4" | "legal";
export type RoundsSectionHeaderStyle = "bar" | "underline" | "plain";
export type RoundsColorMode = "color" | "grayscale" | "mono";
export type RoundsPatientSeparator = "none" | "rule" | "space";
export type RoundsDispoStyle = "bar" | "section";
export type RoundsColumnFill = "balance" | "sequential";

export interface RoundsSectionConfig {
  key: RoundsSectionKey;
  /** Printed label. Editable so a unit can use its own section names. */
  label: string;
  /** Header bar colour as a `#rrggbb` string. */
  color: string;
  enabled: boolean;
}

export interface RoundsSettings {
  variant: RoundsVariant;
  onePatientPerPage: boolean;

  // ── Page ────────────────────────────────────────────────────────────────
  pageSize: RoundsPageSize;
  orientation: "portrait" | "landscape";
  /** Uniform page margin in millimetres. */
  marginMm: number;
  /** Columns per page for the newspaper variant (2 by default, up to 4). */
  columnCount: number;
  columnGapMm: number;
  columnRule: boolean;
  /**
   * `balance` spreads a patient's sections evenly across the columns (shortest
   * block). `sequential` fills column 1 to the bottom of the page before
   * starting column 2, like the paper rounds document.
   */
  columnFill: RoundsColumnFill;

  // ── Typography (points) ─────────────────────────────────────────────────
  fontFamily: string;
  bodyPt: number;
  titlePt: number;
  systemPt: number;
  headerPt: number;
  summaryPt: number;
  lineHeight: number;
  /** Left indent of body lines, in points, relative to the section bar. */
  indentPt: number;
  /** Vertical space above each section header, in points. */
  sectionSpacingPt: number;

  // ── Colour ──────────────────────────────────────────────────────────────
  colorMode: RoundsColorMode;
  headerBg: string;
  headerTextColor: string;
  headerAccentColor: string;
  summaryTextColor: string;
  bodyTextColor: string;
  titleColor: string;
  dispoBg: string;
  dispoTextColor: string;

  // ── Section presentation ────────────────────────────────────────────────
  sectionHeaderStyle: RoundsSectionHeaderStyle;
  uppercaseSectionLabels: boolean;
  showEmptySections: boolean;
  dispoStyle: RoundsDispoStyle;
  keepSectionsTogether: boolean;
  patientSeparator: RoundsPatientSeparator;

  // ── Patient banner ──────────────────────────────────────────────────────
  showBed: boolean;
  showMrn: boolean;
  showPatientNumber: boolean;
  showAge: boolean;
  showCodeStatus: boolean;
  showAllergies: boolean;
  showSummary: boolean;

  // ── Extras ──────────────────────────────────────────────────────────────
  showTodoCheckboxes: boolean;
  /**
   * Render a source line that the clinician wrote as a heading (it ends with a
   * colon) in the bold problem-title style. Purely presentational — the line's
   * wording is never altered.
   */
  boldHeadingLines: boolean;
  /** Ruled blank lines drawn in the Notes section. */
  notesLineCount: number;
  showDocumentHeader: boolean;
  documentTitle: string;
  showTimestamp: boolean;
  showPageNumbers: boolean;

  /** Ordered sections. Order here is the printed order. */
  sections: RoundsSectionConfig[];
}

// ---------------------------------------------------------------------------
// Palette — matches the rounds formatter skill's system colours
// ---------------------------------------------------------------------------

export const ROUNDS_SECTION_DEFAULTS: readonly RoundsSectionConfig[] = [
  { key: "intervalEvents", label: "Interval Events", color: "#5B6B7F", enabled: true },
  { key: "neuro", label: "Neuro", color: "#1F4E79", enabled: true },
  { key: "cv", label: "Cardio/Vasc", color: "#C00000", enabled: true },
  { key: "resp", label: "Resp", color: "#2E75B6", enabled: true },
  { key: "renalGU", label: "Renal/GU", color: "#375623", enabled: true },
  { key: "gi", label: "GI", color: "#E36C09", enabled: true },
  { key: "endo", label: "Endo", color: "#7030A0", enabled: true },
  { key: "heme", label: "Heme", color: "#833C00", enabled: true },
  { key: "infectious", label: "ID/Infect", color: "#1F3864", enabled: true },
  { key: "skinLines", label: "Skin/Lines", color: "#7B3F61", enabled: true },
  { key: "imaging", label: "Imaging", color: "#2F6F8F", enabled: true },
  { key: "labs", label: "Labs", color: "#496B2F", enabled: true },
  { key: "medications", label: "Current Meds", color: "#1F6F6B", enabled: true },
  { key: "todos", label: "To Do", color: "#8A6D1F", enabled: true },
  { key: "clinicalSummary", label: "Summary", color: "#44546A", enabled: false },
  { key: "notes", label: "Notes", color: "#6B7280", enabled: false },
  { key: "dispo", label: "Dispo", color: "#1F4E79", enabled: true },
] as const;

export const ROUNDS_SECTION_KEYS: readonly RoundsSectionKey[] =
  ROUNDS_SECTION_DEFAULTS.map((section) => section.key);

/** Sections whose content comes from `patient.systems`. */
export const ROUNDS_SYSTEM_SECTION_KEYS: readonly RoundsSectionKey[] = [
  "neuro",
  "cv",
  "resp",
  "renalGU",
  "gi",
  "endo",
  "heme",
  "infectious",
  "skinLines",
  "dispo",
];

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const BASE_ROUNDS_SETTINGS: Omit<RoundsSettings, "variant" | "sections"> = {
  onePatientPerPage: true,
  pageSize: "letter",
  orientation: "portrait",
  marginMm: 12.7, // 0.5"
  columnCount: 2,
  columnGapMm: 6,
  columnRule: true,
  columnFill: "balance",

  fontFamily: "arial",
  bodyPt: 9,
  titlePt: 10,
  systemPt: 9,
  headerPt: 14,
  summaryPt: 9,
  lineHeight: 1.25,
  indentPt: 8,
  sectionSpacingPt: 6,

  colorMode: "color",
  headerBg: "#2E3A4E",
  headerTextColor: "#FFFFFF",
  headerAccentColor: "#FFD966",
  summaryTextColor: "#D9E2F0",
  bodyTextColor: "#1F2D3D",
  titleColor: "#1F2D3D",
  dispoBg: "#EBF3FB",
  dispoTextColor: "#1F2D3D",

  sectionHeaderStyle: "bar",
  uppercaseSectionLabels: true,
  showEmptySections: false,
  dispoStyle: "bar",
  keepSectionsTogether: true,
  patientSeparator: "rule",

  showBed: true,
  showMrn: false,
  showPatientNumber: false,
  showAge: false,
  showCodeStatus: false,
  showAllergies: false,
  showSummary: true,

  showTodoCheckboxes: true,
  boldHeadingLines: true,
  notesLineCount: 4,
  showDocumentHeader: false,
  documentTitle: "ICU Rounds",
  showTimestamp: true,
  showPageNumbers: false,
};

const cloneSections = (): RoundsSectionConfig[] =>
  ROUNDS_SECTION_DEFAULTS.map((section) => ({ ...section }));

/** One patient per page, full page width — the standard rounds document. */
export const DEFAULT_ROUNDS_SINGLE: RoundsSettings = {
  ...BASE_ROUNDS_SETTINGS,
  variant: "single",
  sections: cloneSections(),
};

/** Two newspaper columns at 7.5pt — the condensed rounds document. */
export const DEFAULT_ROUNDS_TWO_COLUMN: RoundsSettings = {
  ...BASE_ROUNDS_SETTINGS,
  variant: "twoColumn",
  marginMm: 10.2, // 0.4"
  bodyPt: 7.5,
  summaryPt: 7.5,
  lineHeight: 1.2,
  indentPt: 6,
  sectionSpacingPt: 5,
  columnCount: 2,
  sections: cloneSections(),
};

export const DEFAULT_ROUNDS_SETTINGS = DEFAULT_ROUNDS_SINGLE;

// ---------------------------------------------------------------------------
// Style presets
// ---------------------------------------------------------------------------

export interface RoundsStylePreset {
  id: string;
  name: string;
  description: string;
  apply: (current: RoundsSettings) => RoundsSettings;
}

const withSections = (settings: RoundsSettings, current: RoundsSettings): RoundsSettings => ({
  ...settings,
  sections: current.sections.map((section) => ({ ...section })),
});

export const ROUNDS_STYLE_PRESETS: readonly RoundsStylePreset[] = [
  {
    id: "house-single",
    name: "House style — full page",
    description: "0.5in margins, 9pt body, one patient per page.",
    apply: (current) =>
      withSections({ ...DEFAULT_ROUNDS_SINGLE, variant: current.variant }, current),
  },
  {
    id: "house-2col",
    name: "House style — two column",
    description: "0.4in margins, 7.5pt body, two newspaper columns.",
    apply: (current) =>
      withSections({ ...DEFAULT_ROUNDS_TWO_COLUMN, variant: current.variant }, current),
  },
  {
    id: "ultra-compact",
    name: "Ultra compact",
    description: "6.5pt body and tight leading to fit long lists.",
    apply: (current) => ({
      ...current,
      bodyPt: 6.5,
      summaryPt: 6.5,
      titlePt: 8,
      systemPt: 7.5,
      headerPt: 11,
      lineHeight: 1.1,
      sectionSpacingPt: 3,
      indentPt: 4,
      marginMm: 8,
    }),
  },
  {
    id: "large-print",
    name: "Large print",
    description: "12pt body for bedside readability.",
    apply: (current) => ({
      ...current,
      bodyPt: 12,
      summaryPt: 11,
      titlePt: 13,
      systemPt: 12,
      headerPt: 18,
      lineHeight: 1.4,
      sectionSpacingPt: 9,
    }),
  },
  {
    id: "ink-saver",
    name: "Ink saver",
    description: "No filled bars — outlined headers in black and white.",
    apply: (current) => ({
      ...current,
      colorMode: "mono",
      sectionHeaderStyle: "underline",
      dispoStyle: "section",
    }),
  },
] as const;

// ---------------------------------------------------------------------------
// Normalization — stored settings may predate any field added later
// ---------------------------------------------------------------------------

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const color = (value: unknown, fallback: string): string =>
  typeof value === "string" && HEX_COLOR.test(value.trim()) ? value.trim() : fallback;

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;

/**
 * Merge stored (possibly partial or hostile) settings onto the variant default.
 * Section order is taken from storage but the set of sections always matches
 * the current build, so a new section can never silently disappear.
 */
export const normalizeRoundsSettings = (
  stored: Partial<RoundsSettings> | undefined | null,
  variant: RoundsVariant = "single",
): RoundsSettings => {
  const base = variant === "twoColumn" ? DEFAULT_ROUNDS_TWO_COLUMN : DEFAULT_ROUNDS_SINGLE;
  const input = (stored ?? {}) as Partial<RoundsSettings>;

  const storedSections = Array.isArray(input.sections) ? input.sections : [];
  const byKey = new Map(
    storedSections
      .filter((section): section is RoundsSectionConfig => Boolean(section) && typeof section.key === "string")
      .map((section) => [section.key, section]),
  );

  const ordered: RoundsSectionConfig[] = [];
  const seen = new Set<RoundsSectionKey>();

  storedSections.forEach((section) => {
    const fallback = ROUNDS_SECTION_DEFAULTS.find((d) => d.key === section?.key);
    if (!fallback || seen.has(fallback.key)) return;
    seen.add(fallback.key);
    ordered.push({
      key: fallback.key,
      label:
        typeof section.label === "string" && section.label.trim()
          ? section.label.trim().slice(0, 40)
          : fallback.label,
      color: color(section.color, fallback.color),
      enabled: bool(section.enabled, fallback.enabled),
    });
  });

  ROUNDS_SECTION_DEFAULTS.forEach((fallback) => {
    if (seen.has(fallback.key)) return;
    const section = byKey.get(fallback.key);
    ordered.push(section ? { ...fallback, ...section } : { ...fallback });
  });

  return {
    variant: oneOf(input.variant, ["single", "twoColumn"] as const, base.variant),
    onePatientPerPage: bool(input.onePatientPerPage, base.onePatientPerPage),

    pageSize: oneOf(input.pageSize, ["letter", "a4", "legal"] as const, base.pageSize),
    orientation: oneOf(input.orientation, ["portrait", "landscape"] as const, base.orientation),
    marginMm: clamp(input.marginMm, 3, 40, base.marginMm),
    columnCount: Math.round(clamp(input.columnCount, 1, 4, base.columnCount)),
    columnGapMm: clamp(input.columnGapMm, 0, 30, base.columnGapMm),
    columnRule: bool(input.columnRule, base.columnRule),
    columnFill: oneOf(input.columnFill, ["balance", "sequential"] as const, base.columnFill),

    fontFamily: typeof input.fontFamily === "string" ? input.fontFamily : base.fontFamily,
    bodyPt: clamp(input.bodyPt, 5, 20, base.bodyPt),
    titlePt: clamp(input.titlePt, 5, 24, base.titlePt),
    systemPt: clamp(input.systemPt, 5, 24, base.systemPt),
    headerPt: clamp(input.headerPt, 6, 36, base.headerPt),
    summaryPt: clamp(input.summaryPt, 5, 20, base.summaryPt),
    lineHeight: clamp(input.lineHeight, 0.9, 2.2, base.lineHeight),
    indentPt: clamp(input.indentPt, 0, 40, base.indentPt),
    sectionSpacingPt: clamp(input.sectionSpacingPt, 0, 30, base.sectionSpacingPt),

    colorMode: oneOf(input.colorMode, ["color", "grayscale", "mono"] as const, base.colorMode),
    headerBg: color(input.headerBg, base.headerBg),
    headerTextColor: color(input.headerTextColor, base.headerTextColor),
    headerAccentColor: color(input.headerAccentColor, base.headerAccentColor),
    summaryTextColor: color(input.summaryTextColor, base.summaryTextColor),
    bodyTextColor: color(input.bodyTextColor, base.bodyTextColor),
    titleColor: color(input.titleColor, base.titleColor),
    dispoBg: color(input.dispoBg, base.dispoBg),
    dispoTextColor: color(input.dispoTextColor, base.dispoTextColor),

    sectionHeaderStyle: oneOf(
      input.sectionHeaderStyle,
      ["bar", "underline", "plain"] as const,
      base.sectionHeaderStyle,
    ),
    uppercaseSectionLabels: bool(input.uppercaseSectionLabels, base.uppercaseSectionLabels),
    showEmptySections: bool(input.showEmptySections, base.showEmptySections),
    dispoStyle: oneOf(input.dispoStyle, ["bar", "section"] as const, base.dispoStyle),
    keepSectionsTogether: bool(input.keepSectionsTogether, base.keepSectionsTogether),
    patientSeparator: oneOf(
      input.patientSeparator,
      ["none", "rule", "space"] as const,
      base.patientSeparator,
    ),

    showBed: bool(input.showBed, base.showBed),
    showMrn: bool(input.showMrn, base.showMrn),
    showPatientNumber: bool(input.showPatientNumber, base.showPatientNumber),
    showAge: bool(input.showAge, base.showAge),
    showCodeStatus: bool(input.showCodeStatus, base.showCodeStatus),
    showAllergies: bool(input.showAllergies, base.showAllergies),
    showSummary: bool(input.showSummary, base.showSummary),

    showTodoCheckboxes: bool(input.showTodoCheckboxes, base.showTodoCheckboxes),
    boldHeadingLines: bool(input.boldHeadingLines, base.boldHeadingLines),
    notesLineCount: Math.round(clamp(input.notesLineCount, 1, 20, base.notesLineCount)),
    showDocumentHeader: bool(input.showDocumentHeader, base.showDocumentHeader),
    documentTitle:
      typeof input.documentTitle === "string" && input.documentTitle.trim()
        ? input.documentTitle.trim().slice(0, 80)
        : base.documentTitle,
    showTimestamp: bool(input.showTimestamp, base.showTimestamp),
    showPageNumbers: bool(input.showPageNumbers, base.showPageNumbers),

    sections: ordered,
  };
};

// ---------------------------------------------------------------------------
// Page geometry
// ---------------------------------------------------------------------------

export const ROUNDS_PAGE_SIZES_MM: Record<RoundsPageSize, { width: number; height: number }> = {
  letter: { width: 215.9, height: 279.4 },
  a4: { width: 210, height: 297 },
  legal: { width: 215.9, height: 355.6 },
};

export const ROUNDS_PAGE_SIZE_CSS: Record<RoundsPageSize, string> = {
  letter: "letter",
  a4: "A4",
  legal: "legal",
};

export const getRoundsPageMetrics = (settings: Pick<RoundsSettings, "pageSize" | "orientation" | "marginMm">) => {
  const size = ROUNDS_PAGE_SIZES_MM[settings.pageSize] ?? ROUNDS_PAGE_SIZES_MM.letter;
  const landscape = settings.orientation === "landscape";
  return {
    widthMm: landscape ? size.height : size.width,
    heightMm: landscape ? size.width : size.height,
    marginMm: settings.marginMm,
  };
};
