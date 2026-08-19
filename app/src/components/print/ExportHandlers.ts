import type { Patient } from '@/types/patient';
import type { PatientTodo } from '@/types/todo';
import type { PdfColumnLayout, PdfExportSettings } from '@/lib/print/types';
import type { ColumnConfig, ColumnWidthsType, PatientTodosMap } from './types';
import { systemLabels, systemKeys, columnCombinations } from './constants';
import { escapeHtml, stripHtml, formatTodosForDisplay, formatMedicationsText } from './utils';
import { htmlToRTF, escapeRTF as escapeRTFNew, initRTFColorTable, getRTFColorTable, parseColor } from '@/lib/print/htmlFormatter';
import type jsPDF from 'jspdf';
import { sanitizeHtml } from '@/lib/sanitize';
import {
  PATIENT_IMAGE_KEY_ATTRIBUTE,
  PATIENT_IMAGE_MAX_BYTES,
  extractPatientImageObjectKeys,
  isOwnedPatientImageObjectKey,
  resolveOwnedPatientImageSignedUrl,
} from '@/lib/patientImages';

type AutoTable = typeof import('jspdf-autotable').default;

export function generateExportFilename(
  format: 'pdf' | 'xlsx' | 'doc' | 'rtf' | 'txt' | 'md' | 'json',
  options?: { physicianName?: string; patientCount?: number; title?: string }
): string {
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toISOString().split('T')[1].slice(0, 5).replace(':', '');
  const parts: string[] = ['patient-rounding'];

  if (options?.physicianName) {
    parts.push(options.physicianName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase());
  }

  parts.push(date);
  parts.push(time);

  if (options?.patientCount && options.patientCount > 0) {
    parts.push(`${options.patientCount}pts`);
  }

  const baseName = parts.join('-');
  return `${baseName}.${format}`;
}

type RgbColor = { r: number; g: number; b: number };

interface PdfRenderableColumn {
  id: string;
  label: string;
  type: 'single' | 'combined';
  sourceKeys: string[];
}

interface PdfCellData {
  text: string;
  color: RgbColor | null;
}

interface PdfMarginConfig {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface PdfTypographyConfig {
  titleFontSize: number;
  metaFontSize: number;
  bodyFontSize: number;
  lineHeight: number;
  cellPadding: number;
}

interface PdfLayoutMetrics {
  margins: PdfMarginConfig;
  contentTop: number;
  contentBottom: number;
  pageWidth: number;
  pageHeight: number;
}

const PDF_MARGIN_MM_BY_SETTING = {
  narrow: 10,
  normal: 15,
  wide: 20,
} as const;

const PDF_DEFAULT_TITLE = 'Patient Rounding Report';
const PDF_ACCENT_COLOR: [number, number, number] = [30, 64, 175];
const PDF_BORDER_COLOR: [number, number, number] = [203, 213, 225];
const PDF_ALTERNATE_ROW_COLOR: [number, number, number] = [248, 250, 252];

const isNearBlack = (color: RgbColor): boolean => color.r < 40 && color.g < 40 && color.b < 40;

const normalizePdfText = (text: string): string =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const clampNumber = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const tintColor = (color: RgbColor, tintFactor: number = 0.9): RgbColor => ({
  r: Math.round(color.r + (255 - color.r) * tintFactor),
  g: Math.round(color.g + (255 - color.g) * tintFactor),
  b: Math.round(color.b + (255 - color.b) * tintFactor),
});

const extractDominantColor = (html: string): RgbColor | null => {
  if (!html) return null;
  const temp = document.createElement('div');
  temp.innerHTML = sanitizeHtml(html);

  const elementsWithColor = temp.querySelectorAll('[style*="color"], [style*="background-color"]');
  let fallbackColor: RgbColor | null = null;

  for (const el of elementsWithColor) {
    const style = el.getAttribute('style') || '';

    const backgroundColorMatch = style.match(/(?:^|;)\s*background-color\s*:\s*([^;]+)/i);
    if (backgroundColorMatch) {
      const parsedBackgroundColor = parseColor(backgroundColorMatch[1].trim());
      if (parsedBackgroundColor) {
        return parsedBackgroundColor;
      }
    }

    const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
    if (colorMatch) {
      const color = parseColor(colorMatch[1].trim());
      if (color && !isNearBlack(color)) {
        return color;
      }
      if (color && !fallbackColor) {
        fallbackColor = color;
      }
    }
  }

  return fallbackColor;
};

// Convert HTML to text while preserving structure indicators
const htmlToStructuredText = (html: string): string => {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = sanitizeHtml(html);

  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      const children = Array.from(el.childNodes).map(processNode).join('');

      switch (tag) {
        case 'br': return '\n';
        case 'p': return children + '\n';
        case 'div':
        case 'section':
        case 'article':
          return children + '\n';
        case 'li': return '• ' + children + '\n';
        case 'ul':
        case 'ol': return children;
        default: return children;
      }
    }
    return '';
  };

  return normalizePdfText(Array.from(temp.childNodes).map(processNode).join(''));
};

export interface ExportContext {
  patients: Patient[];
  patientTodos: PatientTodosMap;
  columns: ColumnConfig[];
  combinedColumns: string[];
  columnWidths: ColumnWidthsType;
  printFontSize: number;
  printFontFamily: string;
  printOrientation: 'portrait' | 'landscape';
  onePatientPerPage: boolean;
  margins: 'narrow' | 'normal' | 'wide';
  isColumnEnabled: (key: string) => boolean;
  getPatientTodos: (patientId: string) => PatientTodo[];
  showNotesColumn: boolean;
  showTodosColumn: boolean;
  patientNotes: Record<string, string>;
  isFiltered?: boolean;
  totalPatientCount?: number;
  showPageNumbers?: boolean;
  showTimestamp?: boolean;
  physicianName?: string;
  pdf?: PdfExportSettings;
  patientImageOwnerId?: string;
  patientImageSignedUrls?: ReadonlyMap<string, string>;
  /**
   * The rounds document is a rendered layout rather than a column model, so PDF
   * export must rasterize the prepared DOM instead of rebuilding a table.
   */
  roundsDocument?: {
    pageSize: 'letter' | 'a4' | 'legal';
    orientation: 'portrait' | 'landscape';
  };
}

const getEnabledSystemKeys = (isColumnEnabled: (key: string) => boolean) =>
  systemKeys.filter(key => isColumnEnabled(`systems.${key}`));

const resolvePdfFontFamily = (fontFamily: string): 'helvetica' | 'times' | 'courier' => {
  if (fontFamily === 'times' || fontFamily === 'georgia') return 'times';
  if (fontFamily === 'courier') return 'courier';
  return 'helvetica';
};

