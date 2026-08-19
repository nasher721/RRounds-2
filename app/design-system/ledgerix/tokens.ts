/**
 * LEDGERIX DESIGN SYSTEM — TOKENS (TypeScript)
 *
 * A typed mirror of `tokens.css`, for the places CSS variables can't reach:
 * chart libraries that need literal colour strings, canvas/SVG rendering,
 * PDF export, React Native, or anything running outside the DOM.
 *
 * Two ways to consume colour here:
 *
 *   `palette`  — literal hex values. Theme-blind. Use when you need a real
 *                string and you know which theme you're in.
 *   `cssVar()` — a `var(--lx-…)` reference. Theme-aware, and the default
 *                choice anywhere the value lands in the DOM, because it keeps
 *                light/dark switching free.
 *
 * Keep this file in sync with tokens.css. `npm run ledgerix:check` (see
 * README) diffs the two and fails if they drift.
 */

/* ==========================================================================
   PRIMITIVES
   ========================================================================== */

export const palette = {
  green: {
    50: "#e8fbf0",
    100: "#c6f5dc",
    200: "#92ecbe",
    300: "#52de9a",
    400: "#17cd78",
    500: "#00c56a",
    600: "#00a257",
    700: "#007f44",
    800: "#0a5c34",
    900: "#0b3d25",
    950: "#07261a",
  },
  lime: {
    300: "#dcfb7f",
    400: "#cef95a",
    500: "#c8f94e",
    600: "#b0e02f",
    700: "#8bb520",
    800: "#6f9212",
  },
  neutral: {
    0: "#ffffff",
    25: "#fafbf9",
    50: "#f5f7f3",
    100: "#eef1ea",
    200: "#e2e6de",
    300: "#cdd3c8",
    400: "#a8b0a3",
    500: "#8a9186",
    600: "#6b7268",
    700: "#4d5449",
    800: "#333a30",
    850: "#242821",
    900: "#1a1d18",
    925: "#121412",
    950: "#0d0f0c",
    975: "#0a0b0a",
  },
  amber: { 100: "#fef3c7", 400: "#fbbf3c", 500: "#f5a524", 600: "#d38508", 650: "#b06e00", 700: "#9a6100" },
  red: { 100: "#fee4e2", 400: "#f2585e", 500: "#e5484d", 600: "#c8323b", 700: "#b4242d" },
  blue: { 100: "#dbeafe", 400: "#7aa5f5", 500: "#5b8def", 600: "#3a6fd8", 700: "#2f5fc0" },
  violet: { 400: "#a78bfa", 500: "#8b74f0" },
  teal: { 400: "#45c4c0", 500: "#2aa9a5", 600: "#1f8b88" },
} as const;

/* ==========================================================================
   SEMANTIC ROLES, RESOLVED PER THEME
   Mirrors the light/dark blocks in tokens.css.
   ========================================================================== */

export type ThemeName = "light" | "dark";

/**
 * Every semantic colour role. Values are widened to `string` so the dark map
 * can hold different values (and `rgb(… / α)` strings) for the same keys —
 * with `as const` they'd be locked to light mode's literals.
 */
export interface SemanticColors {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  surfaceHover: string;
  surfaceInverse: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  textInverse: string;
  textBrand: string;

  border: string;
  borderSubtle: string;
  borderStrong: string;
  borderControl: string;
  borderFocus: string;

  brand: string;
  brandHover: string;
  brandSubtle: string;
  onBrand: string;

  signal: string;
  onSignal: string;

  success: string;
  warning: string;
  danger: string;
  info: string;

  positive: string;
  negative: string;

  chartGrid: string;
  chartAxis: string;
  chartNeutral: string;
  chartTooltipBg: string;
  chartTooltipFg: string;
}

const lightSemantic: SemanticColors = {
  canvas: palette.neutral[50],
  surface: palette.neutral[0],
  surfaceRaised: palette.neutral[0],
  surfaceSunken: palette.neutral[100],
  surfaceHover: palette.neutral[100],
  surfaceInverse: palette.neutral[950],

  text: palette.neutral[950],
  textSecondary: palette.neutral[700],
  textMuted: palette.neutral[600],
  textDisabled: palette.neutral[400],
  textInverse: palette.neutral[25],
  textBrand: palette.green[700],

  border: palette.neutral[200],
  borderSubtle: palette.neutral[100],
  borderStrong: palette.neutral[300],
  borderControl: palette.neutral[500],
  borderFocus: palette.green[600],

  brand: palette.green[500],
  brandHover: palette.green[600],
  brandSubtle: palette.green[50],
  // Ink, not white: white on green-500 is 2.28:1.
  onBrand: palette.neutral[950],

  signal: palette.lime[500],
  onSignal: palette.neutral[950],

  success: palette.green[500],
  warning: palette.amber[500],
  danger: palette.red[500],
  info: palette.blue[500],

  positive: palette.green[700],
  negative: palette.red[700],

  chartGrid: palette.neutral[200],
  chartAxis: palette.neutral[400],
  chartNeutral: palette.neutral[500],
  chartTooltipBg: palette.neutral[950],
  chartTooltipFg: palette.neutral[25],
};

