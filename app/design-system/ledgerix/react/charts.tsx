/**
 * LEDGERIX DESIGN SYSTEM — CHART COMPONENTS
 *
 * Components only. Prop bundles, hooks and formatters live in `chartTheme.ts`
 * so this module stays Fast Refresh-friendly.
 */

import * as React from "react";

/* ==========================================================================
   GRADIENT
   ========================================================================== */

export interface AreaGradientProps {
  id: string;
  /** Any CSS colour. Defaults to the brand green. */
  color?: string;
  from?: number;
  to?: number;
}

/**
 * The green wash under a line. Drop inside <defs> and reference as
 * `fill="url(#id)"`.
 */
export function AreaGradient({
  id,
  color = "var(--lx-chart-1)",
  from = 0.28,
  to = 0,
}: AreaGradientProps) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={from} />
      <stop offset="100%" stopColor={color} stopOpacity={to} />
    </linearGradient>
  );
}

/* ==========================================================================
   TOOLTIP
   ========================================================================== */

interface TooltipPayloadItem {
  name?: string | number;
  value?: string | number;
  color?: string;
  dataKey?: string | number;
}

export interface LedgerixTooltipProps {
  /* Recharts injects these; all optional so the component can be passed bare
     as `content={<LedgerixTooltip />}`. */
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  /** Format each value — usually a currency formatter. */
  formatter?: (value: string | number, name?: string | number) => React.ReactNode;
  labelFormatter?: (label: string | number) => React.ReactNode;
}

export function LedgerixTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: LedgerixTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="lx-chart__tooltip">
      {label != null && (
        <div className="lx-chart__tooltip-label">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      {payload.map((item, i) => (
        <div
          key={item.dataKey ?? i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            whiteSpace: "nowrap",
          }}
        >
          {item.color && (
            <span
              className="lx-chart__swatch"
              style={{ backgroundColor: item.color }}
            />
          )}
          {item.name != null && <span>{item.name}</span>}
          <strong style={{ marginLeft: "auto" }}>
            {formatter && item.value != null
              ? formatter(item.value, item.name)
              : item.value}
          </strong>
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   LEGEND
   Recharts' built-in legend is hard to style; this one is plain DOM and sits
   in the card header where legends belong.
   ========================================================================== */

export interface ChartLegendProps {
  items: Array<{ label: string; color: string }>;
  className?: string;
}

export function ChartLegend({ items, className }: ChartLegendProps) {
  return (
    <div className={["lx-chart__legend", className].filter(Boolean).join(" ")}>
      {items.map((item) => (
        <span key={item.label} className="lx-chart__legend-item">
          <span
            className="lx-chart__swatch"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
