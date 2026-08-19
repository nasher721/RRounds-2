/**
 * LEDGERIX DESIGN SYSTEM — RECHARTS THEME (non-component exports)
 *
 * Prop bundles, hooks and formatters live here rather than in `charts.tsx`
 * so that file exports components only — a module mixing the two breaks React
 * Fast Refresh, which is what `react-refresh/only-export-components` warns
 * about.
 *
 * Usage:
 *
 *   import { axisProps, gridProps, useChartTheme } from "./react/chartTheme";
 *   import { LedgerixTooltip, AreaGradient } from "./react/charts";
 *
 *   const t = useChartTheme(theme);
 *
 *   <AreaChart data={data}>
 *     <defs><AreaGradient id="rev" /></defs>
 *     <CartesianGrid {...gridProps} />
 *     <XAxis dataKey="month" {...axisProps} />
 *     <YAxis {...axisProps} tickFormatter={compactCurrency} />
 *     <Tooltip content={<LedgerixTooltip />} cursor={t.cursor} />
 *     <Area dataKey="revenue" stroke={t.series[0]} fill="url(#rev)"
 *           strokeWidth={2.5} />
 *   </AreaChart>
 */


/* ==========================================================================
   STATIC PROP BUNDLES
   These reference CSS variables directly and so need no JS theme awareness.
   ========================================================================== */

/** Horizontal rules only. Vertical grid lines are noise in a time series. */
export const gridProps = {
  strokeDasharray: "0",
  vertical: false,
  stroke: "var(--lx-chart-grid)",
} as const;

/** No axis line, no tick marks — the labels are the axis. */
export const axisProps = {
  axisLine: false,
  tickLine: false,
  tick: {
    fill: "var(--lx-text-muted)",
    fontSize: 12,
    fontWeight: 500,
  },
  tickMargin: 10,
} as const;

/** Sensible plot padding: room for the tooltip and the top-most label. */
export const chartMargin = { top: 8, right: 8, bottom: 0, left: 0 } as const;

/* ==========================================================================
   LIVE THEME
   ========================================================================== */

export interface ChartTheme {
  series: string[];
  brand: string;
  signal: string;
  neutral: string;
  grid: string;
  axis: string;
  text: string;
  textMuted: string;
  surface: string;
  positive: string;
  negative: string;
  /** Hover cursor styling for <Tooltip cursor={…}>. */
  cursor: { fill: string } & Record<string, unknown>;
}

/**
 * Resolve the chart palette from live CSS variables.
 *
 * Deliberately not memoised: the whole point is to follow the active theme,
 * and a memo keyed on anything less than "the theme actually changed" hands
 * back last theme's colours. The cost is one `getComputedStyle` call per
 * render, which is well under the cost of the chart it feeds.
 *
 * Returns the light-theme fallbacks during SSR.
 */
export function useChartTheme(): ChartTheme {
  const read = readTokens();
  return {
    series: [
      read("chart-1", "#00a257"),
      read("chart-2", "#5b8def"),
      read("chart-3", "#8b74f0"),
      read("chart-4", "#b06e00"),
      read("chart-5", "#1f8b88"),
      read("chart-6", "#e5484d"),
      read("chart-7", "#6f9212"),
      read("chart-8", "#8a9186"),
    ],
    brand: read("brand", "#00c56a"),
    signal: read("signal", "#c8f94e"),
    neutral: read("chart-neutral", "#8a9186"),
    grid: read("chart-grid", "#e2e6de"),
    axis: read("chart-axis", "#a8b0a3"),
    text: read("text", "#0d0f0c"),
    textMuted: read("text-muted", "#8a9186"),
    surface: read("surface", "#ffffff"),
    positive: read("positive", "#007f44"),
    negative: read("negative", "#b4242d"),
    cursor: { fill: read("surface-hover", "#eef1ea") },
  };
}

/**
 * One `getComputedStyle` for the whole palette, rather than one per token.
 */
function readTokens(): (name: string, fallback: string) => string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return (_name, fallback) => fallback;
  }
  const style = getComputedStyle(document.documentElement);
  return (name, fallback) =>
    style.getPropertyValue(`--lx-${name}`).trim() || fallback;
}

/* ==========================================================================
   THE HOUSE PATTERN — "one bright, rest quiet"
   ========================================================================== */

/**
 * Per-mark fills where a single bar/cell is emphasised and the rest recede.
 * Render with <Cell> so each mark takes its own colour:
 *
 *   const fills = useEmphasisFills(data.length, currentMonthIndex);
 *   <Bar dataKey="value" radius={[8, 8, 0, 0]}>
 *     {data.map((d, i) => <Cell key={d.month} fill={fills[i]} />)}
 *   </Bar>
 */
export function useEmphasisFills(
  length: number,
  emphasisIndex: number,
  opts: { tone?: "brand" | "signal" } = {},
): string[] {
  const theme = useChartTheme();
  const bright = opts.tone === "signal" ? theme.signal : theme.brand;
  return Array.from({ length }, (_, i) =>
    i === emphasisIndex ? bright : theme.neutral,
  );
}

/* ==========================================================================
   FORMATTERS
   ========================================================================== */

/** 48210 → "$48.2K". Axis ticks and compact tooltips. */
export function compactCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** 48210 → "48.2K". Counts, not money. */
export function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
