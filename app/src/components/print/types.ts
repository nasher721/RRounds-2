import type { Patient } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";

export interface PatientTodosMap {
  [patientId: string]: PatientTodo[];
}

export interface PrintExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
  patientTodos?: PatientTodosMap;
  onUpdatePatient?: (id: string, field: string, value: string) => void;
  totalPatientCount?: number;
  isFiltered?: boolean;
}

export interface ColumnConfig {
  key: string;
  label: string;
  enabled: boolean;
  combinedWith?: string;
}

export interface ColumnCombination {
  key: string;
  label: string;
  columns: string[];
}

export interface ExpandedCell {
  patientId: string;
  field: string;
}

export type ColumnWidthsType = {
  patient: number;
  summary: number;
  events: number;
  imaging: number;
  labs: number;
  medications: number;
  notes: number;
  todos: number;
  'systems.neuro': number;
  'systems.cv': number;
  'systems.resp': number;
  'systems.renalGU': number;
  'systems.gi': number;
  'systems.endo': number;
  'systems.heme': number;
  'systems.infectious': number;
  'systems.skinLines': number;
  'systems.dispo': number;
  [key: string]: number;
};

export type CombinedColumnWidths = Record<string, number>;

export interface PrintPreset {
  id: string;
  name: string;
  columns: ColumnConfig[];
  combinedColumns: string[];
  printOrientation: 'portrait' | 'landscape';
  printFontSize: number;
  printFontFamily: string;
  onePatientPerPage: boolean;
  autoFitFontSize: boolean;
  columnWidths: ColumnWidthsType;
  combinedColumnWidths: CombinedColumnWidths;
  margins: 'narrow' | 'normal' | 'wide';
  headerStyle: 'minimal' | 'standard' | 'detailed';
  borderStyle: 'none' | 'light' | 'medium' | 'heavy';
  showPageNumbers: boolean;
  showTimestamp: boolean;
  alternateRowColors: boolean;
  compactMode: boolean;
  physicianName?: string;
  createdAt: string;
}

export interface FontFamily {
  value: string;
  label: string;
  css: string;
}
