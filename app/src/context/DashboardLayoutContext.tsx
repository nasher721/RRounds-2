"use client"

import * as React from "react"
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import {
  loadDashboardPrefs,
  saveDashboardPrefs,
  DEFAULT_DASHBOARD_PREFS,
  type DashboardPrefs,
  type DashboardFocusTarget,
} from "@/lib/dashboardPrefs"
import {
  toLayoutMode,
  toPrefsMode,
  type SystemsLayoutMode,
} from "@/lib/dashboardLayoutModes"

interface DashboardLayoutState {
  // Panel state
  panelLeftCollapsed: boolean
  panelRightCollapsed: boolean
  // Focus mode
  focusModeActive: boolean
  focusModeEditorId: DashboardFocusTarget | null
  // Systems layout
  systemsLayoutMode: SystemsLayoutMode
  customSystemsGroupIds: string[]
  // Patient roster layout
  patientRosterLayoutMode: DashboardPrefs["patientRosterLayoutMode"]
  patientListViewMode: DashboardPrefs["patientListViewMode"]
}

interface DashboardLayoutActions {
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  setLeftPanelCollapsed: (collapsed: boolean) => void
  setRightPanelCollapsed: (collapsed: boolean) => void
  enterFocusMode: (editorId: DashboardFocusTarget) => void
  exitFocusMode: () => void
  setSystemsLayoutMode: (mode: SystemsLayoutMode) => void
  setCustomSystemsGroup: (ids: string[]) => void
  setPatientRosterLayoutMode: (mode: DashboardPrefs["patientRosterLayoutMode"]) => void
  setPatientListViewMode: (mode: DashboardPrefs["patientListViewMode"]) => void
}

type DashboardLayoutContextValue = DashboardLayoutState & DashboardLayoutActions

const DashboardLayoutContext = createContext<DashboardLayoutContextValue | null>(null)