const getPdfTypography = (ctx: ExportContext): PdfTypographyConfig => {
  const bodyFontSize = clampNumber(ctx.printFontSize, 7, 12);
  return {
    titleFontSize: clampNumber(bodyFontSize + 4, 12, 18),
    metaFontSize: clampNumber(bodyFontSize - 1, 8, 11),
    bodyFontSize,
    lineHeight: clampNumber(bodyFontSize * 0.43, 3.2, 5.2),
    cellPadding: bodyFontSize <= 8 ? 1.6 : 2.2,
  };
};

const getPdfMargins = (setting: ExportContext['margins']): PdfMarginConfig => {
  const marginValue = PDF_MARGIN_MM_BY_SETTING[setting] ?? PDF_MARGIN_MM_BY_SETTING.normal;
  return {
    top: marginValue,
    right: marginValue,
    bottom: marginValue,
    left: marginValue,
  };
};

const getPdfLayoutMetrics = (doc: jsPDF, ctx: ExportContext): PdfLayoutMetrics => {
  const margins = getPdfMargins(ctx.margins);
  return {
    margins,
    contentTop: margins.top + 14,
    contentBottom: margins.bottom + 8,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
  };
};

const isFieldEnabled = (ctx: ExportContext, fieldKey: string): boolean => {
  if (fieldKey === 'todos') return ctx.showTodosColumn;
  if (fieldKey === 'notes') return ctx.showNotesColumn || ctx.isColumnEnabled('notes');
  return ctx.isColumnEnabled(fieldKey);
};

const FALLBACK_COLUMN_LABELS: Record<string, string> = {
  patient: 'Patient',
  clinicalSummary: 'Clinical Summary',
  intervalEvents: 'Interval Events',
  imaging: 'Imaging',
  labs: 'Labs',
  medications: 'Medications',
  todos: 'Todos',
  notes: 'Notes',
};

const resolveColumnLabel = (ctx: ExportContext, key: string): string => {
  if (key.startsWith('systems.')) {
    const systemKey = key.replace('systems.', '') as keyof typeof systemLabels;
    return systemLabels[systemKey] || key;
  }

  const configuredLabel = ctx.columns.find(column => column.key === key)?.label;
  return configuredLabel || FALLBACK_COLUMN_LABELS[key] || key;
};

const resolveColumnWeight = (ctx: ExportContext, column: PdfRenderableColumn): number => {
  const getWeightFromFieldKey = (fieldKey: string): number => {
    if (fieldKey === 'clinicalSummary') return ctx.columnWidths.summary || 150;
    if (fieldKey === 'intervalEvents') return ctx.columnWidths.events || 150;
    if (fieldKey === 'patient') return ctx.columnWidths.patient || 100;
    if (fieldKey === 'notes') return ctx.columnWidths.notes || 140;
    if (fieldKey === 'todos') return ctx.columnWidths.todos || 140;
    if (fieldKey === 'imaging') return ctx.columnWidths.imaging || 120;
    if (fieldKey === 'labs') return ctx.columnWidths.labs || 120;
    if (fieldKey === 'medications') return ctx.columnWidths.medications || 150;
    if (fieldKey.startsWith('systems.')) {
      return ctx.columnWidths[fieldKey] || ctx.columnWidths['systems.neuro'] || 90;
    }
    return ctx.columnWidths[fieldKey] || 120;
  };

  if (column.type === 'combined') {
    const combinedWeight = column.sourceKeys.reduce((sum, sourceKey) => sum + getWeightFromFieldKey(sourceKey), 0);
    return combinedWeight || 200;
  }

  return getWeightFromFieldKey(column.sourceKeys[0]);
};

const buildRenderableColumns = (ctx: ExportContext): PdfRenderableColumn[] => {
  const renderColumns: PdfRenderableColumn[] = [];
  const processedKeys = new Set<string>();

  (ctx.combinedColumns || []).forEach(comboKey => {
    const combination = columnCombinations.find(combo => combo.key === comboKey);
    if (!combination) return;

    const activeSourceKeys = combination.columns.filter(columnKey => isFieldEnabled(ctx, columnKey));
    if (activeSourceKeys.length === 0) return;

    renderColumns.push({
      id: combination.key,
      label: combination.label,
      type: 'combined',
      sourceKeys: activeSourceKeys,
    });

    activeSourceKeys.forEach(columnKey => {
      processedKeys.add(columnKey);
    });
  });

  ctx.columns.forEach(column => {
    if (processedKeys.has(column.key)) return;
    if (!isFieldEnabled(ctx, column.key)) return;

    renderColumns.push({
      id: column.key,
      label: resolveColumnLabel(ctx, column.key),
      type: 'single',
      sourceKeys: [column.key],
    });
  });

  if (renderColumns.length === 0) {
    return [
      {
        id: 'patient',
        label: 'Patient',
        type: 'single',
        sourceKeys: ['patient'],
      },
    ];
  }

  return renderColumns.sort((a, b) => {
    if (a.id === 'patient') return -1;
    if (b.id === 'patient') return 1;
    return 0;
  });
};

const getPatientFieldCellData = (ctx: ExportContext, patient: Patient, fieldKey: string): PdfCellData => {
  if (fieldKey === 'patient') {
    return {
      text: normalizePdfText(`${patient.name || 'Unnamed'}\nBed: ${patient.bed || '-'}`),
      color: null,
    };
  }

  if (fieldKey === 'clinicalSummary') {
    return {
      text: htmlToStructuredText(patient.clinicalSummary),
      color: extractDominantColor(patient.clinicalSummary),
    };
  }

  if (fieldKey === 'intervalEvents') {
    return {
      text: htmlToStructuredText(patient.intervalEvents),
      color: extractDominantColor(patient.intervalEvents),
    };
  }

  if (fieldKey === 'imaging') {
    return {
      text: htmlToStructuredText(patient.imaging),
      color: extractDominantColor(patient.imaging),
    };
  }

  if (fieldKey === 'labs') {
    return {
      text: htmlToStructuredText(patient.labs),
      color: extractDominantColor(patient.labs),
    };
  }

  if (fieldKey === 'medications') {
    return {
      text: normalizePdfText(formatMedicationsText(patient.medications)),
      color: null,
    };
  }

  if (fieldKey.startsWith('systems.')) {
    const systemKey = fieldKey.replace('systems.', '') as keyof typeof patient.systems;
    const value = patient.systems[systemKey];
    return {
      text: htmlToStructuredText(value),
      color: extractDominantColor(value),
    };
  }

  if (fieldKey === 'todos') {
    return {
      text: normalizePdfText(formatTodosForDisplay(ctx.getPatientTodos(patient.id))),
      color: null,
    };
  }

  if (fieldKey === 'notes') {
    return {
      text: normalizePdfText(ctx.patientNotes[patient.id] || ''),
      color: null,
    };
  }

  const fallbackValue = patient[fieldKey as keyof Patient];
  if (typeof fallbackValue === 'string') {
    return {
      text: htmlToStructuredText(fallbackValue),
      color: extractDominantColor(fallbackValue),
    };
  }

  return {
    text: '',
    color: null,
  };
};

