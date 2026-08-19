import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { defaultColumns } from "./constants";
import type { CustomCombination } from "@/lib/print/types";

interface CustomCombinationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (combination: CustomCombination) => void;
  existingCombination?: CustomCombination;
}

export function CustomCombinationDialog({
  open,
  onOpenChange,
  onSave,
  existingCombination
}: CustomCombinationDialogProps) {
  const [name, setName] = React.useState(existingCombination?.label || "");
  const [selectedColumns, setSelectedColumns] = React.useState<string[]>(
    existingCombination?.columns || []
  );

  // Reset state when dialog opens/closes or existingCombination changes
  React.useEffect(() => {
    if (open) {
      setName(existingCombination?.label || "");
      setSelectedColumns(existingCombination?.columns || []);
    }
  }, [open, existingCombination]);

  // Get combinable columns (exclude patient which should always be separate)
  const combinableColumns = defaultColumns.filter(col => col.key !== "patient");

  const handleToggleColumn = (columnKey: string) => {
    setSelectedColumns(prev =>
      prev.includes(columnKey)
        ? prev.filter(k => k !== columnKey)
        : [...prev, columnKey]
    );
  };

  const handleSave = () => {
    if (name.trim() && selectedColumns.length >= 2) {
      const combination: CustomCombination = {
        key: existingCombination?.key || `custom-${Date.now()}`,
        label: name.trim(),
        columns: selectedColumns,
        isCustom: true,
        createdAt: existingCombination?.createdAt || new Date().toISOString()
      };
      onSave(combination);
      onOpenChange(false);
    }
  };

  const isValid = name.trim().length > 0 && selectedColumns.length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {existingCombination ? "Edit Custom Combination" : "Create Custom Combination"}
          </DialogTitle>
          <DialogDescription>
            Name a print layout and choose which chart sections to include together.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="combo-name">Combination Name</Label>
            <Input
              id="combo-name"
              placeholder="e.g., My Clinical Summary"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Sections to Combine</Label>
              <Badge variant="secondary" className="text-xs">
                {selectedColumns.length} selected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Select at least 2 sections to combine into a single column.
            </p>

            <ScrollArea className="h-[250px] border rounded-md p-3">
              <div className="space-y-2">
                {combinableColumns.filter(c => !c.key.startsWith('systems.')).map(col => (
                  <div
                    key={col.key}
                    className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggleColumn(col.key)}
                  >
                    <Checkbox
                      id={`custom-col-${col.key}`}
                      checked={selectedColumns.includes(col.key)}
                      onCheckedChange={() => handleToggleColumn(col.key)}
                    />
                    <Label
                      htmlFor={`custom-col-${col.key}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {col.label}
                    </Label>
                  </div>
                ))}

                <div className="pt-2 pb-1 border-t mt-2">
                  <Label className="text-xs font-semibold text-muted-foreground">SYSTEMS</Label>
                </div>

                {combinableColumns.filter(c => c.key.startsWith('systems.')).map(col => (
                  <div
                    key={col.key}
                    className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer pl-4"
                    onClick={() => handleToggleColumn(col.key)}
                  >
                    <Checkbox
                      id={`custom-col-${col.key}`}
                      checked={selectedColumns.includes(col.key)}
                      onCheckedChange={() => handleToggleColumn(col.key)}
                    />
                    <Label
                      htmlFor={`custom-col-${col.key}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {col.label}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {selectedColumns.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <div className="flex flex-wrap gap-1">
                {selectedColumns.map(key => {
                  const col = combinableColumns.find(c => c.key === key);
                  return col ? (
                    <Badge key={key} variant="outline" className="text-xs">
                      {col.label}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            {existingCombination ? "Save Changes" : "Create Combination"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
