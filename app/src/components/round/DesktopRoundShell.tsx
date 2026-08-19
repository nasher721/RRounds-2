import * as React from "react"
import { RoundChrome } from "./RoundChrome"
import { RosterOverlay } from "./RosterOverlay"
import { PatientFocus } from "./PatientFocus"
import { RoundHome } from "./RoundHome"
import { RoundEnd } from "./RoundEnd"
import { preloadRoundPrintExport } from "./roundPrintExportLoader"
import { ToolsSheet } from "./ToolsSheet"
import { useDashboard } from "@/contexts/DashboardContext"
import { useRoundSession } from "@/contexts/RoundSessionContext"
import type { Patient } from "@/types/patient"
import type { RoundShellSurface } from "./roundShellSurface"
import { exportRoundRecovery } from "@/lib/exportRoundRecovery"

export type { RoundShellSurface }

export interface DesktopRoundShellProps {
  /**
   * Limited secondary escape to classic DesktopDashboard.
   * Prefer ToolsSheet panels; this is clearly labeled legacy.
   */
  onOpenWorkbench?: () => void
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (target.isContentEditable) return true
  return Boolean(target.closest("[contenteditable='true']"))
}

/**
 * Desktop Focus-first Round shell: chrome + lifecycle surfaces + Tools sheet.
 * Patient Focus stays mounted while the roster opens so drafts remain in memory.
 */
export const DesktopRoundShell = ({ onOpenWorkbench }: DesktopRoundShellProps) => {
  const { patients, setDesktopSelectedPatientId } = useDashboard()
  const {
    currentPatientId,
    round,
    isHydrated,
    nextPatient,
    prevPatient,
    markDoneAndNext,
    startNewRound,
  } = useRoundSession()

  const [rosterOpen, setRosterOpen] = React.useState(false)
  const [toolsOpen, setToolsOpen] = React.useState(false)
  const [surface, setSurface] = React.useState<RoundShellSurface>(() =>
    patients.length === 0 ? "home" : "focus",
  )
  const [hasStartedRound, setHasStartedRound] = React.useState(() => patients.length > 0)
  const hydratedSurfaceInitializedRef = React.useRef(false)

  const patient = React.useMemo((): Patient | null => {
    if (!currentPatientId) return null
    return patients.find((entry) => entry.id === currentPatientId) ?? null
  }, [patients, currentPatientId])

  React.useEffect(() => {
    if (patients.length === 0) {
      setSurface("home")
      setHasStartedRound(false)
    }
  }, [patients.length])

  React.useEffect(() => {
    if (!isHydrated || hydratedSurfaceInitializedRef.current) return
    hydratedSurfaceInitializedRef.current = true
    if (round.status === "completed") {
      setSurface("home")
      setHasStartedRound(true)
    }
  }, [isHydrated, round.status])

  React.useEffect(() => {
    if (!navigator.onLine) return
    void preloadRoundPrintExport().catch(() => undefined)
  }, [])

  React.useEffect(() => {
    if (!isHydrated || !currentPatientId) return
    setDesktopSelectedPatientId(currentPatientId)
  }, [currentPatientId, isHydrated, setDesktopSelectedPatientId])

  const handleOpenRoster = React.useCallback(() => {
    setRosterOpen(true)
  }, [])

  const handleOpenTools = React.useCallback(() => {
    setToolsOpen(true)
  }, [])

  const handleGoHome = React.useCallback(() => {
    setSurface("home")
  }, [])

  const handleStartRound = React.useCallback(() => {
    if (round.status === "completed") {
      startNewRound()
    }
    setHasStartedRound(true)
    setSurface("focus")
  }, [round.status, startNewRound])

  const handleEndRound = React.useCallback(() => {
    setSurface("end")
  }, [])

  React.useEffect(() => {
    if (!isHydrated) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return

      const key = event.key
      const lower = key.length === 1 ? key.toLowerCase() : key

      if (key === "/" && !rosterOpen) {
        event.preventDefault()
        setRosterOpen(true)
        return
      }

      if (lower === "r" && !rosterOpen) {
        event.preventDefault()
        setRosterOpen(true)
        return
      }

      if (rosterOpen || surface !== "focus") return

      if (lower === "j" || key === "]") {
        event.preventDefault()
        nextPatient()
        return
      }
      if (lower === "k" || key === "[") {
        event.preventDefault()
        prevPatient()
        return
      }
      if (lower === "d") {
        event.preventDefault()
        markDoneAndNext()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isHydrated, rosterOpen, surface, nextPatient, prevPatient, markDoneAndNext])

  if (!isHydrated) {
    return (
      <div
        className="flex h-[100dvh] min-h-screen items-center justify-center bg-background px-6"
        data-testid="desktop-round-shell"
        data-round-surface={surface}
        data-round-ready="false"
      >
        <p role="status" className="text-sm font-medium text-muted-foreground" data-testid="round-session-loading">
          Restoring today&apos;s Round…
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex h-[100dvh] min-h-screen flex-col bg-background"
      data-testid="desktop-round-shell"
      data-round-surface={surface}
      data-round-ready="true"
    >
      <RoundChrome
        onOpenRoster={handleOpenRoster}
        onOpenTools={handleOpenTools}
        onGoHome={handleGoHome}
        onEndRound={handleEndRound}
        showLifecycleActions={surface === "focus"}
        onExportRecovery={() => exportRoundRecovery(round, patients)}
      />
      <main id="main-content" tabIndex={-1} className="min-h-0 flex-1">
        {surface === "home" && (
          <RoundHome
            isResume={hasStartedRound}
            onStartRound={handleStartRound}
            onEndRound={handleEndRound}
          />
        )}
        {surface === "focus" && (
          <PatientFocus patient={patient} onGoHome={handleGoHome} />
        )}
        {surface === "end" && (
          <RoundEnd
            onBackToFocus={handleStartRound}
            onBackToHome={handleGoHome}
          />
        )}
      </main>
      <RosterOverlay
        open={rosterOpen}
        onOpenChange={setRosterOpen}
        onEndRound={handleEndRound}
        onGoHome={handleGoHome}
      />
      <ToolsSheet
        open={toolsOpen}
        onOpenChange={setToolsOpen}
        onOpenClassicWorkbench={onOpenWorkbench}
      />
    </div>
  )
}
