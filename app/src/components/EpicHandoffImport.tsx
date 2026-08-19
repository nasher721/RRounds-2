import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileUp, Loader2, FileText, Users, AlertCircle, Settings2, Info } from "lucide-react";
import { OCR_HARD_PAGE_LIMIT } from "@/lib/import-utils";
import {
  PATIENT_LIST_ACCEPT_ATTRIBUTE,
} from "@/lib/import/patientListImportSafety";
import { organizeImportedPatient } from "@/lib/import/organizeImportedPatient";
import { useImportSettings } from "@/hooks/useImportSettings";
import { stripHtml } from "@/lib/print/htmlFormatter";
import { withCategoryTimeout } from "@/lib/requestTimeout";
import { getUserFacingErrorMessage, UserFacingError } from "@/lib/userFacingErrors";
import { useAssertBackendReady } from "@/contexts/EdgeHealthContext";
import type { PatientMedications, PatientSystems } from "@/types/patient";

interface ParsedPatient {
  bed: string;
  name: string;
  mrn: string;
  age: string;
  sex: string;
  handoffSummary: string;
  intervalEvents: string;
  imaging?: string;
  labs?: string;
  systems: PatientSystems;
  medications?: PatientMedications;
}

interface EpicHandoffImportProps {
  existingBeds: string[];
  onImportPatients: (patients: Array<{
    name: string;
    bed: string;
    mrn?: string;
    clinicalSummary: string;
    intervalEvents: string;
    imaging?: string;
    labs?: string;
    systems: PatientSystems;
    medications?: PatientMedications;
  }>) => Promise<void>;
  noDialog?: boolean;
  hideHeader?: boolean;
}

