/**
 * LEDGERIX DESIGN SYSTEM — TAILWIND PRESET
 *
 * Drop into any Tailwind 3.x project:
 *
 *   // tailwind.config.ts
 *   import ledgerix from "./design-system/ledgerix/tailwind.preset";
 *   export default {
 *     presets: [ledgerix],
 *     content: ["./src/**\/*.{ts,tsx}"],
 *   };
 *
 * The colour scales map to CSS variables rather than hex literals, so
 * `bg-surface` / `text-brand` follow the active theme with no `dark:` prefix
 * needed. Import `tokens.css` once at your entry point for the variables to
 * exist.
 *
 * Where you DO want a fixed value regardless of theme (a chart legend on a
 * permanently dark panel, say), the raw ramps are still available as
 * `green-500`, `neutral-925`, `lime-500`, etc.
 */

import type { Config } from "tailwindcss";
import { palette, typography, space, radius, layout, motion } from "./tokens";

const v = (token: string) => `var(--lx-${token})`;

/**
 * tokens.ts stores the type scale as flat `[size, lineHeight, tracking]`
 * tuples so it stays framework-neutral. Tailwind wants
 * `[size, { lineHeight, letterSpacing }]`, so reshape it here rather than
 * duplicating the numbers.
 */
type TwFontSize = [string, { lineHeight: string; letterSpacing: string }];

const fontSize = Object.fromEntries(
  Object.entries(typography.scale).map(([name, [size, lineHeight, letterSpacing]]) => [
    name,
    [size, { lineHeight, letterSpacing }] as TwFontSize,
  ]),
) as Record<keyof typeof typography.scale, TwFontSize>;

const preset = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [],
  theme: {
    extend: {
      colors: {
        /* --- Theme-aware semantic roles. Reach for these first. --------- */
        canvas: v("canvas"),
        surface: {
          DEFAULT: v("surface"),
          raised: v("surface-raised"),
          sunken: v("surface-sunken"),
          hover: v("surface-hover"),
          active: v("surface-active"),
          inverse: v("surface-inverse"),
        },
        ink: {
          DEFAULT: v("text"),
          secondary: v("text-secondary"),
          muted: v("text-muted"),
          disabled: v("text-disabled"),
          inverse: v("text-inverse"),
          brand: v("text-brand"),
        },
        line: {
          DEFAULT: v("border"),
          subtle: v("border-subtle"),
          strong: v("border-strong"),
          /** Interactive boundaries (inputs) — clears 3:1 against the surface. */
          control: v("border-control"),
          brand: v("border-brand"),
          focus: v("border-focus"),
        },
        brand: {
          DEFAULT: v("brand"),
          hover: v("brand-hover"),
          active: v("brand-active"),
          subtle: v("brand-subtle"),
          muted: v("brand-muted"),
          fg: v("on-brand"),
        },
        signal: {
          DEFAULT: v("signal"),
          hover: v("signal-hover"),
          fg: v("on-signal"),
        },
        success: { DEFAULT: v("success"), fg: v("success-fg"), bg: v("success-bg") },
        warning: { DEFAULT: v("warning"), fg: v("warning-fg"), bg: v("warning-bg") },
        danger: { DEFAULT: v("danger"), fg: v("danger-fg"), bg: v("danger-bg") },
        info: { DEFAULT: v("info"), fg: v("info-fg"), bg: v("info-bg") },
        positive: { DEFAULT: v("positive"), bg: v("positive-bg") },
        negative: { DEFAULT: v("negative"), bg: v("negative-bg") },

        chart: {
          1: v("chart-1"),
          2: v("chart-2"),
          3: v("chart-3"),
          4: v("chart-4"),
          5: v("chart-5"),
          6: v("chart-6"),
          7: v("chart-7"),
          8: v("chart-8"),
          grid: v("chart-grid"),
          axis: v("chart-axis"),
          neutral: v("chart-neutral"),
        },

        /* --- Raw ramps, for fixed-value cases. -------------------------- */
        green: palette.green,
        lime: palette.lime,
        neutral: palette.neutral,
      },

      fontFamily: {
        sans: [typography.fontFamily.sans],
        mono: [typography.fontFamily.mono],
      },

      fontSize,

      fontWeight: {
        light: String(typography.weight.light),
        normal: String(typography.weight.regular),
        medium: String(typography.weight.medium),
        semibold: String(typography.weight.semibold),
        bold: String(typography.weight.bold),
        extrabold: String(typography.weight.extrabold),
      },

      letterSpacing: {
        tighter: "-0.03em",
        tight: "-0.02em",
        snug: "-0.01em",
        normal: "0em",
        wide: "0.02em",
        wider: "0.08em",
      },

      spacing: space as unknown as Record<string, string>,

      borderRadius: {
        ...radius,
        // Aliases so `rounded-card` / `rounded-control` read as intent.
        card: radius.xl,
        control: radius.md,
        tile: radius.lg,
        panel: radius["2xl"],
      },

      boxShadow: {
        xs: v("shadow-xs"),
        sm: v("shadow-sm"),
        DEFAULT: v("shadow-sm"),
        md: v("shadow-md"),
        lg: v("shadow-lg"),
        xl: v("shadow-xl"),
        focus: v("shadow-focus"),
        brand: v("shadow-brand"),
        none: "none",
      },

      transitionTimingFunction: {
        DEFAULT: motion.ease.default,
        smooth: motion.ease.default,
        out: motion.ease.out,
        "in-out": motion.ease.inOut,
        spring: motion.ease.spring,
      },

      transitionDuration: {
        instant: `${motion.duration.instant}ms`,
        fast: `${motion.duration.fast}ms`,
        DEFAULT: `${motion.duration.base}ms`,
        base: `${motion.duration.base}ms`,
        slow: `${motion.duration.slow}ms`,
        slower: `${motion.duration.slower}ms`,
      },

      maxWidth: {
        content: `${layout.contentMax}px`,
      },

      width: {
        sidebar: `${layout.sidebarWidth}px`,
        "sidebar-collapsed": `${layout.sidebarWidthCollapsed}px`,
      },

      height: {
        topbar: `${layout.topbarHeight}px`,
      },

      zIndex: Object.fromEntries(
        Object.entries(layout.z).map(([k, n]) => [k, String(n)]),
      ),

      keyframes: {
        "lx-fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "lx-shimmer": {
          to: { backgroundPosition: "-200% 0" },
        },
        "lx-pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgb(0 197 106 / 0.45)" },
          "70%": { boxShadow: "0 0 0 8px rgb(0 197 106 / 0)" },
          "100%": { boxShadow: "0 0 0 0 rgb(0 197 106 / 0)" },
        },
      },

      animation: {
        "fade-up": `lx-fade-up ${motion.duration.slow}ms ${motion.ease.out} both`,
        shimmer: "lx-shimmer 1.4s ease-in-out infinite",
        "pulse-ring": "lx-pulse-ring 2s ease-out infinite",
      },
    },
  },
} satisfies Config;

export default preset;
