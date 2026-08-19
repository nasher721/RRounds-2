import { SYSTEM_LABELS_SHORT, SYSTEM_KEYS } from "@/constants/systems";
import type { ColumnConfig, ColumnCombination, ColumnWidthsType, CombinedColumnWidths, FontFamily } from "./types";

export const systemLabels = SYSTEM_LABELS_SHORT;
export const systemKeys = SYSTEM_KEYS;

// All system column keys for the "Systems Review" combination
export const allSystemColumnKeys = systemKeys.map(key => `systems.${key}`);

export const columnCombinations: ColumnCombination[] = [
  { key: "summaryEvents", label: "Summary + Events", columns: ["clinicalSummary", "intervalEvents"] },
  { key: "imagingLabs", label: "Imaging + Labs", columns: ["imaging", "labs"] },
  { key: "allContent", label: "All Clinical Data", columns: ["clinicalSummary", "intervalEvents", "imaging", "labs"] },
  { key: "systemsReview", label: "Systems Review (All Systems)", columns: allSystemColumnKeys },
];

export const defaultColumns: ColumnConfig[] = [
  { key: "patient", label: "Patient/Bed", enabled: true },
  { key: "clinicalSummary", label: "Clinical Summary", enabled: true },
  { key: "intervalEvents", label: "Interval Events", enabled: true },
  { key: "imaging", label: "Imaging", enabled: true },
  { key: "labs", label: "Labs", enabled: true },
  { key: "medications", label: "Medications", enabled: true },
  ...systemKeys.map(key => ({ key: `systems.${key}`, label: systemLabels[key], enabled: true })),
  { key: "todos", label: "Todos", enabled: true },
  { key: "notes", label: "Notes (blank for rounding)", enabled: false },
];

export const defaultColumnWidths: ColumnWidthsType = {
  patient: 100,
  summary: 150,
  events: 150,
  imaging: 120,
  labs: 120,
  medications: 150,
  notes: 140,
  todos: 140,
  'systems.neuro': 90,
  'systems.cv': 90,
  'systems.resp': 90,
  'systems.renalGU': 90,
  'systems.gi': 90,
  'systems.endo': 90,
  'systems.heme': 90,
  'systems.infectious': 90,
  'systems.skinLines': 90,
  'systems.dispo': 90,
};

export const defaultCombinedColumnWidths: CombinedColumnWidths = {
  summaryEvents: 300,
  imagingLabs: 240,
  allContent: 420,
  systemsReview: 360,
};

export const fontFamilies: FontFamily[] = [
  { value: 'system', label: 'System Default', css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { value: 'arial', label: 'Arial', css: "Arial, Helvetica, sans-serif" },
  { value: 'times', label: 'Times New Roman', css: "'Times New Roman', Times, serif" },
  { value: 'georgia', label: 'Georgia', css: "Georgia, 'Times New Roman', serif" },
  { value: 'courier', label: 'Courier New', css: "'Courier New', Courier, monospace" },
  { value: 'verdana', label: 'Verdana', css: "Verdana, Geneva, sans-serif" },
  { value: 'trebuchet', label: 'Trebuchet MS', css: "'Trebuchet MS', Helvetica, sans-serif" },
];