const getColumnCellData = (ctx: ExportContext, patient: Patient, column: PdfRenderableColumn): PdfCellData => {
  if (column.type === 'single') {
    return getPatientFieldCellData(ctx, patient, column.sourceKeys[0]);
  }

  const sectionBlocks: string[] = [];
  let combinedColor: RgbColor | null = null;

  column.sourceKeys.forEach(sourceKey => {
    const sectionData = getPatientFieldCellData(ctx, patient, sourceKey);
    if (!sectionData.text) return;

    sectionBlocks.push(`${resolveColumnLabel(ctx, sourceKey)}:\n${sectionData.text}`);
    if (!combinedColor && sectionData.color) {
      combinedColor = sectionData.color;
    }
  });

  return {
    text: normalizePdfText(sectionBlocks.join('\n\n')),
    color: combinedColor,
  };
};

const resolvePdfLayoutColumns = (ctx: ExportContext, renderColumnCount: number): { columns: PdfColumnLayout; explicit: boolean } => {
  const explicitColumns = ctx.pdf?.layoutColumns;
  if (explicitColumns === 1 || explicitColumns === 2 || explicitColumns === 3) {
    return {
      columns: explicitColumns,
      explicit: true,
    };
  }

  if (ctx.printOrientation === 'landscape') {
    if (ctx.printFontSize <= 7) {
      return {
        columns: 3,
        explicit: false,
      };
    }

    if (renderColumnCount <= 6 || ctx.printFontSize <= 9) {
      return {
        columns: 2,
        explicit: false,
      };
    }
  }

  return {
    columns: 1,
    explicit: false,
  };
};

const applyPdfHeaderAndFooter = (
  doc: jsPDF,
  ctx: ExportContext,
  metrics: PdfLayoutMetrics,
  typography: PdfTypographyConfig,
  generatedAt: string,
  pdfFontFamily: 'helvetica' | 'times' | 'courier'
) => {
  const totalPages = doc.getNumberOfPages();
  const title = normalizePdfText(ctx.pdf?.title || PDF_DEFAULT_TITLE) || PDF_DEFAULT_TITLE;
  const showTimestamp = ctx.showTimestamp !== false;
  const showPageNumbers = ctx.showPageNumbers !== false;

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);

    doc.setFont(pdfFontFamily, 'bold');
    doc.setFontSize(typography.titleFontSize);
    doc.setTextColor(...PDF_ACCENT_COLOR);
    doc.text(title, metrics.margins.left, metrics.margins.top - 1);

    doc.setFont(pdfFontFamily, 'normal');
    doc.setFontSize(typography.metaFontSize);
    doc.setTextColor(71, 85, 105);

    if (ctx.physicianName) {
      doc.text(ctx.physicianName, metrics.margins.left, metrics.margins.top + 4);
    }

    const totalPatientsLabel = `Total Patients: ${ctx.patients.length}`;
    doc.text(totalPatientsLabel, metrics.pageWidth - metrics.margins.right, metrics.margins.top + 4, { align: 'right' });

    doc.setDrawColor(...PDF_BORDER_COLOR);
    doc.setLineWidth(0.2);
    doc.line(metrics.margins.left, metrics.margins.top + 6, metrics.pageWidth - metrics.margins.right, metrics.margins.top + 6);

    const footerY = metrics.pageHeight - metrics.margins.bottom + 3;
    doc.line(
      metrics.margins.left,
      metrics.pageHeight - metrics.margins.bottom - 4,
      metrics.pageWidth - metrics.margins.right,
      metrics.pageHeight - metrics.margins.bottom - 4
    );

    if (showTimestamp) {
      doc.text(`Generated: ${generatedAt}`, metrics.margins.left, footerY);
    }

    if (showPageNumbers) {
      doc.text(`Page ${page} of ${totalPages}`, metrics.pageWidth - metrics.margins.right, footerY, { align: 'right' });
    }
  }
};

const renderPdfTableLayout = (
  doc: jsPDF,
  autoTable: AutoTable,
  ctx: ExportContext,
  renderColumns: PdfRenderableColumn[],
  metrics: PdfLayoutMetrics,
  typography: PdfTypographyConfig,
  pdfFontFamily: 'helvetica' | 'times' | 'courier'
) => {
  const preserveHighlightColors = ctx.pdf?.preserveHighlightColors !== false;

  const tableRowsWithColors: PdfCellData[][] = ctx.patients.map(patient =>
    renderColumns.map(column => {
      const cellData = getColumnCellData(ctx, patient, column);
      return {
        text: cellData.text || '—',
        color: cellData.color,
      };
    })
  );

  const tableData = tableRowsWithColors.map(row => row.map(cell => cell.text));
  const totalWeight = renderColumns.reduce((sum, column) => sum + resolveColumnWeight(ctx, column), 0) || 1;
  const usableWidth = metrics.pageWidth - metrics.margins.left - metrics.margins.right;

  const columnStyles = renderColumns.reduce((styles, column, index) => {
    const normalizedWidth = (resolveColumnWeight(ctx, column) / totalWeight) * usableWidth;
    styles[index] = {
      cellWidth: Math.max(24, normalizedWidth),
    };
    return styles;
  }, {} as Record<number, { cellWidth: number }>);

  const renderTableChunk = (startY: number, body: string[][], bodyColors: PdfCellData[][]) => {
    autoTable(doc, {
      head: [renderColumns.map(column => column.label)],
      body,
      startY,
      margin: {
        top: metrics.contentTop,
        left: metrics.margins.left,
        right: metrics.margins.right,
        bottom: metrics.contentBottom,
      },
      showHead: 'everyPage',
      rowPageBreak: 'auto',
      tableWidth: 'auto',
      styles: {
        font: pdfFontFamily,
        fontSize: typography.bodyFontSize,
        cellPadding: typography.cellPadding,
        overflow: 'linebreak',
        lineWidth: 0.1,
        lineColor: PDF_BORDER_COLOR,
        textColor: [15, 23, 42],
        valign: 'top',
        minCellHeight: typography.lineHeight + 2,
      },
      headStyles: {
        fillColor: PDF_ACCENT_COLOR,
        textColor: 255,
        fontStyle: 'bold',
        font: pdfFontFamily,
        fontSize: clampNumber(typography.bodyFontSize + 0.5, 8, 12),
        cellPadding: typography.cellPadding + 0.2,
      },
      alternateRowStyles: {
        fillColor: PDF_ALTERNATE_ROW_COLOR,
      },
      columnStyles,
      didParseCell: data => {
        if (data.section !== 'body') return;

        const rowIndex = data.row.index;
        const columnIndex = data.column.index;
        const cellData = bodyColors[rowIndex]?.[columnIndex];
        if (!cellData?.color || !preserveHighlightColors) return;

        data.cell.styles.textColor = [cellData.color.r, cellData.color.g, cellData.color.b];
        const tintedColor = tintColor(cellData.color, 0.92);
        data.cell.styles.fillColor = [tintedColor.r, tintedColor.g, tintedColor.b];
      },
    });
  };

  const estimateRowHeight = (rowData: string[]): number => {
    const minHeight = typography.lineHeight + 2;
    let maxHeight = minHeight;

    rowData.forEach((cellText, columnIndex) => {
      const columnWidth = columnStyles[columnIndex]?.cellWidth ?? 24;
      const contentWidth = Math.max(10, Number(columnWidth) - typography.cellPadding * 2);
      const lines = doc.splitTextToSize(cellText || '—', contentWidth);
      const lineCount = Array.isArray(lines) ? lines.length : 1;
      const estimatedHeight = Math.max(minHeight, lineCount * typography.lineHeight + typography.cellPadding * 2);
      if (estimatedHeight > maxHeight) {
        maxHeight = estimatedHeight;
      }
    });

    return maxHeight;
  };

  const pageHeight = metrics.pageHeight;
  const margin = metrics.margins.bottom;
  const headerHeight = 20;
  const pageBottom = pageHeight - margin;
  let currentY = metrics.contentTop;
  let bufferedRows: string[][] = [];
  let bufferedRowColors: PdfCellData[][] = [];
  let bufferedHeight = 0;

  tableData.forEach((row, rowIndex) => {
    const rowHeight = estimateRowHeight(row);

    if (currentY + headerHeight + bufferedHeight + rowHeight > pageBottom && bufferedRows.length > 0) {
      renderTableChunk(currentY, bufferedRows, bufferedRowColors);
      currentY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? currentY;
      bufferedRows = [];
      bufferedRowColors = [];
      bufferedHeight = 0;
    }

    if (currentY + headerHeight + rowHeight > pageBottom) {
      doc.addPage();
      currentY = metrics.contentTop;
    }

    bufferedRows.push(row);
    bufferedRowColors.push(tableRowsWithColors[rowIndex]);
    bufferedHeight += rowHeight;
  });

  if (bufferedRows.length > 0) {
    renderTableChunk(currentY, bufferedRows, bufferedRowColors);
  }
};

