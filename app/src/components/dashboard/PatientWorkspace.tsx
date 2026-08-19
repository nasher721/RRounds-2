import * as React from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Cloud,
  CloudOff,
  History,
  Loader2,
  MoreHorizontal,
  PanelLeftOpen,
  Sparkles,
  User,
} from "lucide-react";
import { PatientCard } from "@/components/PatientCard";
import { QuickActionsPanel } from "@/components/QuickActionsPanel";
import { AppleAIAssistant } from "@/components/AppleAIAssistant";
import { FieldHistoryViewer } from "@/components/FieldHistoryViewer";
import { ActivityFeed } from "@/components/patient/ActivityFeed";
import { LengthOfStayBadge } from "@/components/LengthOfStayBadge";
import { OneClickSignOff } from "@/components/OneClickSignOff";
import { ShiftHandoff } from "@/components/ShiftHandoff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDashboard } from "@/contexts/DashboardContext";
import { useDashboardTodos } from "@/contexts/DashboardTodosContext";
import { useDashboardLayout } from "@/context/DashboardLayoutContext";
import { useTeam } from "@/contexts/TeamContext";
import { usePatientTodos } from "@/hooks/usePatientTodos";
import { usePatientActivity } from "@/hooks/usePatientActivity";
import { useSystemsConfig } from "@/hooks/useSystemsConfig";
import { toLayoutMode, toPrefsMode } from "@/lib/dashboardLayoutModes";
import {
  DOCUMENTATION_SECTIONS,
  DOCUMENTATION_STATUS_LABELS,
  getDocumentationSectionStatus,
  getSystemsDocumentationCount,
  type DocumentationSectionId,
  type DocumentationStatus,
} from "@/lib/patientDocumentation";
import type { Patient } from "@/types/patient";
import { resolveSequentialNavigationIndex } from "@/lib/listKeyboardNavigation";
import { cn } from "@/lib/utils";
import { patientSafetyLabel } from "@/lib/patientIdentity";

const STATUS_DOT_CLASS: Record<DocumentationStatus, string> = {
  ready: "rr-st-ready",
  "in-progress": "rr-st-prog",
  "not-started": "rr-st-todo",
};

const TAB_LABELS: Record<DocumentationSectionId, string> = {
  summary: "Summary",
  events: "Events",
  systems: "Systems",
  results: "Labs & Imaging",
  medications: "Medications",
};

const CODE_STATUS_LABELS: Record<string, string> = {
  full: "Full code",
  dnr: "DNR",
  dni: "DNI",
  comfort: "Comfort",
};

const ACUITY_BADGE_CLASS: Record<string, string> = {
  low: "rr-badge-green",
  moderate: "rr-badge-orange",
  high: "rr-badge-orange",
  critical: "rr-badge-red",
};

export interface PatientWorkspaceProps {
  /** Opens the AI command palette (owned by DesktopDashboard). */
  onOpenAIPalette: () => void;
}

/**
 * Focused chart workspace (mockup artboard A): patient header with quiet
 * editable identity fields + badges + actions, a 5-tab documentation navigator
 * with status dots, the selected PatientCard in "workspace" chrome as the
 * scrollable body, and a pinned sign-off readiness bar.
 */
