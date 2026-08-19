import * as React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TypographySectionProps {
  printFontFamily: string;
  printFontSize: number;
  autoFitFontSize: boolean;
  onUpdateSettings: (settings: Partial<{
    printFontFamily: string;
    printFontSize: number;
    autoFitFontSize: boolean;
  }>) => void;
}

const fontFamilies = [
  { value: 'system', label: 'System Default' },
  { value: 'arial', label: 'Arial' },
  { value: 'times', label: 'Times New Roman' },
  { value: 'georgia', label: 'Georgia' },
  { value: 'courier', label: 'Courier New' },
  { value: 'verdana', label: 'Verdana' },
  { value: 'trebuchet', label: 'Trebuchet MS' },
];

export function TypographySection({
  printFontFamily,
  printFontSize,
  autoFitFontSize,
  onUpdateSettings,
}: TypographySectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Typography</h3>

      <div className="grid gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Font Family</Label>
          </div>
          <Select
            value={printFontFamily}
            onValueChange={(value) => onUpdateSettings({ printFontFamily: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select font" />
            </SelectTrigger>
            <SelectContent>
              {fontFamilies.map(f => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Font Size: {printFontSize}pt</Label>
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-fit"
                checked={autoFitFontSize}
                onCheckedChange={(checked) => onUpdateSettings({ autoFitFontSize: checked })}
              />
              <Label htmlFor="auto-fit" className="text-xs font-normal text-muted-foreground">Auto-fit</Label>
            </div>
          </div>
          <Slider
            value={[printFontSize]}
            min={6}
            max={16}
            step={1}
            disabled={autoFitFontSize}
            onValueChange={(val) => onUpdateSettings({ printFontSize: val[0] })}
          />
        </div>
      </div>
    </div>
  );
}