const renderPdfMultiColumnLayout = (
  doc: jsPDF,
  autoTable: AutoTable,
  ctx: ExportContext,
  renderColumns: PdfRenderableColumn[],
  layoutColumns: PdfColumnLayout,
  metrics: PdfLayoutMetrics,
  typography: PdfTypographyConfig,
  pdfFontFamily: 'helvetica' | 'times' | 'courier'
) => {
  const preserveHighlightColors = ctx.pdf?.preserveHighlightColors !== false;

  const patientCards: PdfCellData[] = ctx.patients.map(patient => {
    const cardSections: string[] = [];
    let cardColor: RgbColor | null = null;

    const patientHeader = getPatientFieldCellData(ctx, patient, 'patient');
    if (patientHeader.text) {
      cardSections.push(patientHeader.text);
    }

    renderColumns
      .filter(column => column.id !== 'patient')
      .forEach(column => {
        const columnData = getColumnCellData(ctx, patient, column);
        if (!columnData.text) return;

        cardSections.push(`${column.label.toUpperCase()}:\n${columnData.text}`);
        if (!cardColor && columnData.color) {
          cardColor = columnData.color;
        }
      });

    return {
      text: normalizePdfText(cardSections.join('\n\n')),
      color: cardColor,
    };
  });

  const rowsWithColors: PdfCellData[][] = [];
  for (let index = 0; index < patientCards.length; index += layoutColumns) {
    const row: PdfCellData[] = [];
    for (let columnIndex = 0; columnIndex < layoutColumns; columnIndex += 1) {
      row.push(patientCards[index + columnIndex] || { text: '', color: null });
    }
    rowsWithColors.push(row);
  }

  const bodyRows = rowsWithColors.map(row => row.map(cell => cell.text || ' '));
  const usableWidth = metrics.pageWidth - metrics.margins.left - metrics.margins.right;
  const cardColumnWidth = usableWidth / layoutColumns;

  const columnStyles = Array.from({ length: layoutColumns }).reduce<Record<number, { cellWidth: number }>>(
    (styles, _, index) => {
      styles[index] = {
        cellWidth: cardColumnWidth,
      };
      return styles;
    },
    {}
  );

  const bodyFontSize = clampNumber(typography.bodyFontSize - (layoutColumns === 3 ? 1 : 0), 6.5, 11);
  const cellPadding = layoutColumns === 3 ? 1.4 : 2;
  const minCellHeight = layoutColumns === 3 ? 34 : 42;

  const renderMultiColumnChunk = (startY: number, body: string[][], bodyColors: PdfCellData[][]) => {
    autoTable(doc, {
      body,
      startY,
      margin: {
        top: metrics.contentTop,
        left: metrics.margins.left,
        right: metrics.margins.right,
        bottom: metrics.contentBottom,
      },
      rowPageBreak: 'avoid',
      tableWidth: 'auto',
      styles: {
        font: pdfFontFamily,
        fontSize: bodyFontSize,
        cellPadding,
        overflow: 'linebreak',
        lineWidth: 0.12,
        lineColor: PDF_BORDER_COLOR,
        textColor: [15, 23, 42],
        valign: 'top',
        minCellHeight,
      },
      alternateRowStyles: {
        fillColor: PDF_ALTERNATE_ROW_COLOR,
      },
      columnStyles,
      didParseCell: data => {
        if (data.section !== 'body') return;

        const rowIndex = data.row.index;
        const columnIndex = data.column.index;
        const cellData = bodyColors[rowIndex]?.[columnIndex];
        if (!cellData?.color || !preserveHighlightColors) return;

        data.cell.styles.textColor = [cellData.color.r, cellData.color.g, cellData.color.b];
        const cardTint = tintColor(cellData.color, 0.94);
        data.cell.styles.fillColor = [cardTint.r, cardTint.g, cardTint.b];
      },
    });
  };

  const estimateCardRowHeight = (rowData: string[]): number => {
    let maxHeight = minCellHeight;
    rowData.forEach(cellText => {
      const contentWidth = Math.max(12, cardColumnWidth - cellPadding * 2);
      const lines = doc.splitTextToSize(cellText || ' ', contentWidth);
      const lineCount = Array.isArray(lines) ? lines.length : 1;
      const lineHeight = clampNumber(bodyFontSize * 0.43, 2.8, 4.8);
      const estimatedHeight = Math.max(minCellHeight, lineCount * lineHeight + cellPadding * 2);
      if (estimatedHeight > maxHeight) {
        maxHeight = estimatedHeight;
      }
    });
    return maxHeight;
  };

  const pageHeight = metrics.pageHeight;
  const margin = metrics.margins.bottom;
  const headerHeight = 20;
  const pageBottom = pageHeight - margin;
  let currentY = metrics.contentTop;
  let bufferedRows: string[][] = [];
  let bufferedRowColors: PdfCellData[][] = [];
  let bufferedHeight = 0;

  bodyRows.forEach((row, rowIndex) => {
    const estimatedContentHeight = estimateCardRowHeight(row);

    if (currentY + headerHeight + bufferedHeight + estimatedContentHeight > pageBottom && bufferedRows.length > 0) {
      renderMultiColumnChunk(currentY, bufferedRows, bufferedRowColors);
      currentY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? currentY;
      bufferedRows = [];
      bufferedRowColors = [];
      bufferedHeight = 0;
    }

    if (currentY + headerHeight + estimatedContentHeight > pageBottom) {
      doc.addPage();
      currentY = metrics.contentTop;
    }

    bufferedRows.push(row);
    bufferedRowColors.push(rowsWithColors[rowIndex]);
    bufferedHeight += estimatedContentHeight;
  });

  if (bufferedRows.length > 0) {
    renderMultiColumnChunk(currentY, bufferedRows, bufferedRowColors);
  }
};

