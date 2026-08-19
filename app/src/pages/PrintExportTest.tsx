import * as React from "react";
import { PrintDocument } from "@/components/print/PrintDocument";
import type { PrintSettings } from "@/lib/print/types";
import { defaultColumns, defaultColumnWidths, defaultCombinedColumnWidths } from "@/components/print/constants";
import type { Patient } from "@/types/patient";
import { defaultMedications, defaultSystems } from "@/types/patient";
import { DEFAULT_ROUNDS_SINGLE, DEFAULT_ROUNDS_TWO_COLUMN } from "@/lib/print/roundsTypes";

const createLongText = (length: number) =>
  Array.from({ length }, () => "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ")
    .join("")
    .trim();

const buildWideTable = () => {
  const headers = Array.from({ length: 8 }, (_, idx) => `Header ${idx + 1}`);
  const cells = Array.from({ length: 8 }, (_, idx) => `Cell content ${idx + 1} ${createLongText(3)}`);
  return `
    <table>
      <thead>
        <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
      </thead>
      <tbody>
        <tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>
      </tbody>
    </table>
  `;
};

const buildLargeImage = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
      <rect width="1600" height="900" fill="#dbeafe" />
      <rect x="80" y="80" width="1440" height="740" fill="#1d4ed8" />
      <text x="120" y="180" font-size="80" fill="white">Large Image Test</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const buildPatients = (): Patient[] => {
  const longParagraph = createLongText(20);
  const wideTable = buildWideTable();
  const image = buildLargeImage();

  return [
    {
      id: "patient-1",
      patientNumber: 1,
      name: "Avery Longlastname",
      mrn: "",
      bed: "ICU-101",
      clinicalSummary: `<p>${longParagraph}</p>${wideTable}<p style="color: #2563eb;">Highlighted note with color.</p>`,
      intervalEvents: `<p>${createLongText(10)}</p>`,
      imaging: `<p>CT chest results pending.</p><img src="${image}" alt="Large" />`,
      labs: `<p>${createLongText(8)}</p>`,
      systems: {
        ...defaultSystems,
        neuro: `<p>${createLongText(6)}</p>`,
        cv: `<p>${createLongText(6)}</p>`,
        resp: `<p>${createLongText(6)}</p>`,
      },
      medications: defaultMedications,
      fieldTimestamps: {},
      collapsed: false,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    },
    {
      id: "patient-2",
      patientNumber: 2,
      name: "Jamie ExtremelyVerboseName",
      mrn: "",
      bed: "Stepdown-202",
      clinicalSummary: `<p>${createLongText(12)}</p>`,
      intervalEvents: `<p>${createLongText(12)}</p>`,
      imaging: `<p>${createLongText(6)}</p>`,
      labs: `<p>${createLongText(12)}</p>`,
      systems: {
        ...defaultSystems,
        gi: `<p>${createLongText(5)}</p>`,
        renalGU: `<p>${createLongText(5)}</p>`,
      },
      medications: defaultMedications,
      fieldTimestamps: {},
      collapsed: false,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    },
  ];
};

const buildSettings = (overrides: Partial<PrintSettings>): PrintSettings => {
  const columns = defaultColumns.map((col) =>
    col.key === "notes" ? { ...col, enabled: true } : col
  );

  return {
    columns,
    combinedColumns: [],
    printOrientation: "portrait",
    printFontSize: 9,
    printFontFamily: "system",
    onePatientPerPage: false,
    autoFitFontSize: false,
    columnWidths: defaultColumnWidths,
    combinedColumnWidths: defaultCombinedColumnWidths,
    margins: "normal",
    headerStyle: "standard",
    borderStyle: "light",
    showPageNumbers: true,
    showTimestamp: true,
    alternateRowColors: true,
    compactMode: false,
    activeTab: "table",
    showNotesColumn: true,
    showTodosColumn: true,
    ...overrides,
  };
};

export default function PrintExportTest() {
  const patients = React.useMemo(() => buildPatients(), []);
  const patientTodos = React.useMemo(
    () => ({
      "patient-1": [
        {
          id: "todo-1",
          patientId: "patient-1",
          userId: "test-user",
          section: null,
          content: createLongText(2),
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "todo-2",
          patientId: "patient-1",
          userId: "test-user",
          section: null,
          content: "Short follow-up",
          completed: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      "patient-2": [
        {
          id: "todo-3",
          patientId: "patient-2",
          userId: "test-user",
          section: null,
          content: createLongText(3),
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }),
    []
  );
  const patientNotes = React.useMemo(
    () => ({
      "patient-1": createLongText(8),
      "patient-2": createLongText(6),
    }),
    []
  );

  const settingsVariants = React.useMemo(
    () => [
      { id: "portrait-table", settings: buildSettings({ activeTab: "table", printOrientation: "portrait", margins: "normal" }) },
      { id: "landscape-table", settings: buildSettings({ activeTab: "table", printOrientation: "landscape", margins: "narrow" }) },
      { id: "portrait-cards", settings: buildSettings({ activeTab: "cards", printOrientation: "portrait", margins: "wide" }) },
      {
        id: "rounds-single",
        settings: buildSettings({ activeTab: "rounds", rounds: DEFAULT_ROUNDS_SINGLE }),
      },
      {
        id: "rounds-two-column",
        settings: buildSettings({ activeTab: "rounds", rounds: DEFAULT_ROUNDS_TWO_COLUMN }),
      },
    ],
    []
  );

  React.useEffect(() => {
    window.runPrintExportTest = () => {
      const documents = Array.from(document.querySelectorAll<HTMLElement>("[data-print-document]"));
      return documents.map((doc) => {
        const rect = doc.getBoundingClientRect();
        const styles = window.getComputedStyle(doc);
        const paddingLeft = parseFloat(styles.paddingLeft || "0");
        const paddingRight = parseFloat(styles.paddingRight || "0");
        const contentRight = rect.right - paddingRight;
        const overflowedElements = Array.from(doc.querySelectorAll<HTMLElement>("*")).filter((el) => {
          if (el === doc) return false;
          const elRect = el.getBoundingClientRect();
          if (elRect.width === 0 || elRect.height === 0) return false;
          return elRect.right > contentRight + 0.5 || el.scrollWidth > el.clientWidth + 1;
        });

        return {
          id: doc.dataset.printDocumentId || "unknown",
          overflowCount: overflowedElements.length,
        };
      });
    };

    return () => {
      delete window.runPrintExportTest;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Print/Export Visual Regression Harness</h1>
        <p className="text-sm text-muted-foreground">
          This page renders edge-case print documents for automated overflow checks.
        </p>
      </div>

      {settingsVariants.map((variant) => (
        <div key={variant.id} className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{variant.id}</h2>
          <PrintDocument
            patients={patients}
            patientTodos={patientTodos}
            patientNotes={patientNotes}
            settings={variant.settings}
            documentId={variant.id}
            className="shadow-sm"
          />
        </div>
      ))}
    </div>
  );
}
