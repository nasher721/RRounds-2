import { SYSTEM_KEYS } from "@/constants/systems";
import type { ColumnCombination } from "./types";

const allSystemColumnKeys = SYSTEM_KEYS.map(key => `systems.${key}`);

export const COLUMN_COMBINATIONS: ColumnCombination[] = [
    {
        key: "summaryEvents",
        label: "Summary + Events",
        columns: ["clinicalSummary", "intervalEvents"]
    },
    {
        key: "imagingLabs",
        label: "Imaging + Labs",
        columns: ["imaging", "labs"]
    },
    {
        key: "allContent",
        label: "All Clinical Data (Summary, Events, Imaging, Labs)",
        columns: ["clinicalSummary", "intervalEvents", "imaging", "labs"]
    },
    {
        key: "systemsReview",
        label: "Systems Review (All Systems)",
        columns: allSystemColumnKeys
    },
];

export const LAYOUT_OPTIONS = [
    { value: 'table', label: 'Table View' },
    { value: 'cards', label: 'Cards (Grid)' },
    { value: 'list', label: 'List (Vertical)' },
];
