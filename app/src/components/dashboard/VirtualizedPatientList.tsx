import * as React from "react";
import { PatientCard } from "@/components/PatientCard";
import { PatientTodos } from "@/components/PatientTodos";
import type { Patient } from "@/types/patient";
import { useDashboard } from "@/contexts/DashboardContext";
import { useDashboardTodos } from "@/contexts/DashboardTodosContext";
import { usePatientTodos } from "@/hooks/usePatientTodos";
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
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useDashboardLayout } from "@/context/DashboardLayoutContext";
import { toLayoutMode, toPrefsMode } from "@/lib/dashboardLayoutModes";
import { getPatientDocumentationSummary, DOCUMENTATION_STATUS_LABELS } from "@/lib/patientDocumentation";
import { patientSafetyLabel } from "@/lib/patientIdentity";
import { Hospital, ListTodo, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ChevronLeft, ChevronRight, CheckCircle2, Circle, CloudOff, Loader2, AlertCircle, AlertTriangle, Cloud } from "lucide-react";

/**
 * Desktop workspace: left = selectable list, right = full card for the selected patient.
 *
 * Note: We intentionally avoid window virtualization; cards are rich and heights vary.
 */
export const VirtualizedPatientList = React.memo(() => {
  const {
    filteredPatients: patients,
    autotexts,
    onUpdatePatient,
    onRemovePatient,
    onDuplicatePatient,
    onToggleCollapse,
    desktopSelectedPatientId,
    setDesktopSelectedPatientId,
    patientListViewMode,
    patientSaveStates = {},
  } = useDashboard();
  const todosMap = useDashboardTodos();

  const {
    panelLeftCollapsed,
    panelRightCollapsed,
    focusModeActive,
    focusModeEditorId,
    enterFocusMode,
    exitFocusMode,
    setLeftPanelCollapsed,
    setRightPanelCollapsed,
    systemsLayoutMode,
    customSystemsGroupIds,
    setSystemsLayoutMode,
    setCustomSystemsGroup,
    patientRosterLayoutMode,
  } = useDashboardLayout();

  const [pendingRemoveId, setPendingRemoveId] = React.useState<string | null>(null);
  const [pendingDuplicateId, setPendingDuplicateId] = React.useState<string | null>(null);
  const removeTriggerRef = React.useRef<HTMLElement | null>(null);
  const duplicateTriggerRef = React.useRef<HTMLElement | null>(null);

  const handleRemoveRequest = React.useCallback((id: string) => {
    removeTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setPendingRemoveId(id);
  }, []);

  const handleConfirmRemove = React.useCallback(() => {
    if (pendingRemoveId) {
      onRemovePatient(pendingRemoveId);
      setPendingRemoveId(null);
    }
  }, [pendingRemoveId, onRemovePatient]);

  const handleCancelRemove = React.useCallback(() => {
    setPendingRemoveId(null);
  }, []);

  const handleDuplicateRequest = React.useCallback((id: string) => {
    duplicateTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setPendingDuplicateId(id);
  }, []);

  const handleConfirmDuplicate = React.useCallback(() => {
    if (pendingDuplicateId) {
      onDuplicatePatient(pendingDuplicateId);
      setPendingDuplicateId(null);
    }
  }, [pendingDuplicateId, onDuplicatePatient]);

  const handleCancelDuplicate = React.useCallback(() => {
    setPendingDuplicateId(null);
  }, []);

  const pendingPatient = React.useMemo(
    () => patients.find((p) => p.id === pendingRemoveId),
    [patients, pendingRemoveId],
  );

  const pendingDuplicatePatient = React.useMemo(
    () => patients.find((p) => p.id === pendingDuplicateId),
    [patients, pendingDuplicateId],
  );

  const selectedPatient = React.useMemo((): Patient | null => {
    if (patients.length === 0) return null;
    if (desktopSelectedPatientId) {
      const found = patients.find((p) => p.id === desktopSelectedPatientId);
      if (found) return found;
    }
    return patients[0];
  }, [patients, desktopSelectedPatientId]);

  const getOpenTodoCount = React.useCallback(
    (patientId: string) => (todosMap[patientId] ?? []).filter((todo) => !todo.completed).length,
    [todosMap],
  );

  const selectedOpenTodoCount = selectedPatient ? getOpenTodoCount(selectedPatient.id) : 0;
  const selectedDocumentation = React.useMemo(
    () => selectedPatient ? getPatientDocumentationSummary(selectedPatient) : null,
    [selectedPatient],
  );
  const selectedIndex = selectedPatient ? patients.findIndex((patient) => patient.id === selectedPatient.id) : -1;
  const saveState = selectedPatient ? (patientSaveStates[selectedPatient.id] ?? "idle") : "idle";

  const selectRelativePatient = React.useCallback((direction: -1 | 1) => {
    if (selectedIndex < 0) return;
    const nextIndex = selectedIndex + direction;
    if (nextIndex < 0 || nextIndex >= patients.length) return;
    setDesktopSelectedPatientId(patients[nextIndex].id);
  }, [patients, selectedIndex, setDesktopSelectedPatientId]);

  const jumpToSection = React.useCallback((sectionId: string) => {
    if (sectionId === "results" || sectionId === "medications") {
      window.dispatchEvent(new Event("rr:reveal-advanced-documentation"));
    }
    const delay = sectionId === "results" || sectionId === "medications" ? 120 : 0;
    window.setTimeout(() => {
      const section =
        document.querySelector<HTMLElement>(`#documentation-section-${sectionId}`) ??
        document.querySelector<HTMLElement>(`[data-documentation-section="${sectionId}"]`);
      if (!section) return;
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      section
        .querySelector<HTMLElement>("[contenteditable='true'], textarea, input, button")
        ?.focus({ preventScroll: true });
    }, delay);
  }, []);

  const sharedPatientTodos = usePatientTodos(selectedPatient?.id ?? null, {
    initialTodos: selectedPatient ? (todosMap[selectedPatient.id] ?? []) : undefined,
  });

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center rounded-lg bg-secondary/20" role="status">
        <div className="w-16 h-16 rounded-lg bg-card border border-border/40 flex items-center justify-center mb-5 shadow-sm">
          <Hospital className="h-7 w-7 text-primary" aria-hidden="true" />
        </div>
        <h3 className="text-xl font-semibold mb-2 text-foreground tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
          Ready to Start Rounds
        </h3>
        <p className="text-muted-foreground text-base max-w-sm leading-relaxed">
          No patients on your roster yet. Use Add Patient or Import Patient List to build today&apos;s census.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full h-full min-h-0 flex flex-col lg:flex-row gap-4 overflow-hidden">
        {patientRosterLayoutMode === "sidebar" && !focusModeActive && (
          !panelLeftCollapsed ? (
            <aside
              className="flex-shrink-0 w-full lg:w-[min(100%,280px)] lg:max-w-[320px] border border-border/30 rounded-lg bg-card/60 flex flex-col min-h-[260px] max-h-[60vh] lg:h-full lg:min-h-0 lg:max-h-none"
              aria-label="Patient list"
              role="region"
              aria-labelledby="desktop-patient-list-heading"
            >
              <div className="px-3 py-2 border-b border-border/20 text-xs font-medium text-muted-foreground flex items-center justify-between gap-2">
                <h2 id="desktop-patient-list-heading" className="truncate">Patients ({patients.length})</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground"
                  onClick={() => setLeftPanelCollapsed(true)}
                  aria-label="Collapse patient list"
                  title="Collapse patient list"
                  aria-expanded
                  aria-controls="desktop-patient-list-content"
                >
                  <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <ScrollArea className="flex-1 min-h-0" id="desktop-patient-list-content">
                <ul className="p-2 space-y-1">
                  {patients.map((patient) => {
                    const isActive = selectedPatient?.id === patient.id;
                    const openTodoCount = getOpenTodoCount(patient.id);
                    const locationLabel = patient.bed?.trim() || "Unassigned";
                    const secondaryLabel = patient.mrn?.trim() ? `MRN ${patient.mrn.trim()}` : "No MRN";
                    const documentation = getPatientDocumentationSummary(patient);
                    return (
                      <li key={patient.id}>
                        <button
                          type="button"
                          onClick={() => setDesktopSelectedPatientId(patient.id)}
                          aria-current={isActive ? "true" : undefined}
                          aria-label={`Select ${patient.name || "unnamed patient"}, ${locationLabel}${openTodoCount > 0 ? `, ${openTodoCount} open tasks` : ""}`}
                          className={cn(
                            "w-full text-left rounded-lg transition-colors flex items-start gap-2 border border-l-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            patientListViewMode === "compact" ? "px-2.5 py-2" : "px-3 py-2.5",
                            isActive
                              ? "bg-primary/12 border-primary/35 shadow-sm border-l-primary/70"
                              : "border-transparent border-l-transparent hover:bg-secondary/70 hover:border-border/30 hover:border-l-primary/35",
                          )}
                        >
                          <div className={cn(
                            "rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/15 font-semibold text-primary",
                            patientListViewMode === "compact" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm",
                          )}>
                            {locationLabel.slice(0, 3).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary truncate">
                              {locationLabel}
                            </p>
                            <p className={cn(
                              "font-medium truncate text-foreground leading-tight",
                              patientListViewMode === "compact" ? "text-xs" : "text-sm",
                            )}>
                              {patient.name || "Unnamed"}
                            </p>
                            <p className={cn(
                              "text-muted-foreground truncate font-mono",
                              patientListViewMode === "compact" ? "text-[11px] mt-0" : "text-xs mt-0.5",
                            )}>
                              {secondaryLabel}
                            </p>
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span>{DOCUMENTATION_STATUS_LABELS[documentation.status]}</span>
                              <span aria-hidden="true">·</span>
                              <span>{documentation.completed}/{documentation.total} sections</span>
                            </div>
                          </div>
                          {openTodoCount > 0 ? (
                            <span className="mt-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
                              {openTodoCount}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            </aside>
          ) : (
            <div className="flex flex-col shrink-0 w-11 border border-border/30 rounded-lg bg-card/60 items-center py-2">
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
          )
        )}

        <div className={cn("flex-1 min-w-0 min-h-0 flex flex-col", focusModeActive ? "px-1" : "pr-1")}>
          {patientRosterLayoutMode === "topbar" && !focusModeActive && (
            <div className="mb-3">
              {panelLeftCollapsed ? (
                <div className="flex items-center justify-start">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2 h-8 px-3"
                    onClick={() => setLeftPanelCollapsed(false)}
                    aria-label="Expand patient roster"
                    title="Expand patient roster"
                  >
                    <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                    Roster
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 border border-border/30 rounded-lg bg-card/60">
                  <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
                    Patients
                  </span>
                  <div className="flex-1 min-w-0 overflow-x-auto scrollbar-thin">
                    <div className="flex items-center gap-2">
                      {patients.map((patient) => {
                        const isActive = selectedPatient?.id === patient.id;
                        const openTodoCount = getOpenTodoCount(patient.id);
                        const locationLabel = patient.bed?.trim() || "Unassigned";
                        return (
                          <button
                            key={patient.id}
                            type="button"
                            onClick={() => setDesktopSelectedPatientId(patient.id)}
                            className={cn(
                              "flex min-h-11 items-center gap-2 rounded-lg border transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              patientListViewMode === "compact" ? "px-2 py-1" : "px-2.5 py-1.5",
                              isActive
                                ? "bg-primary/12 border-primary/35 shadow-sm"
                                : "border-transparent hover:bg-secondary/70",
                            )}
                            aria-current={isActive ? "true" : undefined}
                            aria-label={`Select patient ${patient.name || patient.bed || patient.id}`}
                            title={patient.name || patient.bed || "Patient"}
                          >
                            <div className={cn(
                              "rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/15 text-xs font-semibold text-primary",
                              patientListViewMode === "compact" ? "h-5 w-5" : "h-6 w-6",
                            )}>
                              {patient.name ? patient.name.charAt(0).toUpperCase() : "#"}
                            </div>
                            <span className={cn(
                              "font-medium truncate max-w-[10rem] text-foreground",
                              patientListViewMode === "compact" ? "text-[11px]" : "text-xs",
                            )}>
                              {locationLabel} · {patient.name || "Unnamed"}
                            </span>
                            {openTodoCount > 0 ? (
                              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
                                {openTodoCount}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11 h-11 w-11 shrink-0 text-muted-foreground"
                    onClick={() => setLeftPanelCollapsed(true)}
                    aria-label="Collapse patient roster"
                    title="Collapse patient roster"
                  >
                    <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {selectedPatient ? (
            <ScrollArea className="flex-1 min-h-0">
              <div className={cn("w-full pb-2", focusModeActive && "mx-auto max-w-[980px]")}>
                {!focusModeActive && selectedDocumentation && (
                  <div className="sticky top-0 z-20 mb-3 rounded-lg border border-border/40 bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85" aria-label="Patient documentation workspace header">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{selectedPatient.bed || "Unassigned"}</p>
                        <h2 className="truncate text-base font-semibold text-foreground">{selectedPatient.name || "Unnamed patient"}</h2>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="mr-2 flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
                          {saveState === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                          {saveState === "saved" && <Cloud className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                          {saveState === "queued" && <CloudOff className="h-3.5 w-3.5 text-warning" aria-hidden="true" />}
                          {saveState === "error" && <AlertCircle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />}
                          {saveState === "conflict" && <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />}
                          <span>{saveState === "idle" ? "Ready" : saveState === "queued" ? "Offline queued" : saveState === "conflict" ? "Review conflict" : saveState === "error" ? "Save failed" : saveState === "saving" ? "Saving" : "Saved"}</span>
                        </div>
                        <Button type="button" variant="outline" size="icon" className="min-h-11 min-w-11 h-11 w-11" onClick={() => selectRelativePatient(-1)} disabled={selectedIndex <= 0} aria-label="Previous patient">
                          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" className="min-h-11 min-w-11 h-11 w-11" onClick={() => selectRelativePatient(1)} disabled={selectedIndex < 0 || selectedIndex >= patients.length - 1} aria-label="Next patient">
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                    <nav className="mt-3 flex gap-1 overflow-x-auto border-t border-border/30 pt-2" aria-label="Documentation sections">
                      {selectedDocumentation.sections.map((section) => (
                        <button key={section.id} type="button" onClick={() => jumpToSection(section.id)} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          {section.complete ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5" aria-hidden="true" />}
                          {section.label}
                        </button>
                      ))}
                      <span className="ml-auto self-center whitespace-nowrap px-2 text-xs font-medium text-muted-foreground">{selectedDocumentation.percentage}% complete</span>
                    </nav>
                  </div>
                )}
                <PatientCard
                  key={selectedPatient.id}
                  patient={selectedPatient}
                  onUpdate={onUpdatePatient}
                  onRemove={handleRemoveRequest}
                  onDuplicate={handleDuplicateRequest}
                  onToggleCollapse={onToggleCollapse}
                  autotexts={autotexts}
                  sharedPatientTodos={sharedPatientTodos}
                  hidePatientWideTodos={panelRightCollapsed}
                  dashboardFocusModeEnabled={focusModeActive}
                  dashboardFocusTarget={focusModeEditorId}
                  onRequestDashboardFocusMode={enterFocusMode}
                  onExitDashboardFocusMode={exitFocusMode}
                  systemsReviewMode={toPrefsMode(systemsLayoutMode)}
                  systemsCustomCombineKeys={customSystemsGroupIds}
                  onSystemsReviewModeChange={(mode) => setSystemsLayoutMode(toLayoutMode(mode))}
                  onSystemsCustomCombineKeysChange={setCustomSystemsGroup}
                />
              </div>
            </ScrollArea>
          ) : null}
        </div>

        {!focusModeActive && (
          panelRightCollapsed ? (
            <div className="hidden lg:flex flex-col shrink-0 w-11 border border-border/30 rounded-lg bg-card/60 items-center py-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground"
                onClick={() => setRightPanelCollapsed(false)}
                aria-label="Expand tasks panel"
                title="Expand tasks panel"
              >
                <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <aside
              className="hidden lg:flex flex-shrink-0 flex-col w-[min(100%,280px)] max-w-[300px] border border-border/30 rounded-lg bg-card/60 h-full min-h-0"
              role="region"
              aria-labelledby="desktop-tasks-rail-heading"
            >
              <div className="px-3 py-2 border-b border-border/20 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ListTodo className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <h2 id="desktop-tasks-rail-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
                    {selectedPatient ? `Tasks · ${selectedPatient.bed || selectedPatient.name || "Selected patient"}` : "Tasks"}
                  </h2>
                  {selectedOpenTodoCount > 0 ? (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
                      {selectedOpenTodoCount}
                    </span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11 h-11 w-11 shrink-0 text-muted-foreground"
                  onClick={() => setRightPanelCollapsed(true)}
                  aria-label="Collapse tasks panel"
                  title="Collapse tasks panel"
                >
                  <PanelRightClose className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-3">
                  {selectedPatient ? (
                    <PatientTodos
                      todos={sharedPatientTodos.todos}
                      section={null}
                      patient={selectedPatient}
                      generating={sharedPatientTodos.generating}
                      onAddTodo={sharedPatientTodos.addTodo}
                      onToggleTodo={sharedPatientTodos.toggleTodo}
                      onDeleteTodo={sharedPatientTodos.deleteTodo}
                      onGenerateTodos={sharedPatientTodos.generateTodos}
                      alwaysVisible
                    />
                  ) : null}
                </div>
              </ScrollArea>
            </aside>
          )
        )}
      </div>

      <AlertDialog
        open={pendingRemoveId !== null}
        onOpenChange={(open) => {
          if (!open) handleCancelRemove();
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            removeTriggerRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Patient</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPatient
                ? `Remove ${patientSafetyLabel(pendingPatient)} from rounds?`
                : "Remove this patient from rounds?"}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDuplicateId !== null}
        onOpenChange={(open) => {
          if (!open) handleCancelDuplicate();
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            duplicateTriggerRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Patient</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDuplicatePatient
                ? `Create a new roster entry from ${patientSafetyLabel(pendingDuplicatePatient)}?`
                : "Create a new roster entry from this patient?"}{" "}
              Chart content is copied into the duplicate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDuplicate}>
              Duplicate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

VirtualizedPatientList.displayName = "VirtualizedPatientList";
