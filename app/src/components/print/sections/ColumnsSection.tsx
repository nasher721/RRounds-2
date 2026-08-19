import * as React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ColumnConfig } from "@/lib/print/types";

interface ColumnsSectionProps {
  columns: ColumnConfig[];
  onToggleColumn: (key: string) => void;
  onResetColumns: () => void;
}

export function ColumnsSection({
  columns,
  onToggleColumn,
  onResetColumns,
}: ColumnsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Columns</h3>
        <Button variant="ghost" size="sm" onClick={onResetColumns} className="h-6 text-xs px-2">
          Reset
        </Button>
      </div>

      <ScrollArea className="h-[300px] pr-4 border rounded-md p-2">
        <div className="space-y-2">
          {/* Standard columns */}
          {columns.filter(c => !c.key.startsWith('systems.')).map(col => (
            <div key={col.key} className="flex items-center space-x-2">
              <Checkbox
                id={`col-${col.key}`}
                checked={col.enabled}
                onCheckedChange={() => onToggleColumn(col.key)}
              />
              <Label htmlFor={`col-${col.key}`} className="text-sm font-normal cursor-pointer">
                {col.label}
              </Label>
            </div>
          ))}

          {/* Systems subsection */}
          <div className="pt-2 pb-1">
            <Label className="text-xs font-semibold text-muted-foreground">SYSTEMS</Label>
          </div>

          {columns.filter(c => c.key.startsWith('systems.')).map(col => (
            <div key={col.key} className="flex items-center space-x-2 pl-2 border-l-2 border-muted ml-1">
              <Checkbox
                id={`col-${col.key}`}
                checked={col.enabled}
                onCheckedChange={() => onToggleColumn(col.key)}
              />
              <Label htmlFor={`col-${col.key}`} className="text-sm font-normal cursor-pointer">
                {col.label}
              </Label>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
