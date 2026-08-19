import * as React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Plus, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CustomCombination } from "@/lib/print/types";
import { columnCombinations } from "../constants";

interface CombineSectionsSectionProps {
  combinedColumns: string[];
  customCombinations: CustomCombination[];
  onToggleCombination: (combinationKey: string) => void;
  onAddCustomCombination?: (combination: CustomCombination) => void;
  onUpdateCustomCombination?: (combination: CustomCombination) => void;
  onDeleteCustomCombination?: (combinationKey: string) => void;
  onOpenCustomDialog: (combination?: CustomCombination) => void;
}

export function CombineSectionsSection({
  combinedColumns,
  customCombinations,
  onToggleCombination,
  onAddCustomCombination,
  onUpdateCustomCombination,
  onDeleteCustomCombination,
  onOpenCustomDialog,
}: CombineSectionsSectionProps) {
  const isCombinationActive = (combinationKey: string) => {
    return combinedColumns.includes(combinationKey);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Combine Sections</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Merge multiple sections into a single column for a more compact print layout.
      </p>

      {/* Preset Combinations */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">PRESETS</Label>
        {columnCombinations.map(combo => {
          const isActive = isCombinationActive(combo.key);
          return (
            <div
              key={combo.key}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                isActive
                  ? "bg-primary/10 border-primary"
                  : "bg-muted/30 border-transparent hover:bg-muted/50"
              )}
              onClick={() => onToggleCombination(combo.key)}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`combo-${combo.key}`}
                  checked={isActive}
                  onCheckedChange={() => onToggleCombination(combo.key)}
                />
                <Label
                  htmlFor={`combo-${combo.key}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  {combo.label}
                </Label>
              </div>
              {isActive && (
                <Badge variant="secondary" className="text-xs">
                  Active
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom Combinations */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground">CUSTOM</Label>
          {onAddCustomCombination && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => onOpenCustomDialog()}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          )}
        </div>

        {customCombinations.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">
            No custom combinations yet. Click "Add" to create one.
          </p>
        ) : (
          customCombinations.map(combo => {
            const isActive = isCombinationActive(combo.key);
            return (
              <div
                key={combo.key}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-colors",
                  isActive
                    ? "bg-primary/10 border-primary"
                    : "bg-muted/30 border-transparent hover:bg-muted/50"
                )}
              >
                <div
                  className="flex items-center gap-2 flex-1 cursor-pointer"
                  onClick={() => onToggleCombination(combo.key)}
                >
                  <Checkbox
                    id={`combo-${combo.key}`}
                    checked={isActive}
                    onCheckedChange={() => onToggleCombination(combo.key)}
                  />
                  <div className="flex flex-col">
                    <Label
                      htmlFor={`combo-${combo.key}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {combo.label}
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {combo.columns.length} sections
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isActive && (
                    <Badge variant="secondary" className="text-xs mr-1">
                      Active
                    </Badge>
                  )}
                  {onUpdateCustomCombination && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCustomDialog(combo);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  {onDeleteCustomCombination && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCustomCombination(combo.key);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
