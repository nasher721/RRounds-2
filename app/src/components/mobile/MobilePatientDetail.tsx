import { useEffect, useMemo, useState } from "react";
import { Patient, PatientSystems, PatientMedications } from "@/types/patient";
import { MedicationList } from "@/components/MedicationList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  MoreHorizontal,
  FileText,
  Calendar,
  ImageIcon,
  TestTube,
  Pill,
  Clock,
  Copy,
  Trash2,
  Printer,
  Sparkles,
  Loader2,
  History,
  Eraser,
  Activity,
  User,
  Stethoscope
} from "lucide-react";
import { useIntervalEventsGenerator } from "@/hooks/useIntervalEventsGenerator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RichTextEditor } from "@/components/RichTextEditor";
import { ImagePasteEditor } from "@/components/ImagePasteEditor";
import { PatientTodos } from "@/components/PatientTodos";
import { FieldTimestamp } from "@/components/FieldTimestamp";
import { FieldHistoryViewer } from "@/components/FieldHistoryViewer";
import { AIClinicalAssistant } from "@/components/AIClinicalAssistant";
import { useSystemsConfig } from "@/hooks/useSystemsConfig";
import { AutoText } from "@/types/autotext";
import { usePatientTodos } from "@/hooks/usePatientTodos";
import type { PatientTodo } from "@/types/todo";
import { extractPatientImageObjectKeyList } from "@/lib/patientImages";
import { patientSafetyLabel } from "@/lib/patientIdentity";

const SECTION_CHIPS = [
  { id: "summary", label: "Summary", icon: FileText },
  { id: "events", label: "Events", icon: Calendar },
  { id: "imaging", label: "Imaging", icon: ImageIcon },
  { id: "labs", label: "Labs", icon: TestTube },
  { id: "medications", label: "Meds", icon: Pill },
  { id: "systems", label: "Systems", icon: Activity },
] as const;

interface MobilePatientDetailProps {
  patient: Patient;
  onBack: () => void;
  onUpdate: (id: string, field: string, value: unknown) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onPrint: () => void;
  autotexts?: AutoText[];
  globalFontSize?: number;
  changeTracking?: {
    enabled: boolean;
    wrapWithMarkup: (text: string) => string;
    wrapHtmlWithMarkup?: (html: string) => string;
  } | null;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  /** When provided (e.g. from dashboard todosMap), used as initial todos and avoids a duplicate fetch. */
  initialTodos?: PatientTodo[];
}

