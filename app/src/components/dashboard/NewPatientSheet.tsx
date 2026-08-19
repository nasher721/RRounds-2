import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultMedicationsValue, defaultSystemsValue } from "@/services/patientService";
import type { Patient, PatientSystems, PatientMedications, AcuityLevel, CodeStatus } from "@/types/patient";
import { Loader2, ChevronDown, AlertTriangle, Users, Activity } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { PATIENT_TEMPLATES, getTemplateById } from "@/lib/templates/patientTemplates";
import { normalizePatientAlerts } from "@/lib/patientIdentity";

/** Radix Select forbids `value=""` on SelectItem; use this sentinel for "start from scratch". */
const NEW_PATIENT_TEMPLATE_SCRATCH = "__new_patient_scratch__" as const;

// Service line options for ICU/clinical units
const SERVICE_LINES = [
  { value: "micu", label: "MICU (Medical ICU)" },
  { value: "sicu", label: "SICU (Surgical ICU)" },
  { value: "cvicu", label: "CVICU (Cardiac/Vascular ICU)" },
  { value: "ccu", label: "CCU (Coronary Care Unit)" },
  { value: "nicu", label: "NICU (Neonatal ICU)" },
  { value: "picu", label: "PICU (Pediatric ICU)" },
  { value: "medicine", label: "Medicine" },
  { value: "surgery", label: "Surgery" },
  { value: "ortho", label: "Orthopedics" },
  { value: "neuro", label: "Neurology" },
  { value: "trauma", label: "Trauma" },
  { value: "oncology", label: "Oncology" },
  { value: "burn", label: "Burn Unit" },
  { value: "transplant", label: "Transplant" },
  { value: "obgyn", label: "OB/GYN" },
] as const;

// Acuity options with color coding
const ACUITY_OPTIONS: { value: AcuityLevel; label: string; color: string; bgColor: string; borderColor: string }[] = [
  { value: "low", label: "Low", color: "text-green-700", bgColor: "bg-green-50", borderColor: "border-green-200" },
  { value: "moderate", label: "Moderate", color: "text-yellow-700", bgColor: "bg-yellow-50", borderColor: "border-yellow-200" },
  { value: "high", label: "High", color: "text-orange-700", bgColor: "bg-orange-50", borderColor: "border-orange-200" },
  { value: "critical", label: "Critical", color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-red-200" },
];

// Code status options
const CODE_STATUS_OPTIONS: { value: CodeStatus; label: string; description: string }[] = [
  { value: "full", label: "Full Code", description: "Full resuscitation efforts" },
  { value: "dnr", label: "DNR", description: "Do Not Resuscitate" },
  { value: "dni", label: "DNI", description: "Do Not Intubate" },
  { value: "comfort", label: "Comfort Care", description: "Comfort-focused care" },
];

// Isolation precaution options
const ISOLATION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "contact", label: "Contact" },
  { value: "droplet", label: "Droplet" },
  { value: "airborne", label: "Airborne" },
  { value: "neutropenic", label: "Neutropenic" },
  { value: "protective", label: "Protective Isolation" },
] as const;

export type NewPatientSubmitPayload = {
  name: string;
  mrn?: string;
  bed: string;
  clinicalSummary: string;
  intervalEvents: string;
  imaging: string;
  labs: string;
  systems?: PatientSystems;
  medications?: PatientMedications;
  serviceLine?: string;
  attendingPhysician?: string;
  consultingTeam?: string[];
  acuity?: AcuityLevel;
  codeStatus?: CodeStatus;
  alerts?: string[];
  age?: number;
  dateOfBirth?: string;
  gender?: Patient["gender"];
  admissionDate?: string;
};

type NewPatientSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NewPatientSubmitPayload) => Promise<void>;
};

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
}

const CollapsibleSection = ({ title, icon, children, defaultOpen = false, count }: CollapsibleSectionProps) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/50 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="font-medium text-sm">{title}</span>
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {count}
            </Badge>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && (
        <div className="p-3 space-y-3 border-t">
          {children}
        </div>
      )}
    </div>
  );
};

