export type SystemsLayoutMode = "split" | "combine_all" | "custom"

/**
 * Convert DashboardPrefs systemsReviewMode to DashboardLayoutContext SystemsLayoutMode
 * Maps "combine_custom" from prefs to "custom" in context
 */
export const toLayoutMode = (mode: import("@/lib/dashboardPrefs").DashboardPrefs["systemsReviewMode"]): SystemsLayoutMode => {
  if (mode === "combine_custom") return "custom"
  return mode
}

/**
 * Convert DashboardLayoutContext SystemsLayoutMode to DashboardPrefs systemsReviewMode
 * Maps "custom" in context to "combine_custom" in prefs
 */
export const toPrefsMode = (mode: SystemsLayoutMode): import("@/lib/dashboardPrefs").DashboardPrefs["systemsReviewMode"] => {
  if (mode === "custom") return "combine_custom"
  return mode
}