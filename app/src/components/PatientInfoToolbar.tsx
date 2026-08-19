import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  User, Hash, Calendar, DoorOpen, AlertCircle, Stethoscope,
  ClipboardList, CalendarDays, AlertTriangle, Pill, Activity,
  TestTube, Settings, ChevronDown, GripVertical, RotateCcw
} from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { PATIENT_INFO_TOOLBAR_ITEMS, DEFAULT_PATIENT_INFO_TOOLBAR_BUTTONS } from "@/constants/config";
import { PatientInfoToolbarCustomizeDialog } from "./PatientInfoToolbarCustomizeDialog";
import { cn } from "@/lib/utils";
import { getPatientIdentity, normalizePatientIdentityValue, NOT_DOCUMENTED } from "@/lib/patientIdentity";
import type { Patient } from "@/types/patient";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  User, Hash, Calendar, DoorOpen, AlertCircle, Stethoscope,
  ClipboardList, CalendarDays, AlertTriangle, Pill, Activity, TestTube,
  GripVertical, RotateCcw
};

const ICON_CLASS = "h-3.5 w-3.5";

interface PatientInfoToolbarProps {
  onInsert: (text: string) => void;
  patient?: Patient | null;
  className?: string;
}

const formatMedications = (patient: Patient): string => {
  const { infusions, scheduled, prn, rawText } = patient.medications;
  if (rawText?.trim()) return normalizePatientIdentityValue(rawText);

  const medications = [...infusions, ...scheduled, ...prn].filter(Boolean);
  return medications.length > 0 ? medications.join(", ") : NOT_DOCUMENTED;
};

const formatVitals = (patient: Patient): string => {
  if (!patient.vitals) return NOT_DOCUMENTED;

  const values = [
    patient.vitals.temp && `Temp ${patient.vitals.temp}`,
    patient.vitals.hr && `HR ${patient.vitals.hr}`,
    patient.vitals.bp && `BP ${patient.vitals.bp}`,
    patient.vitals.rr && `RR ${patient.vitals.rr}`,
    patient.vitals.spo2 && `SpO₂ ${patient.vitals.spo2}`,
  ].filter((value): value is string => Boolean(value));

  return values.length > 0 ? values.join(", ") : NOT_DOCUMENTED;
};

export const PatientInfoToolbar = ({
  onInsert,
  patient,
  className
}: PatientInfoToolbarProps) => {
  const {
    patientInfoToolbarMode,
    patientInfoToolbarButtons,
    setPatientInfoToolbarButtons
  } = useSettings();

  const [customizeOpen, setCustomizeOpen] = React.useState(false);

  const visibleItems = React.useMemo(() => {
    if (patientInfoToolbarMode === 'full') {
      return PATIENT_INFO_TOOLBAR_ITEMS;
    }
    return PATIENT_INFO_TOOLBAR_ITEMS.filter(item =>
      patientInfoToolbarButtons.includes(item.id)
    );
  }, [patientInfoToolbarMode, patientInfoToolbarButtons]);

  const dropdownItems = React.useMemo(() => {
    return PATIENT_INFO_TOOLBAR_ITEMS.filter(
      item => !visibleItems.some(v => v.id === item.id)
    );
  }, [visibleItems]);

  const handleInsert = React.useCallback((itemId: string) => {
    if (!patient) {
      onInsert(NOT_DOCUMENTED);
      return;
    }

    const identity = getPatientIdentity(patient);
    let value = "";
    switch (itemId) {
      case "patientName":
        value = identity.name;
        break;
      case "mrn":
        value = identity.mrn;
        break;
      case "dob":
        value = identity.dob;
        break;
      case "room":
        value = identity.room;
        break;
      case "codeStatus":
        value = identity.codeStatus;
        break;
      case "attending":
        value = identity.attending;
        break;
      case "diagnosis":
        value = identity.diagnosis;
        break;
      case "admissionDate":
        value = identity.admissionDate;
        break;
      case "allergies":
        value = identity.allergies;
        break;
      case "medications":
        value = formatMedications(patient);
        break;
      case "vitals":
        value = formatVitals(patient);
        break;
      case "labs":
        value = normalizePatientIdentityValue(patient.labs);
        break;
      default:
        value = NOT_DOCUMENTED;
    }

    onInsert(value);
  }, [patient, onInsert]);

  const handleReset = React.useCallback(() => {
    setPatientInfoToolbarButtons([...DEFAULT_PATIENT_INFO_TOOLBAR_BUTTONS]);
  }, [setPatientInfoToolbarButtons]);

  return (
    <div className={cn("flex items-center gap-1 px-2 py-1 border-b bg-muted/30", className)}>
      <div className="flex items-center gap-1 overflow-x-auto flex-1">
        {visibleItems.map((item) => {
          const Icon = iconMap[item.icon] || User;
          return (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleInsert(item.id)}
              className="min-h-11 h-11 px-3 gap-1.5 shrink-0"
              title={item.label}
            >
              <Icon className={ICON_CLASS} />
              <span className="text-xs">{item.label}</span>
            </Button>
          );
        })}

        {dropdownItems.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 h-11 gap-1.5 shrink-0 px-3"
              >
                <span className="text-xs">More</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground px-2 py-1">
                Additional Fields
              </DropdownMenuLabel>
              {dropdownItems.map((item) => {
                const Icon = iconMap[item.icon] || User;
                return (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={() => handleInsert(item.id)}
                    className="gap-2"
                  >
                    <Icon className={ICON_CLASS} />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="min-h-11 min-w-11 h-11 w-11 p-0"
          title="Reset to default"
          aria-label="Reset patient info toolbar to default"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setCustomizeOpen(true)}
          className="min-h-11 h-11 gap-1.5 px-3"
          aria-label="Customize patient info toolbar"
        >
          <Settings className="h-3.5 w-3.5" aria-hidden />
          <span className="text-xs">Customize</span>
        </Button>
      </div>

      <PatientInfoToolbarCustomizeDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
      />
    </div>
  );
};
