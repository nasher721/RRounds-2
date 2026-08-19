/**
 * ChangeTrackingControls Component
 * UI for toggling change tracking and selecting styles
 */

import React from "react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Highlighter, Type, Italic, Palette } from "lucide-react";
import type { ChangeTrackingStyles } from "@/types/changeTracking";

interface ChangeTrackingControlsProps {
  enabled: boolean;
  color: string;
  styles: ChangeTrackingStyles;
  onToggleEnabled: () => void;
  onColorChange: (color: string) => void;
  onToggleStyle: (style: keyof ChangeTrackingStyles) => void;
}

const PRESET_COLORS = [
  "#0d9488", // Primary (teal) – design system default
  "#C92A2A", // Red
  "#E67700", // Orange
  "#2B8A3E", // Green
  "#1864AB", // Blue
  "#862E9C", // Purple
  "#E64980", // Pink
];

export const ChangeTrackingControls: React.FC<ChangeTrackingControlsProps> = ({
  enabled,
  color,
  styles,
  onToggleEnabled,
  onColorChange,
  onToggleStyle,
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={enabled ? "default" : "outline"}
          size="sm"
          className="gap-2"
          title="Mark New Text"
        >
          <Highlighter className="h-4 w-4" />
          <span className="hidden sm:inline">Mark Changes</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="mark-toggle" className="font-medium">
              Mark New Text
            </Label>
            <Switch
              id="mark-toggle"
              checked={enabled}
              onCheckedChange={onToggleEnabled}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm text-muted-foreground">Style Options</Label>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="style-color"
                checked={styles.textColor}
                onCheckedChange={() => onToggleStyle("textColor")}
              />
              <Label htmlFor="style-color" className="flex items-center gap-2 cursor-pointer">
                <Type className="h-4 w-4" />
                Text Color
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="style-bg"
                checked={styles.backgroundColor}
                onCheckedChange={() => onToggleStyle("backgroundColor")}
              />
              <Label htmlFor="style-bg" className="flex items-center gap-2 cursor-pointer">
                <Highlighter className="h-4 w-4" />
                Background Highlight
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="style-italic"
                checked={styles.italic}
                onCheckedChange={() => onToggleStyle("italic")}
              />
              <Label htmlFor="style-italic" className="flex items-center gap-2 cursor-pointer">
                <Italic className="h-4 w-4" />
                Italics
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Color
            </Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === presetColor
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: presetColor }}
                  onClick={() => onColorChange(presetColor)}
                  title={presetColor}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => onColorChange(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border-0 p-0"
                title="Custom color"
              />
            </div>
          </div>

          {enabled && (
            <div
              className="p-2 rounded border text-sm"
              style={{
                color: styles.textColor ? color : undefined,
                backgroundColor: styles.backgroundColor ? color + "33" : undefined,
                fontStyle: styles.italic ? "italic" : undefined,
              }}
            >
              Preview: New text will look like this
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
