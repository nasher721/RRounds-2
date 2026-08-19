import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  User, Hash, Calendar, DoorOpen, AlertCircle, Stethoscope,
  ClipboardList, CalendarDays, AlertTriangle, Pill, Activity,
  TestTube, GripVertical, RotateCcw
} from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { PATIENT_INFO_TOOLBAR_ITEMS, DEFAULT_PATIENT_INFO_TOOLBAR_BUTTONS } from "@/constants/config";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  User, Hash, Calendar, DoorOpen, AlertCircle, Stethoscope,
  ClipboardList, CalendarDays, AlertTriangle, Pill, Activity, TestTube,
  GripVertical
};

const ICON_CLASS = "h-4 w-4";

interface PatientInfoToolbarCustomizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PatientInfoToolbarCustomizeDialog = ({
  open,
  onOpenChange
}: PatientInfoToolbarCustomizeDialogProps) => {
  const {
    patientInfoToolbarMode,
    setPatientInfoToolbarMode,
    patientInfoToolbarButtons,
    setPatientInfoToolbarButtons
  } = useSettings();

  const [localButtons, setLocalButtons] = React.useState<string[]>(patientInfoToolbarButtons);
  const [localMode, setLocalMode] = React.useState(patientInfoToolbarMode);

  React.useEffect(() => {
    if (open) {
      setLocalButtons(patientInfoToolbarButtons);
      setLocalMode(patientInfoToolbarMode);
    }
  }, [open, patientInfoToolbarButtons, patientInfoToolbarMode]);

  const handleToggle = React.useCallback((itemId: string) => {
    setLocalButtons(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      }
      return [...prev, itemId];
    });
  }, []);

  const handleReset = React.useCallback(() => {
    setLocalButtons([...DEFAULT_PATIENT_INFO_TOOLBAR_BUTTONS]);
    setLocalMode('minimal');
  }, []);

  const handleSave = React.useCallback(() => {
    setPatientInfoToolbarButtons(localButtons);
    setPatientInfoToolbarMode(localMode);
    onOpenChange(false);
  }, [localButtons, localMode, setPatientInfoToolbarButtons, setPatientInfoToolbarMode, onOpenChange]);

  const groupedItems = React.useMemo(() => {
    const groups: Record<string, typeof PATIENT_INFO_TOOLBAR_ITEMS> = {
      patient: [],
      clinical: [],
      common: []
    };
    PATIENT_INFO_TOOLBAR_ITEMS.forEach(item => {
      groups[item.category].push(item);
    });
    return groups;
  }, []);

  const categoryLabels: Record<string, string> = {
    patient: "Patient Information",
    clinical: "Clinical Data",
    common: "Common Fields"
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Customize Patient Info Toolbar
          </DialogTitle>
          <DialogDescription>
            Choose which patient identity and clinical fields appear in the chart toolbar during rounds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Display Mode</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={localMode === 'minimal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLocalMode('minimal')}
                className="flex-1"
              >
                Custom
              </Button>
              <Button
                type="button"
                variant={localMode === 'full' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLocalMode('full')}
                className="flex-1"
              >
                Show All
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {localMode === 'minimal'
                ? 'Only selected items will appear in the toolbar. Additional items are available in the dropdown.'
                : 'All available items will appear in the toolbar.'}
            </p>
          </div>

          {localMode === 'minimal' && (
            <div className="space-y-4">
              <Label className="text-sm font-medium">Toolbar Items</Label>
              <p className="text-xs text-muted-foreground">
                Toggle which items appear in your toolbar
              </p>

              {Object.entries(groupedItems).map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {categoryLabels[category]}
                  </h4>
                  <div className="space-y-1">
                    {items.map((item) => {
                      const Icon = iconMap[item.icon] || User;
                      const isSelected = localButtons.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-md transition-colors",
                            isSelected ? "bg-muted" : "hover:bg-muted/50"
                          )}
                        >
                          <Icon className={cn(ICON_CLASS, "text-muted-foreground shrink-0")} />
                          <span className="flex-1 text-sm">{item.label}</span>
                          <Switch
                            checked={isSelected}
                            onCheckedChange={() => handleToggle(item.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-2"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to Default
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
