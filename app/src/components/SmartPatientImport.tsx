import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, Loader2, Clipboard, Check, Edit2, Pill, ShieldAlert } from "lucide-react";
import type { PatientSystems, PatientMedications } from "@/types/patient";
import { withCategoryTimeout } from "@/lib/requestTimeout";
import { getUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { useAssertBackendReady, useEdgeHealth } from "@/contexts/EdgeHealthContext";

interface ParsedPatientData {
  name: string;
  mrn?: string;
  bed: string;
  clinicalSummary: string;
  intervalEvents: string;
  imaging: string;
  labs: string;
  systems: PatientSystems;
  medications: PatientMedications;
}

interface SmartPatientImportProps {
  onImportPatient: (patient: {
    name: string;
    mrn?: string;
    bed: string;
    clinicalSummary: string;
    intervalEvents: string;
    imaging: string;
    labs: string;
    systems: PatientSystems;
    medications?: PatientMedications;
  }) => Promise<void>;
  trigger?: React.ReactNode;
}

export const SmartPatientImport = ({ onImportPatient, trigger }: SmartPatientImportProps) => {
  const assertBackendReady = useAssertBackendReady();
  const edgeHealth = useEdgeHealth();
  const backendUnavailable = edgeHealth?.status === "unhealthy";
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<"input" | "review">("input");
  const [content, setContent] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [parsedData, setParsedData] = React.useState<ParsedPatientData | null>(null);
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const [phiAcknowledged, setPhiAcknowledged] = React.useState(false);
  const { toast } = useToast();

  const handlePaste = async () => {
    if (!phiAcknowledged) {
      toast({
        title: "Review PHI processing first",
        description: "Confirm the disclosure before reading clinical text from the clipboard.",
        variant: "destructive",
      });
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setContent(text);
        toast({ title: "Text pasted from clipboard" });
      }
    } catch {
      toast({
        title: "Could not access clipboard",
        description: "Please paste manually using Ctrl+V",
        variant: "destructive",
      });
    }
  };

  const handleParse = async () => {
    if (!phiAcknowledged) {
      toast({
        title: "PHI confirmation required",
        description: "Confirm your organization permits this configured AI workflow.",
        variant: "destructive",
      });
      return;
    }
    if (!content.trim()) {
      toast({
        title: "No content to parse",
        description: "Please enter or paste clinical notes",
        variant: "destructive",
      });
      return;
    }

    if (!assertBackendReady()) {
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await withCategoryTimeout(
        supabase.functions.invoke("parse-single-patient", {
          body: { content: content.trim() },
        }),
        "aiEdgeFunction",
        "parse-single-patient",
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.patient) {
        setParsedData(data.patient);
        setStep("review");
        toast({ title: "Notes parsed successfully", description: "Review and edit the organized data" });
      } else {
        throw new Error("No patient data returned");
      }
    } catch (error) {
      console.error("Patient note parsing failed");
      toast({
        title: "Failed to parse notes",
        description: getUserFacingErrorMessage(error, "Unable to parse notes right now. Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!parsedData) return;

    setIsLoading(true);
    try {
      await onImportPatient(parsedData);
      toast({ title: "Patient imported successfully" });
      handleClose();
    } catch (error) {
      console.error("Patient import failed");
      toast({
        title: "Failed to import patient",
        description: getUserFacingErrorMessage(error, "Unable to import patient right now. Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep("input");
    setContent("");
    setParsedData(null);
    setEditingField(null);
    setPhiAcknowledged(false);
  };

  const updateField = (field: string, value: string) => {
    if (!parsedData) return;

    if (field.startsWith("systems.")) {
      const systemKey = field.replace("systems.", "") as keyof PatientSystems;
      setParsedData({
        ...parsedData,
        systems: { ...parsedData.systems, [systemKey]: value },
      });
    } else {
      setParsedData({ ...parsedData, [field]: value });
    }
    setEditingField(null);
  };

  const renderEditableField = (label: string, field: string, value: string, multiline = false) => {
    const isEditing = editingField === field;

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{label}</Label>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 min-w-11 h-11 px-2"
            onClick={() => setEditingField(isEditing ? null : field)}
            aria-label={`${isEditing ? "Finish editing" : "Edit"} ${label}`}
          >
            {isEditing ? <Check className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
          </Button>
        </div>
        {isEditing ? (
          multiline ? (
            <Textarea
              value={value}
              onChange={(e) => updateField(field, e.target.value)}
              className="min-h-[80px] text-sm"
              autoFocus
            />
          ) : (
            <Input
              value={value}
              onChange={(e) => updateField(field, e.target.value)}
              className="min-h-11 text-sm"
              autoFocus
            />
          )
        ) : (
          <button
            type="button"
            className="min-h-11 w-full cursor-pointer whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-left text-sm hover:bg-muted"
            onClick={() => setEditingField(field)}
            aria-label={`Edit ${label}`}
          >
            {value || <span className="text-muted-foreground italic">Empty</span>}
          </button>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button type="button" variant="outline" className="min-h-11 w-full justify-start gap-2">
            <Wand2 className="h-4 w-4" />
            Smart Import
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            {step === "input" ? "Smart Patient Import" : "Review & Edit"}
          </DialogTitle>
          <DialogDescription>
            {step === "input"
              ? "Paste clinical notes and AI will organize them into the correct patient fields."
              : "Review parsed fields before adding this patient to the roster."}
          </DialogDescription>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4 flex-1">

            <section
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
              aria-labelledby="smart-import-phi-heading"
            >
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                <div className="space-y-2">
                  <h3 id="smart-import-phi-heading" className="font-semibold text-foreground">
                    PHI processing disclosure
                  </h3>
                  <p className="text-xs leading-relaxed text-foreground/80">
                    Text is sent through this deployment&apos;s Supabase Edge Function to configured AI model
                    your organization&apos;s configured clinical AI provider. Processing is not local. Retention, deletion,
                    training use, BAA/DPA coverage, and permitted PHI use depend on deployment and provider contracts;
                    confirm them with your administrator. Review every parsed field before import. Parsing errors can
                    place data in wrong chart sections.
                  </p>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="smart-import-phi-ack"
                      checked={phiAcknowledged}
                      onCheckedChange={(checked) => setPhiAcknowledged(checked === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="smart-import-phi-ack" className="text-xs leading-relaxed text-foreground">
                      Organization permits this PHI workflow; provider terms and patient data destination verified.
                    </Label>
                  </div>
                </div>
              </div>
            </section>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePaste} className="min-h-11 gap-1" disabled={!phiAcknowledged}>
                <Clipboard className="h-4 w-4" />
                Paste from Clipboard
              </Button>
            </div>

            <Textarea
              placeholder="Paste or type clinical notes here...&#10;&#10;Examples:&#10;- H&P notes&#10;- Progress notes&#10;- Signout/handoff text&#10;- Any clinical documentation"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[250px] font-mono text-sm"
            />

            {backendUnavailable ? (
              <p id="smart-import-backend-unavailable" className="text-sm font-medium text-destructive" role="status">
                Parsing is unavailable while the backend health check is failing. Your pasted text remains local in this form.
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleParse}
                disabled={backendUnavailable || isLoading || !content.trim() || !phiAcknowledged}
                aria-describedby={backendUnavailable ? "smart-import-backend-unavailable" : undefined}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Parse Notes
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : parsedData ? (
          <div className="flex-1 flex flex-col min-h-0">
            <p className="text-sm text-muted-foreground mb-3">
              Review the extracted data. Click any field to edit.
            </p>

            <ScrollArea className="flex-1 pr-4">
              <Tabs defaultValue="main" className="w-full">
                <TabsList className="mb-3">
                  <TabsTrigger value="main">Main Info</TabsTrigger>
                  <TabsTrigger value="medications">Medications</TabsTrigger>
                  <TabsTrigger value="systems">Systems Review</TabsTrigger>
                </TabsList>

                <TabsContent value="main" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    {renderEditableField("Patient Name", "name", parsedData.name)}
                    {renderEditableField("Bed/Room", "bed", parsedData.bed)}
                    {renderEditableField("MRN", "mrn", parsedData.mrn ?? "")}
                  </div>
                  {renderEditableField("Clinical Summary", "clinicalSummary", parsedData.clinicalSummary, true)}
                  {renderEditableField("Interval Events", "intervalEvents", parsedData.intervalEvents, true)}
                  {renderEditableField("Imaging", "imaging", parsedData.imaging, true)}
                  {renderEditableField("Labs", "labs", parsedData.labs, true)}
                </TabsContent>

                <TabsContent value="medications" className="space-y-4 mt-0">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Pill className="h-4 w-4 text-destructive" />
                        Infusions ({parsedData.medications?.infusions?.length || 0})
                      </Label>
                      <div className="text-sm p-2 bg-muted/50 rounded-md min-h-[40px]">
                        {parsedData.medications?.infusions?.length ? (
                          <ul className="space-y-1">
                            {parsedData.medications.infusions.map((med, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="text-destructive">•</span> {typeof med === 'string' ? med : JSON.stringify(med)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground italic">No infusions</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Pill className="h-4 w-4 text-primary" />
                        Scheduled ({parsedData.medications?.scheduled?.length || 0})
                      </Label>
                      <div className="text-sm p-2 bg-muted/50 rounded-md min-h-[40px]">
                        {parsedData.medications?.scheduled?.length ? (
                          <ul className="space-y-1">
                            {parsedData.medications.scheduled.map((med, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="text-primary">•</span> {typeof med === 'string' ? med : JSON.stringify(med)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground italic">No scheduled medications</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Pill className="h-4 w-4 text-warning" />
                        PRN ({parsedData.medications?.prn?.length || 0})
                      </Label>
                      <div className="text-sm p-2 bg-muted/50 rounded-md min-h-[40px]">
                        {parsedData.medications?.prn?.length ? (
                          <ul className="space-y-1">
                            {parsedData.medications.prn.map((med, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="text-warning">•</span> {typeof med === 'string' ? med : JSON.stringify(med)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground italic">No PRN medications</span>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="systems" className="space-y-3 mt-0">
                  {renderEditableField("Neuro", "systems.neuro", parsedData.systems.neuro ?? '', true)}
                  {renderEditableField("Cardiovascular", "systems.cv", parsedData.systems.cv ?? '', true)}
                  {renderEditableField("Respiratory", "systems.resp", parsedData.systems.resp ?? '', true)}
                  {renderEditableField("Renal/GU", "systems.renalGU", parsedData.systems.renalGU ?? '', true)}
                  {renderEditableField("GI", "systems.gi", parsedData.systems.gi ?? '', true)}
                  {renderEditableField("Endocrine", "systems.endo", parsedData.systems.endo ?? '', true)}
                  {renderEditableField("Heme", "systems.heme", parsedData.systems.heme ?? '', true)}
                  {renderEditableField("Infectious", "systems.infectious", parsedData.systems.infectious ?? '', true)}
                  {renderEditableField("Skin/Lines", "systems.skinLines", parsedData.systems.skinLines ?? '', true)}
                  {renderEditableField("Disposition", "systems.dispo", parsedData.systems.dispo ?? '', true)}
                </TabsContent>
              </Tabs>
            </ScrollArea>

            <div className="flex justify-between pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => setStep("input")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Import Patient
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
