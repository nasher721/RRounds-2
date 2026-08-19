import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { createTimeline } from "animejs";
import { scaleIn, transitions } from "@/lib/animations";
import { durations, ease } from "@/lib/anime-presets";
import { useSettings } from "@/contexts/SettingsContext";
import { useDashboardLayout } from "@/context/DashboardLayoutContext";
import { useChangeTracking } from "@/contexts/ChangeTrackingContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { useDashboardTodos, type TodosMap } from "@/contexts/DashboardTodosContext";
import { PatientRosterRail } from "./PatientRosterRail";
import { PatientWorkspace } from "./PatientWorkspace";
import { ProfileCoachingBanner } from "./ProfileCoachingBanner";
import { getPatientProfileCoaching } from "@/lib/patientProfileCoaching";
import { AutotextManager } from "@/components/AutotextManager";
import { EpicHandoffImport } from "@/components/EpicHandoffImport";
import { CSVColumnMapper } from "@/components/import/CSVColumnMapper";
import { organizeCsvImportRecord } from "@/lib/import/organizeImportedPatient";
import { SmartPatientImport } from "@/components/SmartPatientImport";
import { ChangeTrackingControls } from "@/components/ChangeTrackingControls";
import { IBCCPanel } from "@/components/ibcc";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GuidelinesPanel } from "@/components/guidelines";
import { SectionVisibilityPanel } from "@/components/SectionVisibilityPanel";
import { DesktopSpecialtySelector } from "@/components/settings/DesktopSpecialtySelector";
import { DesktopAIModelSettingsDialog } from "@/components/settings/DesktopAIModelSettingsDialog";
import { ObservabilitySupportCard } from "@/components/settings/ObservabilitySupportCard";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { ClinicalRiskCalculator } from "@/components/ClinicalRiskCalculator";
import { TimelineDialog } from "../tools/timeline/TimelineDialog";
import { UnitCensusDashboard } from "@/components/UnitCensusDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { TrustIndicators } from "@/components/trust/TrustIndicators";
import { BatchCourseGenerator } from "@/components/BatchCourseGenerator";
import { ContextAwareHelp } from "@/components/ContextAwareHelp";
import { KeyboardShortcutHelp, useKeyboardShortcutHelp } from "@/components/KeyboardShortcutHelp";
import { SyncHistoryPanel } from "@/components/sync/SyncHistoryPanel";
import { useAICommandPalette } from "@/hooks/useAICommandPalette";
import type { ChangeTrackingStyles } from "@/types/changeTracking";

// Lazy-load heavy modal components for better initial bundle size
const PrintExportModal = React.lazy(() => import("@/components/PrintExportModal").then(m => ({ default: m.PrintExportModal })));
const MultiPatientComparison = React.lazy(() => import("@/components/MultiPatientComparison").then(m => ({ default: m.MultiPatientComparison })));
const PhraseManager = React.lazy(() => import("@/components/phrases/PhraseManager").then(m => ({ default: m.PhraseManager })));
const AICommandPalette = React.lazy(() => import("@/components/tools/AICommandPalette").then(m => ({ default: m.AICommandPalette })));
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Plus,
  Printer,
  Clock,
  LogOut,
  ListTodo,
  FileText,
  Sparkles,
  ChevronDown,
  SlidersHorizontal,
  Minimize2,
  Maximize2,
  CheckCircle2,
  Upload,
  PanelLeftOpen,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PatientFilterType, MIN_GLOBAL_FONT_SIZE_PX, MAX_GLOBAL_FONT_SIZE_PX } from "@/constants/config";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeStorage";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type UtilityPanel = "resources" | "tools" | "settings";

