import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { animate, stagger } from 'animejs';
import { cardHover, collapseVariants } from '@/lib/animations';
import { durations, ease, staggers } from '@/lib/anime-presets';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Calendar, Copy, Trash2, ChevronDown, ChevronUp, Clock, ImageIcon, TestTube, Sparkles, Loader2, History, Settings2, X, Eraser, ClipboardList, AlertTriangle, User } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { RichTextEditor } from "./RichTextEditor";
import { ImagePasteEditor } from "./ImagePasteEditor";
import { PatientTodos } from "./PatientTodos";
import { FieldTimestamp } from "./FieldTimestamp";
import { FieldHistoryViewer } from "./FieldHistoryViewer";
import { SystemsConfigManager } from "./SystemsConfigManager";
import { MedicationList } from "./MedicationList";
import { LabFishbone } from "./labs";
import { LengthOfStayBadge } from "./LengthOfStayBadge";
import { QuickActionsPanel } from "./QuickActionsPanel";
import { AppleAIAssistant } from "./AppleAIAssistant";
import { PatientSystemsReview } from "./PatientSystemsReview";
import { ActivityFeed } from "./patient/ActivityFeed";
import { SectionFooterChrome } from "./patient/SectionFooterChrome";
import { AIDraftPreviewDialog } from "./dashboard/AIDraftPreviewDialog";
import { toast } from "sonner";
import type { AutoText } from "@/types/autotext";
import { defaultAutotexts } from "@/data/autotexts";
import type { Patient, PatientSystems, PatientMedications } from "@/types/patient";
import type { PatientTodo, TodoSection } from "@/types/todo";
import { useSystemsConfig } from "@/hooks/useSystemsConfig";
import { usePatientTodos, type PatientTodosApi } from "@/hooks/usePatientTodos";
import { useIntervalEventsGenerator } from "@/hooks/useIntervalEventsGenerator";
import { useDailySummaryGenerator } from "@/hooks/useDailySummaryGenerator";
import { useSettings } from "@/contexts/SettingsContext";
import { useChangeTracking } from "@/contexts/ChangeTrackingContext";
import { useTeam } from "@/contexts/TeamContext";
import { DashboardFocusTarget, SystemsReviewMode } from "@/lib/dashboardPrefs";
import { cn } from "@/lib/utils";
import { normalizePatientAlerts, patientSafetyLabel } from "@/lib/patientIdentity";
import { extractPatientImageObjectKeyList } from "@/lib/patientImages";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PatientCardProps {
  patient: Patient;
  onUpdate: (id: string, field: string, value: unknown) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  autotexts?: AutoText[];
  /** When provided (e.g. from dashboard todosMap), used as initial todos and avoids a duplicate fetch. */
  initialTodos?: PatientTodo[];
  /** When set (e.g. desktop list + tasks rail), uses this API instead of internal usePatientTodos so rail and card stay in sync. */
  sharedPatientTodos?: PatientTodosApi;
  /** Hide the top patient-wide tasks block (parent shows it in a rail). */
  hidePatientWideTodos?: boolean;
  dashboardFocusModeEnabled?: boolean;
  dashboardFocusTarget?: DashboardFocusTarget | null;
  onRequestDashboardFocusMode?: (target: DashboardFocusTarget) => void;
  onExitDashboardFocusMode?: () => void;
  systemsReviewMode?: SystemsReviewMode;
  systemsCustomCombineKeys?: string[];
  onSystemsReviewModeChange?: (mode: SystemsReviewMode) => void;
  onSystemsCustomCombineKeysChange?: (keys: string[]) => void;
  /**
   * "card" (default): standalone card with its own header — used by the legacy
   * stacked list. "workspace": hides the internal header, always renders the
   * body, defaults advanced sections open, and consolidates per-section
   * chrome (timestamp / AI actions / clear) into a single footer row.
   */
  chrome?: "card" | "workspace";
}