const darkSemantic: SemanticColors = {
  canvas: palette.neutral[975],
  surface: palette.neutral[925],
  surfaceRaised: palette.neutral[900],
  surfaceSunken: palette.neutral[950],
  surfaceHover: palette.neutral[850],
  surfaceInverse: palette.neutral[50],

  text: palette.neutral[25],
  textSecondary: palette.neutral[400],
  textMuted: palette.neutral[500],
  textDisabled: palette.neutral[700],
  textInverse: palette.neutral[950],
  textBrand: palette.green[400],

  border: palette.neutral[850],
  borderSubtle: palette.neutral[900],
  borderStrong: palette.neutral[800],
  borderControl: palette.neutral[600],
  borderFocus: palette.green[400],

  brand: palette.green[500],
  brandHover: palette.green[400],
  brandSubtle: "rgb(0 197 106 / 0.14)",
  onBrand: palette.neutral[975],

  signal: palette.lime[500],
  onSignal: palette.neutral[975],

  success: palette.green[400],
  warning: palette.amber[400],
  danger: palette.red[400],
  info: palette.blue[400],

  positive: palette.green[400],
  negative: palette.red[400],

  chartGrid: palette.neutral[850],
  chartAxis: palette.neutral[600],
  chartNeutral: palette.neutral[600],
  chartTooltipBg: palette.neutral[800],
  chartTooltipFg: palette.neutral[25],
};

export const semantic: Record<ThemeName, SemanticColors> = {
  light: lightSemantic,
  dark: darkSemantic,
};

/** Resolve semantic colours for a theme. Defaults to light. */
export function colors(theme: ThemeName = "light"): SemanticColors {
  return semantic[theme];
}

/* ==========================================================================
   CHART RAMP
   Ordered by emphasis: index 0 is the metric the screen is about.
   ========================================================================== */

export const chartSeries: Record<ThemeName, string[]> = {
  // Light steps sit deeper than the equivalent UI colours so every mark
  // clears 3:1 on a white card — green-500 is 2.28:1 there, lime is 1.23:1.
  light: [
    palette.green[600],
    palette.blue[500],
    palette.violet[500],
    palette.amber[650],
    palette.teal[600],
    palette.red[500],
    palette.lime[800],
    palette.neutral[500],
  ],
  dark: [
    palette.green[400],
    palette.blue[400],
    palette.violet[400],
    palette.amber[400],
    palette.teal[400],
    palette.red[400],
    palette.lime[500],
    palette.neutral[500],
  ],
};

/**
 * The house chart pattern: "one bright, rest quiet".
 *
 * Give it a series length and the index to emphasise, and every other mark
 * comes back in the muted neutral. This is the single most recognisable move
 * in the system — use it for month-over-month bars, category comparisons, and
 * anywhere one value is the answer and the rest are context.
 */
export function emphasisFills(
  length: number,
  emphasisIndex: number,
  theme: ThemeName = "light",
): string[] {
  const c = colors(theme);
  return Array.from({ length }, (_, i) =>
    i === emphasisIndex ? c.brand : c.chartNeutral,
  );
}

/* ==========================================================================
   TYPOGRAPHY
   ========================================================================== */

export const typography = {
  fontFamily: {
    sans: '"Urbanist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace',
  },
  weight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  /** [fontSize, lineHeight, letterSpacing] — px sizes noted in comments. */
  scale: {
    "2xs": ["0.6875rem", "1.3", "0.08em"], // 11 — overline
    xs: ["0.75rem", "1.3", "0"], //            12 — caption, chart tick
    sm: ["0.8125rem", "1.5", "0"], //          13 — dense cell
    base: ["0.875rem", "1.5", "0"], //         14 — DEFAULT app body
    md: ["1rem", "1.5", "0"], //               16 — comfortable body
    lg: ["1.125rem", "1.3", "-0.01em"], //     18 — card title
    xl: ["1.25rem", "1.3", "-0.01em"], //      20 — section heading
    "2xl": ["1.5rem", "1.3", "-0.02em"], //    24 — page heading
    "3xl": ["1.875rem", "1.15", "-0.02em"], // 30 — small display
    "4xl": ["2.25rem", "1", "-0.02em"], //     36 — KPI figure
    "5xl": ["2.75rem", "1.15", "-0.03em"], //  44 — display
    "6xl": ["3.5rem", "1", "-0.03em"], //      56 — hero display
  },
} as const;