export const DesktopDashboard = () => {
  const {
    user,
    patients,
    filteredPatients,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    selectedPatient,
    autotexts,
    templates,
    customDictionary,
    onAddPatient,
    onAddPatientWithData,
    onUpdatePatient,
    onCollapseAll,
    onClearAll,
    onImportPatients,
    onAddAutotext,
    onRemoveAutotext,
    onAddTemplate,
    onRemoveTemplate,
    onImportDictionary,
    onSignOut,
    lastSaved,
    onRefetchPatients,
    desktopSelectedPatientId,
    setDesktopSelectedPatientId,
    patientListViewMode,
    setPatientListViewMode,
  } = useDashboard();
  const todosMap = useDashboardTodos();
  const navigate = useNavigate();
  const {
    globalFontSize,
    setGlobalFontSize,
    todosAlwaysVisible,
    setTodosAlwaysVisible,
    sortBy,
    setSortBy,
    editorToolbarMode,
    setEditorToolbarMode,
  } = useSettings();
  const activeAiModelLabel = "Organization managed";
  const { enabled: ctEnabled, color: ctColor, styles: ctStyles, toggleEnabled: ctToggleEnabled, setColor: ctSetColor, toggleStyle: ctToggleStyle } = useChangeTracking();

  const [showPrintModal, setShowPrintModal] = React.useState(false);
  const [showPhraseManager, setShowPhraseManager] = React.useState(false);
  const [showComparisonModal, setShowComparisonModal] = React.useState(false);
  const { isOpen: isAICommandPaletteOpen, setIsOpen: setAICommandPaletteOpen } = useAICommandPalette();
  const { isOpen: isShortcutHelpOpen, setIsOpen: setShortcutHelpOpen } = useKeyboardShortcutHelp();
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const goNextPatient = React.useCallback(() => {
    if (filteredPatients.length === 0) return;
    const idx = filteredPatients.findIndex((p) => p.id === desktopSelectedPatientId);
    const current = idx >= 0 ? idx : 0;
    const next = (current + 1) % filteredPatients.length;
    setDesktopSelectedPatientId(filteredPatients[next].id);
  }, [filteredPatients, desktopSelectedPatientId, setDesktopSelectedPatientId]);

  const goPrevPatient = React.useCallback(() => {
    if (filteredPatients.length === 0) return;
    const idx = filteredPatients.findIndex((p) => p.id === desktopSelectedPatientId);
    const current = idx >= 0 ? idx : 0;
    const prev = (current - 1 + filteredPatients.length) % filteredPatients.length;
    setDesktopSelectedPatientId(filteredPatients[prev].id);
  }, [filteredPatients, desktopSelectedPatientId, setDesktopSelectedPatientId]);

  /** Explicit AI scope: desktop roster selection, never a silent first-patient fallback. */
  const aiContextPatient = React.useMemo(() => {
    if (desktopSelectedPatientId) {
      return (
        filteredPatients.find((p) => p.id === desktopSelectedPatientId) ??
        patients.find((p) => p.id === desktopSelectedPatientId) ??
        undefined
      );
    }
    return selectedPatient ?? undefined;
  }, [desktopSelectedPatientId, filteredPatients, patients, selectedPatient]);

  useKeyboardShortcuts({
    onAddPatient,
    onSearch: () => searchInputRef.current?.focus(),
    onCollapseAll,
    onPrint: () => setShowPrintModal(true),
    onSlashFocusSearch: () => searchInputRef.current?.focus(),
    onKeyNAddPatient: onAddPatient,
    onNextPatient: goNextPatient,
    onPrevPatient: goPrevPatient,
  });

  const handleExport = React.useCallback(() => {
    const exportData = patients.map((p) => ({
      name: p.name,
      bed: p.bed,
      clinicalSummary: p.clinicalSummary,
      intervalEvents: p.intervalEvents,
      systems: p.systems,
      createdAt: p.createdAt,
      lastModified: p.lastModified,
    }));
    const dataStr = JSON.stringify({ patients: exportData }, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rounding-notes-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [patients]);

  const [showClearAllDialog, setShowClearAllDialog] = React.useState(false);
  const [syncingList, setSyncingList] = React.useState(false);
  const [showSyncHistory, setShowSyncHistory] = React.useState(false);
  const [showSamplePreview, setShowSamplePreview] = React.useState(false);
  const [openToolsRequestToken, setOpenToolsRequestToken] = React.useState(0);

  const profileCoaching = React.useMemo(() => getPatientProfileCoaching(patients), [patients]);

  const activeFilterCount =
    (searchQuery.trim() ? 1 : 0) + (filter !== PatientFilterType.All ? 1 : 0);

  const activePatientsCount = React.useMemo(() => {
    const hasClinicalContent = (value: string) => value.trim().length > 0;
    const hasArrayContent = (value: string[]) => value.some((entry) => entry.trim().length > 0);
    return patients.filter((patient) => {
      if (hasClinicalContent(patient.clinicalSummary)) return true;
      if (hasClinicalContent(patient.intervalEvents)) return true;
      if (hasClinicalContent(patient.imaging)) return true;
      if (hasClinicalContent(patient.labs)) return true;
      if (Object.values(patient.systems).some((systemValue) => hasClinicalContent(systemValue))) return true;
      if (hasArrayContent(patient.medications.infusions)) return true;
      if (hasArrayContent(patient.medications.scheduled)) return true;
      if (hasArrayContent(patient.medications.prn)) return true;
      return false;
    }).length;
  }, [patients]);

  const inactivePatientsCount = Math.max(0, patients.length - activePatientsCount);

  const outstandingTodosCount = React.useMemo(() => {
    return Object.values(todosMap).reduce((total, patientTodos) => {
      return total + patientTodos.filter((todo) => !todo.completed).length;
    }, 0);
  }, [todosMap]);

  const handleSyncNow = React.useCallback(async () => {
    setSyncingList(true);
    try {
      await onRefetchPatients();
    } finally {
      setSyncingList(false);
    }
  }, [onRefetchPatients]);

  const handleClearAll = React.useCallback(() => {
    setShowClearAllDialog(true);
  }, []);

  const handleConfirmClearAll = React.useCallback(() => {
    onClearAll();
    setShowClearAllDialog(false);
  }, [onClearAll]);

  const filterLabel = React.useMemo(() => {
    if (filter === PatientFilterType.Filled) return "With notes";
    if (filter === PatientFilterType.Empty) return "Empty notes";
    if (filter === PatientFilterType.MyPatients) return "My patients";
    return "All patients";
  }, [filter]);

  /** When true, patient count lives in the header roster chip only—meta row uses non-numeric copy to avoid duplicate "N patients". */
  const isDefaultListScope =
    patients.length > 0 && !searchQuery.trim() && filter === PatientFilterType.All;

  const shouldReduceMotion = useReducedMotion();

  const todayLabel = React.useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    [],
  );

  const lastSavedRelative = React.useMemo(() => {
    const diffMs = Date.now() - lastSaved.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}h ago`;
    return lastSaved.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }, [lastSaved]);

  const dashUtilRef = React.useRef<HTMLDivElement>(null);
  const dashListRef = React.useRef<HTMLDivElement>(null);
  const dashMountRan = React.useRef(false);

  React.useEffect(() => {
    if (dashMountRan.current) return;
    const els = [dashUtilRef.current, dashListRef.current];
    if (els.some(el => !el)) return;
    dashMountRan.current = true;

    if (shouldReduceMotion) {
      els.forEach(el => { if (el) el.style.opacity = "1"; });
      return;
    }

    const tl = createTimeline({ defaults: { ease: ease.out } })
      .add(dashUtilRef.current!, {
        opacity: [0, 1],
        translateY: [16, 0],
        duration: durations.normal,
      }, 100)
      .add(dashListRef.current!, {
        opacity: [0, 1],
        translateY: [20, 0],
        duration: durations.slow,
      }, 250);

    return () => { tl.pause(); };
  }, [shouldReduceMotion]);

  const {
    panelLeftCollapsed,
    panelRightCollapsed,
    toggleLeftPanel,
    toggleRightPanel,
    setLeftPanelCollapsed,
    focusModeActive,
    exitFocusMode,
    patientRosterLayoutMode,
    setPatientRosterLayoutMode,
  } = useDashboardLayout();

  const handleTogglePanels = React.useCallback(() => {
    // Focus mode collapses both panels; treat "expand panels" as exiting focus.
    if (focusModeActive) {
      exitFocusMode();
      return;
    }
    const bothCollapsed = panelLeftCollapsed && panelRightCollapsed;
    const anyCollapsed = panelLeftCollapsed || panelRightCollapsed;
    if (bothCollapsed) {
      toggleLeftPanel();
      toggleRightPanel();
      return;
    }
    if (anyCollapsed) {
      if (panelLeftCollapsed) toggleLeftPanel();
      if (panelRightCollapsed) toggleRightPanel();
      return;
    }
    toggleLeftPanel();
    toggleRightPanel();
  }, [
    focusModeActive,
    exitFocusMode,
    panelLeftCollapsed,
    panelRightCollapsed,
    toggleLeftPanel,
    toggleRightPanel,
  ]);

  const TogglePanelsButton = () => {
    const bothCollapsed = panelLeftCollapsed && panelRightCollapsed;
    const anyCollapsed = panelLeftCollapsed || panelRightCollapsed;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleTogglePanels}
              aria-label={
                focusModeActive || bothCollapsed ? "Expand panels" : "Collapse panels"
              }
            >
              {bothCollapsed ? (
                <Maximize2 className="h-4 w-4" />
              ) : anyCollapsed ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Minimize2 className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{bothCollapsed ? "Expand all panels" : anyCollapsed ? "Expand panels" : "Collapse all panels"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  /** Shared empty-roster / filtered-empty recovery panel (zero state + checklist). */
  const renderRecoveryState = () => (
    <motion.div
      className="flex flex-col items-center justify-start pt-6 pb-12 text-center gradient-mesh-empty rounded-xl"
      variants={shouldReduceMotion ? undefined : scaleIn}
      initial="hidden"
      animate="visible"
      transition={{ ...transitions.spring, delay: 0.15 }}
    >
      <div className="mb-8 relative flex items-center justify-center">
        <div className="bg-secondary/30 rounded-3xl p-8 border border-border/40 shadow-sm depth-shadow-hover">
          <img src="/icons/icon-192.png" alt="Rolling Rounds" className="h-20 w-20 rounded-2xl opacity-60" />
        </div>
      </div>
      <h3 className="text-3xl font-semibold mb-2 text-foreground tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
        {patients.length === 0 ? "Ready to Start Rounds" : "No patients match your filter"}
      </h3>
      <p className="text-muted-foreground text-base mb-6 max-w-sm leading-relaxed">
        {patients.length === 0
          ? "Add your first patient to begin documenting rounds with your team."
          : "Try adjusting your search or filter criteria."}
      </p>
      {patients.length > 0 ? (
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Clear filters from the roster rail, or add a patient if the census is incomplete.
        </p>
      ) : null}
      {patients.length === 0 && (
        <div className="w-full max-w-xl rounded-xl border border-border/40 bg-card/70 p-5 text-left shadow-sm">
          <p className="text-sm font-semibold text-foreground mb-3">Quick start checklist</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2 text-foreground/90">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" aria-hidden="true" />
              <span>Add your first patient to build today&apos;s roster</span>
            </div>
            <div className="flex items-start gap-2 text-foreground/90">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" aria-hidden="true" />
              <span>Share rounds with your team using synced notes</span>
            </div>
            <div className="flex items-start gap-2 text-foreground/90">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" aria-hidden="true" />
              <span>Try the AI assistant for drafts and interval updates</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={onAddPatient} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add First Patient
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setOpenToolsRequestToken((prev) => prev + 1)}
            >
              <Upload className="h-4 w-4" />
              Import from CSV/EHR
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowSamplePreview((prev) => !prev)}
            >
              {showSamplePreview ? "Hide sample preview" : "Preview example structure"}
            </Button>
          </div>
          {showSamplePreview ? (
            <div className="mt-4 rounded-lg border border-border/50 bg-background p-3 text-xs text-left">
              <p className="font-semibold text-foreground">Example structure</p>
              <p className="mt-1 text-muted-foreground">Bed 12A · De-identified ICU admission · Shock improving</p>
              <p className="mt-2 text-foreground/90">CV: pressor dose decreasing, MAP goal met. Resp: low-flow oxygen, wean as tolerated.</p>
            </div>
          ) : null}
        </div>
      )}
    </motion.div>
  );

  return (
    <div
      className="min-h-screen bg-background"
      id="main-content"
      role="main"
      data-testid="dashboard"
      data-left-panel-collapsed={String(panelLeftCollapsed)}
      data-right-panel-collapsed={String(panelRightCollapsed)}
      data-panel-collapsed={String(panelLeftCollapsed && panelRightCollapsed)}
      data-focus-mode={String(focusModeActive)}
    >
      <motion.header
        className="sticky top-0 z-50 isolate border-b border-border/20 bg-card/95 backdrop-blur-xl no-print shadow-card gradient-mesh-subtle"
        initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.smooth}
      >
        <div className="container mx-auto px-4 md:px-6 lg:px-8 py-2.5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Link to="/" className="flex items-center gap-2.5 group cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors border border-primary/10">
                    <img src="/icons/favicon-64.png" alt="" className="h-5 w-5 rounded" aria-hidden="true" />
                  </div>
                  <h1 className="text-lg font-semibold tracking-tight text-card-foreground group-hover:text-primary transition-colors hidden sm:block">Rolling Rounds</h1>
                </Link>
                {patients.length > 0 ? (
                  <div className="hidden md:flex items-center gap-2 rounded-md border border-border/25 bg-background/55 px-2.5 py-1 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground tabular-nums">{patients.length}</span>
                    <span>roster</span>
                    <span className="h-3 w-px bg-border/50" aria-hidden="true" />
                    <span className="font-semibold text-foreground tabular-nums">{outstandingTodosCount}</span>
                    <span>open tasks</span>
                    <span className="h-3 w-px bg-border/50" aria-hidden="true" />
                    <span>Synced {lastSavedRelative}</span>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" onClick={onAddPatient} size="sm" className="gap-1.5 h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm hover:shadow-md transition-all px-3">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add patient
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="font-medium">Add new patient</p>
                    <p className="text-xs text-muted-foreground">Shortcut: N or ⌘⇧N</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        type="button"
                        onClick={() => setShowPrintModal(true)}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-9 rounded-lg text-xs font-medium border-border/60 hover:bg-secondary/60"
                        disabled={patients.length === 0}
                      >
                        <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                        Print
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {patients.length === 0 ? (
                      <p>Add at least 1 patient to print or export</p>
                    ) : (
                      <>
                        <p>Print / export patient summaries</p>
                        <p className="text-xs text-muted-foreground">Shortcut: ⌘P</p>
                      </>
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {patients.length > 0 ? (
                <div className="flex md:hidden flex-wrap items-center gap-2 px-3 py-1.5 bg-secondary/40 rounded-lg text-xs border border-border/30">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                  <span className="font-semibold text-foreground">{patients.length} total</span>
                  <span className="text-muted-foreground/60" aria-hidden="true">·</span>
                  <span className="text-foreground/80">{activePatientsCount} active</span>
                  <span className="text-muted-foreground/60" aria-hidden="true">·</span>
                  <span className="text-foreground/80">{inactivePatientsCount} inactive</span>
                  <span className="text-muted-foreground/60" aria-hidden="true">·</span>
                  <span className="text-foreground/80">{outstandingTodosCount} open tasks</span>
                  <span className="text-muted-foreground/60" aria-hidden="true">·</span>
                  <span className="text-foreground/80">Synced {lastSavedRelative}</span>
                  <span className="text-muted-foreground/60" aria-hidden="true">·</span>
                  <Clock className="h-3 w-3 text-foreground/70" aria-hidden="true" />
                  <span className="text-foreground/80">{todayLabel}</span>
                </div>
              ) : (
                <div className="hidden sm:block" />
              )}

              <div className="flex items-center gap-1.5">
                <OfflineIndicator />

                <div className="hidden min-[1100px]:flex items-center gap-2">
                  <TrustIndicators />
                  <PresenceIndicator />
                  <span className="text-xs text-muted-foreground truncate max-w-[140px] hidden sm:block" title={user?.email ?? ""}>{user?.email ?? ""}</span>
                  <KeyboardShortcutHelp open={isShortcutHelpOpen} onOpenChange={setShortcutHelpOpen} />
                  <TogglePanelsButton />
                  <ThemeToggle />
                  <Button type="button" onClick={onSignOut} variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10" aria-label="Sign out">
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>

                <div className="flex min-[1100px]:hidden items-center gap-1.5">
                  <PresenceIndicator />
                  <ThemeToggle />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg border-border/60"
                        aria-label="Workspace settings"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-lg">
                      <DropdownMenuLabel className="truncate" title={user?.email ?? ""}>
                        {user?.email ?? ""}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleTogglePanels}>
                        {focusModeActive || (panelLeftCollapsed && panelRightCollapsed)
                          ? "Show patient list"
                          : "Collapse panels"}
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href="#desktop-patient-search">Jump to search</a>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive">
                        Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      <div ref={dashUtilRef} style={{ opacity: 0 }} className="container mx-auto px-4 md:px-6 lg:px-8 pt-1.5 pb-1.5 no-print relative z-20">
        {profileCoaching.showBanner ? (
          <ProfileCoachingBanner message={profileCoaching.message} className="mb-3" />
        ) : null}
        <DesktopUtilityPanel
          patients={patients}
          autotexts={autotexts}
          templates={templates}
          customDictionary={customDictionary}
          todosMap={todosMap}
          todosAlwaysVisible={todosAlwaysVisible}
          globalFontSize={globalFontSize}
          setTodosAlwaysVisible={setTodosAlwaysVisible}
          setGlobalFontSize={setGlobalFontSize}
          patientRosterLayoutMode={patientRosterLayoutMode}
          onPatientRosterLayoutModeChange={setPatientRosterLayoutMode}
          editorToolbarMode={editorToolbarMode}
          setEditorToolbarMode={setEditorToolbarMode}
          ctEnabled={ctEnabled}
          ctColor={ctColor}
          ctStyles={ctStyles}
          ctToggleEnabled={ctToggleEnabled}
          ctSetColor={ctSetColor}
          ctToggleStyle={ctToggleStyle}
          onAddPatientWithData={onAddPatientWithData}
          onImportPatients={onImportPatients}
          onUpdatePatient={onUpdatePatient}
          onAddAutotext={onAddAutotext}
          onRemoveAutotext={onRemoveAutotext}
          onAddTemplate={onAddTemplate}
          onRemoveTemplate={onRemoveTemplate}
          onImportDictionary={onImportDictionary}
          onOpenPhraseManager={() => setShowPhraseManager(true)}
          onOpenAICommandPalette={() => setAICommandPaletteOpen(true)}
          openToolsRequestToken={openToolsRequestToken}
        />
      </div>

      <div ref={dashListRef} style={{ opacity: 0 }} className="h-[calc(100vh-10rem)] w-full no-print pb-4">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 h-full">
          {patients.length === 0 ? (
            <div className="flex flex-col h-full bg-background relative z-10 border-y border-border/25">
              <div className="p-3 md:p-4 pb-0">
                <span className="font-medium text-foreground/80 min-w-0 text-xs leading-snug">
                  No patients on your roster yet
                </span>
              </div>
              <ScrollArea className="flex-1 px-4 md:px-6 py-4">
                {renderRecoveryState()}
              </ScrollArea>
            </div>
          ) : (
            <div className="flex h-full bg-background relative z-10 border-y border-border/25">
              {!panelLeftCollapsed ? (
                <PatientRosterRail
                  searchInputRef={searchInputRef}
                  onOpenCompare={() => setShowComparisonModal(true)}
                  onRequestClearAll={handleClearAll}
                  onOpenSyncHistory={() => setShowSyncHistory(true)}
                  syncingList={syncingList}
                  onSyncNow={handleSyncNow}
                />
              ) : (
                <div className="flex w-11 flex-none flex-col items-center border-r border-border/25 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground"
                    onClick={() => setLeftPanelCollapsed(false)}
                    aria-label={focusModeActive ? "Show patient list" : "Expand patient list"}
                    title={focusModeActive ? "Show patient list" : "Expand patient list"}
                    aria-expanded={false}
                  >
                    <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}
              {filteredPatients.length === 0 ? (
                <ScrollArea className="flex-1 px-4 md:px-6 py-4">
                  {renderRecoveryState()}
                </ScrollArea>
              ) : (
                <PatientWorkspace onOpenAIPalette={() => setAICommandPaletteOpen(true)} />
              )}
            </div>
          )}
        </div>
      </div>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setAICommandPaletteOpen(true)}
              className="fixed bottom-32 right-6 z-50 h-13 w-13 rounded-xl shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-xl hover:scale-105 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 transition-all duration-200 motion-reduce:transition-shadow border border-primary/40 p-3 max-md:bottom-32 md:bottom-32 lg:bottom-6"
              aria-label="Open AI command palette — organization-managed provider"
              title="AI workspace — organization managed"
              style={{ height: "3.25rem", width: "3.25rem" }}
            >
              <Sparkles className="h-5 w-5 drop-shadow" aria-hidden />
              <Badge
                variant="secondary"
                aria-hidden
                title={activeAiModelLabel}
                className="pointer-events-none absolute -bottom-1 -right-1 max-w-[5rem] truncate border border-white/40 bg-background/95 px-1 py-0 text-[11px] font-medium leading-tight text-foreground shadow-md backdrop-blur-sm"
              >
                Managed
              </Badge>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[240px]">
            <p className="font-medium">AI workspace</p>
            <p className="text-xs text-muted-foreground mt-1">
              Drafting, analysis, and utilities use your organization&apos;s configured AI providers.
            </p>
            <p className="text-xs text-muted-foreground mt-1">Shortcut: ⌘⇧A</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <React.Suspense fallback={null}>
        <PrintExportModal
          open={showPrintModal}
          onOpenChange={setShowPrintModal}
          patients={filteredPatients}
          patientTodos={todosMap}
          onUpdatePatient={onUpdatePatient}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <MultiPatientComparison
          open={showComparisonModal}
          onOpenChange={setShowComparisonModal}
          patients={filteredPatients}
          todosMap={todosMap}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <PhraseManager open={showPhraseManager} onOpenChange={setShowPhraseManager} />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <AICommandPalette
          open={isAICommandPaletteOpen}
          onOpenChange={setAICommandPaletteOpen}
          patient={aiContextPatient}
        />
      </React.Suspense>

      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Patients</AlertDialogTitle>
            <AlertDialogDescription>
              {patients.length > 0
                ? `Remove all ${patients.length} patients from today's rounds?`
                : "Remove all patients from today's rounds?"}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SyncHistoryPanel
        open={showSyncHistory}
        onOpenChange={setShowSyncHistory}
        onRetry={(dataSource) => {
          if (dataSource === "patients" || dataSource === "supabase") {
            handleSyncNow();
          }
        }}
        isRetrying={syncingList}
      />
    </div>
  );
};

