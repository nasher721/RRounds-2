import * as React from "react";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";
import {
  buildRoundsDocumentModel,
  isHeadingSourceLine,
  readableTextColor,
  resolveRoundsColor,
  type RoundsPatientModel,
  type RoundsSectionModel,
} from "@/lib/print/roundsModel";
import { getRoundsPageMetrics, type RoundsSettings } from "@/lib/print/roundsTypes";
import { fontFamilies } from "./constants";

interface RoundsDocumentProps {
  patients: Patient[];
  patientTodos?: Record<string, PatientTodo[]>;
  settings: RoundsSettings;
  /** Header line shown when a document header is enabled. */
  physicianName?: string;
  /** Renders paper sheets with drop shadows for the on-screen preview. */
  preview?: boolean;
  className?: string;
  documentId?: string;
}

const fontStack = (value: string): string =>
  fontFamilies.find((font) => font.value === value)?.css ?? fontFamilies[0].css;

const labelText = (label: string, uppercase: boolean): string =>
  uppercase ? label.toUpperCase() : label;

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

interface SectionProps {
  section: RoundsSectionModel;
  settings: RoundsSettings;
}

const RoundsSection = ({ section, settings }: SectionProps) => {
  const mono = settings.colorMode === "mono";
  const color = mono ? settings.bodyTextColor : resolveRoundsColor(section.color, settings.colorMode);
  const headerStyle = mono && settings.sectionHeaderStyle === "bar" ? "underline" : settings.sectionHeaderStyle;

  const style = {
    ["--rounds-section-color" as string]: color,
    ["--rounds-section-on-color" as string]: readableTextColor(color),
  } as React.CSSProperties;

  return (
    <div
      className={cn("rounds-section", settings.keepSectionsTogether && "rounds-section--together")}
      style={style}
      data-rounds-section={section.key}
    >
      <div className={cn("rounds-section__header", `rounds-section__header--${headerStyle}`)}>
        {labelText(section.label, settings.uppercaseSectionLabels)}
      </div>
      <div className="rounds-section__body">
        {section.key === "notes" ? (
          Array.from({ length: Math.max(1, settings.notesLineCount) }).map((_, index) => (
            <div key={index} className="rounds-notes__line" />
          ))
        ) : section.todos ? (
          section.todos.map((todo, index) => (
            <div key={`${todo.content}-${index}`} className="rounds-line rounds-todo">
              {settings.showTodoCheckboxes && (
                <span className="rounds-todo__box" aria-hidden="true">
                  {todo.completed ? "☑" : "☐"}
                </span>
              )}
              <span>{todo.content}</span>
            </div>
          ))
        ) : (
          section.lines.map((line, index) =>
            settings.boldHeadingLines && isHeadingSourceLine(line) ? (
              <p key={`${index}-${line}`} className="rounds-line rounds-line--heading">
                {line}
              </p>
            ) : (
              <p key={`${index}-${line}`} className="rounds-line">
                {line}
              </p>
            ),
          )
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Patient block
// ---------------------------------------------------------------------------

interface PatientBlockProps {
  patient: RoundsPatientModel;
  settings: RoundsSettings;
  isFirst: boolean;
}

const RoundsPatientBlock = ({ patient, settings, isFirst }: PatientBlockProps) => {
  const mono = settings.colorMode === "mono";
  const separated = !isFirst && !settings.onePatientPerPage;

  const dispoLines = patient.dispo?.lines ?? [];

  return (
    <div
      className={cn(
        "rounds-patient",
        separated && settings.patientSeparator === "rule" && "rounds-patient--separated",
        separated && settings.patientSeparator === "space" && "rounds-patient--spaced",
      )}
      data-rounds-patient={patient.id}
    >
      <div className={cn("rounds-banner", mono && "rounds-banner--plain")}>
        <div className="rounds-banner__title">
          {patient.bedLabel && <span className="rounds-banner__bed">{patient.bedLabel}</span>}
          <span className="rounds-banner__name">{patient.name}</span>
        </div>
        {patient.metaLine && <div className="rounds-banner__meta">{patient.metaLine}</div>}
        {patient.allergies.length > 0 && (
          <div className="rounds-banner__allergies">{patient.allergies.join(" · ")}</div>
        )}
        {patient.summaryLines.map((line, index) => (
          <div key={`${index}-${line}`} className="rounds-banner__summary">
            {line}
          </div>
        ))}
      </div>

      {patient.sections.map((section) => (
        <RoundsSection key={section.key} section={section} settings={settings} />
      ))}

      {patient.dispo && (
        <div className="rounds-dispo">
          <span className="rounds-dispo__label">
            {labelText(patient.dispo.label, settings.uppercaseSectionLabels)}:
          </span>
          {dispoLines.length === 0 ? null : dispoLines.length === 1 ? (
            <span>{dispoLines[0]}</span>
          ) : (
            dispoLines.map((line, index) => (
              <p key={`${index}-${line}`} className="rounds-line">
                {line}
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export const RoundsDocument = React.forwardRef<HTMLDivElement, RoundsDocumentProps>(
  ({ patients, patientTodos, settings, physicianName, preview = false, className, documentId }, ref) => {
    const models = React.useMemo(
      () => buildRoundsDocumentModel(patients, patientTodos, settings),
      [patients, patientTodos, settings],
    );

    const { widthMm, heightMm, marginMm } = getRoundsPageMetrics(settings);
    const columnCount = settings.variant === "twoColumn" ? Math.max(1, settings.columnCount) : 1;
    const ruleColor = settings.colorMode === "color" ? "#cbd5e1" : "#94a3b8";

    const style = {
      fontFamily: fontStack(settings.fontFamily),
      ["--rounds-body-pt" as string]: `${settings.bodyPt}pt`,
      ["--rounds-title-pt" as string]: `${settings.titlePt}pt`,
      ["--rounds-system-pt" as string]: `${settings.systemPt}pt`,
      ["--rounds-header-pt" as string]: `${settings.headerPt}pt`,
      ["--rounds-summary-pt" as string]: `${settings.summaryPt}pt`,
      ["--rounds-line-height" as string]: `${settings.lineHeight}`,
      ["--rounds-indent" as string]: `${settings.indentPt}pt`,
      ["--rounds-section-gap" as string]: `${settings.sectionSpacingPt}pt`,
      ["--rounds-page-width" as string]: `${widthMm}mm`,
      ["--rounds-page-height" as string]: `${heightMm}mm`,
      ["--rounds-page-margin" as string]: `${marginMm}mm`,
      ["--rounds-column-count" as string]: `${columnCount}`,
      ["--rounds-column-gap" as string]: `${settings.columnGapMm}mm`,
      ["--rounds-column-rule" as string]:
        columnCount > 1 && settings.columnRule ? `0.75pt solid ${ruleColor}` : "none",
      ["--rounds-header-bg" as string]: resolveRoundsColor(settings.headerBg, settings.colorMode),
      ["--rounds-header-text" as string]: settings.headerTextColor,
      ["--rounds-header-accent" as string]: resolveRoundsColor(
        settings.headerAccentColor,
        settings.colorMode,
      ),
      ["--rounds-summary-text" as string]: settings.summaryTextColor,
      ["--rounds-body-text" as string]: settings.bodyTextColor,
      ["--rounds-title-text" as string]: settings.titleColor,
      ["--rounds-dispo-bg" as string]:
        settings.colorMode === "mono"
          ? "#ffffff"
          : resolveRoundsColor(settings.dispoBg, settings.colorMode),
      ["--rounds-dispo-text" as string]: settings.dispoTextColor,
    } as React.CSSProperties;

    const documentHeader = settings.showDocumentHeader ? (
      <div className="rounds-doc-header">
        <div className="rounds-doc-header__title">{settings.documentTitle}</div>
        <div className="rounds-doc-header__meta">
          <span>{physicianName || ""}</span>
          <span>
            {settings.showTimestamp ? new Date().toLocaleString() : ""}
            {settings.showTimestamp && patients.length ? " · " : ""}
            {patients.length} patient{patients.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    ) : null;

    const flowClass = columnCount > 1 ? "rounds-flow" : undefined;
    // Sequential fill needs a page-tall box to fill against; balanced fill must
    // not have one, or a short patient leaves every column but the first blank.
    const pageFlowClass = cn(
      flowClass,
      columnCount > 1 && settings.columnFill === "sequential" && "rounds-flow--sequential",
    );

    return (
      <div
        ref={ref}
        data-print-document
        data-rounds-document
        data-rounds-preview={preview ? "true" : "false"}
        data-print-document-id={documentId}
        className={cn("rounds-doc", className)}
        style={style}
      >
        {settings.onePatientPerPage ? (
          models.map((patient, index) => (
            <section key={patient.id} className="rounds-page">
              {index === 0 && documentHeader}
              <div className={pageFlowClass}>
                <RoundsPatientBlock patient={patient} settings={settings} isFirst />
              </div>
            </section>
          ))
        ) : (
          <section className="rounds-page rounds-page--continuous">
            {documentHeader}
            <div className={flowClass}>
              {models.map((patient, index) => (
                <RoundsPatientBlock
                  key={patient.id}
                  patient={patient}
                  settings={settings}
                  isFirst={index === 0}
                />
              ))}
            </div>
          </section>
        )}

        {models.length === 0 && (
          <section className="rounds-page">
            <p className="rounds-line">No patients match the current filter.</p>
          </section>
        )}
      </div>
    );
  },
);

RoundsDocument.displayName = "RoundsDocument";