/** html2pdf.js accepts `pagebreak`, but its shipped types omit the field. */
type Html2PdfConfig = Record<string, unknown>;

const exportWithHtml2PdfFallback = async (ctx: ExportContext, element: HTMLElement, fileName: string) => {
  const { default: html2pdf } = await import('html2pdf.js');
  await html2pdf()
    // `pagebreak` is supported by html2pdf.js but missing from its shipped
    // types; without it the rounds document's CSS page breaks are ignored.
    .set({
      filename: fileName,
      margin: 0,
      image: {
        type: 'jpeg',
        quality: 0.98,
      },
      html2canvas: {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      },
      pagebreak: { mode: ['css', 'legacy'] },
      jsPDF: {
        unit: 'mm',
        format: ctx.roundsDocument?.pageSize ?? 'a4',
        orientation: ctx.roundsDocument?.orientation ?? ctx.printOrientation,
      },
    } as Html2PdfConfig)
    .from(element)
    .save();
};

const waitForPrintablePatientImages = async (element: HTMLElement): Promise<void> => {
  const images = Array.from(
    element.querySelectorAll<HTMLImageElement>('img[data-patient-image-key][src]'),
  );
  await Promise.all(
    images.map(async (image) => {
      if (image.complete) return;
      await new Promise<void>((resolve) => {
        const finish = () => {
          window.clearTimeout(timeoutId);
          image.removeEventListener('load', finish);
          image.removeEventListener('error', finish);
          resolve();
        };
        const timeoutId = window.setTimeout(finish, 10_000);
        image.addEventListener('load', finish, { once: true });
        image.addEventListener('error', finish, { once: true });
      });
    }),
  );
};

export const containsPrintablePatientImages = (element?: HTMLElement | null): boolean =>
  Boolean(element?.querySelector('img[data-patient-image-key][src]'));