export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_DASHBOARD_PREFS)
  const [focusModeActive, setFocusModeActive] = useState(false)
  const [focusModeEditorId, setFocusModeEditorId] = useState<DashboardFocusTarget | null>(null)
  const [systemsLayoutMode, setSystemsLayoutModeState] = useState<SystemsLayoutMode>("split")
  const [customSystemsGroupIds, setCustomSystemsGroupIdsState] = useState<string[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const preFocusLayoutRef = useRef<{ leftPatientListOpen: boolean; rightTasksPanelOpen: boolean } | null>(null)

  // Load prefs on mount. Focus mode is session-only — never restore it, because it
  // collapses the patient list and previously blocked every UI control that reopens it.
  useEffect(() => {
    const loaded = loadDashboardPrefs()
    const leftPatientListOpen = loaded.focusModeEnabled
      ? true
      : loaded.leftPatientListOpen
    setPrefs({
      ...loaded,
      focusModeEnabled: false,
      leftPatientListOpen,
    })
    setFocusModeActive(false)
    setSystemsLayoutModeState(toLayoutMode(loaded.systemsReviewMode))
    setCustomSystemsGroupIdsState(loaded.systemsCustomCombineKeys)
    setIsInitialized(true)
  }, [])

  // Persist when state changes (focus mode stays session-only)
  useEffect(() => {
    if (!isInitialized) return
    const newPrefs: DashboardPrefs = {
      ...prefs,
      focusModeEnabled: false,
      systemsReviewMode: toPrefsMode(systemsLayoutMode),
      systemsCustomCombineKeys: customSystemsGroupIds,
    }
    saveDashboardPrefs(newPrefs)
  }, [isInitialized, prefs, focusModeActive, systemsLayoutMode, customSystemsGroupIds])

  const clearFocusModeState = useCallback(() => {
    setFocusModeActive(false)
    setFocusModeEditorId(null)
  }, [])

  /** Exit focus mode and force the patient list open (used by expand controls). */
  const revealLeftPanel = useCallback(() => {
    clearFocusModeState()
    setPrefs((prev) => {
      const restore = prev.focusModeEnabled ? preFocusLayoutRef.current : null
      if (prev.focusModeEnabled) {
        preFocusLayoutRef.current = null
      }
      return {
        ...prev,
        focusModeEnabled: false,
        leftPatientListOpen: true,
        rightTasksPanelOpen: prev.focusModeEnabled
          ? (restore?.rightTasksPanelOpen ?? prev.rightTasksPanelOpen)
          : prev.rightTasksPanelOpen,
      }
    })
  }, [clearFocusModeState])

  const toggleLeftPanel = useCallback(() => {
    // Opening the list must always work, even from focus mode.
    clearFocusModeState()
    setPrefs((p) => {
      if (p.focusModeEnabled) {
        const restore = preFocusLayoutRef.current
        preFocusLayoutRef.current = null
        return {
          ...p,
          focusModeEnabled: false,
          leftPatientListOpen: true,
          rightTasksPanelOpen: restore?.rightTasksPanelOpen ?? p.rightTasksPanelOpen,
        }
      }
      return { ...p, leftPatientListOpen: !p.leftPatientListOpen }
    })
  }, [clearFocusModeState])

  const toggleRightPanel = useCallback(() => {
    clearFocusModeState()
    setPrefs((p) => {
      if (p.focusModeEnabled) {
        const restore = preFocusLayoutRef.current
        preFocusLayoutRef.current = null
        return {
          ...p,
          focusModeEnabled: false,
          leftPatientListOpen: restore?.leftPatientListOpen ?? true,
          rightTasksPanelOpen: true,
        }
      }
      return { ...p, rightTasksPanelOpen: !p.rightTasksPanelOpen }
    })
  }, [clearFocusModeState])

  const setLeftPanelCollapsed = useCallback((collapsed: boolean) => {
    if (!collapsed) {
      revealLeftPanel()
      return
    }
    setPrefs((p) => {
      if (p.focusModeEnabled) return p
      return { ...p, leftPatientListOpen: false }
    })
  }, [revealLeftPanel])

  const setRightPanelCollapsed = useCallback((collapsed: boolean) => {
    if (!collapsed) {
      clearFocusModeState()
      setPrefs((p) => {
        const restore = p.focusModeEnabled ? preFocusLayoutRef.current : null
        if (p.focusModeEnabled) {
          preFocusLayoutRef.current = null
        }
        return {
          ...p,
          focusModeEnabled: false,
          leftPatientListOpen: p.focusModeEnabled
            ? (restore?.leftPatientListOpen ?? true)
            : p.leftPatientListOpen,
          rightTasksPanelOpen: true,
        }
      })
      return
    }
    setPrefs((p) => {
      if (p.focusModeEnabled) return p
      return { ...p, rightTasksPanelOpen: false }
    })
  }, [clearFocusModeState])

  const enterFocusMode = useCallback((editorId: DashboardFocusTarget) => {
    setFocusModeActive(true)
    setFocusModeEditorId(editorId)
    setPrefs((prev) => {
      if (prev.focusModeEnabled) return prev
      preFocusLayoutRef.current = {
        leftPatientListOpen: prev.leftPatientListOpen,
        rightTasksPanelOpen: prev.rightTasksPanelOpen,
      }
      return {
        ...prev,
        focusModeEnabled: true,
        leftPatientListOpen: false,
        rightTasksPanelOpen: false,
      }
    })
  }, [])

  const exitFocusMode = useCallback(() => {
    clearFocusModeState()
    setPrefs((prev) => {
      if (!prev.focusModeEnabled) return prev
      const restore = preFocusLayoutRef.current
      preFocusLayoutRef.current = null
      return {
        ...prev,
        focusModeEnabled: false,
        leftPatientListOpen: restore?.leftPatientListOpen ?? true,
        rightTasksPanelOpen: restore?.rightTasksPanelOpen ?? true,
      }
    })
  }, [clearFocusModeState])

  const setSystemsLayoutMode = useCallback((mode: SystemsLayoutMode) => {
    setSystemsLayoutModeState(mode)
  }, [])

  const setCustomSystemsGroup = useCallback((ids: string[]) => {
    setCustomSystemsGroupIdsState(ids)
    setSystemsLayoutModeState(ids.length > 0 ? "custom" : "split")
  }, [])

  const setPatientRosterLayoutMode = useCallback(
    (mode: DashboardPrefs["patientRosterLayoutMode"]) => {
      setPrefs((p) => ({ ...p, patientRosterLayoutMode: mode }))
    },
    [],
  )

  const setPatientListViewMode = useCallback(
    (mode: DashboardPrefs["patientListViewMode"]) => {
      setPrefs((p) => ({ ...p, patientListViewMode: mode }))
    },
    [],
  )

   // Keyboard handler for Esc to exit focus mode
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if (e.key === "Escape" && focusModeActive) {
         exitFocusMode()
       }
     }
     
     if (focusModeActive) {
       document.addEventListener("keydown", handleKeyDown)
       return () => document.removeEventListener("keydown", handleKeyDown)
     }
   }, [focusModeActive, exitFocusMode])

  const value: DashboardLayoutContextValue = useMemo(() => ({
    panelLeftCollapsed: !prefs.leftPatientListOpen,
    panelRightCollapsed: !prefs.rightTasksPanelOpen,
    focusModeActive,
    focusModeEditorId,
    systemsLayoutMode,
    customSystemsGroupIds,
    patientRosterLayoutMode: prefs.patientRosterLayoutMode,
    patientListViewMode: prefs.patientListViewMode,
    toggleLeftPanel,
    toggleRightPanel,
    setLeftPanelCollapsed,
    setRightPanelCollapsed,
    enterFocusMode,
    exitFocusMode,
    setSystemsLayoutMode,
    setCustomSystemsGroup,
    setPatientRosterLayoutMode,
    setPatientListViewMode,
  }), [
    prefs.leftPatientListOpen,
    prefs.rightTasksPanelOpen,
    prefs.patientRosterLayoutMode,
    prefs.patientListViewMode,
    focusModeActive,
    focusModeEditorId,
    systemsLayoutMode,
    customSystemsGroupIds,
    toggleLeftPanel,
    toggleRightPanel,
    setLeftPanelCollapsed,
    setRightPanelCollapsed,
    enterFocusMode,
    exitFocusMode,
    setSystemsLayoutMode,
    setCustomSystemsGroup,
    setPatientRosterLayoutMode,
    setPatientListViewMode,
  ])

  return (
    <DashboardLayoutContext.Provider value={value}>
      {children}
    </DashboardLayoutContext.Provider>
  )
}

export function useDashboardLayout() {
  const context = useContext(DashboardLayoutContext)
  if (!context) {
    throw new Error("useDashboardLayout must be used within DashboardLayoutProvider")
  }
  return context
}