export const EpicHandoffImport = ({
  existingBeds,
  onImportPatients,
  noDialog = false,
  hideHeader = false,
}: EpicHandoffImportProps) => {
  const assertBackendReady = useAssertBackendReady();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [parsedPatients, setParsedPatients] = useState<ParsedPatient[]>([]);
  const [selectedPatients, setSelectedPatients] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<"upload" | "select">("upload");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { settings, updateSettings } = useImportSettings();

  const invokeParseHandoff = async (body: { images?: string[]; pdfContent?: string }) => {
    // documentParse is 180s — successful handoff parses have been observed at ~67s.
    return withCategoryTimeout(
      supabase.functions.invoke('parse-handoff', { body }),
      'documentParse',
      'parse-handoff',
    );
  };

  const getSafePageLimit = () => Math.max(1, Math.min(settings.pageLimit, OCR_HARD_PAGE_LIMIT));

  const activateWithKeyboard = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    action();
  };

  const tryInvokeParseHandoff = async (body: { images?: string[]; pdfContent?: string }, retries = 1) => {
    let attempt = 0;

    while (true) {
      const result = await invokeParseHandoff(body);
      if (!result.error || attempt >= retries) {
        return result;
      }

      const status = (result.error as { context?: { status?: number } }).context?.status;
      // The server is pinned to one approved clinical provider; only retry transient 5xx.
      // Client-side TimeoutError propagates from invokeParseHandoff and is not retried here.
      if (!status || status < 500) {
        return result;
      }

      attempt += 1;
      const waitMs = Math.min(1_000 * attempt, 3_000);
      setStatusMessage(`Temporary server issue — retrying (${attempt + 1}/${retries + 1})...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!assertBackendReady()) {
      return;
    }

    setIsLoading(true);
    setStatusMessage("Reading file...");
    setParsedPatients([]);
    setSelectedPatients(new Set());

    try {
      setStatusMessage("Extracting content...");
      const { extractPatientListContent } = await import("@/lib/import/extractImportContent");
      const extracted = await extractPatientListContent(file);

      if (extracted.mode === "images") {
        if (!settings.ocrEnabled) {
          throw new UserFacingError(
            "Image import needs OCR. Enable OCR in import settings, or upload a text/Word/Excel export.",
          );
        }

        setStatusMessage("Analyzing image with AI...");
        const { data, error } = await tryInvokeParseHandoff({
          images: extracted.images.slice(0, getSafePageLimit()),
        });

        if (error) {
          console.error("Edge Function invocation failed (image path)");
          throw error;
        }
        if (!data.success) throw new Error("Failed to parse patient list");

        finalizeImport(data.data?.patients || []);
        return;
      }

      if (extracted.text.trim().length < 20) {
        throw new UserFacingError(
          "Could not extract enough text from the file. Try another format or paste the list directly.",
        );
      }

      setStatusMessage("Parsing patients and chart sections (may take 1–2 minutes)...");
      const { data, error } = await tryInvokeParseHandoff({
        pdfContent: extracted.text,
      });

      if (error) {
        console.error("Edge Function invocation failed");
        throw error;
      }
      if (!data.success) throw new Error("Failed to parse patient list");

      finalizeImport(data.data?.patients || []);
    } catch (error) {
      console.error("Error parsing patient list");
      toast({
        title: "Parsing failed",
        description: getUserFacingErrorMessage(error, "Unable to parse the patient list right now."),
        variant: "destructive",
      });
      setIsLoading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const finalizeImport = (patients: ParsedPatient[]) => {
    if (patients.length === 0) {
      toast({
        title: "No patients found",
        description: "The AI couldn't extract any patients detailed in this document.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    setParsedPatients(patients);
    setSelectedPatients(new Set(patients.map((_: ParsedPatient, i: number) => i)));
    setStep("select");
    setIsLoading(false);
    toast({
      title: "Handoff parsed",
      description: `Found ${patients.length} patient(s). Select which to import.`,
    });
  };

  const handleTextPaste = async () => {
    try {
      // Check clipboard permissions first
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
          if (permissionStatus.state === 'denied') {
            toast({
              title: "Clipboard access denied",
              description: "Please enable clipboard permissions in your browser settings, or paste manually.",
              variant: "destructive",
            });
            return;
          }
        } catch {
          // Some browsers don't support clipboard-read permission query, continue anyway
        }
      }

      const text = await navigator.clipboard.readText();
      if (!text || text.length < 50) {
        toast({
          title: "No content",
          description: "Please copy the handoff content to your clipboard first.",
          variant: "destructive",
        });
        return;
      }

      if (!assertBackendReady()) {
        return;
      }

      setIsLoading(true);
      setStatusMessage("Processing pasted text (may take 1–2 minutes)...");
      setParsedPatients([]);
      setSelectedPatients(new Set());

      const { data, error } = await tryInvokeParseHandoff({ pdfContent: text });

      if (error) {
        console.error("Edge Function invocation failed (paste path)");
        throw error;
      }
      if (!data.success) throw new Error("Failed to parse handoff");

      finalizeImport(data.data?.patients || []);
    } catch (error) {
      console.error("Error parsing pasted content");
      toast({
        title: "Parsing failed",
        description: getUserFacingErrorMessage(error, "Unable to parse the pasted content right now."),
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const togglePatient = (index: number) => {
    setSelectedPatients(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedPatients.size === parsedPatients.length) {
      setSelectedPatients(new Set());
    } else {
      setSelectedPatients(new Set(parsedPatients.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    const patientsToImport = parsedPatients
      .filter((_, i) => selectedPatients.has(i))
      .map((patient) => organizeImportedPatient({
        bed: patient.bed,
        name: patient.name,
        mrn: patient.mrn,
        age: patient.age,
        sex: patient.sex,
        handoffSummary: patient.handoffSummary,
        intervalEvents: patient.intervalEvents,
        imaging: patient.imaging,
        labs: patient.labs,
        systems: patient.systems,
        medications: patient.medications,
      }));

    if (patientsToImport.length === 0) {
      toast({
        title: "No patients selected",
        description: "Please select at least one patient to import.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setStatusMessage("Importing patients...");
    try {
      await onImportPatients(patientsToImport);
      toast({
        title: "Import successful",
        description: `Imported ${patientsToImport.length} patient(s).`,
      });
      handleClose();
    } catch {
      console.error("Patient import failed");
      toast({
        title: "Import failed",
        description: "Failed to import patients.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep("upload");
    setParsedPatients([]);
    setSelectedPatients(new Set());
    setStatusMessage("");
  };

  const bedExists = (bed: string) => {
    const normalizedBed = bed.toLowerCase();
    return existingBeds.some(b => b.toLowerCase() === normalizedBed);
  };

  const importSettings = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Import settings">
          <Settings2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <h4 className="font-medium leading-none">Import Settings</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="ocr-enabled" className="flex flex-col gap-1">
                <span>Enable OCR</span>
                <span className="text-xs text-muted-foreground">For scanned PDFs/images</span>
              </Label>
              <Switch
                id="ocr-enabled"
                checked={settings.ocrEnabled}
                onCheckedChange={(c) => updateSettings({ ocrEnabled: c })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="force-ocr" className="flex flex-col gap-1">
                <span>Force OCR</span>
                <span className="text-xs text-muted-foreground">Ignore extracted text</span>
              </Label>
              <Switch
                id="force-ocr"
                checked={settings.forceOcr}
                onCheckedChange={(c) => updateSettings({ forceOcr: c })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Image Quality (Upscale)</Label>
                <span className="text-xs text-muted-foreground">{settings.imageScale}x</span>
              </div>
              <Slider
                min={1.0}
                max={3.0}
                step={0.5}
                value={[settings.imageScale]}
                onValueChange={([v]) => updateSettings({ imageScale: v })}
              />
              <p className="text-xs text-muted-foreground">
                Higher quality improves accuracy but takes longer.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Page Limit</Label>
                <span className="text-xs text-muted-foreground">{getSafePageLimit()} parsed</span>
              </div>
              <Slider
                min={1}
                max={OCR_HARD_PAGE_LIMIT}
                step={1}
                value={[settings.pageLimit]}
                onValueChange={([v]) => updateSettings({ pageLimit: v })}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  const content = (
    <>
      {!hideHeader ? (
        <DialogHeader className="flex-shrink-0">
          <div className="flex justify-between items-center pr-8">
            <div className="space-y-1.5">
              {/* DialogTitle works for both owned Dialog and parent Dialog wrappers (noDialog). */}
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" aria-hidden="true" />
                Import Patient List
              </DialogTitle>
              <DialogDescription>
                Upload or paste a roster file to parse patients into beds and chart sections.
              </DialogDescription>
            </div>

            {importSettings}
          </div>
        </DialogHeader>
      ) : (
        <div className="flex flex-shrink-0 justify-end pr-1">{importSettings}</div>
      )}

        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          {step === "upload" && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground flex gap-3">
                <Info className="h-5 w-5 flex-shrink-0 text-blue-500" />
                <p>
                  Upload a Word, HTML, JSON, RTF, image, or text export, or paste the list.
                  This mode uses the deployment-approved clinical AI service to identify each patient and organize chart sections.
                  Use the CSV tab for deterministic spreadsheet mapping. PDF is temporarily unavailable for secure bundling reasons.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card className="p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors border-dashed border-2 flex flex-col justify-center items-center h-48"
                  role="button"
                  tabIndex={0}
                  aria-label="Upload patient list file"
                  onKeyDown={(event) => activateWithKeyboard(event, () => fileInputRef.current?.click())}
                  onClick={() => fileInputRef.current?.click()}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={PATIENT_LIST_ACCEPT_ATTRIBUTE}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <FileUp className="h-10 w-10 mb-4 text-primary/60" />
                  <p className="font-medium text-lg">Upload File</p>
                  <p className="text-sm text-muted-foreground mt-1">Word, Excel, CSV, image, text…</p>
                </Card>

                <Card className="p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors border-dashed border-2 flex flex-col justify-center items-center h-48"
                  role="button"
                  tabIndex={0}
                  aria-label="Paste patient list content from clipboard"
                  onKeyDown={(event) => activateWithKeyboard(event, handleTextPaste)}
                  onClick={handleTextPaste}>
                  <FileText className="h-10 w-10 mb-4 text-primary/60" />
                  <p className="font-medium text-lg">Paste Content</p>
                  <p className="text-sm text-muted-foreground mt-1">From Clipboard</p>
                </Card>
              </div>

              {isLoading && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium animate-pulse">{statusMessage}</p>
                </div>
              )}
            </div>
          )}

          {step === "select" && (
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">{parsedPatients.length} patients found</span>
                </div>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedPatients.size === parsedPatients.length ? "Deselect All" : "Select All"}
                </Button>
              </div>

              <ScrollArea className="flex-1 pr-4 -mr-4">
                <div className="space-y-2 pb-4">
                  {parsedPatients.map((patient, index) => {
                    const exists = bedExists(patient.bed);
                    return (
                      <Card
                        key={index}
                        className={`p-3 cursor-pointer transition-colors ${selectedPatients.has(index) ? 'border-primary bg-primary/5' : ''
                          } ${exists ? 'border-warning' : ''}`}
                        onClick={(event) => {
                          const target = event.target as HTMLElement;
                          if (target.closest('button, input, a, [role="checkbox"]')) {
                            return;
                          }
                          togglePatient(index);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedPatients.has(index)}
                            onCheckedChange={() => togglePatient(index)}
                            onClick={(event) => event.stopPropagation()}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="font-mono">
                                {patient.bed}
                              </Badge>
                              <span className="font-medium">{patient.name}</span>
                              {patient.age && (
                                <span className="text-sm text-muted-foreground">
                                  {patient.age} {patient.sex}
                                </span>
                              )}
                              {exists && (
                                <Badge variant="secondary" className="text-warning-foreground bg-warning/20">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Bed exists
                                </Badge>
                              )}
                            </div>
                            {patient.mrn && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                MRN: {patient.mrn}
                              </p>
                            )}
                            <p className="text-sm mt-1 line-clamp-2">
                              {stripHtml(patient.handoffSummary)}
                            </p>
                            {patient.intervalEvents && (
                              <p className="text-xs mt-1 text-muted-foreground line-clamp-1">
                                <span className="font-medium">Rounds:</span> {stripHtml(patient.intervalEvents)}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {step === "select" && (
          <div className="flex justify-between items-center pt-4 border-t mt-auto flex-shrink-0">
            <Button variant="outline" onClick={() => setStep("upload")}>
              Back
            </Button>
            <div className="flex gap-2">
              <span className="text-sm text-muted-foreground self-center">
                {selectedPatients.size} selected
              </span>
              <Button onClick={handleImport} disabled={selectedPatients.size === 0 || isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>Import Selected</>
                )}
              </Button>
            </div>
          </div>
        )}
    </>
  );

  if (noDialog) {
    return (
      <div className="max-w-2xl max-h-[80vh] flex flex-col">
        {content}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => o ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start gap-2">
          <FileUp className="h-4 w-4" />
          Import Patient List
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {content}
      </DialogContent>
    </Dialog>
  );
};