/* ==========================================================================
   SPACE / RADIUS / SHADOW / MOTION / LAYOUT
   ========================================================================== */

export const space = {
  0: "0",
  px: "1px",
  0.5: "0.125rem",
  1: "0.25rem",
  1.5: "0.375rem",
  2: "0.5rem",
  2.5: "0.625rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
} as const;

export const radius = {
  none: "0",
  xs: "4px",
  sm: "8px",
  md: "12px", // controls
  lg: "16px", // inner tiles
  xl: "20px", // CARDS — the signature radius
  "2xl": "24px",
  "3xl": "32px",
  full: "9999px",
} as const;

export const shadow = {
  light: {
    xs: "0 1px 2px 0 rgb(13 15 12 / 0.04)",
    sm: "0 1px 3px 0 rgb(13 15 12 / 0.06), 0 1px 2px -1px rgb(13 15 12 / 0.04)",
    md: "0 4px 12px -2px rgb(13 15 12 / 0.07), 0 2px 4px -2px rgb(13 15 12 / 0.04)",
    lg: "0 12px 28px -6px rgb(13 15 12 / 0.10), 0 4px 8px -4px rgb(13 15 12 / 0.05)",
    xl: "0 24px 56px -12px rgb(13 15 12 / 0.14)",
    focus: "0 0 0 3px rgb(0 197 106 / 0.22)",
    brand: "0 6px 20px -6px rgb(0 197 106 / 0.42)",
  },
  dark: {
    xs: "0 1px 2px 0 rgb(0 0 0 / 0.30)",
    sm: "0 1px 3px 0 rgb(0 0 0 / 0.40)",
    md: "0 4px 12px -2px rgb(0 0 0 / 0.48)",
    lg: "0 12px 28px -6px rgb(0 0 0 / 0.55)",
    xl: "0 24px 56px -12px rgb(0 0 0 / 0.65)",
    focus: "0 0 0 3px rgb(0 197 106 / 0.34)",
    brand: "0 6px 24px -6px rgb(0 197 106 / 0.34)",
  },
} as const;

export const motion = {
  duration: {
    instant: 80,
    fast: 140,
    base: 200,
    slow: 320,
    slower: 480,
  },
  ease: {
    default: "cubic-bezier(0.32, 0.72, 0, 1)",
    out: "cubic-bezier(0.16, 1, 0.3, 1)",
    inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
} as const;

export const layout = {
  sidebarWidth: 264,
  sidebarWidthCollapsed: 76,
  topbarHeight: 68,
  contentMax: 1440,
  pageGutter: 24,
  gridGap: 20,
  z: {
    base: 0,
    sticky: 100,
    drawer: 200,
    overlay: 300,
    modal: 400,
    popover: 500,
    toast: 600,
    tooltip: 700,
  },
} as const;

/* ==========================================================================
   HELPERS
   ========================================================================== */

/**
 * Reference a token as a live CSS variable, so the value follows the active
 * theme. Prefer this over `palette`/`colors()` for anything rendered in DOM.
 *
 *   cssVar("brand")            → "var(--lx-brand)"
 *   cssVar("chart-1")          → "var(--lx-chart-1)"
 *   cssVar("brand", "#00c56a") → "var(--lx-brand, #00c56a)"
 */
export function cssVar(name: string, fallback?: string): string {
  const token = name.startsWith("--lx-") ? name : `--lx-${name}`;
  return fallback ? `var(${token}, ${fallback})` : `var(${token})`;
}

/**
 * Read a token's computed value at runtime. Useful for chart libraries that
 * demand a real colour string but must still respect the active theme.
 * Returns `fallback` during SSR.
 */
export function readToken(name: string, fallback = ""): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }
  const token = name.startsWith("--lx-") ? name : `--lx-${name}`;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value || fallback;
}

/** Currency formatter matching the system's tabular figures. */
export function formatCurrency(
  value: number,
  { currency = "USD", locale = "en-US", compact = false } = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(value);
}

/** Signed percentage for delta chips: 0.124 → "+12.4%". */
export function formatDelta(ratio: number, digits = 1): string {
  const pct = ratio * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(digits)}%`;
}

export const ledgerix = {
  palette,
  semantic,
  colors,
  chartSeries,
  emphasisFills,
  typography,
  space,
  radius,
  shadow,
  motion,
  layout,
  cssVar,
  readToken,
} as const;

export default ledgerix;