export const handleExportExcel = async (ctx: ExportContext) => {
  const XLSX = await import('xlsx');
  const { patients, isColumnEnabled, showTodosColumn, getPatientTodos, patientNotes } = ctx;

  const data = patients.map(patient => {
    const row: Record<string, string> = {};

    if (isColumnEnabled("patient")) {
      row["Patient Name"] = patient.name || "Unnamed";
      row["Bed/Room"] = patient.bed;
    }
    if (isColumnEnabled("clinicalSummary")) {
      row["Clinical Summary"] = stripHtml(patient.clinicalSummary);
    }
    if (isColumnEnabled("intervalEvents")) {
      row["Interval Events"] = stripHtml(patient.intervalEvents);
    }
    if (isColumnEnabled("imaging")) {
      row["Imaging"] = stripHtml(patient.imaging);
    }
    if (isColumnEnabled("labs")) {
      row["Labs"] = stripHtml(patient.labs);
    }
    if (isColumnEnabled("medications")) {
      row["Medications"] = formatMedicationsText(patient.medications);
    }

    systemKeys.forEach(key => {
      if (isColumnEnabled(`systems.${key}`)) {
        row[systemLabels[key]] = stripHtml(patient.systems[key as keyof typeof patient.systems]);
      }
    });

    if (showTodosColumn) {
      const todos = getPatientTodos(patient.id);
      row["Todos"] = formatTodosForDisplay(todos);
    }

    if (isColumnEnabled("notes")) {
      row["Notes"] = patientNotes[patient.id] || "";
    }

    row["Created"] = new Date(patient.createdAt).toLocaleString();
    row["Last Modified"] = new Date(patient.lastModified).toLocaleString();

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Patient Rounding");

  const fileName = generateExportFilename('xlsx', {
    physicianName: ctx.physicianName,
    patientCount: ctx.patients.length,
  });
  XLSX.writeFile(wb, fileName);

  return fileName;
};

export const handleExportPDF = async (ctx: ExportContext, element?: HTMLElement | null) => {
  const fileName = generateExportFilename('pdf', {
    physicianName: ctx.physicianName,
    patientCount: ctx.patients.length,
    title: ctx.pdf?.title,
  });
  const generatedAt = new Date().toLocaleString();

  // The vector text renderer cannot preserve clinical images. When the
  // disposable export tree contains safely hydrated private images, use the
  // existing async HTML renderer so the visual export includes them.
  if (element && (ctx.roundsDocument || containsPrintablePatientImages(element))) {
    await waitForPrintablePatientImages(element);
    await exportWithHtml2PdfFallback(ctx, element, fileName);
    return fileName;
  }

  try {
    const [{ default: JsPdf }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new JsPdf({
      orientation: ctx.printOrientation,
      unit: 'mm',
      format: 'a4',
    });

    const pdfFontFamily = resolvePdfFontFamily(ctx.printFontFamily);
    const typography = getPdfTypography(ctx);
    const metrics = getPdfLayoutMetrics(doc, ctx);
    const renderColumns = buildRenderableColumns(ctx);
    const { columns: layoutColumns, explicit } = resolvePdfLayoutColumns(ctx, renderColumns.length);

    const shouldUseMultiColumnLayout =
      !ctx.onePatientPerPage && layoutColumns > 1 && (explicit || renderColumns.length <= 8);

    doc.setFont(pdfFontFamily, 'normal');

    if (shouldUseMultiColumnLayout) {
      renderPdfMultiColumnLayout(doc, autoTable, ctx, renderColumns, layoutColumns, metrics, typography, pdfFontFamily);
    } else {
      renderPdfTableLayout(doc, autoTable, ctx, renderColumns, metrics, typography, pdfFontFamily);
    }

    applyPdfHeaderAndFooter(doc, ctx, metrics, typography, generatedAt, pdfFontFamily);
    doc.save(fileName);

    return fileName;
  } catch (error) {
    console.error('jsPDF export failed, attempting html2pdf fallback:', error);
    if (!element) {
      throw error;
    }

    await exportWithHtml2PdfFallback(ctx, element, fileName);
    return fileName;
  }
};

export const handleExportTXT = (ctx: ExportContext) => {
  const { patients, isColumnEnabled, showTodosColumn, getPatientTodos, patientNotes } = ctx;
  const enabledSystemKeys = getEnabledSystemKeys(isColumnEnabled);

  let content = `PATIENT ROUNDING REPORT\n`;
  content += `Generated: ${new Date().toLocaleString()}\n`;
  content += `Total Patients: ${patients.length}\n`;
  content += `${'='.repeat(60)}\n\n`;

  patients.forEach((patient, index) => {
    content += `${'─'.repeat(60)}\n`;
    content += `PATIENT ${index + 1}: ${patient.name || 'Unnamed'}\n`;
    content += `Bed/Room: ${patient.bed || 'N/A'}\n`;
    content += `${'─'.repeat(60)}\n\n`;

    if (isColumnEnabled("clinicalSummary") && patient.clinicalSummary) {
      content += `CLINICAL SUMMARY:\n${stripHtml(patient.clinicalSummary)}\n\n`;
    }
    if (isColumnEnabled("intervalEvents") && patient.intervalEvents) {
      content += `INTERVAL EVENTS:\n${stripHtml(patient.intervalEvents)}\n\n`;
    }
    if (isColumnEnabled("imaging") && patient.imaging) {
      content += `IMAGING:\n${stripHtml(patient.imaging)}\n\n`;
    }
    if (isColumnEnabled("labs") && patient.labs) {
      content += `LABS:\n${stripHtml(patient.labs)}\n\n`;
    }
    if (isColumnEnabled("medications")) {
      const medsText = formatMedicationsText(patient.medications);
      if (medsText) content += `MEDICATIONS:\n${medsText}\n\n`;
    }

    if (enabledSystemKeys.length > 0) {
      content += `SYSTEMS REVIEW:\n`;
      enabledSystemKeys.forEach(key => {
        const value = patient.systems[key as keyof typeof patient.systems];
        if (value) {
          content += `  ${systemLabels[key]}: ${stripHtml(value)}\n`;
        }
      });
      content += `\n`;
    }

    if (showTodosColumn) {
      const todos = getPatientTodos(patient.id);
      if (todos.length > 0) {
        content += `TODOS:\n`;
        todos.forEach(todo => {
          content += `  ${todo.completed ? '[x]' : '[ ]'} ${todo.content}\n`;
        });
        content += `\n`;
      }
    }

    if (isColumnEnabled("notes") && patientNotes[patient.id]) {
      content += `NOTES:\n${patientNotes[patient.id]}\n\n`;
    }

    content += `\n`;
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = generateExportFilename('txt', {
    physicianName: ctx.physicianName,
    patientCount: ctx.patients.length,
  });
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return fileName;
};

export const handleExportRTF = (ctx: ExportContext) => {
  const { patients, isColumnEnabled, showTodosColumn, getPatientTodos, patientNotes } = ctx;
  const enabledSystemKeys = getEnabledSystemKeys(isColumnEnabled);

  // Initialize RTF color table for this export
  initRTFColorTable();

  // Build RTF content first to collect all colors
  const patientContent: string[] = [];

  patients.forEach((patient, index) => {
    let content = '';
    content += `\\pard\\sb200\\sa100\\brdrb\\brdrs\\brdrw10\\brsp20\n`;
    content += `\\fs28\\b\\cf2 Patient ${index + 1}: ${escapeRTFNew(patient.name || 'Unnamed')}\\cf1\\b0\\par\n`;
    content += `\\fs20 Bed/Room: ${escapeRTFNew(patient.bed || 'N/A')}\\par\n`;
    content += `\\pard\\sa100\n`;

    if (isColumnEnabled("clinicalSummary") && patient.clinicalSummary) {
      content += `\\fs22\\b Clinical Summary:\\b0\\par\n`;
      content += `\\fs20 ${htmlToRTF(patient.clinicalSummary)}\\par\\par\n`;
    }
    if (isColumnEnabled("intervalEvents") && patient.intervalEvents) {
      content += `\\fs22\\b Interval Events:\\b0\\par\n`;
      content += `\\fs20 ${htmlToRTF(patient.intervalEvents)}\\par\\par\n`;
    }
    if (isColumnEnabled("imaging") && patient.imaging) {
      content += `\\fs22\\b Imaging:\\b0\\par\n`;
      content += `\\fs20 ${htmlToRTF(patient.imaging)}\\par\\par\n`;
    }
    if (isColumnEnabled("labs") && patient.labs) {
      content += `\\fs22\\b Labs:\\b0\\par\n`;
      content += `\\fs20 ${htmlToRTF(patient.labs)}\\par\\par\n`;
    }
    if (isColumnEnabled("medications")) {
      const medsText = formatMedicationsText(patient.medications);
      if (medsText) {
        content += `\\fs22\\b Medications:\\b0\\par\n`;
        content += `\\fs20 ${escapeRTFNew(medsText)}\\par\\par\n`;
      }
    }

    if (enabledSystemKeys.length > 0) {
      content += `\\fs22\\b Systems Review:\\b0\\par\n`;
      enabledSystemKeys.forEach(key => {
        const value = patient.systems[key as keyof typeof patient.systems];
        if (value) {
          content += `\\fs20\\b ${escapeRTFNew(systemLabels[key])}:\\b0  ${htmlToRTF(value)}\\par\n`;
        }
      });
      content += `\\par\n`;
    }

    if (showTodosColumn) {
      const todos = getPatientTodos(patient.id);
      if (todos.length > 0) {
        content += `\\fs22\\b Todos:\\b0\\par\n`;
        todos.forEach(todo => {
          content += `\\fs20 ${todo.completed ? '[X]' : '[ ]'} ${escapeRTFNew(todo.content)}\\par\n`;
        });
        content += `\\par\n`;
      }
    }

    if (isColumnEnabled("notes") && patientNotes[patient.id]) {
      content += `\\fs22\\b Notes:\\b0\\par\n`;
      content += `\\fs20 ${escapeRTFNew(patientNotes[patient.id])}\\par\\par\n`;
    }

    content += `\\par\n`;
    patientContent.push(content);
  });

  // Now build complete RTF with the dynamically generated color table
  let rtf = `{\\rtf1\\ansi\\deff0\n`;
  rtf += `{\\fonttbl{\\f0\\fswiss Arial;}{\\f1\\fmodern Courier New;}}\n`;
  rtf += `${getRTFColorTable()}\n\n`;

  rtf += `\\f0\\fs32\\b PATIENT ROUNDING REPORT\\b0\\par\n`;
  rtf += `\\fs20\\cf3 Generated: ${new Date().toLocaleString()}\\par\n`;
  rtf += `Total Patients: ${patients.length}\\cf1\\par\n`;
  rtf += `\\line\n`;

  // Add all patient content
  rtf += patientContent.join('');

  rtf += `}`;

  const blob = new Blob([rtf], { type: 'application/rtf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = generateExportFilename('rtf', {
    physicianName: ctx.physicianName,
    patientCount: ctx.patients.length,
  });
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return fileName;
};

const DOCUMENT_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

const patientImageBlobToDataUrl = async (blob: Blob): Promise<string | null> => {
  const mimeType = blob.type.toLowerCase().split(';', 1)[0];
  if (!DOCUMENT_IMAGE_TYPES.has(mimeType) || blob.size <= 0 || blob.size > PATIENT_IMAGE_MAX_BYTES) {
    return null;
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
};

const loadDocumentPatientImageDataUrls = async (
  ctx: ExportContext,
): Promise<Map<string, string>> => {
  const ownerId = ctx.patientImageOwnerId;
  if (!ownerId || !ctx.patientImageSignedUrls) return new Map();

  const keys = new Set<string>();
  ctx.patients.forEach((patient) => {
    extractPatientImageObjectKeys(patient.imaging, ownerId).forEach((key) => keys.add(key));
  });

  const dataUrls = new Map<string, string>();
  await Promise.all(
    Array.from(keys).map(async (key) => {
      const signedUrl = resolveOwnedPatientImageSignedUrl(
        key,
        ctx.patientImageSignedUrls,
        ownerId,
      );
      if (!signedUrl) return;

      try {
        const response = await fetch(signedUrl, {
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        if (!response.ok) return;
        const dataUrl = await patientImageBlobToDataUrl(await response.blob());
        if (dataUrl) dataUrls.set(key, dataUrl);
      } catch {
        // Keep the document export usable when an individual image expires or
        // the storage service is temporarily unavailable.
      }
    }),
  );

  return dataUrls;
};

export const sanitizeClinicalHtmlForDocumentExport = (
  html: string,
  ownerId?: string,
  patientImageDataUrls: ReadonlyMap<string, string> = new Map(),
): string => {
  const template = document.createElement('template');
  template.innerHTML = sanitizeHtml(html);

  template.content.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    const objectKey = image.getAttribute(PATIENT_IMAGE_KEY_ATTRIBUTE);
    const dataUrl = objectKey ? patientImageDataUrls.get(objectKey) : undefined;
    if (
      !objectKey ||
      !ownerId ||
      !isOwnedPatientImageObjectKey(objectKey, ownerId) ||
      !dataUrl ||
      !/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(dataUrl)
    ) {
      image.remove();
      return;
    }

    const alt = (image.getAttribute('alt') || 'Patient image').slice(0, 500);
    Array.from(image.attributes).forEach((attribute) => image.removeAttribute(attribute.name));
    image.setAttribute('src', dataUrl);
    image.setAttribute('alt', alt);
  });

  return template.innerHTML;
};

export const handleExportDOC = async (ctx: ExportContext): Promise<string> => {
  const { patients, isColumnEnabled, showTodosColumn, getPatientTodos, patientNotes } = ctx;
  const enabledSystemKeys = getEnabledSystemKeys(isColumnEnabled);
  const patientImageDataUrls = await loadDocumentPatientImageDataUrls(ctx);
  const safeClinicalHtml = (value: string) =>
    sanitizeClinicalHtmlForDocumentExport(
      value,
      ctx.patientImageOwnerId,
      patientImageDataUrls,
    );

  let html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>Patient Rounding Report</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page { margin: 1in; }
    body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.4; word-break: break-word; overflow-wrap: anywhere; }
    * { box-sizing: border-box; }
    h1 { color: #3b82f6; font-size: 18pt; margin-bottom: 5pt; }
    h2 { color: #3b82f6; font-size: 14pt; border-bottom: 2px solid #3b82f6; padding-bottom: 5pt; margin-top: 20pt; }
    h3 { font-size: 12pt; color: #333; margin-top: 10pt; margin-bottom: 5pt; }
    .meta { color: #666; font-size: 10pt; margin-bottom: 15pt; }
    .patient-card { border: 1px solid #ccc; margin: 15pt 0; padding: 10pt; page-break-inside: avoid; }
    .patient-header { background: #3b82f6; color: white; padding: 8pt; margin: -10pt -10pt 10pt -10pt; }
    .section { margin: 10pt 0; }
    .section-title { font-weight: bold; color: #333; }
    .section-content { margin-top: 3pt; }
    .todo-item { margin: 3pt 0; }
    .completed { text-decoration: line-through; color: #888; }
    table { width: 100%; border-collapse: collapse; margin: 10pt 0; table-layout: fixed; }
    th, td { border: 1px solid #ddd; padding: 5pt; text-align: left; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; }
    th { background: #f5f5f5; font-weight: bold; }
    img { max-width: 100%; height: auto; }
    /* Preserve inline colors - Word respects inline styles */
    span[style], div[style], p[style] { mso-style-textfill-type: solid; }
  </style>
</head>
<body>
  <h1>Patient Rounding Report</h1>
  <div class="meta">Generated: ${new Date().toLocaleString()} | Total Patients: ${patients.length}</div>
`;

  patients.forEach((patient, index) => {
    html += `
  <div class="patient-card">
    <div class="patient-header">
      <strong>Patient ${index + 1}: ${escapeHtml(patient.name || 'Unnamed')}</strong>
      ${patient.bed ? ` | Bed: ${escapeHtml(patient.bed)}` : ''}
    </div>
`;

    if (isColumnEnabled("clinicalSummary") && patient.clinicalSummary) {
      html += `
    <div class="section">
      <div class="section-title">Clinical Summary</div>
      <div class="section-content">${safeClinicalHtml(patient.clinicalSummary)}</div>
    </div>`;
    }
    if (isColumnEnabled("intervalEvents") && patient.intervalEvents) {
      html += `
    <div class="section">
      <div class="section-title">Interval Events</div>
      <div class="section-content">${safeClinicalHtml(patient.intervalEvents)}</div>
    </div>`;
    }
    if (isColumnEnabled("imaging") && patient.imaging) {
      html += `
    <div class="section">
      <div class="section-title">Imaging</div>
      <div class="section-content">${safeClinicalHtml(patient.imaging)}</div>
    </div>`;
    }
    if (isColumnEnabled("labs") && patient.labs) {
      html += `
    <div class="section">
      <div class="section-title">Labs</div>
      <div class="section-content">${safeClinicalHtml(patient.labs)}</div>
    </div>`;
    }
    if (isColumnEnabled("medications")) {
      const medsText = formatMedicationsText(patient.medications);
      if (medsText) {
        html += `
    <div class="section">
      <div class="section-title">Medications</div>
      <div class="section-content">${escapeHtml(medsText).replace(/\n/g, '<br>')}</div>
    </div>`;
      }
    }

    if (enabledSystemKeys.length > 0) {
      html += `
    <div class="section">
      <div class="section-title">Systems Review</div>
      <table>
        <tr>`;
      enabledSystemKeys.forEach(key => {
        html += `<th>${escapeHtml(systemLabels[key])}</th>`;
      });
      html += `</tr><tr>`;
      enabledSystemKeys.forEach(key => {
        const value = patient.systems[key as keyof typeof patient.systems];
        // Preserve inline styles with colors in table cells
        html += `<td>${value ? safeClinicalHtml(value) : '-'}</td>`;
      });
      html += `</tr></table>
    </div>`;
    }

    if (showTodosColumn) {
      const todos = getPatientTodos(patient.id);
      if (todos.length > 0) {
        html += `
    <div class="section">
      <div class="section-title">Todos</div>`;
        todos.forEach(todo => {
          html += `
      <div class="todo-item ${todo.completed ? 'completed' : ''}">
        ${todo.completed ? '☑' : '☐'} ${escapeHtml(todo.content)}
      </div>`;
        });
        html += `
    </div>`;
      }
    }

    if (isColumnEnabled("notes") && patientNotes[patient.id]) {
      html += `
    <div class="section">
      <div class="section-title">Notes</div>
      <div class="section-content">${escapeHtml(patientNotes[patient.id])}</div>
    </div>`;
    }

    html += `
  </div>`;
  });

  html += `
</body>
</html>`;

  const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = generateExportFilename('doc', {
    physicianName: ctx.physicianName,
    patientCount: ctx.patients.length,
  });
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return fileName;
};

export const handleExportMarkdown = (ctx: ExportContext) => {
  const { patients, isColumnEnabled, showTodosColumn, getPatientTodos, patientNotes } = ctx;
  const enabledSystemKeys = getEnabledSystemKeys(isColumnEnabled);

  let content = `# Patient Rounding Report\n`;
  content += `**Generated:** ${new Date().toLocaleString()}\n`;
  content += `**Total Patients:** ${patients.length}\n\n`;

  patients.forEach((patient, index) => {
    content += `## Patient ${index + 1}: ${patient.name || 'Unnamed'}\n`;
    content += `**Bed/Room:** ${patient.bed || 'N/A'}\n\n`;

    if (isColumnEnabled("clinicalSummary") && patient.clinicalSummary) {
      content += `### Clinical Summary\n${stripHtml(patient.clinicalSummary)}\n\n`;
    }
    if (isColumnEnabled("intervalEvents") && patient.intervalEvents) {
      content += `### Interval Events\n${stripHtml(patient.intervalEvents)}\n\n`;
    }
    if (isColumnEnabled("imaging") && patient.imaging) {
      content += `### Imaging\n${stripHtml(patient.imaging)}\n\n`;
    }
    if (isColumnEnabled("labs") && patient.labs) {
      content += `### Labs\n${stripHtml(patient.labs)}\n\n`;
    }
    if (isColumnEnabled("medications")) {
      const medsText = formatMedicationsText(patient.medications);
      if (medsText) {
        content += `### Medications\n${medsText}\n\n`;
      }
    }

    if (enabledSystemKeys.length > 0) {
      content += `### Systems Review\n`;
      enabledSystemKeys.forEach(key => {
        const value = patient.systems[key as keyof typeof patient.systems];
        if (value) {
          content += `#### ${systemLabels[key]}\n${stripHtml(value)}\n\n`;
        }
      });
    }

    if (showTodosColumn) {
      const todos = getPatientTodos(patient.id);
      if (todos.length > 0) {
        content += `### Todos\n`;
        todos.forEach(todo => {
          content += `- [${todo.completed ? 'x' : ' '}] ${todo.content}\n`;
        });
        content += `\n`;
      }
    }

    if (isColumnEnabled("notes") && patientNotes[patient.id]) {
      content += `### Notes\n${patientNotes[patient.id]}\n\n`;
    }

    content += `---\n\n`;
  });

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = generateExportFilename('md', {
    physicianName: ctx.physicianName,
    patientCount: ctx.patients.length,
  });
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return fileName;
};

export const handleExportJSON = (ctx: ExportContext) => {
  const {
    patients,
    columns,
    combinedColumns,
    isColumnEnabled,
    showTodosColumn,
    getPatientTodos,
    isFiltered,
    totalPatientCount
  } = ctx;

  const exportData = {
    exportedAt: new Date().toISOString(),
    patientCount: patients.length,
    columns: columns.filter(c => c.enabled).map(c => c.key),
    combinedColumns: combinedColumns,
    isFiltered: isFiltered,
    totalPatients: totalPatientCount || patients.length,
    data: patients.map(patient => {
      const row: Record<string, unknown> = {};

      if (isColumnEnabled("patient")) {
        row.patientName = patient.name || "Unnamed";
        row.bed = patient.bed;
      }
      if (isColumnEnabled("clinicalSummary")) {
        row.clinicalSummary = stripHtml(patient.clinicalSummary);
      }
      if (isColumnEnabled("intervalEvents")) {
        row.intervalEvents = stripHtml(patient.intervalEvents);
      }
      if (isColumnEnabled("imaging")) {
        row.imaging = stripHtml(patient.imaging);
      }
      if (isColumnEnabled("labs")) {
        row.labs = stripHtml(patient.labs);
      }
      if (isColumnEnabled("medications")) {
        row.medications = {
          infusions: patient.medications?.infusions || [],
          scheduled: patient.medications?.scheduled || [],
          prn: patient.medications?.prn || [],
          rawText: patient.medications?.rawText || ''
        };
      }

      const systems: Record<string, string> = {};
      systemKeys.forEach(key => {
        if (isColumnEnabled(`systems.${key}`)) {
          systems[key] = stripHtml(patient.systems[key as keyof typeof patient.systems]);
        }
      });
      if (Object.keys(systems).length > 0) {
        row.systems = systems;
      }

      if (showTodosColumn) {
        row.todos = getPatientTodos(patient.id).map(t => ({
          content: t.content,
          completed: t.completed
        }));
      }

      return row;
    })
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = generateExportFilename('json', {
    physicianName: ctx.physicianName,
    patientCount: ctx.patients.length,
  });
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return fileName;
};
