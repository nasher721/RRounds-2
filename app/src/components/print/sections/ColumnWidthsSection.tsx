import * as React from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { PrintSettings, ColumnWidthsType, CustomCombination } from "@/lib/print/types";
import { columnCombinations } from "../constants";

interface WidthControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const WidthControl = ({ label, value, onChange, min = 50, max = 500, step = 5 }: WidthControlProps) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label>{label}: {value}px</Label>
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(val) => onChange(val[0])}
    />
  </div>
);

interface ColumnWidthsSectionProps {
  columnWidths: ColumnWidthsType;
  combinedColumnWidths: Record<string, number>;
  combinedColumns: string[];
  customCombinations: CustomCombination[];
  onUpdateSettings: (settings: Partial<PrintSettings>) => void;
}

export function ColumnWidthsSection({
  columnWidths,
  combinedColumnWidths,
  combinedColumns,
  customCombinations,
  onUpdateSettings,
}: ColumnWidthsSectionProps) {
  const combinedWidthOptions = React.useMemo(() => [
    ...columnCombinations,
    ...customCombinations
  ], [customCombinations]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Column Widths</h3>

      <div className="grid gap-4">
        <WidthControl
          label="Patient Column"
          value={columnWidths.patient}
          onChange={(v) => onUpdateSettings({ columnWidths: { ...columnWidths, patient: v } })}
          max={300}
        />

        <WidthControl
          label="Summary Column"
          value={columnWidths.summary}
          onChange={(v) => onUpdateSettings({ columnWidths: { ...columnWidths, summary: v } })}
        />

        <WidthControl
          label="Events Column"
          value={columnWidths.events}
          onChange={(v) => onUpdateSettings({ columnWidths: { ...columnWidths, events: v } })}
        />

        <WidthControl
          label="Imaging"
          value={columnWidths.imaging}
          onChange={(v) => onUpdateSettings({ columnWidths: { ...columnWidths, imaging: v } })}
          max={300}
        />

        <WidthControl
          label="Labs"
          value={columnWidths.labs}
          onChange={(v) => onUpdateSettings({ columnWidths: { ...columnWidths, labs: v } })}
          max={300}
        />

        <WidthControl
          label="Todos"
          value={columnWidths.todos || 140}
          onChange={(v) => onUpdateSettings({ columnWidths: { ...columnWidths, todos: v } })}
          max={300}
        />

        <WidthControl
          label="Notes"
          value={columnWidths.notes}
          onChange={(v) => onUpdateSettings({ columnWidths: { ...columnWidths, notes: v } })}
          max={300}
        />

        <WidthControl
          label="System Columns"
          value={columnWidths['systems.neuro']}
          onChange={(v) => {
            const updatedColumnWidths: ColumnWidthsType = { ...columnWidths };
            Object.keys(updatedColumnWidths).forEach((key) => {
              if (key.startsWith('systems.')) {
                updatedColumnWidths[key] = v;
              }
            });
            onUpdateSettings({ columnWidths: updatedColumnWidths });
          }}
          max={200}
        />
      </div>

      {/* Combined Column Widths */}
      <div className="pt-2 space-y-3">
        <Label className="text-xs font-semibold text-muted-foreground">COMBINED COLUMN WIDTHS</Label>
        {combinedColumns.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Enable a combination to adjust its width.</p>
        ) : (
          combinedWidthOptions
            .filter(option => combinedColumns.includes(option.key))
            .map(option => (
              <WidthControl
                key={option.key}
                label={option.label}
                value={combinedColumnWidths[option.key] || 240}
                onChange={(v) => onUpdateSettings({
                  combinedColumnWidths: {
                    ...combinedColumnWidths,
                    [option.key]: v
                  }
                })}
                max={600}
              />
            ))
        )}
      </div>
    </div>
  );
}
