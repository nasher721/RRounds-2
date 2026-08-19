import * as React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface LayoutSectionProps {
  printOrientation: 'portrait' | 'landscape';
  onePatientPerPage: boolean;
  onUpdateSettings: (settings: Partial<{
    printOrientation: 'portrait' | 'landscape';
    onePatientPerPage: boolean;
  }>) => void;
}

export function LayoutSection({
  printOrientation,
  onePatientPerPage,
  onUpdateSettings,
}: LayoutSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Layout</h3>

      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="orientation">Orientation</Label>
          <div className="flex bg-muted p-1 rounded-lg">
            <button
              onClick={() => onUpdateSettings({ printOrientation: 'portrait' })}
              className={cn(
                "px-3 py-1 text-xs rounded-md transition-all",
                printOrientation === 'portrait' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              )}
              aria-pressed={printOrientation === 'portrait'}
            >
              Portrait
            </button>
            <button
              onClick={() => onUpdateSettings({ printOrientation: 'landscape' })}
              className={cn(
                "px-3 py-1 text-xs rounded-md transition-all",
                printOrientation === 'landscape' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              )}
              aria-pressed={printOrientation === 'landscape'}
            >
              Landscape
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="one-per-page">One Patient Per Page</Label>
            <p className="text-xs text-muted-foreground">Force each patient on a new page</p>
          </div>
          <Switch
            id="one-per-page"
            checked={onePatientPerPage}
            onCheckedChange={(checked) => onUpdateSettings({ onePatientPerPage: checked })}
          />
        </div>
      </div>
    </div>
  );
}