export const NewPatientSheet = ({ open, onOpenChange, onSubmit }: NewPatientSheetProps) => {
  const [name, setName] = React.useState("");
  const [mrn, setMrn] = React.useState("");
  const [bed, setBed] = React.useState("");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);
  const canSubmit = name.trim().length > 0 && !submitting;

  // Template selection state
  const [selectedTemplate, setSelectedTemplate] = React.useState<string>(NEW_PATIENT_TEMPLATE_SCRATCH);

  // Extended fields state
  const [serviceLine, setServiceLine] = React.useState<string>("");
  const [attendingPhysician, setAttendingPhysician] = React.useState("");
  const [consultingTeam, setConsultingTeam] = React.useState("");
  const [acuity, setAcuity] = React.useState<AcuityLevel | "">("");
  const [codeStatus, setCodeStatus] = React.useState<CodeStatus | "">("");
  const [allergies, setAllergies] = React.useState("");
  const [isolation, setIsolation] = React.useState<string>("none");

  React.useEffect(() => {
    if (open) {
      setName("");
      setMrn("");
      setBed("");
      setNameError(null);
      setSubmitting(false);
      setSelectedTemplate(NEW_PATIENT_TEMPLATE_SCRATCH);
      setServiceLine("");
      setAttendingPhysician("");
      setConsultingTeam("");
      setAcuity("");
      setCodeStatus("");
      setAllergies("");
      setIsolation("none");
    }
  }, [open]);

  // Apply template values when a template is selected
  const handleTemplateChange = React.useCallback((templateId: string) => {
    setSelectedTemplate(templateId);

    if (templateId === NEW_PATIENT_TEMPLATE_SCRATCH) {
      // Reset to defaults when starting from scratch
      setServiceLine("");
      setAcuity("");
      setCodeStatus("");
      return;
    }

    const template = getTemplateById(templateId);
    if (template?.data) {
      const { data } = template;
      if (data.serviceLine) setServiceLine(data.serviceLine);
      if (data.acuity) setAcuity(data.acuity);
      if (data.codeStatus) setCodeStatus(data.codeStatus);
      if (data.allergies) setAllergies(data.allergies.join(", "));
      if (data.isolation) setIsolation(data.isolation);
      if (data.consultingTeam) setConsultingTeam(data.consultingTeam.join(", "));
    }
  }, []);

  const allergiesCount = allergies
    ? allergies
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0).length
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Patient name is required");
      nameInputRef.current?.focus();
      return;
    }
    setNameError(null);
    setSubmitting(true);
    try {
      const parsedAllergies = normalizePatientAlerts(allergies
        ? allergies
            .split(",")
            .map((a) => a.trim())
            .filter((a) => a.length > 0)
        : []);
      const parsedAlerts = isolation !== "none"
        ? normalizePatientAlerts([...parsedAllergies, `Isolation: ${isolation}`])
        : parsedAllergies;

      const parsedConsultingTeam = consultingTeam
        ? consultingTeam
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
        : [];

      await onSubmit({
        name: trimmed,
        mrn: mrn.trim(),
        bed: bed.trim(),
        clinicalSummary: "",
        intervalEvents: "",
        imaging: "",
        labs: "",
        systems: defaultSystemsValue,
        medications: defaultMedicationsValue,
        serviceLine: serviceLine || undefined,
        attendingPhysician: attendingPhysician.trim() || undefined,
        consultingTeam: parsedConsultingTeam.length > 0 ? parsedConsultingTeam : undefined,
        acuity: acuity || undefined,
        codeStatus: codeStatus || undefined,
        alerts: parsedAlerts.length > 0 ? parsedAlerts : undefined,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New patient</SheetTitle>
          <SheetDescription>
            Name is required. Add MRN and bed or location when you have them—both help with safe handoffs. Expand the sections below to add team, status, and alert information.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-4 mt-2 pb-4">
          {/* Template Selector */}
          <div className="space-y-2">
            <Label htmlFor="new-patient-template">Quick template (optional)</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger id="new-patient-template" className="min-h-11">
                <SelectValue placeholder="Start from scratch or choose a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_PATIENT_TEMPLATE_SCRATCH}>Start from scratch</SelectItem>
                {PATIENT_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex flex-col items-start">
                      <span>{template.name}</span>
                      <span className="text-xs text-muted-foreground">{template.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Basic Info - Always Visible */}
          <div className="space-y-2">
            <Label htmlFor="new-patient-name">
              Patient name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="new-patient-name"
              ref={nameInputRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="e.g. Jane Doe"
              autoComplete="off"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "new-patient-name-error" : undefined}
              className="min-h-11"
            />
            {nameError ? (
              <p id="new-patient-name-error" className="text-sm text-destructive" role="alert">
                {nameError}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-patient-mrn">MRN (optional)</Label>
            <Input
              id="new-patient-mrn"
              value={mrn}
              onChange={(e) => setMrn(e.target.value)}
              placeholder="Medical record number"
              autoComplete="off"
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-patient-bed">Bed / location (optional)</Label>
            <Input
              id="new-patient-bed"
              value={bed}
              onChange={(e) => setBed(e.target.value)}
              placeholder="e.g. MICU 12"
              autoComplete="off"
              className="min-h-11"
            />
          </div>

          <Separator />

          {/* Team Section */}
          <CollapsibleSection
            title="Team"
            icon={<Users className="h-4 w-4" />}
            count={serviceLine ? 1 : 0}
          >
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-patient-service-line">Service Line</Label>
                <Select value={serviceLine} onValueChange={setServiceLine}>
                  <SelectTrigger id="new-patient-service-line" className="min-h-11">
                    <SelectValue placeholder="Select service line" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_LINES.map((line) => (
                      <SelectItem key={line.value} value={line.value}>
                        {line.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-patient-attending">Attending Physician</Label>
                <Input
                  id="new-patient-attending"
                  value={attendingPhysician}
                  onChange={(e) => setAttendingPhysician(e.target.value)}
                  placeholder="Attending name"
                  autoComplete="off"
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-patient-consulting">Consulting Teams</Label>
                <Input
                  id="new-patient-consulting"
                  value={consultingTeam}
                  onChange={(e) => setConsultingTeam(e.target.value)}
                  placeholder="e.g. Cards, ID, Nephrology (comma-separated)"
                  autoComplete="off"
                  className="min-h-11"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Status Section */}
          <CollapsibleSection
            title="Status"
            icon={<Activity className="h-4 w-4" />}
            count={[acuity, codeStatus].filter(Boolean).length}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Acuity Level</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ACUITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAcuity(acuity === option.value ? "" : option.value)}
                      className={cn(
                        "flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border text-sm font-medium transition-all",
                        "hover:border-opacity-80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                        acuity === option.value
                          ? `${option.bgColor} ${option.borderColor} ${option.color}`
                          : "bg-background border-input hover:bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "w-3 h-3 rounded-full",
                          option.value === "low" && "bg-green-500",
                          option.value === "moderate" && "bg-yellow-500",
                          option.value === "high" && "bg-orange-500",
                          option.value === "critical" && "bg-red-500"
                        )}
                      />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Code Status</Label>
                <Select
                  value={codeStatus}
                  onValueChange={(val) => setCodeStatus(val as CodeStatus)}
                >
                  <SelectTrigger className="min-h-11">
                    <SelectValue placeholder="Select code status" />
                  </SelectTrigger>
                  <SelectContent>
                    {CODE_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col items-start">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleSection>

          {/* Alerts Section */}
          <CollapsibleSection
            title="Alerts"
            icon={<AlertTriangle className="h-4 w-4" />}
            count={allergiesCount + (isolation !== "none" ? 1 : 0)}
          >
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-patient-allergies">Allergies</Label>
                <Input
                  id="new-patient-allergies"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, Sulfa (comma-separated)"
                  autoComplete="off"
                  className="min-h-11"
                />
                {allergiesCount > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {allergies
                      .split(",")
                      .map((a) => a.trim())
                      .filter((a) => a.length > 0)
                      .map((allergy) => (
                        <Badge
                          key={allergy}
                          variant="outline"
                          className="text-xs border-red-200 bg-red-50 text-red-700"
                        >
                          {allergy}
                        </Badge>
                      ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-patient-isolation">Isolation Precautions</Label>
                <Select value={isolation} onValueChange={setIsolation}>
                  <SelectTrigger id="new-patient-isolation" className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ISOLATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleSection>

          <div className="flex-1" />

          <Separator />

          <SheetFooter className="flex-row justify-end gap-2 sm:justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} aria-disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                  Adding…
                </>
              ) : (
                "Add patient"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};
