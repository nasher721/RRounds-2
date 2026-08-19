import * as React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PrintSettings } from "@/lib/print/types";

interface TemplateOptionsSectionProps {
  margins: PrintSettings['margins'];
  headerStyle: PrintSettings['headerStyle'];
  borderStyle: PrintSettings['borderStyle'];
  showPageNumbers: boolean;
  showTimestamp: boolean;
  physicianName: string;
  alternateRowColors: boolean;
  compactMode: boolean;
  onUpdateSettings: (settings: Partial<PrintSettings>) => void;
}

export function TemplateOptionsSection({
  margins,
  headerStyle,
  borderStyle,
  showPageNumbers,
  showTimestamp,
  physicianName,
  alternateRowColors,
  compactMode,
  onUpdateSettings,
}: TemplateOptionsSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Template Options</h3>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>Margins</Label>
          <Select
            value={margins}
            onValueChange={(value) => onUpdateSettings({ margins: value as PrintSettings['margins'] })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select margins" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="narrow">Narrow</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="wide">Wide</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Header Style</Label>
          <Select
            value={headerStyle}
            onValueChange={(value) => onUpdateSettings({ headerStyle: value as PrintSettings['headerStyle'] })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select header style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minimal">Minimal</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="detailed">Detailed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Border Style</Label>
          <Select
            value={borderStyle}
            onValueChange={(value) => onUpdateSettings({ borderStyle: value as PrintSettings['borderStyle'] })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select border style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="heavy">Heavy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="show-page-numbers">Show Page Numbers</Label>
            <p className="text-xs text-muted-foreground">Display page numbers in the header</p>
          </div>
          <Switch
            id="show-page-numbers"
            checked={showPageNumbers}
            onCheckedChange={(checked) => onUpdateSettings({ showPageNumbers: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="show-timestamp">Show Timestamp</Label>
            <p className="text-xs text-muted-foreground">Include the generated date &amp; time</p>
          </div>
          <Switch
            id="show-timestamp"
            checked={showTimestamp}
            onCheckedChange={(checked) => onUpdateSettings({ showTimestamp: checked })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="physician-name">Physician / Team Name</Label>
          <input
            id="physician-name"
            type="text"
            placeholder="e.g. Dr. Smith — ICU Team A"
            value={physicianName || ''}
            onChange={(e) => onUpdateSettings({ physicianName: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">Appears in the printed header</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="alternate-rows">Alternate Row Colors</Label>
            <p className="text-xs text-muted-foreground">Add striping to table rows</p>
          </div>
          <Switch
            id="alternate-rows"
            checked={alternateRowColors}
            onCheckedChange={(checked) => onUpdateSettings({ alternateRowColors: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="compact-mode">Compact Mode</Label>
            <p className="text-xs text-muted-foreground">Reduce spacing for dense layouts</p>
          </div>
          <Switch
            id="compact-mode"
            checked={compactMode}
            onCheckedChange={(checked) => onUpdateSettings({ compactMode: checked })}
          />
        </div>
      </div>
    </div>
  );
}
