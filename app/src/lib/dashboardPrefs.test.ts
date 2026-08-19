import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DASHBOARD_PREFS_STORAGE_KEY,
  DEFAULT_DASHBOARD_PREFS,
  loadDashboardPrefs,
  sanitizeDashboardPrefs,
  saveDashboardPrefs,
} from "@/lib/dashboardPrefs";
import { createSafeStorage } from "@/utils/safeStorage";
import { createThrowingStorage } from "@/test/dashboardRegressionFixtures";

describe("sanitizeDashboardPrefs", () => {
  it("returns defaults for non-object input", () => {
    const prefs = sanitizeDashboardPrefs(null);
    assert.deepEqual(prefs, DEFAULT_DASHBOARD_PREFS);
  });

  it("sanitizes mode and de-duplicates custom keys", () => {
    const prefs = sanitizeDashboardPrefs({
      leftPatientListOpen: false,
      rightTasksPanelOpen: true,
      focusModeEnabled: true,
      systemsReviewMode: "combine_custom",
      systemsCustomCombineKeys: ["neuro", "cv", "neuro", "", "  ", 1],
      patientRosterLayoutMode: "topbar",
      patientListViewMode: "compact",
    });

    assert.equal(prefs.leftPatientListOpen, false);
    assert.equal(prefs.rightTasksPanelOpen, true);
    assert.equal(prefs.focusModeEnabled, true);
    assert.equal(prefs.systemsReviewMode, "combine_custom");
    assert.deepEqual(prefs.systemsCustomCombineKeys, ["neuro", "cv"]);
    assert.equal(prefs.patientRosterLayoutMode, "topbar");
    assert.equal(prefs.patientListViewMode, "compact");
  });

  it("migrates legacy tasksRailOpen key", () => {
    const prefs = sanitizeDashboardPrefs({ tasksRailOpen: false });
    assert.equal(prefs.rightTasksPanelOpen, false);
  });

  it("falls back to split mode for invalid values", () => {
    const prefs = sanitizeDashboardPrefs({ systemsReviewMode: "unknown_mode" });
    assert.equal(prefs.systemsReviewMode, "split");
  });

  it("falls back to sidebar for invalid roster layout mode", () => {
    const prefs = sanitizeDashboardPrefs({ patientRosterLayoutMode: "unknown_mode" });
    assert.equal(prefs.patientRosterLayoutMode, "sidebar");
  });

  it("falls back to rich for invalid patient list view mode", () => {
    const prefs = sanitizeDashboardPrefs({ patientListViewMode: "unknown_mode" });
    assert.equal(prefs.patientListViewMode, "rich");
  });
});

describe("dashboard preference storage failures", () => {
  it("returns defaults when localStorage cannot be accessed", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Access to storage is not allowed from this context");
      },
    });

    try {
      assert.deepEqual(loadDashboardPrefs(), DEFAULT_DASHBOARD_PREFS);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, "localStorage", originalDescriptor);
      }
    }
  });

  it("keeps working when localStorage writes throw", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    const throwingStorage = createThrowingStorage({ onGetItem: "null", onSetItem: "throw" });

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: throwingStorage,
    });

    try {
      assert.doesNotThrow(() => {
        saveDashboardPrefs({ ...DEFAULT_DASHBOARD_PREFS, leftPatientListOpen: false });
      });
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, "localStorage", originalDescriptor);
      }
    }
  });

  it("creates a memory-backed safe storage adapter when localStorage access throws", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Access to storage is not allowed from this context");
      },
    });

    try {
      const storage = createSafeStorage();
      storage.setItem(DASHBOARD_PREFS_STORAGE_KEY, "memory-value");
      assert.equal(storage.getItem(DASHBOARD_PREFS_STORAGE_KEY), "memory-value");
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, "localStorage", originalDescriptor);
      }
    }
  });

  it("returns defaults and quarantines corrupt JSON instead of masking it", () => {
    const memory = new Map<string, string>();
    memory.set(DASHBOARD_PREFS_STORAGE_KEY, "{not-valid-json");
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    };

    assert.deepEqual(loadDashboardPrefs(storage), DEFAULT_DASHBOARD_PREFS);
    assert.equal(memory.has(DASHBOARD_PREFS_STORAGE_KEY), false);
  });
});
