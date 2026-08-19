import * as React from "react";
import { cn } from "@/lib/utils";
import { SYSTEM_LABELS_SHORT } from "@/constants/systems";
import type { PrintSettings, PrintDataProps } from "@/lib/print/types";
import { COLUMN_COMBINATIONS } from "@/lib/print/constants";
import type { Patient } from "@/types/patient";
import { patientExportIdentifierLine } from "@/lib/patientIdentity";
import { getPageMetrics } from "@/lib/print/layout";
import { formatMedicationsHtml } from "./utils";
import DOMPurify from "dompurify";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  PATIENT_IMAGE_KEY_ATTRIBUTE,
  resolveOwnedPatientImageSignedUrl,
} from "@/lib/patientImages";
import { RoundsDocument } from "./RoundsDocument";
import { normalizeRoundsSettings } from "@/lib/print/roundsTypes";

interface PrintDocumentProps extends PrintDataProps {
  settings: PrintSettings;
  className?: string;
  documentId?: string;
  /** Renders paper sheets with shadows; used by the on-screen preview only. */
  preview?: boolean;
}

const PRINT_ALLOWED_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "br",
  "ul",
  "ol",
  "li",
  "p",
  "div",
  "span",
  "img",
]);

const parsePrintableStyle = (styleText: string) => {
  const style: React.CSSProperties = {};
  styleText
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((segment) => {
      const [rawKey, ...rawValueParts] = segment.split(":");
      if (!rawKey || rawValueParts.length === 0) return;
      const key = rawKey.trim().toLowerCase();
      const value = rawValueParts.join(":").trim();
      if (key === "color") style.color = value;
      if (key === "background-color") style.backgroundColor = value;
    });
  return style;
};

const renderPrintableHtml = (
  html: string,
  imageOwnerId?: string,
  imageSignedUrls?: ReadonlyMap<string, string>,
): React.ReactNode => {
  if (!html) return null;

  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: Array.from(PRINT_ALLOWED_TAGS),
    // Stored src attributes are deliberately excluded. A private image URL is
    // attached below only when its canonical key belongs to the active owner.
    ALLOWED_ATTR: ["style", "alt", PATIENT_IMAGE_KEY_ATTRIBUTE],
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, "text/html");

  const renderNode = (node: ChildNode, key: string): React.ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    const children = Array.from(element.childNodes)
      .map((child, index) => renderNode(child, `${key}.${index}`))
      .filter((child) => child !== null && child !== undefined && child !== false);

    if (tagName === "br") {
      return <br key={key} />;
    }

    if (tagName === "img") {
      const objectKey = element.getAttribute(PATIENT_IMAGE_KEY_ATTRIBUTE);
      const signedUrl = resolveOwnedPatientImageSignedUrl(
        objectKey,
        imageSignedUrls,
        imageOwnerId,
      );
      if (!objectKey || !signedUrl) return null;

      return (
        <img
          key={key}
          src={signedUrl}
          alt={(element.getAttribute("alt") || "Patient image").slice(0, 500)}
          data-patient-image-key={objectKey}
          className="my-2 h-auto max-w-full break-inside-avoid"
        />
      );
    }

    if (!PRINT_ALLOWED_TAGS.has(tagName)) {
      return children;
    }

    const props: Record<string, unknown> = { key };
    const inlineStyle = parsePrintableStyle(element.getAttribute("style") || "");
    if (Object.keys(inlineStyle).length > 0) {
      props.style = inlineStyle;
    }

    return React.createElement(tagName, props, children);
  };

  return Array.from(doc.body.childNodes).map((node, index) => renderNode(node, String(index)));
};

const PRINT_STYLE_ID = "print-formatting-styles";

