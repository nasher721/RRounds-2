/**
 * LEDGERIX DESIGN SYSTEM — REACT UTILITIES
 *
 * Non-component helpers live here so `index.tsx` exports components only,
 * which is what keeps React Fast Refresh working for the whole library.
 */

/**
 * Minimal class joiner — drops falsy entries and joins the rest.
 * Swap for your app's own `cn()` if it already has one.
 */
export function cx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
