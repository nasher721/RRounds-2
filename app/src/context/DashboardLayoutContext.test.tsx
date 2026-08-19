import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { renderHook, act, waitFor } from "@testing-library/react";
import { DashboardLayoutProvider, useDashboardLayout } from "@/context/DashboardLayoutContext";
import {
  DASHBOARD_PREFS_STORAGE_KEY,
  DEFAULT_DASHBOARD_PREFS,
  saveDashboardPrefs,
} from "@/lib/dashboardPrefs";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, "localStorage", { configurable: true, value: localStorageMock });
Object.defineProperty(window, "localStorage", { configurable: true, value: localStorageMock });

describe("DashboardLayoutContext", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("panel state", () => {
    it("provides default panel collapsed states", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      assert.equal(result.current.panelLeftCollapsed, false);
      assert.equal(result.current.panelRightCollapsed, false);
    });

    it("toggles left panel state", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      act(() => {
        result.current.toggleLeftPanel();
      });
      
      assert.equal(result.current.panelLeftCollapsed, true);
    });

    it("toggles right panel state", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      act(() => {
        result.current.toggleRightPanel();
      });
      
      assert.equal(result.current.panelRightCollapsed, true);
    });

    it("hydrates panel and roster preferences from localStorage", async () => {
      localStorageMock.setItem(
        DASHBOARD_PREFS_STORAGE_KEY,
        JSON.stringify({
          ...DEFAULT_DASHBOARD_PREFS,
          leftPatientListOpen: false,
          rightTasksPanelOpen: false,
          patientRosterLayoutMode: "topbar",
          patientListViewMode: "compact",
          systemsReviewMode: "combine_all",
        }),
      );

      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });

      await waitFor(() => {
        assert.equal(result.current.panelLeftCollapsed, true);
        assert.equal(result.current.panelRightCollapsed, true);
        assert.equal(result.current.patientRosterLayoutMode, "topbar");
        assert.equal(result.current.patientListViewMode, "compact");
        assert.equal(result.current.systemsLayoutMode, "combine_all");
      });
    });

    it("persists panel and roster preference changes", async () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });

      await waitFor(() => {
        const stored = localStorageMock.getItem(DASHBOARD_PREFS_STORAGE_KEY);
        assert.ok(stored);
      });

      act(() => {
        result.current.toggleLeftPanel();
        result.current.setPatientRosterLayoutMode("topbar");
        result.current.setPatientListViewMode("compact");
      });

      await waitFor(() => {
        const stored = JSON.parse(localStorageMock.getItem(DASHBOARD_PREFS_STORAGE_KEY) ?? "{}");
        assert.equal(stored.leftPatientListOpen, false);
        assert.equal(stored.patientRosterLayoutMode, "topbar");
        assert.equal(stored.patientListViewMode, "compact");
      });
    });

    it("keeps the last in-memory layout state when dashboard preference reads throw", async () => {
      saveDashboardPrefs({
        ...DEFAULT_DASHBOARD_PREFS,
        leftPatientListOpen: false,
        rightTasksPanelOpen: true,
        patientRosterLayoutMode: "topbar",
      });

      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: {
          getItem: () => {
            throw new Error("Access to storage is not allowed from this context");
          },
          setItem: () => {},
          removeItem: () => {},
          clear: () => {},
        },
      });

      try {
        const { result } = renderHook(() => useDashboardLayout(), {
          wrapper: DashboardLayoutProvider,
        });

        await waitFor(() => {
          assert.equal(result.current.panelLeftCollapsed, true);
          assert.equal(result.current.panelRightCollapsed, false);
          assert.equal(result.current.patientRosterLayoutMode, "topbar");
        });
      } finally {
        Object.defineProperty(window, "localStorage", { configurable: true, value: localStorageMock });
      }
    });

    it("keeps layout interactions usable when dashboard preference writes throw", async () => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: {
          getItem: () => null,
          setItem: () => {
            throw new Error("Quota exceeded");
          },
          removeItem: () => {},
          clear: () => {},
        },
      });

      try {
        const { result } = renderHook(() => useDashboardLayout(), {
          wrapper: DashboardLayoutProvider,
        });

        await waitFor(() => {
          assert.equal(result.current.panelLeftCollapsed, false);
        });

        act(() => {
          result.current.toggleLeftPanel();
        });

        await waitFor(() => {
          assert.equal(result.current.panelLeftCollapsed, true);
        });
      } finally {
        Object.defineProperty(window, "localStorage", { configurable: true, value: localStorageMock });
      }
    });

    it("remains interactive when storage access throws before prefs hydrate", async () => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new Error("Access to storage is not allowed from this context");
        },
      });

      try {
        const { result } = renderHook(() => useDashboardLayout(), {
          wrapper: DashboardLayoutProvider,
        });

        await waitFor(() => {
          assert.equal(typeof result.current.toggleRightPanel, "function");
        });

        const before = result.current.panelRightCollapsed;
        act(() => {
          result.current.toggleRightPanel();
        });
        assert.equal(result.current.panelRightCollapsed, !before);
      } finally {
        Object.defineProperty(window, "localStorage", { configurable: true, value: localStorageMock });
      }
    });
  });

  describe("focus mode", () => {
    it("enters focus mode with editor id", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      act(() => {
        result.current.enterFocusMode("clinicalSummary");
      });
      
      assert.equal(result.current.focusModeActive, true);
      assert.equal(result.current.focusModeEditorId, "clinicalSummary");
    });

    it("exits focus mode", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      act(() => {
        result.current.enterFocusMode("clinicalSummary");
      });
      
      act(() => {
        result.current.exitFocusMode();
      });
      
      assert.equal(result.current.focusModeActive, false);
      assert.equal(result.current.focusModeEditorId, null);
    });

    it("collapses panels during focus mode and restores the previous panel state on exit", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });

      act(() => {
        result.current.setRightPanelCollapsed(true);
      });

      act(() => {
        result.current.enterFocusMode("clinicalSummary");
      });

      assert.equal(result.current.focusModeActive, true);
      assert.equal(result.current.panelLeftCollapsed, true);
      assert.equal(result.current.panelRightCollapsed, true);

      act(() => {
        result.current.exitFocusMode();
      });

      assert.equal(result.current.focusModeActive, false);
      assert.equal(result.current.panelLeftCollapsed, false);
      assert.equal(result.current.panelRightCollapsed, true);
    });

    it("reopens the patient list and exits focus mode when expand is requested", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });

      act(() => {
        result.current.enterFocusMode("clinicalSummary");
      });

      assert.equal(result.current.focusModeActive, true);
      assert.equal(result.current.panelLeftCollapsed, true);

      act(() => {
        result.current.setLeftPanelCollapsed(false);
      });

      assert.equal(result.current.focusModeActive, false);
      assert.equal(result.current.focusModeEditorId, null);
      assert.equal(result.current.panelLeftCollapsed, false);
    });

    it("exits focus mode when the left panel is toggled open", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });

      act(() => {
        result.current.enterFocusMode("clinicalSummary");
      });

      act(() => {
        result.current.toggleLeftPanel();
      });

      assert.equal(result.current.focusModeActive, false);
      assert.equal(result.current.panelLeftCollapsed, false);
    });

    it("does not restore focus mode from persisted preferences", async () => {
      localStorageMock.setItem(
        DASHBOARD_PREFS_STORAGE_KEY,
        JSON.stringify({
          ...DEFAULT_DASHBOARD_PREFS,
          focusModeEnabled: true,
          leftPatientListOpen: false,
          rightTasksPanelOpen: false,
        }),
      );

      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });

      await waitFor(() => {
        assert.equal(result.current.focusModeActive, false);
        assert.equal(result.current.panelLeftCollapsed, false);
      });
    });

    it("Escape exits focus mode", async () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });

      act(() => {
        result.current.enterFocusMode("clinicalSummary");
      });

      await waitFor(() => {
        assert.equal(result.current.focusModeActive, true);
      });

      act(() => {
        document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
      });

      await waitFor(() => {
        assert.equal(result.current.focusModeActive, false);
      });
    });
  });

  describe("systems layout mode", () => {
    it("defaults to split mode", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      assert.equal(result.current.systemsLayoutMode, "split");
    });

    it("changes systems layout mode", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      act(() => {
        result.current.setSystemsLayoutMode("combine_all");
      });
      
      assert.equal(result.current.systemsLayoutMode, "combine_all");
    });

    it("sets custom systems group", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      act(() => {
        result.current.setCustomSystemsGroup(["neuro", "cv"]);
      });
      
      assert.deepEqual(result.current.customSystemsGroupIds, ["neuro", "cv"]);
      assert.equal(result.current.systemsLayoutMode, "custom");
    });
  });

  describe("patient roster layout mode", () => {
    it("sets patient roster layout mode", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });

      act(() => {
        result.current.setPatientRosterLayoutMode("topbar");
      });

      assert.equal(result.current.patientRosterLayoutMode, "topbar");
    });
  });
});