export const PrintDocument = React.forwardRef<HTMLDivElement, PrintDocumentProps>(
  (
    {
      patients,
      patientTodos,
      patientNotes,
      patientImageOwnerId,
      patientImageSignedUrls,
      settings,
      className,
      documentId,
      preview = false,
    },
    ref,
  ) => {
    const roundsSettings = React.useMemo(
      () => normalizeRoundsSettings(settings.rounds, settings.rounds?.variant ?? "single"),
      [settings.rounds],
    );
    React.useEffect(() => {
      if (!document.getElementById(PRINT_STYLE_ID)) {
        const style = document.createElement("style");
        style.id = PRINT_STYLE_ID;
        style.textContent = `
          @media print {
            b, strong { font-weight: bold !important; }
            i, em { font-style: italic !important; }
            u { text-decoration: underline !important; }
            ul { list-style-type: disc !important; margin-left: 1.5em !important; }
            ol { list-style-type: decimal !important; margin-left: 1.5em !important; }
            li { display: list-item !important; }
            p { margin-bottom: 0.5em !important; }
            br { display: block !important; content: "" !important; margin-top: 0.25em !important; }
            [style*="color"], [style*="background"] {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            [data-print-document] { color: black; }
            [data-print-document] *:not([style*="color"]) { color: inherit; }
            .print-patient-break { page-break-before: always; break-before: page; }
            [data-print-document] .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
            .print-export-sandbox { display: none !important; }
          }
        `;
        document.head.appendChild(style);
      }
      return () => {
        const existingStyle = document.getElementById(PRINT_STYLE_ID);
        if (existingStyle) {
          existingStyle.remove();
        }
      };
    }, []);

    const { widthMm, heightMm, marginMm } = getPageMetrics(settings);

    const cleanInlineStyles = (html: string) => {
      if (!html) return "";
      const temp = document.createElement("div");
      temp.innerHTML = sanitizeHtml(html);
      const elements = temp.querySelectorAll("*");
      elements.forEach((el) => {
        const style = el.getAttribute("style");
        if (style) {
          const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
          const bgColorMatch = style.match(/background-color\s*:\s*([^;]+)/i);
          const preservedStyles: string[] = [];
          if (colorMatch) preservedStyles.push(`color: ${colorMatch[1].trim()}`);
          if (bgColorMatch) preservedStyles.push(`background-color: ${bgColorMatch[1].trim()}`);
          if (preservedStyles.length > 0) {
            el.setAttribute("style", preservedStyles.join("; "));
          } else {
            el.removeAttribute("style");
          }
        }
      });
      return temp.innerHTML;
    };

    const getSystemLabel = React.useCallback((key: string) => {
      const sysKey = key.replace("systems.", "");
      return SYSTEM_LABELS_SHORT[sysKey] || key;
    }, []);

    const renderClinicalHtml = React.useCallback(
      (html: string) =>
        renderPrintableHtml(html, patientImageOwnerId, patientImageSignedUrls),
      [patientImageOwnerId, patientImageSignedUrls],
    );

    const getHeaderFontSize = () => {
      const base = settings.printFontSize;
      if (settings.headerStyle === "minimal") return base + 4;
      if (settings.headerStyle === "detailed") return base + 10;
      return base + 7;
    };

    const borderWidth =
      settings.borderStyle === "none" ? 0 : settings.borderStyle === "heavy" ? 3 : settings.borderStyle === "medium" ? 2 : 1;
    const tableBorderClass = settings.borderStyle === "none" ? "" : "border border-slate-200";
    const cellPaddingClass = settings.compactMode ? "p-1" : "p-2";

    const getRenderColumns = React.useCallback(() => {
      const renderCols: {
        id: string;
        label: string;
        type: "single" | "combined";
        sourceKeys: string[];
        width?: number;
      }[] = [];

      const processedKeys = new Set<string>();

      (settings.combinedColumns || []).forEach((comboKey) => {
        const combo = COLUMN_COMBINATIONS.find((c) => c.key === comboKey);
        if (combo) {
          const hasEnabled = combo.columns.some(
            (colKey) => settings.columns.find((c) => c.key === colKey)?.enabled
          );

          if (hasEnabled) {
            renderCols.push({
              id: combo.key,
              label: combo.label,
              type: "combined",
              sourceKeys: combo.columns,
              width: settings.combinedColumnWidths?.[combo.key],
            });
            combo.columns.forEach((k) => {
              processedKeys.add(k);
            });
          }
        }
      });

      settings.columns.forEach((col) => {
        if (col.enabled && !processedKeys.has(col.key)) {
          renderCols.push({
            id: col.key,
            label: col.key.startsWith("systems.") ? getSystemLabel(col.key) : col.label,
            type: "single",
            sourceKeys: [col.key],
            width:
              settings.columnWidths[col.key] ||
              (col.key.startsWith("systems.") ? settings.columnWidths["systems.neuro"] : undefined),
          });
        }
      });

      return renderCols.sort((a, b) => {
        if (a.id === "patient") return -1;
        if (b.id === "patient") return 1;
        return 0;
      });
    }, [getSystemLabel, settings.columns, settings.combinedColumns, settings.columnWidths, settings.combinedColumnWidths]);

    const renderColumns = getRenderColumns();

    const getColumnPercentages = React.useMemo(() => {
      const fallbackWidth = 120;
      const widths = renderColumns.map((col) => col.width ?? fallbackWidth);
      const total = widths.reduce((sum, width) => sum + width, 0) || 1;
      return widths.map((width) => (width / total) * 100);
    }, [renderColumns]);

    const getCellValue = (patient: Patient, colKey: string) => {
      if (colKey === "patient") {
        return (
          <div>
            <div className="font-bold">{patient.name || "Unnamed"}</div>
            <div className="text-muted-foreground">{patientExportIdentifierLine(patient)}</div>
          </div>
        );
      }
      if (colKey === "todos") {
        const todos = patientTodos?.[patient.id] || [];
        if (todos.length === 0) return null;
        return (
          <ul className="list-none space-y-1">
            {todos.map((t, i) => (
               <li key={`${t.content}-${t.completed}-${i}`} className="flex gap-1.5 items-start">
                <span className="mt-0.5 text-[0.8em]">{t.completed ? "☑" : "☐"}</span>
                <span>{t.content}</span>
              </li>
            ))}
          </ul>
        );
      }
      if (colKey === "notes") {
        return patientNotes?.[patient.id] || "";
      }
      if (colKey.startsWith("systems.")) {
        const sysKey = colKey.replace("systems.", "") as keyof typeof patient.systems;
        const val = patient.systems[sysKey];
        if (!val) return null;
        return <div className="whitespace-pre-wrap break-words">{renderClinicalHtml(cleanInlineStyles(val))}</div>;
      }
      if (colKey === "medications") {
        return (
          <div className="whitespace-pre-wrap break-words">
            {renderClinicalHtml(
              formatMedicationsHtml(
                (patient as Patient & { medications?: { infusions?: string[]; scheduled?: string[]; prn?: string[]; rawText?: string } }).medications
              )
            )}
          </div>
        );
      }
      const val = patient[colKey as keyof typeof patient] as string;
      if (!val) return null;
      return <div className="whitespace-pre-wrap break-words">{renderClinicalHtml(cleanInlineStyles(val))}</div>;
    };

    const renderCombinedCell = (patient: Patient, sourceKeys: string[]) => {
      return (
        <div className="space-y-3">
          {sourceKeys.map((key) => {
            const colConfig = settings.columns.find((c) => c.key === key);
            if (!colConfig?.enabled) return null;

            const content = getCellValue(patient, key);
            if (!content) return null;

            const label = key.startsWith("systems.") ? getSystemLabel(key) : colConfig.label;

            return (
              <div key={key}>
                <div className="font-semibold text-muted-foreground text-[0.85em] uppercase tracking-wide mb-0.5">
                  {label}
                </div>
                <div>{content}</div>
              </div>
            );
          })}
        </div>
      );
    };

    if (settings.activeTab === "rounds") {
      return (
        <RoundsDocument
          ref={ref}
          patients={patients}
          patientTodos={patientTodos}
          settings={roundsSettings}
          physicianName={settings.physicianName}
          preview={preview}
          className={className}
          documentId={documentId}
        />
      );
    }

    return (
      <div
        ref={ref}
        data-print-document
        data-print-document-id={documentId}
        className={cn("print-document bg-white text-slate-900", className)}
        style={{
          fontFamily: settings.printFontFamily !== "system" ? settings.printFontFamily : undefined,
          fontSize: `${settings.printFontSize}pt`,
          ["--print-page-width" as string]: `${widthMm}mm`,
          ["--print-page-height" as string]: `${heightMm}mm`,
          ["--print-page-margin" as string]: `${marginMm}mm`,
        }}
      >
        <div className="space-y-6">
          <div className="border-b pb-4 mb-6">
            <h1 className="font-bold text-slate-900" style={{ fontSize: `${getHeaderFontSize()}pt` }}>
              Patient Rounding Report
            </h1>
            {settings.physicianName && (
              <div className="mt-1 text-sm font-medium text-slate-700">{settings.physicianName}</div>
            )}
            <div className="flex justify-between mt-2 text-sm text-slate-500">
              {settings.showTimestamp ? <span>Generated: {new Date().toLocaleString()}</span> : <span />}
              <span>Total Patients: {patients.length}</span>
              {settings.showPageNumbers && <span>Page 1</span>}
            </div>
          </div>

          {settings.activeTab === "table" ? (
            <div className="overflow-x-hidden">
              <table className={cn("w-full border-collapse text-left table-fixed")}>
                <thead>
                  <tr className={cn("bg-slate-50", tableBorderClass)}>
                    {renderColumns.map((col, index) => (
                      <th
                        key={col.id}
                        className={cn(cellPaddingClass, "font-semibold text-slate-700 align-top break-words", tableBorderClass)}
                        style={{ borderWidth, width: `${getColumnPercentages[index]}%`, minWidth: 0 }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient, idx) => (
                    <tr
                      key={patient.id}
                      className={cn(
                        "align-top",
                        tableBorderClass,
                        settings.alternateRowColors ? (idx % 2 === 0 ? "bg-white" : "bg-slate-50/50") : "bg-white",
                        settings.onePatientPerPage && idx < patients.length - 1 && "print-patient-break"
                      )}
                    >
                      {renderColumns.map((col, index) => (
                        <td
                          key={`${patient.id}-${col.id}`}
                          className={cn(cellPaddingClass, "break-words", tableBorderClass)}
                          style={{ borderWidth, width: `${getColumnPercentages[index]}%`, minWidth: 0 }}
                        >
                          {col.type === "combined"
                            ? renderCombinedCell(patient, col.sourceKeys)
                            : getCellValue(patient, col.sourceKeys[0])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              className={cn(
                "grid gap-4",
                settings.activeTab === "cards"
                  ? settings.printOrientation === "landscape"
                    ? "grid-cols-2"
                    : "grid-cols-1"
                  : "grid-cols-1"
              )}
            >
              {patients.map((patient) => (
                <div
                  key={patient.id}
                  className={cn(
                    settings.borderStyle === "none" ? "" : "border",
                    "rounded-lg bg-white shadow-sm break-inside-avoid print-avoid-break",
                    settings.onePatientPerPage && "print-patient-break",
                    settings.activeTab === "list"
                      ? settings.compactMode
                        ? "p-2"
                        : "p-4"
                      : settings.compactMode
                        ? "p-2"
                        : "p-4 flex flex-col h-full"
                  )}
                  style={{ borderWidth }}
                >
                  <div className="border-b pb-2 mb-3 flex justify-between items-baseline">
                    <span className="font-bold text-lg">{patient.name || "Unnamed"}</span>
                    <span className="text-muted-foreground font-mono">{patientExportIdentifierLine(patient)}</span>
                  </div>

                  <div
                    className={cn(
                      settings.activeTab === "list" ? "grid grid-cols-1 md:grid-cols-3 gap-6" : "space-y-4"
                    )}
                  >
                    {renderColumns
                      .filter((c) => c.id !== "patient")
                      .map((col) => {
                        const content =
                          col.type === "combined" ? renderCombinedCell(patient, col.sourceKeys) : getCellValue(patient, col.sourceKeys[0]);

                        return (
                          <div key={col.id} className={cn("space-y-1", settings.activeTab === "list" && "border-l-2 pl-3 border-muted")}>
                            <div className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 mb-1">
                              {col.label}
                            </div>
                            <div className="text-slate-600 break-words">
                              {content || <span className="text-muted-foreground/50 italic text-[0.9em]">No content</span>}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

PrintDocument.displayName = "PrintDocument";
