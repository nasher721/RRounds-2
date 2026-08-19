import * as React from "react"
import {
  BookOpen,
  FileText,
  ListTodo,
  LogOut,
  Settings2,
  Sparkles,
  Trash2,
  GitCompare,
  PanelLeft,
  ChevronDown,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { AutotextManager } from "@/components/AutotextManager"
import { ChangeTrackingControls } from "@/components/ChangeTrackingControls"
import { ClinicalRiskCalculator } from "@/components/ClinicalRiskCalculator"
import { BatchCourseGenerator } from "@/components/BatchCourseGenerator"
import { CSVColumnMapper } from "@/components/import/CSVColumnMapper"
import { organizeCsvImportRecord } from "@/lib/import/organizeImportedPatient"
import { SmartPatientImport } from "@/components/SmartPatientImport"
import { TimelineDialog } from "@/components/tools/timeline/TimelineDialog"
import { UnitCensusDashboard } from "@/components/UnitCensusDashboard"
import { DesktopAIModelSettingsDialog } from "@/components/settings/DesktopAIModelSettingsDialog"
import { DesktopSpecialtySelector } from "@/components/settings/DesktopSpecialtySelector"
import { ThemeToggle } from "@/components/ThemeToggle"
import { IBCCPanel } from "@/components/ibcc"
import { GuidelinesPanelLazy } from "@/components/guidelines"
import { useAICommandPalette } from "@/hooks/useAICommandPalette"
import { useChangeTracking } from "@/contexts/ChangeTrackingContext"
import { useClinicalGuidelinesState } from "@/contexts/ClinicalGuidelinesContext"
import { useDashboard } from "@/contexts/DashboardContext"
import { useDashboardTodos } from "@/contexts/DashboardTodosContext"
import { useIBCCState } from "@/contexts/IBCCContext"
import { useRoundSession } from "@/contexts/RoundSessionContext"
import { useSettings } from "@/contexts/SettingsContext"
import { MIN_GLOBAL_FONT_SIZE_PX, MAX_GLOBAL_FONT_SIZE_PX } from "@/constants/config"
import { cn } from "@/lib/utils"
import { useEdgeHealth } from "@/contexts/EdgeHealthContext"
import { formatClearAllPatientsConfirmation } from "@/lib/destructiveConfirmation"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"

const MultiPatientComparison = React.lazy(() =>
  import("@/components/MultiPatientComparison").then((m) => ({ default: m.MultiPatientComparison })),
)
const PhraseManager = React.lazy(() =>
  import("@/components/phrases/PhraseManager").then((m) => ({ default: m.PhraseManager })),
)
const AICommandPalette = React.lazy(() =>
  import("@/components/tools/AICommandPalette").then((m) => ({ default: m.AICommandPalette })),
)

export interface ToolsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Limited secondary escape to classic workbench. */
  onOpenClassicWorkbench?: () => void
  touchFriendly?: boolean
}

/**
 * Demoted capabilities live here — not in primary Round chrome.
 * Reuses existing modal/panel components; this sheet only owns triggers + mounts.
 */