export const PatientWorkspace = ({ onOpenAIPalette }: PatientWorkspaceProps) => {
  const {
    patients,
    filteredPatients,
    autotexts,
    onUpdatePatient,
    onRemovePatient,
    onDuplicatePatient,
    onToggleCollapse,
    desktopSelectedPatientId,
    patientSaveStates = {},
    lastSaved,
  } = useDashboard();
  const todosMap = useDashboardTodos();
  const {
    focusModeActive,
    focusModeEditorId,
    enterFocusMode,
    exitFocusMode,
    setLeftPanelCollapsed,
    systemsLayoutMode,
    customSystemsGroupIds,
    setSystemsLayoutMode,
    setCustomSystemsGroup,
  } = useDashboardLayout();
  const { teamMembers } = useTeam();
  const { enabledSystems } = useSystemsConfig();

  const systemKeys = React.useMemo(() => enabledSystems.map((s) => s.key), [enabledSystems]);

  const patient = React.useMemo((): Patient | null => {
    if (filteredPatients.length === 0) return null;
    if (desktopSelectedPatientId) {
      const found = filteredPatients.find((p) => p.id === desktopSelectedPatientId);
      if (found) return found;
    }
    return filteredPatients[0];
  }, [filteredPatients, desktopSelectedPatientId]);

  const [pendingRemove, setPendingRemove] = React.useState(false);
  const [pendingDuplicate, setPendingDuplicate] = React.useState(false);
  const removeTriggerRef = React.useRef<HTMLElement | null>(null);
  const duplicateTriggerRef = React.useRef<HTMLElement | null>(null);
  const chartBodyRef = React.useRef<HTMLDivElement | null>(null);
  const [signOffOpen, setSignOffOpen] = React.useState(false);
  const [handoffOpen, setHandoffOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<DocumentationSectionId>("summary");
  const [isSwitchingPatient, setIsSwitchingPatient] = React.useState(false);
  const previousPatientIdRef = React.useRef<string | null>(null);

  const sharedPatientTodos = usePatientTodos(patient?.id ?? null, {
    initialTodos: patient ? (todosMap[patient.id] ?? []) : undefined,
  });

  const { addActivity } = usePatientActivity(patient?.id ?? "");

  React.useLayoutEffect(() => {
    const nextId = patient?.id ?? null;
    if (!nextId) {
      previousPatientIdRef.current = null;
      setIsSwitchingPatient(false);
      return;
    }
    if (previousPatientIdRef.current && previousPatientIdRef.current !== nextId) {
      setIsSwitchingPatient(true);
      setActiveTab("summary");
      if (chartBodyRef.current) chartBodyRef.current.scrollTop = 0;
      const timer = window.setTimeout(() => setIsSwitchingPatient(false), 160);
      previousPatientIdRef.current = nextId;
      return () => window.clearTimeout(timer);
    }
    previousPatientIdRef.current = nextId;
  }, [patient?.id]);

  React.useEffect(() => {
    const root = chartBodyRef.current;
    if (!root || isSwitchingPatient || !patient) return;

    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("[data-documentation-section]"),
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0];
        if (!top) return;
        const sectionId = top.target.getAttribute("data-documentation-section");
        if (
          sectionId === "summary" ||
          sectionId === "events" ||
          sectionId === "systems" ||
          sectionId === "results" ||
          sectionId === "medications"
        ) {
          setActiveTab(sectionId);
        }
      },
      {
        root,
        rootMargin: "-12% 0px -58% 0px",
        threshold: [0.15, 0.35, 0.55],
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [patient?.id, isSwitchingPatient, patient]);

  // Record sign-offs in the per-patient activity feed (uses the existing
  // 'updated' action since the DB CHECK constraint only allows a fixed set).
  const handleSignOff = React.useCallback(
    (_patientIds: string[], _signature: string) => {
      void addActivity("updated", {
        fieldName: "signoff",
        summary: "Chart signed off",
      });
    },
    [addActivity],
  );

  const handleRemoveRequest = React.useCallback(() => {
    removeTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPendingRemove(true);
  }, []);

  const handleConfirmRemove = React.useCallback(() => {
    if (patient) onRemovePatient(patient.id);
    setPendingRemove(false);
  }, [onRemovePatient, patient]);

  const handleDuplicateRequest = React.useCallback(() => {
    duplicateTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPendingDuplicate(true);
  }, []);

  const handleConfirmDuplicate = React.useCallback(() => {
    if (patient) onDuplicatePatient(patient.id);
    setPendingDuplicate(false);
  }, [onDuplicatePatient, patient]);

  const jumpToSection = React.useCallback((sectionId: DocumentationSectionId) => {
    setActiveTab(sectionId);
    if (sectionId === "results" || sectionId === "medications") {
      window.dispatchEvent(new Event("rr:reveal-advanced-documentation"));
    }
    const delay = sectionId === "results" || sectionId === "medications" ? 120 : 0;
    window.setTimeout(() => {
      const root = chartBodyRef.current;
      const section =
        root?.querySelector<HTMLElement>(`#documentation-section-${sectionId}`) ??
        root?.querySelector<HTMLElement>(`[data-documentation-section="${sectionId}"]`) ??
        document.querySelector<HTMLElement>(`#documentation-section-${sectionId}`) ??
        document.querySelector<HTMLElement>(`[data-documentation-section="${sectionId}"]`);
      if (!section) return;
      if (typeof section.scrollIntoView === "function") {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      section
        .querySelector<HTMLElement>("[contenteditable='true'], textarea, input, button")
        ?.focus({ preventScroll: true });
    }, delay);
  }, []);

  /** Live tab nodes, so arrow keys can move real focus across the strip. */
  const sectionTabRefs = React.useRef(new Map<DocumentationSectionId, HTMLButtonElement>());

  const registerSectionTab = React.useCallback(
    (sectionId: DocumentationSectionId, node: HTMLButtonElement | null) => {
      if (node) sectionTabRefs.current.set(sectionId, node);
      else sectionTabRefs.current.delete(sectionId);
    },
    [],
  );

  /**
   * Left/Right/Home/End move focus across the documentation tabs, matching the
   * roster rail's traversal on the other axis.
   *
   * Manual activation on purpose: activating a tab scrolls to the section and
   * focuses the first editable inside it, so activating on arrow would yank
   * focus out of the strip after one press. Enter and Space still activate
   * natively, which is what the pattern expects for a jump-to-section
   * navigator whose sections are all mounted in one scroll body.
   */
  const handleSectionTabKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const focusedId = event.currentTarget.getAttribute("data-documentation-tab");
      const currentIndex = DOCUMENTATION_SECTIONS.findIndex(
        (section) => section.id === focusedId,
      );
      const nextIndex = resolveSequentialNavigationIndex(
        event.key,
        currentIndex,
        DOCUMENTATION_SECTIONS.length,
        { orientation: "horizontal" },
      );
      if (nextIndex === null) return;
      event.preventDefault();
      const nextSection = DOCUMENTATION_SECTIONS[nextIndex];
      if (!nextSection) return;
      sectionTabRefs.current.get(nextSection.id)?.focus();
    },
    [],
  );

  const sectionStatuses = React.useMemo(() => {
    if (!patient) return null;
    return DOCUMENTATION_SECTIONS.map((section) => ({
      id: section.id,
      status: getDocumentationSectionStatus(patient, section.id, systemKeys),
    }));
  }, [patient, systemKeys]);

  const systemsCount = React.useMemo(
    () => (patient ? getSystemsDocumentationCount(patient, systemKeys) : { filled: 0, total: 0 }),
    [patient, systemKeys],
  );

  if (!patient || !sectionStatuses) return null;

  const readyCount = sectionStatuses.filter((s) => s.status === "ready").length;
  const incompleteSections = sectionStatuses.filter((s) => s.status !== "ready");
  const incompleteLabels = incompleteSections.map((s) => TAB_LABELS[s.id]).join(", ");
  const readinessSummary =
    incompleteSections.length === 0
      ? `All ${sectionStatuses.length} sections ready`
      : `${readyCount} of ${sectionStatuses.length} sections ready. Remaining: ${incompleteLabels}`;
  const saveState = patientSaveStates[patient.id] ?? "idle";
  const savedTime = lastSaved.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (isSwitchingPatient) {
    return (
      <section
        className="rr-ws flex min-w-0 flex-1 flex-col"
        style={{ background: "var(--rr-bg-ground)" }}
        aria-busy="true"
        aria-label={`Loading workspace: ${patient.name || "Unnamed patient"}`}
      >
        <header
          className="border-b px-5 py-3"
          style={{ borderColor: "var(--rr-sep)", background: "var(--rr-bg-primary)" }}
        >
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
            <div>
              <p className="text-[17px] font-semibold" style={{ color: "var(--rr-label-1)" }}>
                {patient.name || "Unnamed patient"}
              </p>
              <p className="text-sm" style={{ color: "var(--rr-label-2)" }}>
                Switching patient…
              </p>
            </div>
          </div>
        </header>
        <div className="space-y-3 px-5 py-4">
          <div className="h-10 animate-pulse rounded-lg" style={{ background: "var(--rr-f2)" }} />
          <div className="h-32 animate-pulse rounded-lg" style={{ background: "var(--rr-f1)" }} />
          <div className="h-32 animate-pulse rounded-lg" style={{ background: "var(--rr-f1)" }} />
        </div>
      </section>
    );
  }

  return (
    <section
      key={patient.id}
      className="rr-ws flex min-w-0 flex-1 flex-col"
      style={{ background: "var(--rr-bg-ground)" }}
      aria-label={`Workspace: ${patient.name || "Unnamed patient"}`}
    >
      {/* Patient header */}
      <header
        className="border-b px-5 pb-0 pt-2"
        style={{ borderColor: "var(--rr-sep)", background: "var(--rr-bg-primary)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={patient.name}
            onChange={(e) => onUpdatePatient(patient.id, "name", e.target.value)}
            aria-label="Patient name"
            placeholder="Patient name"
            className="min-h-11 h-11 w-[220px] rounded-[8px] border-transparent bg-transparent px-2 text-[17px] font-semibold shadow-none hover:bg-black/[0.03] focus-visible:bg-background focus-visible:ring-1"
            style={{ color: "var(--rr-label-1)" }}
          />
          <Input
            value={patient.bed}
            onChange={(e) => onUpdatePatient(patient.id, "bed", e.target.value)}
            aria-label="Bed or room number"
            placeholder="Bed / room"
            className="min-h-11 h-11 w-[104px] rounded-[6px] border-transparent px-2 text-xs font-medium shadow-none focus-visible:ring-1"
            style={{ background: "var(--rr-f2)", color: "var(--rr-label-1)" }}
          />
          <LengthOfStayBadge createdAt={patient.createdAt} />

          <div className="ml-auto flex flex-wrap items-center gap-1.5 no-print">
            {focusModeActive ? (
              <button
                type="button"
                className="rr-btn rr-btn-outline"
                onClick={() => setLeftPanelCollapsed(false)}
                aria-label="Show patient list"
                title="Show patient list (Esc)"
              >
                <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                Patients
              </button>
            ) : null}
            <QuickActionsPanel patient={patient} onUpdatePatient={onUpdatePatient} />
            <AppleAIAssistant patient={patient} onUpdatePatient={onUpdatePatient} compact />
            <button type="button" className="rr-btn rr-btn-outline" onClick={onOpenAIPalette}>
              AI
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rr-btn rr-btn-secondary"
                  aria-label="More patient tools"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  More
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-lg p-1.5">
                <DropdownMenuLabel className="text-xs">Chart tools</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <FieldHistoryViewer
                  patientId={patient.id}
                  patientName={patient.name}
                  trigger={
                    <DropdownMenuItem
                      className="cursor-pointer text-xs"
                      onSelect={(event) => event.preventDefault()}
                    >
                      <History className="mr-2 h-4 w-4" aria-hidden="true" />
                      History
                    </DropdownMenuItem>
                  }
                />
                <div className="px-1 py-1">
                  <ActivityFeed patientId={patient.id} patientName={patient.name} className="w-full justify-start" />
                </div>
                {teamMembers.length > 0 ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs">Assign to</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => onUpdatePatient(patient.id, "assignedTo", null)}
                      className="text-xs"
                    >
                      <User className="mr-2 h-4 w-4" aria-hidden="true" />
                      Unassigned
                    </DropdownMenuItem>
                    {teamMembers.map((member) => (
                      <DropdownMenuItem
                        key={member.id}
                        onClick={() => onUpdatePatient(patient.id, "assignedTo", member.id)}
                        className="cursor-pointer text-xs"
                      >
                        <span>{member.name}</span>
                        {patient.assignedTo === member.id && (
                          <span className="ml-auto text-primary">✓</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDuplicateRequest} className="text-xs">
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleRemoveRequest}
                  className="text-xs text-destructive focus:text-destructive"
                >
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              className="rr-btn rr-btn-primary"
              onClick={() => setSignOffOpen(true)}
            >
              Sign off
            </button>
          </div>
        </div>

        {/* Meta row */}
        <div
          className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-[18px]"
          style={{ color: "var(--rr-label-2)" }}
        >
          <Input
            value={patient.mrn ?? ""}
            onChange={(e) => onUpdatePatient(patient.id, "mrn", e.target.value)}
            aria-label="Medical record number"
            placeholder="MRN"
            className="min-h-11 h-11 w-[120px] rounded-[6px] border-transparent bg-transparent px-2 text-xs shadow-none hover:bg-black/[0.03] focus-visible:bg-background focus-visible:ring-1"
            style={{ color: "var(--rr-label-1)" }}
          />
          {patient.age !== undefined && (
            <>
              <span aria-hidden="true">·</span>
              <span>{patient.age} y/o</span>
            </>
          )}
          {patient.attendingPhysician && (
            <>
              <span aria-hidden="true">·</span>
              <span>Attending: {patient.attendingPhysician}</span>
            </>
          )}
          {patient.serviceLine && (
            <>
              <span aria-hidden="true">·</span>
              <span>{patient.serviceLine}</span>
            </>
          )}
        </div>

        {/* Badges */}
        {(patient.acuity || patient.codeStatus || (patient.alerts && patient.alerts.length > 0)) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {patient.acuity && (
              <span
                className={cn("rr-badge", ACUITY_BADGE_CLASS[patient.acuity] ?? "rr-badge-neutral")}
              >
                {patient.acuity.charAt(0).toUpperCase() + patient.acuity.slice(1)} acuity
              </span>
            )}
            {patient.codeStatus && (
              <span className="rr-badge rr-badge-neutral" title={`Code status: ${patient.codeStatus}`}>
                {CODE_STATUS_LABELS[patient.codeStatus] ?? patient.codeStatus}
              </span>
            )}
            {patient.alerts && patient.alerts.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="rr-badge rr-badge-red cursor-default">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {patient.alerts.length > 1 ? `${patient.alerts.length} alerts` : patient.alerts[0]}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold">Alerts</p>
                      <ul className="space-y-0.5 text-xs">
                        {patient.alerts.map((alert, idx) => (
                          <li key={`${patient.id}-ws-alert-${idx}`} className="flex items-start gap-1">
                            <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-destructive" />
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

        {/* Documentation tabs */}
        <nav className="mt-3 flex items-center gap-1 overflow-x-auto" aria-label="Documentation sections">
          <p className="sr-only">
            Status colors: green means ready, amber means in progress, gray means not started. Use
            the left and right arrow keys to move between sections, then Enter to jump to the
            selected section.
          </p>
          <div
            className="mr-1 hidden items-center gap-2 text-[11px] xl:flex"
            style={{ color: "var(--rr-label-2)" }}
            aria-hidden="true"
          >
            <span className="inline-flex items-center gap-1">
              <span className="rr-dot rr-st-ready" /> Ready
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="rr-dot rr-st-prog" /> In progress
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="rr-dot rr-st-todo" /> Not started
            </span>
          </div>
          {sectionStatuses.map(({ id, status }) => {
            const statusLabel = DOCUMENTATION_STATUS_LABELS[status];
            const tabLabel = `${TAB_LABELS[id]}, ${statusLabel}`;
            return (
            <button
              key={id}
              type="button"
              ref={(node) => registerSectionTab(id, node)}
              data-documentation-tab={id}
              className={cn("rr-tab", activeTab === id && "rr-active")}
              onClick={() => jumpToSection(id)}
              onKeyDown={handleSectionTabKeyDown}
              aria-pressed={activeTab === id}
              tabIndex={activeTab === id ? 0 : -1}
              aria-label={tabLabel}
              title={tabLabel}
            >
              <span className={cn("rr-dot", STATUS_DOT_CLASS[status])} aria-hidden="true" />
              {TAB_LABELS[id]}
              <span className="sr-only">{statusLabel}</span>
            </button>
            );
          })}
          <div className="ml-auto flex shrink-0 items-center gap-3 pl-2">
            <button
              type="button"
              className="text-left text-xs leading-[18px] underline-offset-2 hover:underline"
              style={{ color: "var(--rr-label-2)" }}
              title={readinessSummary}
              aria-label={readinessSummary}
              onClick={() => {
                const nextIncomplete = incompleteSections[0];
                if (nextIncomplete) jumpToSection(nextIncomplete.id);
              }}
            >
              {readyCount} of {sectionStatuses.length} sections ready
              {incompleteSections.length > 0 ? (
                <span className="block text-xs no-underline" style={{ color: "var(--rr-label-2)" }}>
                  Remaining: {incompleteLabels}
                </span>
              ) : null}
            </button>
            <div
              className="flex items-center gap-1.5 text-[12px] leading-[18px]"
              style={{ color: "var(--rr-label-3)" }}
              role="status"
              aria-live="polite"
            >
              {saveState === "saving" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              {saveState === "saved" && (
                <Cloud className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              )}
              {saveState === "queued" && (
                <CloudOff className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
              )}
              {saveState === "error" && (
                <AlertCircle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
              )}
              {saveState === "conflict" && (
                <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
              )}
              {saveState === "idle" && <Check className="h-3 w-3" aria-hidden="true" />}
              <span>
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "queued"
                    ? "Offline queued"
                    : saveState === "error"
                      ? "Save failed"
                      : saveState === "conflict"
                        ? "Review conflict"
                      : `Saved ${savedTime}`}
              </span>
            </div>
          </div>
        </nav>
      </header>

      {/* Scrollable chart body */}
      <div ref={chartBodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-4">
        <PatientCard
          key={patient.id}
          chrome="workspace"
          patient={patient}
          onUpdate={onUpdatePatient}
          onRemove={handleRemoveRequest}
          onDuplicate={handleDuplicateRequest}
          onToggleCollapse={onToggleCollapse}
          autotexts={autotexts}
          sharedPatientTodos={sharedPatientTodos}
          hidePatientWideTodos={false}
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

      {/* Pinned sign-off readiness bar */}
      <div className="rr-signoff">
        <span className="hidden text-xs font-medium lg:inline" style={{ color: "var(--rr-label-2)" }}>
          Documentation
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {sectionStatuses.map(({ id, status }) => {
            const label =
              id === "systems"
                ? `Systems ${systemsCount.filled}/${systemsCount.total}`
                : DOCUMENTATION_SECTIONS.find((s) => s.id === id)?.label ?? TAB_LABELS[id];
            const shortLabel =
              id === "systems"
                ? `Sys ${systemsCount.filled}/${systemsCount.total}`
                : TAB_LABELS[id].split(" ")[0] ?? label;
            const chipTitle = `${label}: ${DOCUMENTATION_STATUS_LABELS[status]}`;
            return (
            <span key={id} className="rr-chip" title={chipTitle} aria-label={chipTitle}>
              <span className={cn("rr-dot", STATUS_DOT_CLASS[status])} aria-hidden="true" />
              <span className="lg:hidden">{shortLabel}</span>
              <span className="hidden lg:inline">{label}</span>
            </span>
            );
          })}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="rr-btn rr-btn-outline rr-btn-44"
            onClick={() => setHandoffOpen(true)}
          >
            <span className="lg:hidden">Handoff</span>
            <span className="hidden lg:inline">Preview handoff</span>
          </button>
          <button
            type="button"
            className="rr-btn rr-btn-primary rr-btn-44"
            onClick={() => setSignOffOpen(true)}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span className="lg:hidden">Sign off</span>
            <span className="hidden lg:inline">Sign off & mark handoff-ready</span>
          </button>
        </div>
      </div>

      {/* Handoff preview */}
      <Dialog open={handoffOpen} onOpenChange={setHandoffOpen}>
        <DialogContent className="h-[80vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shift handoff</DialogTitle>
            <DialogDescription>
              Review and complete handoff notes for patients on the current roster.
            </DialogDescription>
          </DialogHeader>
          <ShiftHandoff
            patients={filteredPatients.length > 0 ? filteredPatients : patients}
            onSaveHandoff={() => toast.success("Handoff saved")}
            onCompleteHandoff={() => {
              toast.success("Handoff completed");
              setHandoffOpen(false);
            }}
            onUpdatePatient={onUpdatePatient}
          />
        </DialogContent>
      </Dialog>

      {/* Sign-off flow, pre-focused on this chart */}
      <OneClickSignOff
        open={signOffOpen}
        onOpenChange={setSignOffOpen}
        hideTrigger
        initialSelectedIds={[patient.id]}
        patients={[patient]}
        todosMap={todosMap}
        onSignOff={handleSignOff}
      />

      {/* Remove confirmation */}
      <AlertDialog
        open={pendingRemove}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(false);
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
              Remove {patientSafetyLabel(patient)} from rounds?{" "}
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
        open={pendingDuplicate}
        onOpenChange={(open) => {
          if (!open) setPendingDuplicate(false);
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
              Create a new roster entry from {patientSafetyLabel(patient)}?{" "}
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
    </section>
  );
};
