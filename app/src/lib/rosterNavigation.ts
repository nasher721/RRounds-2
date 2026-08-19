/**
 * Keyboard navigation math for the desktop patient roster rail.
 *
 * A thin, vertical, paging-enabled binding of the shared traversal rules in
 * `listKeyboardNavigation`. Kept as its own module so the rail imports an
 * intention-revealing name and so roster-specific behavior has one place to
 * grow if it ever diverges from the chart's tab strip.
 */

import {
  PAGE_STEP,
  resolveSequentialNavigationIndex,
} from "@/lib/listKeyboardNavigation";

/** Rows moved by PageUp / PageDown in one press. */
export const ROSTER_PAGE_STEP = PAGE_STEP;

/**
 * Resolves the roster index a navigation key should move to.
 *
 * - `ArrowDown` / `ArrowUp` step by one and wrap around the ends, matching the
 *   existing `Cmd/Ctrl + ]` / `[` patient shortcuts.
 * - `Home` / `End` jump to the first / last patient.
 * - `PageDown` / `PageUp` jump by {@link ROSTER_PAGE_STEP} rows and clamp
 *   instead of wrapping, so a long roster cannot skip past an end.
 *
 * @param key - `KeyboardEvent.key`.
 * @param currentIndex - Index of the selected row, or `-1` when none is selected.
 * @param count - Number of rows currently rendered.
 * @returns The target index, or `null` when the key is not a navigation key or
 * there is nothing to navigate (callers should not `preventDefault` on `null`).
 */
export function resolveRosterNavigationIndex(
  key: string,
  currentIndex: number,
  count: number,
): number | null {
  return resolveSequentialNavigationIndex(key, currentIndex, count, {
    orientation: "vertical",
    paging: true,
  });
}