export const ToolsSheet = ({
  open,
  onOpenChange,
  onOpenClassicWorkbench,
  touchFriendly = false,
}: ToolsSheetProps) => {
  const {
    patients,
    filteredPatients,
    selectedPatient,
    onClearAll,
    onSignOut,
    onAddPatientWithData,
    onImportPatients,
    onUpdatePatient,
    autotexts,
    templates,
    customDictionary,
    onAddAutotext,
    onRemoveAutotext,
    onAddTemplate,
    onRemoveTemplate,
    onImportDictionary,
  } = useDashboard()
  const { currentPatientId } = useRoundSession()
  const roundPatient = React.useMemo(() => {
    if (!currentPatientId) return null
    return patients.find((entry) => entry.id === currentPatientId) ?? null
  }, [patients, currentPatientId])
  /** Prefer Focus/active Round patient over stale dashboard selection. */
  const toolsPatient = roundPatient ?? selectedPatient
  const todosMap = useDashboardTodos()
  const isOnline = useOnlineStatus()
  const edgeHealth = useEdgeHealth()
  const backendUnavailable = edgeHealth?.status === "unhealthy"
  const networkActionsUnavailable = !isOnline || backendUnavailable
  const { openPanel: openIbcc } = useIBCCState()
  const { openPanel: openGuidelines } = useClinicalGuidelinesState()
  const { isOpen: isAICommandPaletteOpen, setIsOpen: setAICommandPaletteOpen } = useAICommandPalette()
  const {
    enabled: ctEnabled,
    color: ctColor,
    styles: ctStyles,
    toggleEnabled: ctToggleEnabled,
    setColor: ctSetColor,
    toggleStyle: ctToggleStyle,
  } = useChangeTracking()
  const {
    globalFontSize,
    setGlobalFontSize,
    todosAlwaysVisible,
    setTodosAlwaysVisible,
    editorToolbarMode,
    setEditorToolbarMode,
  } = useSettings()

  const [showComparison, setShowComparison] = React.useState(false)
  const [showPhraseManager, setShowPhraseManager] = React.useState(false)
  const [showAutotexts, setShowAutotexts] = React.useState(false)
  const [showClearAll, setShowClearAll] = React.useState(false)
  const [advancedOpen, setAdvancedOpen] = React.useState(false)
  const [moreImportOpen, setMoreImportOpen] = React.useState(false)

  const handleCsvImport = React.useCallback(async (records: Record<string, string>[]) => {
    await onImportPatients(records.map(organizeCsvImportRecord))
  }, [onImportPatients])

  const closeSheet = () => {
    onOpenChange(false)
  }

  const handleOpenAi = () => {
    setAICommandPaletteOpen(true)
  }

  const handleOpenIbcc = () => {
    closeSheet()
    openIbcc()
  }

  const handleOpenGuidelines = () => {
    closeSheet()
    openGuidelines()
  }

  const handleOpenCompare = () => {
    setShowComparison(true)
  }

  const handleOpenPhrases = () => {
    setShowPhraseManager(true)
  }

  const handleOpenAutotexts = () => {
    setShowAutotexts(true)
  }

  const handleConfirmClearAll = () => {
    onClearAll()
    setShowClearAll(false)
    closeSheet()
    toast.message("All patients cleared")
  }

  const handleOpenClassic = () => {
    closeSheet()
    onOpenClassicWorkbench?.()
  }

  const rowClass = cn(
    "w-full justify-start gap-2.5 rounded-lg border-border/40 font-medium transition-colors hover:bg-accent/60",
    touchFriendly ? "h-[44px] text-sm" : "h-9 text-sm",
  )

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
          data-testid="tools-sheet"
          aria-describedby={undefined}
        >
          <SheetHeader className="border-b border-border/30 px-4 py-3 text-left">
            <SheetTitle className="text-sm font-semibold tracking-tight">Tools</SheetTitle>
            <SheetDescription
              className={cn(
                touchFriendly ? "text-sm text-foreground/70" : "text-xs text-muted-foreground",
              )}
            >
              Secondary capabilities. Mid-rounds core stays on Focus.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 px-4 py-4">
            {networkActionsUnavailable && (
              <p
                className={cn(
                  "rounded-md border border-border/40 bg-muted/40 px-3 py-2 text-muted-foreground",
                  touchFriendly ? "text-sm" : "text-xs",
                )}
                data-testid="tools-offline-cue"
                role="status"
              >
                {backendUnavailable
                  ? "Backend unavailable — AI and parsing are disabled. Focus stays editable."
                  : "Offline — network tools need connection. Focus stays editable."}
              </p>
            )}
            <section className="space-y-2" aria-label="Clinical tools">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Clinical
              </p>
              <Button
                type="button"
                variant="outline"
                className={rowClass}
                onClick={handleOpenAi}
                disabled={networkActionsUnavailable}
                aria-label={
                  backendUnavailable
                    ? "AI assistant unavailable while backend health check is failing"
                    : isOnline
                      ? "Open AI assistant"
                      : "AI assistant needs network"
                }
                data-testid="tools-ai"
              >
                <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                AI Assistant
                <span className="ml-auto text-xs opacity-60">
                  {networkActionsUnavailable ? "unavailable" : "⌘⇧A"}
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className={rowClass}
                onClick={handleOpenIbcc}
                aria-label="Open IBCC clinical reference"
                data-testid="tools-ibcc"
              >
                <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                IBCC Reference
              </Button>
              <Button
                type="button"
                variant="outline"
                className={rowClass}
                onClick={handleOpenGuidelines}
                aria-label="Open clinical guidelines"
                data-testid="tools-guidelines"
              >
                <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                Guidelines
              </Button>
              <Button
                type="button"
                variant="outline"
                className={rowClass}
                onClick={handleOpenCompare}
                aria-label="Compare patients"
                data-testid="tools-compare"
              >
                <GitCompare className="h-4 w-4 shrink-0" aria-hidden="true" />
                Compare patients
              </Button>
              <div
                data-testid="tools-risk"
              >
                <ClinicalRiskCalculator className={cn(touchFriendly ? "h-[44px]" : "h-9", "w-full justify-start gap-2")} />
              </div>
              <div data-testid="tools-timeline">
                <TimelineDialog triggerClassName={touchFriendly ? "h-[44px]" : undefined} />
              </div>
              <div data-testid="tools-census" onClickCapture={closeSheet}>
                <UnitCensusDashboard
                  patients={patients}
                  className={cn(touchFriendly ? "h-[44px]" : "h-9", "w-full justify-start gap-2")}
                />
              </div>
              <div
                data-testid="tools-batch-course"
                className={cn(networkActionsUnavailable && "pointer-events-none opacity-50")}
                aria-disabled={networkActionsUnavailable}
                title={networkActionsUnavailable ? "Backend connection required" : undefined}
              >
                <BatchCourseGenerator
                  patients={patients}
                  todosMap={todosMap}
                  triggerClassName={touchFriendly ? "h-[44px]" : undefined}
                />
                {networkActionsUnavailable && (
                  <p className="mt-1 text-xs text-muted-foreground">Batch course needs a healthy backend connection</p>
                )}
              </div>
            </section>

            <section className="space-y-2" aria-label="Authoring">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Phrases &amp; autotext
              </p>
              <Button
                type="button"
                variant="outline"
                className={rowClass}
                onClick={handleOpenPhrases}
                aria-label="Manage phrases"
                data-testid="tools-phrases"
              >
                <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                Manage Phrases
              </Button>
              <Button
                type="button"
                variant="outline"
                className={rowClass}
                onClick={handleOpenAutotexts}
                aria-label="Manage autotexts"
                data-testid="tools-autotexts"
              >
                <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                Autotexts &amp; templates
              </Button>
            </section>

            <Collapsible open={moreImportOpen} onOpenChange={setMoreImportOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(rowClass, "justify-between")}
                  aria-expanded={moreImportOpen}
                  data-testid="tools-more-import"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                    More import options
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 opacity-70 transition-transform",
                      moreImportOpen && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2 rounded-md border border-border/30 bg-card/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Primary Import Patient List lives on Round Home. These are secondary formats.
                </p>
                <SmartPatientImport onImportPatient={onAddPatientWithData} />
                <CSVColumnMapper onImportPatients={handleCsvImport} />
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(rowClass, "justify-between")}
                  aria-expanded={advancedOpen}
                  data-testid="tools-advanced"
                >
                  <span className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Advanced settings
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 opacity-70 transition-transform",
                      advancedOpen && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-3 rounded-md border border-border/30 bg-card/40 p-3">
                <Button
                  type="button"
                  variant={todosAlwaysVisible ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTodosAlwaysVisible(!todosAlwaysVisible)}
                  className={cn("w-full gap-1.5", touchFriendly && "h-[44px]")}
                >
                  <ListTodo className="h-3.5 w-3.5" aria-hidden="true" />
                  Todos always visible
                </Button>
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
                    onValueChange={(value) => setGlobalFontSize(value[0] ?? globalFontSize)}
                    aria-label="Global font size"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Text box toolbar</p>
                  <select
                    value={editorToolbarMode}
                    onChange={(e) =>
                      setEditorToolbarMode(e.target.value as "minimal" | "full" | "custom")
                    }
                    className={cn(
                      "w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring",
                      touchFriendly ? "h-[44px]" : "h-8",
                    )}
                    aria-label="Toolbar style for all text boxes"
                  >
                    <option value="minimal">Minimal (essential + More)</option>
                    <option value="full">Full</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <DesktopSpecialtySelector />
                <DesktopAIModelSettingsDialog />
              </CollapsibleContent>
            </Collapsible>

            <section
              className="space-y-2 border-t border-border/25 pt-3"
              aria-label="Documentation"
              data-testid="tools-change-tracking"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Documentation
              </p>
              <ChangeTrackingControls
                enabled={ctEnabled}
                color={ctColor}
                styles={ctStyles}
                onToggleEnabled={ctToggleEnabled}
                onColorChange={ctSetColor}
                onToggleStyle={ctToggleStyle}
              />
              <p className="text-xs text-muted-foreground">
                Mark text you add during this round so new documentation is easy to review.
              </p>
            </section>

            <section className="space-y-2 border-t border-border/25 pt-3" aria-label="Account">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Account
              </p>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn("gap-1.5", touchFriendly && "min-h-[44px]")}
                  onClick={onSignOut}
                  aria-label="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            </section>

            <section className="space-y-2 border-t border-border/25 pt-3" aria-label="Destructive">
              <Button
                type="button"
                variant="outline"
                className={cn(rowClass, "border-destructive/40 text-destructive hover:bg-destructive/10")}
                onClick={() => setShowClearAll(true)}
                disabled={patients.length === 0}
                aria-label="Clear all patients"
                data-testid="tools-clear-all"
              >
                <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                Clear all patients
              </Button>
            </section>

            {onOpenClassicWorkbench && (
              <section className="border-t border-border/25 pt-3" aria-label="Legacy workbench">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    rowClass,
                    "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={handleOpenClassic}
                  aria-label="Open classic workbench (secondary escape hatch)"
                  data-testid="tools-classic-workbench"
                >
                  <PanelLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Classic workbench (legacy)
                </Button>
                <p className="mt-1 px-1 text-xs text-muted-foreground">
                  Secondary escape hatch only — prefer Tools panels above.
                </p>
              </section>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Overlay panels mounted once for Round shells (same pattern as MobileDashboard). */}
      <IBCCPanel variant="overlay" />
      <GuidelinesPanelLazy />

      <React.Suspense fallback={null}>
        <AICommandPalette
          open={isAICommandPaletteOpen}
          onOpenChange={setAICommandPaletteOpen}
          patient={toolsPatient ?? undefined}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <MultiPatientComparison
          open={showComparison}
          onOpenChange={setShowComparison}
          patients={filteredPatients.length > 0 ? filteredPatients : patients}
          todosMap={todosMap}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <PhraseManager open={showPhraseManager} onOpenChange={setShowPhraseManager} />
      </React.Suspense>

      <Dialog open={showAutotexts} onOpenChange={setShowAutotexts}>
        <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Autotexts &amp; templates</DialogTitle>
            <DialogDescription>
              Manage typing shortcuts, note templates, and custom dictionary entries for this round.
            </DialogDescription>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>

      <AlertDialog open={showClearAll} onOpenChange={setShowClearAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Patients</AlertDialogTitle>
            <AlertDialogDescription>
              {formatClearAllPatientsConfirmation(patients.length)}
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
    </>
  )
}