interface DesktopUtilityPanelProps {
  patients: ReturnType<typeof useDashboard>["patients"];
  autotexts: ReturnType<typeof useDashboard>["autotexts"];
  templates: ReturnType<typeof useDashboard>["templates"];
  customDictionary: ReturnType<typeof useDashboard>["customDictionary"];
  todosMap: TodosMap;
  todosAlwaysVisible: boolean;
  globalFontSize: number;
  setTodosAlwaysVisible: (visible: boolean) => void;
  setGlobalFontSize: (size: number) => void;
  patientRosterLayoutMode: "sidebar" | "topbar";
  onPatientRosterLayoutModeChange: (mode: "sidebar" | "topbar") => void;
  editorToolbarMode: 'minimal' | 'full' | 'custom';
  setEditorToolbarMode: (mode: 'minimal' | 'full' | 'custom') => void;
  ctEnabled: boolean;
  ctColor: string;
  ctStyles: ChangeTrackingStyles;
  ctToggleEnabled: () => void;
  ctSetColor: (color: string) => void;
  ctToggleStyle: (style: keyof ChangeTrackingStyles) => void;
  onAddPatientWithData: ReturnType<typeof useDashboard>["onAddPatientWithData"];
  onImportPatients: ReturnType<typeof useDashboard>["onImportPatients"];
  onUpdatePatient: ReturnType<typeof useDashboard>["onUpdatePatient"];
  onAddAutotext: ReturnType<typeof useDashboard>["onAddAutotext"];
  onRemoveAutotext: ReturnType<typeof useDashboard>["onRemoveAutotext"];
  onAddTemplate: ReturnType<typeof useDashboard>["onAddTemplate"];
  onRemoveTemplate: ReturnType<typeof useDashboard>["onRemoveTemplate"];
  onImportDictionary: ReturnType<typeof useDashboard>["onImportDictionary"];
  onOpenPhraseManager: () => void;
  onOpenAICommandPalette: () => void;
  openToolsRequestToken: number;
}

