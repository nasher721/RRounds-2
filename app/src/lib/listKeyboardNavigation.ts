/**
 * Shared keyboard-traversal math for the workspace's single-select widgets
 * (the roster rail's patient rows, the chart's documentation tab strip).
 *
 * Pure: no DOM, no React. Callers own focus movement and activation; this
 * module only answers "which index does this key go to?", so the wrap and
 * clamp rules that decide where a clinician lands stay unit-testable alone.
 */

/** Rows moved by PageUp / PageDown in one press. */
export const PAGE_STEP = 5;

export type NavigationOrientation = "vertical" | "horizontal";

const NEXT_KEYS: Record<NavigationOrientation, string> = {
  vertical: "ArrowDown",
  horizontal: "ArrowRight",
};

const PREVIOUS_KEYS: Record<NavigationOrientation, string> = {
  vertical: "ArrowUp",
  horizontal: "ArrowLeft",
};

export interface SequentialNavigationOptions {
  /** Which arrow keys traverse the widget. Defaults to `"vertical"`. */
  orientation?: NavigationOrientation;
  /**
   * Whether PageUp / PageDown jump by {@link PAGE_STEP}. Long lists want this;
   * a short tab strip does not, and should leave those keys to the scroll
   * container. Defaults to `false`.
   */
  paging?: boolean;
}

const clamp = (index: number, count: number): number =>
  Math.min(Math.max(index, 0), count - 1);

/**
 * Resolves the index a navigation key should move to.
 *
 * - The orientation's arrow keys step by one and wrap around the ends.
 * - `Home` / `End` jump to the first / last item.
 * - With `paging`, `PageDown` / `PageUp` jump by {@link PAGE_STEP} and clamp
 *   instead of wrapping, so a long list cannot skip past an end.
 *
 * @param key - `KeyboardEvent.key`.
 * @param currentIndex - Index of the current item, or `-1` when none is current.
 * @param count - Number of items currently rendered.
 * @returns The target index, or `null` when the key is not a navigation key for
 * this widget or there is nothing to navigate. Callers must not `preventDefault`
 * on `null`, so unrelated keys keep reaching the page.
 */
export function resolveSequentialNavigationIndex(
  key: string,
  currentIndex: number,
  count: number,
  options: SequentialNavigationOptions = {},
): number | null {
  if (count <= 0) return null;

  const orientation = options.orientation ?? "vertical";
  const hasCurrent = Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < count;
  const current = hasCurrent ? currentIndex : -1;

  if (key === NEXT_KEYS[orientation]) {
    return current < 0 ? 0 : (current + 1) % count;
  }
  if (key === PREVIOUS_KEYS[orientation]) {
    return current < 0 ? count - 1 : (current - 1 + count) % count;
  }
  if (key === "Home") return 0;
  if (key === "End") return count - 1;

  if (options.paging) {
    if (key === "PageDown") return clamp((current < 0 ? 0 : current) + PAGE_STEP, count);
    if (key === "PageUp") return clamp((current < 0 ? count - 1 : current) - PAGE_STEP, count);
  }

  return null;
}