export const MobilePatientDetail = ({
  patient,
  onBack,
  onUpdate,
  onRemove,
  onDuplicate,
  onPrint,
  autotexts = [],
  globalFontSize = 11,
  changeTracking = null,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
  initialTodos,
}: MobilePatientDetailProps) => {
  const [openSections, setOpenSections] = useState<string[]>(["summary"]);
  const [activeSection, setActiveSection] = useState("summary");
  const [pendingClearField, setPendingClearField] = useState<string | null>(null);
  const [showRemovePatientDialog, setShowRemovePatientDialog] = useState(false);
  const [showDuplicatePatientDialog, setShowDuplicatePatientDialog] = useState(false);
  const [showClearSystemsDialog, setShowClearSystemsDialog] = useState(false);
  const clearSectionLabel = useMemo(() => {
    if (!pendingClearField) return "this section";
    const labels: Record<string, string> = {
      clinicalSummary: "Clinical Summary",
      intervalEvents: "Interval Events",
      imaging: "Imaging",
      labs: "Labs",
    };
    return labels[pendingClearField] ?? pendingClearField;
  }, [pendingClearField]);
  const { todos, generating, addTodo, toggleTodo, deleteTodo, generateTodos } = usePatientTodos(patient.id, { initialTodos });
  const { generateIntervalEvents, isGenerating: isGeneratingEvents } = useIntervalEventsGenerator();
  const { enabledSystems } = useSystemsConfig();
  const imagingImageCount = useMemo(() => {
    if (!patient.imaging) return 0;
    return extractPatientImageObjectKeyList(patient.imaging).length;
  }, [patient.imaging]);
  const imagingTextCount = useMemo(() => {
    if (!patient.imaging) return 0;
    return patient.imaging.replace(/<[^>]*>/g, "").trim().length;
  }, [patient.imaging]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    setOpenSections(["summary"]);
    setActiveSection("summary");
  }, [patient.id]);

  useEffect(() => {
    const sections = SECTION_CHIPS
      .map((chip) => document.getElementById(`section-${chip.id}`))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0];
        if (!top?.target.id.startsWith("section-")) return;
        setActiveSection(top.target.id.replace("section-", ""));
      },
      { root: null, rootMargin: "-20% 0px -55% 0px", threshold: [0.2, 0.4] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [patient.id, openSections]);

  const handleJumpToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    // Mount only the selected chart section to avoid a tall stacked mobile document.
    setOpenSections([sectionId]);
    window.setTimeout(() => {
      const target = document.getElementById(`section-${sectionId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleGenerateIntervalEvents = async () => {
    const result = await generateIntervalEvents(
      patient.systems,
      patient.intervalEvents,
      patient.name
    );
    if (result) {
      const newValue = patient.intervalEvents
        ? `${patient.intervalEvents}<br/><br/>${result}`
        : result;
      onUpdate(patient.id, "intervalEvents", newValue);
    }
  };

  const addTimestamp = (field: string) => {
    const timestamp = new Date().toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const currentValue = field.includes(".")
      ? patient.systems[field.split(".")[1] as keyof PatientSystems]
      : patient[field as keyof Patient];
    const newValue = `[${timestamp}] ${currentValue || ""}`;
    onUpdate(patient.id, field, newValue);
  };

  const clearSection = (field: string) => {
    setPendingClearField(field);
  };

  const handleRemove = () => {
    setShowRemovePatientDialog(true);
  };

  const handleDuplicate = () => {
    setShowDuplicatePatientDialog(true);
  };

  const handleConfirmDuplicatePatient = () => {
    onDuplicate(patient.id);
    setShowDuplicatePatientDialog(false);
    onBack();
  };

  const clearAllSystems = () => {
    setShowClearSystemsDialog(true);
  };

  const handleConfirmClearField = () => {
    if (!pendingClearField) return;
    onUpdate(patient.id, pendingClearField, "");
    setPendingClearField(null);
  };

  const handleConfirmRemovePatient = () => {
    onRemove(patient.id);
    setShowRemovePatientDialog(false);
    onBack();
  };

  const handleConfirmClearSystems = () => {
    enabledSystems.forEach((system) => {
      onUpdate(patient.id, `systems.${system.key}`, "");
    });
    setShowClearSystemsDialog(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/40 safe-area-top">
        <div className="flex items-center justify-between h-14 px-2">
          <div className="flex items-center gap-1 min-w-0">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-11 w-11 shrink-0" aria-label="Back to patient list">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>

            {/* Quick Navigation */}
            <div className="flex items-center bg-secondary/50 rounded-full border border-border/50">
              <Button
                variant="ghost"
                size="icon"
                onClick={onPrevious}
                disabled={!hasPrevious}
                className="min-h-11 min-w-11 h-11 w-11 rounded-l-full hover:bg-secondary"
                aria-label="Previous patient"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <div className="w-px h-4 bg-border/50" />
              <Button
                variant="ghost"
                size="icon"
                onClick={onNext}
                disabled={!hasNext}
                className="min-h-11 min-w-11 h-11 w-11 rounded-r-full hover:bg-secondary"
                aria-label="Next patient"
              >
                <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="min-h-11 min-w-11 h-11 w-11" aria-label="More patient actions">
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <FieldHistoryViewer
                patientId={patient.id}
                patientName={patient.name}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <History className="h-4 w-4 mr-2" />
                    View History
                  </DropdownMenuItem>
                }
              />
              <DropdownMenuItem onClick={onPrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print / Export
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* AI Clinical Assistant - integrated inline */}
              <div className="px-2 py-1">
                <AIClinicalAssistant
                  patient={patient}
                  onUpdatePatient={onUpdate}
                  compact
                />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate Patient
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={clearAllSystems} className="text-orange-600">
                <Eraser className="h-4 w-4 mr-2" />
                Clear Systems Review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRemove} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Patient
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Patient Info */}
      <div className="px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-primary/70" />
          </div>
          <div className="flex-1 min-w-0">
            <Input
              placeholder="Patient Name"
              value={patient.name}
              onChange={(e) => onUpdate(patient.id, "name", e.target.value)}
              className="text-lg font-semibold bg-card border border-border focus:border-primary rounded-lg px-3 h-10 touch-manipulation"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="done"
              onTouchStart={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-card border border-border/60 rounded-full px-3 py-1.5 min-h-11">
            <span className="text-xs text-muted-foreground">Room</span>
            <Input
              placeholder="Bed/Room"
              value={patient.bed}
              onChange={(e) => onUpdate(patient.id, "bed", e.target.value)}
              className="w-24 min-h-9 h-9 text-sm bg-transparent border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              autoComplete="off"
              autoCorrect="off"
              aria-label="Bed or room"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border/60 rounded-full px-3 py-1.5 min-h-11">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            <span>Updated {new Date(patient.lastModified).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border bg-background/95">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin" role="tablist" aria-label="Documentation sections">
          {SECTION_CHIPS.map((chip) => {
            const Icon = chip.icon;
            const isActive = activeSection === chip.id;
            return (
              <Button
                key={chip.id}
                role="tab"
                aria-selected={isActive}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className="min-h-11 h-11 rounded-full px-3.5 text-xs shrink-0"
                onClick={() => handleJumpToSection(chip.id)}
              >
                <Icon className="h-3.5 w-3.5 mr-1" aria-hidden />
                {chip.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Patient-Wide Todos */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="text-sm font-medium text-muted-foreground">Patient Tasks:</span>
        <PatientTodos
          todos={todos}
          section={null}
          patient={patient}
          generating={generating}
          onAddTodo={addTodo}
          onToggleTodo={toggleTodo}
          onDeleteTodo={deleteTodo}
          onGenerateTodos={generateTodos}
        />
      </div>

      {/* Content Sections */}
      <Accordion
        type="single"
        collapsible
        value={openSections[0] ?? ""}
        onValueChange={(value) => {
          setOpenSections(value ? [value] : []);
          if (value) setActiveSection(value);
        }}
        className="px-4"
      >
        {/* Clinical Summary */}
        <AccordionItem value="summary" className="border-b" id="section-summary">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium">Clinical Summary</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex justify-end gap-1 mb-2">
              <PatientTodos
                todos={todos}
                section="clinical_summary"
                patient={patient}
                generating={generating}
                onAddTodo={addTodo}
                onToggleTodo={toggleTodo}
                onDeleteTodo={deleteTodo}
                onGenerateTodos={generateTodos}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addTimestamp("clinicalSummary")}
                className="min-h-11 h-11 text-xs px-3"
              >
                <Clock className="h-3 w-3 mr-1" />
                Add Time
              </Button>
            </div>
            <div className="space-y-1">
              <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
                <RichTextEditor
                  value={patient.clinicalSummary}
                  onChange={(value) => onUpdate(patient.id, "clinicalSummary", value)}
                  placeholder="Enter clinical summary..."
                  minHeight="100px"
                  autotexts={autotexts}
                  fontSize={globalFontSize}
                  changeTracking={changeTracking}
                />
              </div>
              <FieldTimestamp timestamp={patient.fieldTimestamps?.clinicalSummary} className="pl-1" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Interval Events */}
        <AccordionItem value="events" className="border-b" id="section-events">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-medium">Interval Events</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex justify-end gap-1 mb-2">
              <PatientTodos
                todos={todos}
                section="interval_events"
                patient={patient}
                generating={generating}
                onAddTodo={addTodo}
                onToggleTodo={toggleTodo}
                onDeleteTodo={deleteTodo}
                onGenerateTodos={generateTodos}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateIntervalEvents}
                disabled={isGeneratingEvents}
                className="min-h-11 h-11 text-xs gap-1 px-3"
                title="Generate interval events from systems data"
              >
                {isGeneratingEvents ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Generate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addTimestamp("intervalEvents")}
                className="min-h-11 h-11 text-xs px-3"
              >
                <Clock className="h-3 w-3 mr-1" />
                Add Time
              </Button>
            </div>
            <div className="space-y-1">
              <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
                <RichTextEditor
                  value={patient.intervalEvents}
                  onChange={(value) => onUpdate(patient.id, "intervalEvents", value)}
                  placeholder="Enter interval events..."
                  minHeight="100px"
                  autotexts={autotexts}
                  fontSize={globalFontSize}
                  changeTracking={changeTracking}
                />
              </div>
              <FieldTimestamp timestamp={patient.fieldTimestamps?.intervalEvents} className="pl-1" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Imaging */}
        <AccordionItem value="imaging" className="border-b" id="section-imaging">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Imaging</span>
              {imagingTextCount > 0 && (
                <span className="text-[11px] text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded dark:text-blue-100 dark:bg-blue-950/60">
                  {imagingTextCount} chars
                </span>
              )}
              {imagingImageCount > 0 && (
                <span className="text-[11px] text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded dark:text-blue-100 dark:bg-blue-950/60">
                  {imagingImageCount} img
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addTimestamp("imaging")}
                  className="min-h-11 h-11 text-xs px-3"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  Add Time
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearSection("imaging")}
                  className="min-h-11 h-11 text-xs px-3 text-destructive"
                >
                  <Eraser className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
              <PatientTodos
                todos={todos}
                section="imaging"
                patient={patient}
                generating={generating}
                onAddTodo={addTodo}
                onToggleTodo={toggleTodo}
                onDeleteTodo={deleteTodo}
                onGenerateTodos={generateTodos}
              />
            </div>
            <div className="space-y-1">
              <div className="bg-blue-50/30 rounded-lg border border-blue-200/50">
                <ImagePasteEditor
                  value={patient.imaging}
                  onChange={(value) => onUpdate(patient.id, "imaging", value)}
                  placeholder="X-rays, CT, MRI, Echo... (paste images here)"
                  minHeight="80px"
                  autotexts={autotexts}
                  fontSize={globalFontSize}
                  changeTracking={changeTracking}
                  patient={patient}
                  section="imaging"
                />
              </div>
              <FieldTimestamp timestamp={patient.fieldTimestamps?.imaging} className="pl-1" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Labs */}
        <AccordionItem value="labs" className="border-b" id="section-labs">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-2">
              <TestTube className="h-4 w-4 text-primary" />
              <span className="font-medium">Labs</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex justify-end mb-2">
              <PatientTodos
                todos={todos}
                section="labs"
                patient={patient}
                generating={generating}
                onAddTodo={addTodo}
                onToggleTodo={toggleTodo}
                onDeleteTodo={deleteTodo}
                onGenerateTodos={generateTodos}
              />
            </div>
            <div className="space-y-1">
              <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
                <RichTextEditor
                  value={patient.labs}
                  onChange={(value) => onUpdate(patient.id, "labs", value)}
                  placeholder="CBC, BMP, LFTs, coags..."
                  minHeight="80px"
                  autotexts={autotexts}
                  fontSize={globalFontSize}
                  changeTracking={changeTracking}
                />
              </div>
              <FieldTimestamp timestamp={patient.fieldTimestamps?.labs} className="pl-1" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Medications */}
        <AccordionItem value="medications" className="border-b" id="section-medications">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-2">
              <Pill className="h-4 w-4 text-success" />
              <span className="font-medium">Medications</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <MedicationList
              medications={patient.medications || { infusions: [], scheduled: [], prn: [] }}
              onMedicationsChange={(medications: PatientMedications) =>
                onUpdate(patient.id, "medications", medications)
              }
            />
          </AccordionContent>
        </AccordionItem>

        {/* Systems Review */}
        <AccordionItem value="systems" className="border-b" id="section-systems">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              <span className="font-medium">Systems Review</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex justify-end mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllSystems}
                className="min-h-11 h-11 text-xs px-3 text-muted-foreground hover:text-destructive"
              >
                <Eraser className="h-3 w-3 mr-1" />
                Clear All Systems
              </Button>
            </div>
            <div className="space-y-3">
              {enabledSystems.map((system) => (
                <div key={system.key} className="rounded-lg p-3 border border-border/50 bg-secondary/30">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                      <span>{system.icon}</span>
                      {system.label}
                    </label>
                    <PatientTodos
                      todos={todos}
                      section={system.key}
                      patient={patient}
                      generating={generating}
                      onAddTodo={addTodo}
                      onToggleTodo={toggleTodo}
                      onDeleteTodo={deleteTodo}
                      onGenerateTodos={generateTodos}
                    />
                  </div>
                  <div className="space-y-1">
                    <RichTextEditor
                      value={patient.systems[system.key as keyof PatientSystems] || ''}
                      onChange={(value) => onUpdate(patient.id, `systems.${system.key}`, value)}
                      placeholder={`${system.label}...`}
                      minHeight="60px"
                      autotexts={autotexts}
                      fontSize={globalFontSize}
                      changeTracking={changeTracking}
                    />
                    <FieldTimestamp
                      timestamp={patient.fieldTimestamps?.[`systems.${system.key}` as keyof typeof patient.fieldTimestamps]}
                      className="pl-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <AlertDialog open={pendingClearField !== null} onOpenChange={(open) => !open && setPendingClearField(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear section</AlertDialogTitle>
            <AlertDialogDescription>
              Clear {clearSectionLabel} for {patientSafetyLabel(patient)}?{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClearField}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRemovePatientDialog} onOpenChange={setShowRemovePatientDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove patient</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {patientSafetyLabel(patient)} from rounds?{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemovePatient}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDuplicatePatientDialog} onOpenChange={setShowDuplicatePatientDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Patient</AlertDialogTitle>
            <AlertDialogDescription>
              Create a new roster entry from {patientSafetyLabel(patient)}?{" "}
              Chart content is copied into the duplicate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDuplicatePatient}>
              Duplicate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showClearSystemsDialog} onOpenChange={setShowClearSystemsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all systems review</AlertDialogTitle>
            <AlertDialogDescription>
              Remove all systems review content for {patientSafetyLabel(patient)}?{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClearSystems}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear all systems
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