const PatientCardComponent = ({
  patient,
  onUpdate,
  onRemove,
  onDuplicate,
  onToggleCollapse,
  autotexts = defaultAutotexts,
  initialTodos,
  sharedPatientTodos,
  hidePatientWideTodos = false,
  dashboardFocusModeEnabled = false,
  dashboardFocusTarget = null,
  onRequestDashboardFocusMode,
  onExitDashboardFocusMode,
  systemsReviewMode,
  systemsCustomCombineKeys,
  onSystemsReviewModeChange,
  onSystemsCustomCombineKeysChange,
  chrome = "card",
}: PatientCardProps) => {
  const isWorkspace = chrome === "workspace";
  const { globalFontSize, todosAlwaysVisible, showLabFishbones, sectionVisibility } = useSettings();
  const changeTracking = useChangeTracking();
  const { teamMembers } = useTeam();
  const activeAiModelLabel = "Organization managed";

  const [expandedSection, setExpandedSection] = React.useState<string | null>(null);
  const [showSystemsConfig, setShowSystemsConfig] = React.useState(false);
  const [pendingClearField, setPendingClearField] = React.useState<string | null>(null);
  const [showClearSystemsDialog, setShowClearSystemsDialog] = React.useState(false);
  const clearSectionLabel = React.useMemo(() => {
    if (!pendingClearField) return "this section";
    const labels: Record<string, string> = {
      clinicalSummary: "Clinical Summary",
      intervalEvents: "Interval Events",
      imaging: "Imaging",
      labs: "Labs",
    };
    return labels[pendingClearField] ?? pendingClearField;
  }, [pendingClearField]);
  // Workspace chrome: advanced sections are peers (no gate), so default them open.
  const [showAdvancedSections, setShowAdvancedSections] = React.useState(() => chrome === "workspace");
  // AI draft preview (mockup artboard C): generated content waits here until inserted.
  const [aiDraft, setAiDraft] = React.useState<{
    title: string;
    draft: string;
    meta: string;
    previousValue: string;
    mode: "append" | "replace";
  } | null>(null);
  React.useEffect(() => {
    const revealAdvanced = () => setShowAdvancedSections(true);
    window.addEventListener("rr:reveal-advanced-documentation", revealAdvanced);
    return () => window.removeEventListener("rr:reveal-advanced-documentation", revealAdvanced);
  }, []);
  const internalTodos = usePatientTodos(sharedPatientTodos ? null : patient.id, {
    initialTodos: sharedPatientTodos ? undefined : initialTodos,
  });
  const { todos, generating, addTodo, toggleTodo, deleteTodo, generateTodos } = sharedPatientTodos ?? internalTodos;
  const { generateIntervalEvents, isGenerating: isGeneratingEvents, cancelGeneration } = useIntervalEventsGenerator();
  const { generateDailySummary, isGenerating: isGeneratingSummary, cancelGeneration: cancelSummary } = useDailySummaryGenerator();
  const { enabledSystems, systemLabels, systemIcons } = useSystemsConfig();
  const normalizedAlerts = React.useMemo(() => normalizePatientAlerts(patient.alerts), [patient.alerts]);
  const imagingImageCount = React.useMemo(() => {
    if (!patient.imaging) return 0;
    return extractPatientImageObjectKeyList(patient.imaging).length;
  }, [patient.imaging]);

  const handleGenerateIntervalEvents = async () => {
    const result = await generateIntervalEvents(
      patient.systems,
      patient.intervalEvents,
      patient.name
    );
    if (result) {
      // Gate the final write behind the AI draft preview modal (artboard C).
      setAiDraft({
        title: "AI draft — Interval Events",
        draft: result,
        meta: `Sources: Systems review, existing interval events · ${activeAiModelLabel}`,
        previousValue: patient.intervalEvents,
        mode: "append",
      });
    }
  };

  const handleGenerateDailySummary = async () => {
    // Pass no onUpdate callback so the hook returns the summary without writing;
    // the preview modal decides whether it lands in the chart.
    const result = await generateDailySummary(
      patient,
      undefined,
      todos.length ? todos : undefined,
    );
    if (result) {
      setAiDraft({
        title: "AI draft — Interval Events",
        draft: result,
        meta: `Sources: Summary, events, labs, imaging, systems, medications, todos · ${activeAiModelLabel}`,
        previousValue: patient.intervalEvents,
        mode: "replace",
      });
    }
  };

  const handleInsertAiDraft = React.useCallback(() => {
    if (!aiDraft) return;
    // Same write paths as before the preview gate: generate → append, summarize → replace.
    const newValue =
      aiDraft.mode === "append"
        ? aiDraft.previousValue
          ? `${aiDraft.previousValue}\n\n${aiDraft.draft}`
          : aiDraft.draft
        : aiDraft.draft;
    const previousValue = aiDraft.previousValue;
    onUpdate(patient.id, "intervalEvents", newValue);
    setAiDraft(null);
    toast.success("Draft inserted — Interval Events updated", {
      action: {
        label: "Undo",
        onClick: () => onUpdate(patient.id, "intervalEvents", previousValue),
      },
    });
  }, [aiDraft, onUpdate, patient.id]);

  const addTimestamp = (field: string) => {
    const timestamp = new Date().toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const currentValue = field.includes('.')
      ? patient.systems[field.split('.')[1] as keyof PatientSystems]
      : patient[field as keyof Patient];
    const newValue = `[${timestamp}] ${currentValue || ''}`;
    onUpdate(patient.id, field, newValue);
  };

  const clearSection = (field: string) => {
    setPendingClearField(field);
  };

  const clearAllSystems = () => {
    setShowClearSystemsDialog(true);
  };

  const handleConfirmClearField = React.useCallback(() => {
    if (!pendingClearField) return;
    onUpdate(patient.id, pendingClearField, "");
    setPendingClearField(null);
  }, [onUpdate, patient.id, pendingClearField]);

  const handleConfirmClearAllSystems = React.useCallback(() => {
    enabledSystems.forEach((system) => {
      onUpdate(patient.id, `systems.${system.key}`, "");
    });
    setShowClearSystemsDialog(false);
  }, [enabledSystems, onUpdate, patient.id]);



  const shouldReduceMotion = useReducedMotion();
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const prevCollapsed = React.useRef(patient.collapsed);
  const focusContainersRef = React.useRef<Partial<Record<DashboardFocusTarget, HTMLDivElement | null>>>({});

  const bindFocusContainer = React.useCallback(
    (target: DashboardFocusTarget) => (node: HTMLDivElement | null) => {
      focusContainersRef.current[target] = node;
    },
    [],
  );

  const handleEditorFocusIntent = React.useCallback(
    (target: DashboardFocusTarget) => {
      onRequestDashboardFocusMode?.(target);
    },
    [onRequestDashboardFocusMode],
  );

  const handleEditableFocus = React.useCallback(
    (target: DashboardFocusTarget) => (event: React.FocusEvent) => {
      const targetElement = event.target;
      if (!(targetElement instanceof HTMLElement)) return;
      if (!targetElement.isContentEditable) return;
      handleEditorFocusIntent(target);
    },
    [handleEditorFocusIntent],
  );

  React.useEffect(() => {
    const wasCollapsed = prevCollapsed.current;
    prevCollapsed.current = patient.collapsed;

    if (wasCollapsed && !patient.collapsed && !shouldReduceMotion) {
      const timer = setTimeout(() => {
        const el = bodyRef.current;
        if (!el) return;
        const sections = el.querySelectorAll<HTMLElement>(':scope > *');
        if (!sections.length) return;

        sections.forEach(s => { s.style.opacity = '0'; s.style.transform = 'translateY(12px)'; });

        animate(sections, {
          opacity: [0, 1],
          translateY: [12, 0],
          delay: stagger(staggers.tight),
          duration: durations.normal,
          ease: ease.out,
        });
      }, 180);

      return () => clearTimeout(timer);
    }
  }, [patient.collapsed, shouldReduceMotion]);

  React.useEffect(() => {
    if (!dashboardFocusModeEnabled || !dashboardFocusTarget) return;
    const container = focusContainersRef.current[dashboardFocusTarget];
    if (!container) return;
    const targetElement = container.querySelector<HTMLElement>("[contenteditable='true'], textarea, input");
    if (!targetElement) return;
    if (document.activeElement === targetElement) return;
    targetElement.focus();
  }, [dashboardFocusModeEnabled, dashboardFocusTarget, patient.id]);

  React.useEffect(() => {
    if (!dashboardFocusModeEnabled || !onExitDashboardFocusMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onExitDashboardFocusMode();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dashboardFocusModeEnabled, onExitDashboardFocusMode]);

  return (
    <motion.article
      className={cn(
        "print-avoid-break relative group",
        isWorkspace
          ? "bg-transparent"
          : "bg-card rounded-lg border border-border/40 shadow-card hover:shadow-md transition-all duration-300 overflow-hidden",
        dashboardFocusModeEnabled && "ring-1 ring-primary/30 shadow-lg",
      )}
      aria-label={`Patient: ${patient.name || 'Unnamed'}`}
      variants={shouldReduceMotion ? undefined : cardHover}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
    >
      {/* Header — hidden in workspace chrome: PatientWorkspace provides the patient header */}
      {!isWorkspace && (
      <div className="flex justify-between items-center gap-4 px-4 py-3 bg-secondary/30 border-b border-border/30 transition-colors group-hover:bg-secondary/40">
        <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
            <span className="text-base font-semibold text-primary">
              {patient.name ? patient.name.charAt(0).toUpperCase() : '#'}
            </span>
          </div>
          <div className="flex gap-2.5 flex-1 flex-wrap items-center">
            <div className="relative">
              <Label htmlFor={`patient-name-${patient.id}`} className="sr-only">
                Patient name
              </Label>
              <Input
                id={`patient-name-${patient.id}`}
                placeholder="Patient name"
                value={patient.name}
                onChange={(e) => onUpdate(patient.id, 'name', e.target.value)}
                aria-label="Patient name"
                title="Legal name or label used on rounds"
                className="max-w-[220px] font-semibold bg-transparent border-transparent hover:bg-secondary/40 hover:border-border/50 focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/20 rounded-lg px-3 h-9 text-base text-foreground shadow-none tracking-tight"
              />
            </div>
            <div className="relative">
              <Label htmlFor={`patient-mrn-${patient.id}`} className="sr-only">
                Medical record number
              </Label>
              <Input
                id={`patient-mrn-${patient.id}`}
                placeholder="MRN"
                value={patient.mrn ?? ""}
                onChange={(e) => onUpdate(patient.id, 'mrn', e.target.value)}
                aria-label="Medical record number"
                title="Hospital MRN or account number"
                className="max-w-[110px] bg-transparent border-transparent hover:bg-secondary/40 hover:border-border/50 focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/20 rounded-lg px-3 h-9 text-xs text-muted-foreground font-normal shadow-none"
              />
            </div>
            <div className="relative">
              <Label htmlFor={`patient-bed-${patient.id}`} className="sr-only">
                Bed or room number
              </Label>
              <Input
                id={`patient-bed-${patient.id}`}
                placeholder="Bed / room"
                value={patient.bed}
                onChange={(e) => onUpdate(patient.id, 'bed', e.target.value)}
                aria-label="Bed or room number"
                title="Unit and room or bay"
                className="max-w-[120px] bg-transparent border-transparent hover:bg-secondary/40 hover:border-border/50 focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/20 rounded-lg px-3 h-9 text-xs text-muted-foreground font-normal shadow-none"
              />
            </div>
            {/* Patient Status Badges */}
            <div className="flex items-center gap-1.5 no-print">
              <LengthOfStayBadge createdAt={patient.createdAt} />
            </div>
            {/* Assignment Dropdown */}
            {teamMembers.length > 0 && (
              <div className="flex items-center gap-1 ml-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-11 h-11 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors gap-1"
                      aria-label="Assign patient to team member"
                    >
                      <User className="h-3 w-3" />
                      <span>Assign</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 rounded-lg">
                    <DropdownMenuLabel className="text-xs">Assign to</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onUpdate(patient.id, 'assignedTo', null)}
                      className="text-xs"
                    >
                      Unassigned
                    </DropdownMenuItem>
                    {teamMembers.map((member) => (
                      <DropdownMenuItem
                        key={member.id}
                        onClick={() => onUpdate(patient.id, 'assignedTo', member.id)}
                        className="text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.name}
                              className="h-5 w-5 rounded-full"
                            />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-medium text-primary">
                                {member.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span>{member.name}</span>
                          {patient.assignedTo === member.id && (
                            <span className="ml-auto text-primary">✓</span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* Assigned User Badge */}
                {patient.assignedTo && (() => {
                  const assignedMember = teamMembers.find(m => m.id === patient.assignedTo);
                  return assignedMember ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/60 border border-border/40">
                            {assignedMember.avatarUrl ? (
                              <img
                                src={assignedMember.avatarUrl}
                                alt={assignedMember.name}
                                className="h-4 w-4 rounded-full"
                              />
                            ) : (
                              <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-medium text-primary">
                                  {assignedMember.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          Assigned to {assignedMember.name}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : null;
                })()}
              </div>
            )}
            {(patient.serviceLine || patient.codeStatus || patient.acuity || normalizedAlerts.length > 0) && (
              <div className="flex items-center gap-1.5 no-print border-l border-border/50 pl-2 ml-1">
                {patient.serviceLine && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-secondary/60 text-secondary-foreground border border-border/40">
                    {patient.serviceLine}
                  </span>
                )}
                {patient.acuity && (
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      patient.acuity === 'low' && "bg-green-500",
                      patient.acuity === 'moderate' && "bg-yellow-500",
                      patient.acuity === 'high' && "bg-orange-500",
                      patient.acuity === 'critical' && "bg-red-500 animate-pulse"
                    )}
                    title={`Acuity: ${patient.acuity}`}
                  />
                )}
                {patient.codeStatus && (
                  <span
                    className={cn(
                      "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border",
                      patient.codeStatus === 'full' && "bg-blue-500/10 text-blue-600 border-blue-500/30",
                      patient.codeStatus === 'dnr' && "bg-purple-500/10 text-purple-600 border-purple-500/30",
                      patient.codeStatus === 'dni' && "bg-amber-500/10 text-amber-600 border-amber-500/30",
                      patient.codeStatus === 'comfort' && "bg-pink-500/10 text-pink-600 border-pink-500/30"
                    )}
                    title={`Code status: ${patient.codeStatus}`}
                  >
                    {(patient.codeStatus ?? "").toUpperCase()}
                  </span>
                )}
                {normalizedAlerts.length > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-5 h-5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                          aria-label={`${normalizedAlerts.length} alert${normalizedAlerts.length > 1 ? 's' : ''}`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {normalizedAlerts.length > 1 && (
                            <span className="ml-0.5 text-xs font-bold">{normalizedAlerts.length}</span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <div className="space-y-1">
                          <p className="font-semibold text-xs">Alerts</p>
                          <ul className="text-xs space-y-0.5">
                            {normalizedAlerts.map((alert, idx) => (
                              <li key={`${patient.id}-alert-${idx}`} className="flex items-start gap-1">
                                <span className="w-1 h-1 rounded-full bg-destructive mt-1.5 flex-shrink-0" />
                                <span>{alert}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 no-print">
          {/* Quick Actions & Protocol Tools */}
          <QuickActionsPanel patient={patient} onUpdatePatient={onUpdate} />
          <AppleAIAssistant patient={patient} onUpdatePatient={onUpdate} compact />
          <div className="w-px h-4 bg-border/40 mx-1" />
          <FieldHistoryViewer
            patientId={patient.id}
            patientName={patient.name}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11 h-11 w-11 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors"
                aria-label="View change history"
              >
                <History className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            }
          />
          <ActivityFeed patientId={patient.id} patientName={patient.name} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleCollapse(patient.id)}
            className="min-h-11 min-w-11 h-11 w-11 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors"
            aria-label={patient.collapsed ? "Expand patient card" : "Collapse patient card"}
            aria-expanded={!patient.collapsed}
            aria-controls={`patient-body-${patient.id}`}
          >
            {patient.collapsed ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />}
          </Button>
          <div
            className="flex items-center gap-0.5 pl-2 ml-1 border-l border-border/50"
            role="group"
            aria-label="Duplicate or remove patient"
          >
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDuplicate(patient.id)}
                    className="min-h-11 min-w-11 h-11 w-11 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors"
                    aria-label={`Duplicate ${patient.name || "patient"}`}
                    title="Duplicate this patient card into a new roster entry"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  Duplicate this patient into a new roster entry
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(patient.id)}
                    className="min-h-11 min-w-11 h-11 w-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    aria-label={`Remove ${patient.name || "patient"} from list`}
                    title="Remove patient from this session"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  Remove this patient from today&apos;s roster
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
      )}

      <AnimatePresence initial={false}>
        {(!patient.collapsed || isWorkspace) && (
          <motion.div
            key="card-body"
            id={`patient-body-${patient.id}`}
            variants={shouldReduceMotion ? undefined : collapseVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="overflow-hidden"
          >
            <div ref={bodyRef} className={isWorkspace ? "px-1 pt-1 pb-3 space-y-3" : "p-4 space-y-4"}>
              {/* Patient-Wide Todos (hidden when desktop parent renders them in the tasks rail) */}
              {!hidePatientWideTodos && (
                <div
                  className={todosAlwaysVisible ? "" : "flex flex-wrap items-center gap-2 pb-2 border-b border-border"}
                  role="region"
                  aria-labelledby={`patient-tasks-heading-${patient.id}`}
                >
                  {!todosAlwaysVisible && (
                    <span id={`patient-tasks-heading-${patient.id}`} className="text-sm font-medium text-muted-foreground">
                      Patient tasks
                    </span>
                  )}
                  <PatientTodos
                    todos={todos}
                    section={null}
                    patient={patient}
                    generating={generating}
                    onAddTodo={addTodo}
                    onToggleTodo={toggleTodo}
                    onDeleteTodo={deleteTodo}
                    onGenerateTodos={generateTodos}
                    alwaysVisible={todosAlwaysVisible}
                  />
                </div>
              )}

              {/* Clinical Summary */}
              {sectionVisibility.clinicalSummary && (
                <div
                  className="space-y-1.5 scroll-mt-32"
                  data-documentation-section="summary"
                  id="documentation-section-summary"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/10 border border-primary/15">
                        <FileText className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      </div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/85">Clinical Summary</h3>
                      {patient.clinicalSummary && (
                        <span className="rounded bg-muted/50 px-1.5 py-0.5 text-xs text-foreground/70">
                          {(patient.clinicalSummary ?? "").length}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-0.5 no-print">
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
                      {!isWorkspace && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addTimestamp('clinicalSummary')}
                            className="min-h-11 min-w-11 h-11 w-11 p-0 text-muted-foreground hover:text-foreground"
                            aria-label="Add timestamp to clinical summary"
                          >
                            <Clock className="h-3 w-3" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => clearSection('clinicalSummary')}
                            className="min-h-11 h-11 px-2.5 text-xs text-muted-foreground hover:text-destructive"
                          >
                            Clear
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className="space-y-1"
                    ref={bindFocusContainer("clinicalSummary")}
                    onFocusCapture={handleEditableFocus("clinicalSummary")}
                    data-editor-type="clinical-summary"
                  >
                    <div className="bg-background/50 rounded-lg p-3 border border-border/40 focus-within:border-primary/40 focus-within:bg-background">
                      <RichTextEditor
                        value={patient.clinicalSummary}
                        onChange={(value) => onUpdate(patient.id, 'clinicalSummary', value)}
                        placeholder="Enter clinical summary..."
                        minHeight="80px"
                        autotexts={autotexts}
                        fontSize={globalFontSize}
                        changeTracking={changeTracking}
                      />
                    </div>
                    {!isWorkspace && (
                      <FieldTimestamp timestamp={patient.fieldTimestamps?.clinicalSummary} className="pl-1" />
                    )}
                  </div>
                  {isWorkspace && (
                    <SectionFooterChrome
                      fieldLabel="clinical summary"
                      timestamp={patient.fieldTimestamps?.clinicalSummary}
                      onAddTimestamp={() => addTimestamp('clinicalSummary')}
                      onClearSection={() => clearSection('clinicalSummary')}
                      modelLabel={activeAiModelLabel}
                    />
                  )}
                </div>
              )}

              {/* Interval Events */}
              {sectionVisibility.intervalEvents && (
                <div
                  className="space-y-1.5 scroll-mt-32"
                  data-documentation-section="events"
                  id="documentation-section-events"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/10 border border-primary/15">
                        <Calendar className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      </div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/85">Interval Events</h3>
                      {patient.intervalEvents && (
                        <span className="rounded bg-muted/50 px-1.5 py-0.5 text-xs text-foreground/70">
                          {patient.intervalEvents.length}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 no-print">
                      {!isWorkspace && (
                        <>
                          {isGeneratingEvents || isGeneratingSummary ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={isGeneratingEvents ? cancelGeneration : cancelSummary}
                              className="min-h-11 h-11 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                              aria-label="Cancel generation"
                            >
                              <X className="h-3 w-3" aria-hidden="true" />
                              <span className="ml-1 text-xs">Cancel</span>
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleGenerateIntervalEvents}
                                className="min-h-11 h-11 px-3 text-primary hover:text-primary hover:bg-primary/10"
                                aria-label="Generate interval events from systems using AI"
                                title="Draft interval events from systems review using the current AI model"
                              >
                                <Sparkles className="h-3 w-3" aria-hidden="true" />
                                <span className="ml-1 text-xs">Generate</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleGenerateDailySummary}
                                className="min-h-11 h-11 px-3 text-warning hover:text-warning hover:bg-warning/10"
                                aria-label="Summarize today's changes and todos using AI"
                                title="Summarize today's chart changes and open todos"
                              >
                                <ClipboardList className="h-3 w-3" aria-hidden="true" />
                                <span className="ml-1 text-xs">Summary</span>
                              </Button>
                            </>
                          )}
                          {(isGeneratingEvents || isGeneratingSummary) && (
                            <div
                              className="flex items-center min-h-11 h-11 px-2 gap-1.5"
                              role="status"
                              aria-live="polite"
                              aria-busy="true"
                            >
                              <Loader2 className="h-3 w-3 animate-spin text-primary" aria-hidden="true" />
                              <span className="text-xs text-muted-foreground">
                                {isGeneratingEvents ? "Generating events…" : "Summarizing…"}
                              </span>
                            </div>
                          )}
                        </>
                      )}
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
                      {!isWorkspace && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addTimestamp('intervalEvents')}
                            className="min-h-11 min-w-11 h-11 w-11 p-0 text-muted-foreground hover:text-foreground"
                            aria-label="Add timestamp to interval events"
                          >
                            <Clock className="h-3 w-3" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => clearSection('intervalEvents')}
                            className="min-h-11 h-11 px-2.5 text-xs text-muted-foreground hover:text-destructive"
                          >
                            Clear
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className="space-y-1"
                    ref={bindFocusContainer("intervalEvents")}
                    onFocusCapture={handleEditableFocus("intervalEvents")}
                  >
                    <div className="bg-background/50 rounded-lg p-3 border border-border/40 focus-within:border-primary/40 focus-within:bg-background">
                      <RichTextEditor
                        value={patient.intervalEvents}
                        onChange={(value) => onUpdate(patient.id, 'intervalEvents', value)}
                        placeholder="Enter interval events..."
                        minHeight="80px"
                        autotexts={autotexts}
                        fontSize={globalFontSize}
                        changeTracking={changeTracking}
                      />
                    </div>
                    {!isWorkspace && (
                      <FieldTimestamp timestamp={patient.fieldTimestamps?.intervalEvents} className="pl-1" />
                    )}
                  </div>
                  {isWorkspace && (
                    <SectionFooterChrome
                      fieldLabel="interval events"
                      timestamp={patient.fieldTimestamps?.intervalEvents}
                      onAddTimestamp={() => addTimestamp('intervalEvents')}
                      onClearSection={() => clearSection('intervalEvents')}
                      aiActions={[
                        {
                          key: "draft-systems",
                          label: "Draft from systems review",
                          icon: <Sparkles className="h-3.5 w-3.5" />,
                          onSelect: handleGenerateIntervalEvents,
                        },
                        {
                          key: "summarize-today",
                          label: "Summarize today's changes",
                          icon: <ClipboardList className="h-3.5 w-3.5" />,
                          onSelect: handleGenerateDailySummary,
                        },
                      ]}
                      aiBusy={isGeneratingEvents || isGeneratingSummary}
                      onCancelAI={isGeneratingEvents ? cancelGeneration : cancelSummary}
                      modelLabel={activeAiModelLabel}
                    />
                  )}
                </div>
              )}

              {/* Imaging & Labs Row */}
              {(sectionVisibility.imaging || sectionVisibility.labs) && (
                <div
                  className="space-y-2 scroll-mt-32"
                  data-documentation-section="results"
                  id="documentation-section-results"
                >
                  {!isWorkspace && (
                    <div className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Advanced sections
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11 h-11 px-3 text-xs"
                        onClick={() => setShowAdvancedSections((prev) => !prev)}
                      >
                        {showAdvancedSections ? "Hide" : "Show"}
                      </Button>
                    </div>
                  )}
                  {showAdvancedSections && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Imaging */}
                  {sectionVisibility.imaging && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/10 border border-primary/15">
                            <ImageIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          </div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/85">Imaging</h3>
                          {patient.imaging && (
                            <span className="rounded bg-muted/50 px-1.5 py-0.5 text-xs text-foreground/70">
                              {patient.imaging.replace(/<[^>]*>/g, '').length}
                            </span>
                          )}
                          {imagingImageCount > 0 && (
                            <span className="rounded bg-muted/50 px-1.5 py-0.5 text-xs text-foreground/70">
                              {imagingImageCount} img
                            </span>
                          )}
                        </div>
                        <div className="flex gap-0.5 no-print">
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addTimestamp('imaging')}
                            className="min-h-11 min-w-11 h-11 w-11 p-0 text-muted-foreground hover:text-foreground"
                            aria-label="Add timestamp to imaging"
                          >
                            <Clock className="h-3 w-3" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => clearSection('imaging')}
                            className="min-h-11 h-11 px-2.5 text-xs text-muted-foreground hover:text-destructive"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                      <div
                        className="space-y-1"
                        ref={bindFocusContainer("imaging")}
                        onFocusCapture={handleEditableFocus("imaging")}
                      >
                        <div className="bg-background/50 rounded-lg border border-border/40 focus-within:border-primary/40 focus-within:bg-background">
                          <ImagePasteEditor
                            value={patient.imaging}
                            onChange={(value) => onUpdate(patient.id, 'imaging', value)}
                            placeholder="X-rays, CT, MRI, Echo... (paste images here)"
                            minHeight="60px"
                            autotexts={autotexts}
                            fontSize={globalFontSize}
                            changeTracking={changeTracking}
                            patient={patient}
                            section="imaging"
                          />
                        </div>
                        <FieldTimestamp timestamp={patient.fieldTimestamps?.imaging} className="pl-1" />
                      </div>
                    </div>
                  )}

                  {/* Labs */}
                  {sectionVisibility.labs && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/10 border border-primary/15">
                            <TestTube className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          </div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/85">Labs</h3>
                          {patient.labs && (
                            <span className="rounded bg-muted/50 px-1.5 py-0.5 text-xs text-foreground/70">
                              {patient.labs.length}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-0.5 no-print">
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => clearSection('labs')}
                            className="min-h-11 h-11 px-2.5 text-xs text-muted-foreground hover:text-destructive"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>

                      {/* Lab Fishbone Display (when enabled and labs have data) */}
                      {showLabFishbones && patient.labs && (
                        <LabFishbone labs={patient.labs} className="mb-2" />
                      )}

                      <div
                        className="space-y-1"
                        ref={bindFocusContainer("labs")}
                        onFocusCapture={handleEditableFocus("labs")}
                      >
                        <div className="bg-background/50 rounded-lg p-3 border border-border/40 focus-within:border-primary/40 focus-within:bg-background">
                          <RichTextEditor
                            value={patient.labs}
                            onChange={(value) => onUpdate(patient.id, 'labs', value)}
                            placeholder="CBC, BMP, LFTs, coags... (e.g., Na: 140, K: 4.0, Cr: 1.0)"
                            minHeight="60px"
                            autotexts={autotexts}
                            fontSize={globalFontSize}
                            changeTracking={changeTracking}
                          />
                        </div>
                        <FieldTimestamp timestamp={patient.fieldTimestamps?.labs} className="pl-1" />
                      </div>
                    </div>
                  )}
                </div>
                  )}
                </div>
              )}

              {/* Medications */}
              {sectionVisibility.medications && showAdvancedSections && (
                <div
                  className="bg-background/50 rounded-lg p-4 border border-border/40 transition-all duration-200 hover:border-border/60 scroll-mt-32"
                  data-documentation-section="medications"
                  id="documentation-section-medications"
                >
                  <MedicationList
                    medications={patient.medications ?? { infusions: [], scheduled: [], prn: [] }}
                    onMedicationsChange={(meds) => onUpdate(patient.id, 'medications', meds)}
                  />
                  <FieldTimestamp timestamp={patient.fieldTimestamps?.medications} className="pl-1 mt-2" />
                </div>
              )}

              {/* Systems Review */}
              {sectionVisibility.systemsReview && (
                <div
                  ref={bindFocusContainer("systemsReview")}
                  onFocusCapture={handleEditableFocus("systemsReview")}
                  data-editor-type="systems-review"
                  data-documentation-section="systems"
                  id="documentation-section-systems"
                  className="scroll-mt-32"
                >
                  <PatientSystemsReview
                    patient={patient}
                    todos={todos}
                    generating={generating}
                    autotexts={autotexts}
                    globalFontSize={globalFontSize}
                    changeTracking={changeTracking}
                    onUpdate={onUpdate}
                    addTodo={addTodo}
                    toggleTodo={toggleTodo}
                    deleteTodo={deleteTodo}
                    generateTodos={(section) => generateTodos(patient, section as TodoSection)}
                    onClearAll={clearAllSystems}
                    onOpenConfig={() => setShowSystemsConfig(true)}
                    systemsReviewMode={systemsReviewMode}
                    systemsCustomCombineKeys={systemsCustomCombineKeys}
                    onSystemsReviewModeChange={onSystemsReviewModeChange}
                    onSystemsCustomCombineKeysChange={onSystemsCustomCombineKeysChange}
                    onAnyEditorFocus={() => handleEditorFocusIntent("systemsReview")}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SystemsConfigManager
        open={showSystemsConfig}
        onOpenChange={setShowSystemsConfig}
      />

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
              onClick={handleConfirmClearAllSystems}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear all systems
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AIDraftPreviewDialog
        open={aiDraft !== null}
        onOpenChange={(open) => {
          if (!open) setAiDraft(null);
        }}
        title={aiDraft?.title ?? ""}
        draft={aiDraft?.draft ?? ""}
        meta={aiDraft?.meta}
        onInsert={handleInsertAiDraft}
      />
    </motion.article>
  );
};

// Memoize to prevent unnecessary re-renders when other patients change
// React Query provides stable patient references when data hasn't changed,
// so reference comparison is sufficient for the patient object
export const PatientCard = React.memo(PatientCardComponent, (prevProps, nextProps) => {
  if (prevProps.chrome !== nextProps.chrome) return false;
  if (prevProps.hidePatientWideTodos !== nextProps.hidePatientWideTodos) return false;
  if (prevProps.dashboardFocusModeEnabled !== nextProps.dashboardFocusModeEnabled) return false;
  if (prevProps.dashboardFocusTarget !== nextProps.dashboardFocusTarget) return false;
  if (prevProps.systemsReviewMode !== nextProps.systemsReviewMode) return false;
  if (prevProps.systemsCustomCombineKeys !== nextProps.systemsCustomCombineKeys) return false;
  if (prevProps.onRequestDashboardFocusMode !== nextProps.onRequestDashboardFocusMode) return false;
  if (prevProps.onExitDashboardFocusMode !== nextProps.onExitDashboardFocusMode) return false;
  if (prevProps.onSystemsReviewModeChange !== nextProps.onSystemsReviewModeChange) return false;
  if (prevProps.onSystemsCustomCombineKeysChange !== nextProps.onSystemsCustomCombineKeysChange) return false;
  const sharedEqual =
    prevProps.sharedPatientTodos === nextProps.sharedPatientTodos ||
    (!!prevProps.sharedPatientTodos &&
      !!nextProps.sharedPatientTodos &&
      prevProps.sharedPatientTodos.todos === nextProps.sharedPatientTodos.todos &&
      prevProps.sharedPatientTodos.generating === nextProps.sharedPatientTodos.generating);
  if (!sharedEqual) return false;

  // Fast path: if patient reference is identical, only check callbacks
  if (prevProps.patient === nextProps.patient) {
    return (
      prevProps.autotexts === nextProps.autotexts &&
      prevProps.onUpdate === nextProps.onUpdate &&
      prevProps.onRemove === nextProps.onRemove &&
      prevProps.onDuplicate === nextProps.onDuplicate &&
      prevProps.onToggleCollapse === nextProps.onToggleCollapse
    );
  }

  // Different patient objects - check if it's actually a different patient
  // or just an update to the same patient
  if (prevProps.patient.id !== nextProps.patient.id) {
    return false; // Different patient, must re-render
  }

  // Same patient ID but different object - check if meaningful fields changed
  // Use lastModified as a quick change indicator
  return (
    prevProps.patient.lastModified === nextProps.patient.lastModified &&
    prevProps.patient.collapsed === nextProps.patient.collapsed &&
    prevProps.autotexts === nextProps.autotexts &&
    prevProps.onUpdate === nextProps.onUpdate &&
    prevProps.onRemove === nextProps.onRemove &&
    prevProps.onDuplicate === nextProps.onDuplicate &&
    prevProps.onToggleCollapse === nextProps.onToggleCollapse
  );
});
