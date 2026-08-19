import type { Patient, PatientMedications } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";
import type { ColumnConfig } from "./types";
import { columnCombinations } from "./constants";
import { stripHtml as baseStripHtml, sanitizeAndCleanStyles } from "@/lib/sanitize";

// Re-export strip HTML for backward compatibility
export const stripHtml = baseStripHtml;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape plain-text values before composing trusted print markup. */
export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, character => HTML_ESCAPES[character]);

// Format structured medications into display text
export const formatMedicationsText = (meds: PatientMedications | undefined): string => {
  if (!meds) return '';
  const parts: string[] = [];
  if (meds.infusions?.length) parts.push(`Infusions: ${meds.infusions.join(', ')}`);
  if (meds.scheduled?.length) parts.push(`Scheduled: ${meds.scheduled.join(', ')}`);
  if (meds.prn?.length) parts.push(`PRN: ${meds.prn.join(', ')}`);
  if (parts.length === 0 && meds.rawText) return meds.rawText;
  return parts.join('\n');
};

// Format structured medications into HTML for print
export const formatMedicationsHtml = (meds: PatientMedications | undefined): string => {
  if (!meds) return '';
  const sections: string[] = [];
  if (meds.infusions?.length) {
    sections.push(`<div class="med-section"><strong>Infusions:</strong> ${meds.infusions.map(escapeHtml).join(', ')}</div>`);
  }
  if (meds.scheduled?.length) {
    sections.push(`<div class="med-section"><strong>Scheduled:</strong> ${meds.scheduled.map(escapeHtml).join(', ')}</div>`);
  }
  if (meds.prn?.length) {
    sections.push(`<div class="med-section"><strong>PRN:</strong> ${meds.prn.map(escapeHtml).join(', ')}</div>`);
  }
  if (sections.length === 0 && meds.rawText) return escapeHtml(meds.rawText);
  return sections.join('');
};

// Clean inline font styles from HTML while preserving structure AND sanitizing against XSS
export const cleanInlineStyles = sanitizeAndCleanStyles;

// Helper to escape RTF special characters
export const escapeRTF = (text: string): string => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\par\n');
};

// Format todos for display
export const formatTodosForDisplay = (todos: PatientTodo[]): string => {
  if (todos.length === 0) return '';
  return todos.map(t => `${t.completed ? '☑' : '☐'} ${t.content}`).join('\n');
};

export const formatTodosHtml = (todos: PatientTodo[]): string => {
  if (todos.length === 0) return '<span class="empty">No todos</span>';
  return `<ul class="todos-list">${todos.map(t =>
    `<li class="todo-item ${t.completed ? 'completed' : ''}">
      <span class="todo-checkbox">${t.completed ? '☑' : '☐'}</span>
      <span class="todo-content">${escapeHtml(t.content)}</span>
    </li>`
  ).join('')}</ul>`;
};

// Get cell value from patient
export const getCellValue = (patient: Patient, field: string, patientNotes: Record<string, string>): string => {
  if (field === "clinicalSummary") return patient.clinicalSummary;
  if (field === "intervalEvents") return patient.intervalEvents;
  if (field === "imaging") return patient.imaging;
  if (field === "labs") return patient.labs;
  if (field === "medications") return formatMedicationsText(patient.medications);
  if (field === "notes") return patientNotes[patient.id] || "";
  if (field.startsWith("systems.")) {
    const systemKey = field.replace("systems.", "") as keyof typeof patient.systems;
    return patient.systems[systemKey];
  }
  return "";
};

// Check if a column is part of an active combination
export const isColumnCombined = (columnKey: string, combinedColumns: string[]): string | null => {
  for (const combo of columnCombinations) {
    if (combinedColumns.includes(combo.key) && combo.columns.includes(columnKey)) {
      return combo.key;
    }
  }
  return null;
};

// Get combined content for a patient
export const getCombinedContent = (
  patient: Patient,
  combinationKey: string,
  columns: ColumnConfig[],
  patientNotes: Record<string, string>
): string => {
  const combination = columnCombinations.find(c => c.key === combinationKey);
  if (!combination) return '';

  const sections: string[] = [];
  combination.columns.forEach(colKey => {
    const value = getCellValue(patient, colKey, patientNotes);
    if (value) {
      const label = columns.find(c => c.key === colKey)?.label || colKey;
      sections.push(`<div class="combined-section"><strong>${escapeHtml(label)}:</strong> ${cleanInlineStyles(value)}</div>`);
    }
  });

  return sections.join('');
};