const DesktopUtilityPanel: React.FC<DesktopUtilityPanelProps> = ({
  patients,
  autotexts,
  templates,
  customDictionary,
  todosMap,
  todosAlwaysVisible,
  globalFontSize,
  setTodosAlwaysVisible,
  setGlobalFontSize,
  patientRosterLayoutMode,
  onPatientRosterLayoutModeChange,
  editorToolbarMode,
  setEditorToolbarMode,
  ctEnabled,
  ctColor,
  ctStyles,
  ctToggleEnabled,
  ctSetColor,
  ctToggleStyle,
  onAddPatientWithData,
  onImportPatients,
  onUpdatePatient,
  onAddAutotext,
  onRemoveAutotext,
  onAddTemplate,
  onRemoveTemplate,
  onImportDictionary,
  onOpenPhraseManager,
  onOpenAICommandPalette,
  openToolsRequestToken,
}) => {
  const MENU_OPEN_STORAGE_KEY = "rr-desktop-utility-menu-open";

  const [menuOpen, setMenuOpenState] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return safeLocalStorage.getItem(MENU_OPEN_STORAGE_KEY) === "1";
  });
  const setMenuOpen = React.useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setMenuOpenState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      safeLocalStorage.setItem(MENU_OPEN_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const [activeTab, setActiveTab] = React.useState<UtilityPanel>("resources");
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const shouldIgnorePanelClickOutside = (event: MouseEvent): boolean => {
      // Nested imports open Radix Dialog in a portal (outside panelRef). Closing the menu here
      // unmounts EpicHandoffImport / SmartPatientImport and kills the dialog mid-flow.
      if (
        document.querySelector(
          '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
        )
      ) {
        return true;
      }
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      for (const n of path) {
        if (n instanceof Element && n.hasAttribute("data-radix-popper-content-wrapper")) {
          return true;
        }
      }
      return false;
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (shouldIgnorePanelClickOutside(event)) return;
      setMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [setMenuOpen]);

  React.useEffect(() => {
    if (openToolsRequestToken === 0) return;
    setMenuOpen(true);
    setActiveTab("tools");
  }, [openToolsRequestToken, setMenuOpen]);

  const handleCsvImport = React.useCallback(async (records: Record<string, string>[]) => {
    await onImportPatients(records.map(organizeCsvImportRecord));
  }, [onImportPatients]);

  return (
    <div
      ref={panelRef}
      className={cn(
        "relative overflow-hidden transition-[box-shadow,background-color,border-color] duration-200",
        menuOpen
          ? "rounded-lg border border-border/35 bg-card/80 backdrop-blur-sm shadow-card"
          : "rounded-md border border-transparent bg-transparent shadow-none",
      )}
    >
      <div className={cn("flex items-center", menuOpen ? "p-2" : "p-0")}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`gap-2 rounded-md h-8 px-2.5 text-xs font-medium transition-all ${menuOpen ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          aria-label={menuOpen ? "Close workspace tools" : "Open workspace tools"}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Tools
          <ChevronDown className={`h-3 w-3 opacity-60 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {menuOpen && (
        <div className="border-t border-border/40 bg-background p-3 shadow-modal rounded-b-lg">
          {/* Segments are plain buttons so IBCC/Guidelines can stay a single nested Tabs without roving-focus conflicts */}
          <div
            role="tablist"
            aria-label="Menu sections"
            className="mb-3 w-full grid grid-cols-3 gap-1 rounded-lg bg-secondary/60 p-1"
          >
            {([
              { id: "resources" as const, label: "Resources" },
              { id: "tools" as const, label: "Tools" },
              { id: "settings" as const, label: "Settings" },
            ]).map(({ id, label }) => {
              const isSelected = activeTab === id;
              if (isSelected) {
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected="true"
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "bg-primary text-primary-foreground shadow-sm",
                    )}
                  >
                    {label}
                  </button>
                );
              }

              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected="false"
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "text-muted-foreground hover:text-foreground hover:bg-background/80",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {activeTab === "resources" && (
            <div role="tabpanel" className="m-0 mt-0">
              <Tabs defaultValue="ibcc" className="w-full">
                <TabsList className="mb-3">
                  <TabsTrigger value="ibcc">IBCC</TabsTrigger>
                  <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
                </TabsList>
                <TabsContent value="ibcc" className="m-0">
                  <div className="h-72 overflow-hidden rounded-md border border-border/30">
                    <IBCCPanel />
                  </div>
                </TabsContent>
                <TabsContent value="guidelines" className="m-0">
                  <div className="h-72 overflow-hidden rounded-md border border-border/30">
                    <GuidelinesPanel />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {activeTab === "tools" && (
            <div role="tabpanel" className="m-0 mt-0">
              <div className="space-y-2">
                <Collapsible defaultOpen className="rounded-md border border-border/30 bg-card/40 animate-[stagger-fade-up_0.3s_ease-out_forwards]" style={{ animationDelay: '0ms', opacity: 0 }}>
                  <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span>Import & AI</span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 px-3 pb-3 pt-0">
                    <SmartPatientImport onImportPatient={onAddPatientWithData} />
                    <EpicHandoffImport existingBeds={patients.map((p) => p.bed)} onImportPatients={onImportPatients} />
                    <CSVColumnMapper onImportPatients={handleCsvImport} />
                    <Button onClick={onOpenAICommandPalette} className="w-full justify-start gap-2 bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20">
                      <Sparkles className="h-4 w-4" /> AI Assistant <span className="ml-auto text-xs opacity-60">⌘⇧A</span>
                    </Button>
                    <TimelineDialog />
                    <ClinicalRiskCalculator />
                  </CollapsibleContent>
                </Collapsible>
                <Collapsible className="rounded-md border border-border/30 bg-card/40 animate-[stagger-fade-up_0.3s_ease-out_forwards]" style={{ animationDelay: '100ms', opacity: 0 }}>
                  <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span>Analytics & batch</span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 px-3 pb-3 pt-0">
                    <UnitCensusDashboard patients={patients} />
                    <ContextAwareHelp />
                    <BatchCourseGenerator patients={patients} todosMap={todosMap} />
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div role="tabpanel" className="m-0 mt-0">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-md border border-border/40 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Display</p>
                  <Button
                    variant={todosAlwaysVisible ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTodosAlwaysVisible(!todosAlwaysVisible)}
                    className="w-full gap-1.5"
                  >
                    <ListTodo className="h-3.5 w-3.5" /> Todos Always Visible
                  </Button>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Patient list view</p>
                    <select
                      value={patientRosterLayoutMode}
                      onChange={(e) => onPatientRosterLayoutModeChange(e.target.value as "sidebar" | "topbar")}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      aria-label="Patient list view mode"
                      title="Sidebar keeps a compact roster beside the chart; top bar uses a wide roster above"
                    >
                      <option value="sidebar">Sidebar (compact)</option>
                      <option value="topbar">Top bar (wide)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Font size</span>
                      <span>{globalFontSize}px</span>
                    </div>
                    <Slider
                      min={MIN_GLOBAL_FONT_SIZE_PX}
                      max={MAX_GLOBAL_FONT_SIZE_PX}
                      step={1}
                      value={[globalFontSize]}
                      onValueChange={(value) => setGlobalFontSize(value[0])}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Text box toolbar</p>
                    <select
                      value={editorToolbarMode}
                      onChange={(e) => setEditorToolbarMode(e.target.value as 'minimal' | 'full' | 'custom')}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      aria-label="Toolbar style for all text boxes"
                    >
                      <option value="minimal">Minimal (essential + More)</option>
                      <option value="full">Full</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>
                <div className="rounded-md border border-border/40 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Workflow</p>
                  <DesktopSpecialtySelector />
                  <DesktopAIModelSettingsDialog />
                  <ChangeTrackingControls
                    enabled={ctEnabled}
                    color={ctColor}
                    styles={ctStyles}
                    onToggleEnabled={ctToggleEnabled}
                    onColorChange={ctSetColor}
                    onToggleStyle={ctToggleStyle}
                  />
                </div>
                <div className="rounded-md border border-border/40 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Authoring</p>
                  <AutotextManager
                    autotexts={autotexts}
                    templates={templates}
                    customDictionary={customDictionary}
                    onAddAutotext={onAddAutotext}
                    onRemoveAutotext={onRemoveAutotext}
                    onAddTemplate={onAddTemplate}
                    onRemoveTemplate={onRemoveTemplate}
                    onImportDictionary={onImportDictionary}
                  />
                  <Button onClick={onOpenPhraseManager} variant="outline" size="sm" className="w-full gap-1.5" title="Reusable clinical phrases for quick insertion" aria-label="Manage Phrases">
                    <FileText className="h-3.5 w-3.5" /> Manage Phrases
                  </Button>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <ObservabilitySupportCard variant="desktop" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
