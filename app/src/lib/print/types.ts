import type { Patient } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";
import type { RoundsSettings } from "./roundsTypes";

/**
 * Which document the print pipeline renders. `table`, `cards` and `list` are
 * the column-driven layouts; `rounds` is the organ-system rounds document whose
 * own knobs live in `PrintSettings.rounds`.
 */
export type PrintFormat = "table" | "cards" | "list" | "rounds";

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
    isCustom?: boolean;
}

export type PdfColumnLayout = 1 | 2 | 3;

export interface PdfExportSettings {
    layoutColumns?: PdfColumnLayout;
    preserveHighlightColors?: boolean;
    title?: string;
}

export interface CustomCombination extends ColumnCombination {
    isCustom: true;
    createdAt: string;
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
    [key: string]: number; // Allow additional system keys
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
    pdf?: PdfExportSettings;
    createdAt: string;
}

export interface PrintSettings {
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
    pdf?: PdfExportSettings;
    /** Active document format. Kept as `activeTab` for stored-payload compatibility. */
    activeTab: string;
    showNotesColumn: boolean;
    showTodosColumn: boolean;
    /** Rounds-document configuration; present once the rounds format is used. */
    rounds?: RoundsSettings;
}

export interface PrintDataProps {
    patients: Patient[];
    patientTodos?: Record<string, PatientTodo[]>;
    patientNotes?: Record<string, string>;
    patientImageOwnerId?: string;
    patientImageSignedUrls?: ReadonlyMap<string, string>;
}
