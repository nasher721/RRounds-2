/**
 * LEDGERIX DESIGN SYSTEM — REACT PRIMITIVES
 *
 * Thin, unopinionated wrappers over the `.lx-*` classes in components.css.
 * They add typing, sensible defaults and the small bits of composition logic
 * (delta direction, avatar initials, meter segments) that are tedious to
 * repeat — and nothing else. No context, no portals, no state library.
 *
 * Requires, once at your app entry:
 *   import "../design-system/ledgerix/tokens.css";
 *   import "../design-system/ledgerix/components.css";
 *
 * …and `className="lx-root"` on <body> or your app's outermost element, which
 * is what scopes the reset, focus ring and scrollbar styling.
 *
 * `cx` lives in `./utils` and the chart theme in `./chartTheme`, so this
 * module exports components only and Fast Refresh keeps working.
 *
 * These are deliberately NOT built on Radix. If you need a real modal, menu
 * or combobox, use your existing shadcn/Radix components and pass the
 * matching `.lx-*` class — the styling layer is independent of the behaviour
 * layer by design.
 */

import * as React from "react";

import { cx } from "./utils";

/* ==========================================================================
   UTIL
   ========================================================================== */

type Polymorphic<E extends React.ElementType> = {
  as?: E;
} & Omit<React.ComponentPropsWithoutRef<E>, "as">;

/* ==========================================================================
   BUTTON
   ========================================================================== */

export type ButtonVariant =
  | "primary"
  | "signal"
  | "secondary"
  | "ghost"
  | "subtle"
  | "inverse"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a square icon-only button. Requires an accessible label. */
  iconOnly?: boolean;
  pill?: boolean;
  block?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      iconOnly = false,
      pill = false,
      block = false,
      leadingIcon,
      trailingIcon,
      className,
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          "lx-btn",
          `lx-btn--${variant}`,
          size !== "md" && `lx-btn--${size}`,
          iconOnly && "lx-btn--icon",
          pill && "lx-btn--pill",
          block && "lx-btn--block",
          className,
        )}
        {...rest}
      >
        {leadingIcon}
        {children}
        {trailingIcon}
      </button>
    );
  },
);

/* ==========================================================================
   CARD
   ========================================================================== */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "inverse" | "brand";
  interactive?: boolean;
  flat?: boolean;
}

export function Card({
  variant = "default",
  interactive = false,
  flat = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cx(
        "lx-card",
        variant !== "default" && `lx-card--${variant}`,
        interactive && "lx-card--interactive",
        flat && "lx-card--flat",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** A ReactNode slot, not the native `title` tooltip attribute. */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned slot: a segmented control, menu button, legend. */
  actions?: React.ReactNode;
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className,
  children,
  ...rest
}: CardHeaderProps) {
  return (
    <div className={cx("lx-card__header", className)} {...rest}>
      <div>
        {title != null && <h3 className="lx-card__title">{title}</h3>}
        {subtitle != null && <p className="lx-card__subtitle">{subtitle}</p>}
        {children}
      </div>
      {actions != null && <div className="lx-topbar__actions">{actions}</div>}
    </div>
  );
}

export function CardBody({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("lx-card__body", className)} {...rest} />;
}

export function CardFooter({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("lx-card__footer", className)} {...rest} />;
}

/* ==========================================================================
   DELTA
   ========================================================================== */

export interface DeltaProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Ratio, not percentage: 0.124 renders "+12.4%". */
  value: number;
  digits?: number;
  /** Override the arrow, or pass null to drop it. */
  icon?: React.ReactNode;
  /** Treat a fall as neutral rather than negative (costs, churn, latency). */
  invertColor?: boolean;
}

export function Delta({
  value,
  digits = 1,
  icon,
  invertColor = false,
  className,
  ...rest
}: DeltaProps) {
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  // For metrics where "down is good" (costs, churn), swap the colour but keep
  // the arrow pointing the way the number actually moved.
  const tone =
    direction === "flat"
      ? "flat"
      : invertColor
        ? direction === "up"
          ? "down"
          : "up"
        : direction;

  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "—";
  const pct = value * 100;

  return (
    <span className={cx("lx-delta", `lx-delta--${tone}`, className)} {...rest}>
      {icon === undefined ? <span aria-hidden="true">{arrow}</span> : icon}
      {`${pct >= 0 ? "+" : ""}${pct.toFixed(digits)}%`}
    </span>
  );
}

/* ==========================================================================
   STAT CARD  (KPI tile)
   ========================================================================== */

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  /** Pre-formatted. Format with `formatCurrency` from tokens.ts. */
  value: React.ReactNode;
  delta?: number;
  /** e.g. "vs last month" — the comparison the delta is against. */
  comparison?: string;
  icon?: React.ReactNode;
  iconTone?: "brand" | "neutral";
  invertDelta?: boolean;
  /** Bleeds to the tile's bottom edge. Pass a <ResponsiveContainer>. */
  sparkline?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  delta,
  comparison,
  icon,
  iconTone = "brand",
  invertDelta = false,
  sparkline,
  className,
  ...rest
}: StatCardProps) {
  return (
    <div className={cx("lx-stat", className)} {...rest}>
      <div className="lx-stat__head">
        <span className="lx-stat__label">{label}</span>
        {icon != null && (
          <span
            className={cx(
              "lx-stat__icon",
              iconTone === "neutral" && "lx-stat__icon--neutral",
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>

      <div className="lx-stat__value">{value}</div>

      {(delta !== undefined || comparison) && (
        <div className="lx-stat__foot">
          {delta !== undefined && (
            <Delta value={delta} invertColor={invertDelta} />
          )}
          {comparison && <span>{comparison}</span>}
        </div>
      )}

      {sparkline && <div className="lx-stat__spark">{sparkline}</div>}
    </div>
  );
}

/* ==========================================================================
   BADGE
   ========================================================================== */

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "signal";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  outline?: boolean;
  dot?: boolean;
}

export function Badge({
  tone = "neutral",
  outline = false,
  dot = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cx(
        "lx-badge",
        tone !== "neutral" && `lx-badge--${tone}`,
        outline && "lx-badge--outline",
        className,
      )}
      {...rest}
    >
      {dot && <span className="lx-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ==========================================================================
   FORM
   ========================================================================== */

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor?: string;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
  ...rest
}: FieldProps) {
  return (
    <div className={cx("lx-field", className)} {...rest}>
      {label != null && (
        <label className="lx-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error != null ? (
        <span className="lx-error">{error}</span>
      ) : hint != null ? (
        <span className="lx-hint">{hint}</span>
      ) : null}
    </div>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx("lx-input", className)} {...rest} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea ref={ref} className={cx("lx-textarea", className)} {...rest} />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cx("lx-select", className)} {...rest} />;
});

export interface SearchInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export function SearchInput({ icon, className, ...rest }: SearchInputProps) {
  return (
    <div className={cx("lx-search", className)}>
      <span className="lx-search__icon" aria-hidden="true">
        {icon ?? <SearchGlyph />}
      </span>
      <input type="search" className="lx-input" {...rest} />
    </div>
  );
}

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({
  checked,
  onCheckedChange,
  className,
  ...rest
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cx("lx-switch", className)}
      onClick={() => onCheckedChange?.(!checked)}
      {...rest}
    />
  );
}

export interface SegmentedProps<T extends string> {
  options: Array<{ value: T; label: React.ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  ...rest
}: SegmentedProps<T>) {
  return (
    <div className={cx("lx-segmented", className)} role="tablist" {...rest}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          className="lx-segmented__item"
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ==========================================================================
   AVATAR
   ========================================================================== */

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name?: string;
  src?: string;
  size?: "sm" | "md" | "lg";
}

/** "Ada Lovelace" → "AL"; "ada" → "AD". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name = "",
  src,
  size = "md",
  className,
  ...rest
}: AvatarProps) {
  return (
    <span
      className={cx("lx-avatar", size !== "md" && `lx-avatar--${size}`, className)}
      title={name || undefined}
      {...rest}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          width="100%"
          height="100%"
          style={{ objectFit: "cover" }}
        />
      ) : (
        <span aria-hidden={!name}>{initialsOf(name)}</span>
      )}
    </span>
  );
}

export function AvatarGroup({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("lx-avatar-group", className)} {...rest} />;
}

/* ==========================================================================
   TABLE
   ========================================================================== */

export function Table({
  className,
  ...rest
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="lx-table-wrap">
      <table className={cx("lx-table", className)} {...rest} />
    </div>
  );
}

/** Marks a cell as numeric: right-aligned, tabular figures, semibold. */
export const num = "lx-num";

/* ==========================================================================
   PROGRESS / METER
   ========================================================================== */

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–1. */
  value: number;
  tone?: "brand" | "signal" | "warning" | "danger";
}

export function Progress({
  value,
  tone = "brand",
  className,
  ...rest
}: ProgressProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={cx("lx-progress", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      {...rest}
    >
      <div
        className={cx(
          "lx-progress__bar",
          tone !== "brand" && `lx-progress__bar--${tone}`,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export interface MeterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Segments are drawn in order, sized by their share of the total. */
  segments: Array<{ value: number; color: string; label?: string }>;
}

export function Meter({ segments, className, ...rest }: MeterProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  return (
    <div className={cx("lx-meter", className)} {...rest}>
      {segments.map((seg, i) => (
        <div
          key={seg.label ?? i}
          className="lx-meter__seg"
          title={seg.label}
          style={{
            width: `${(seg.value / total) * 100}%`,
            backgroundColor: seg.color,
          }}
        />
      ))}
    </div>
  );
}

/* ==========================================================================
   INSIGHT
   ========================================================================== */

export interface InsightProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** A ReactNode slot, not the native `title` tooltip attribute. */
  title?: React.ReactNode;
  icon?: React.ReactNode;
}

export function Insight({
  title = "AI insight",
  icon,
  className,
  children,
  ...rest
}: InsightProps) {
  return (
    <div className={cx("lx-insight", className)} {...rest}>
      <span className="lx-insight__icon" aria-hidden="true">
        {icon ?? <SparkGlyph />}
      </span>
      <div>
        <p className="lx-insight__title">{title}</p>
        <p className="lx-insight__body">{children}</p>
      </div>
    </div>
  );
}

/* ==========================================================================
   APP SHELL
   ========================================================================== */

export function Shell({
  collapsed = false,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { collapsed?: boolean }) {
  return (
    <div
      className={cx("lx-shell", collapsed && "lx-shell--collapsed", className)}
      {...rest}
    />
  );
}

export function Sidebar({
  className,
  ...rest
}: React.HTMLAttributes<HTMLElement>) {
  return <aside className={cx("lx-sidebar", className)} {...rest} />;
}

export function SidebarBrand({
  mark,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { mark?: React.ReactNode }) {
  return (
    <div className={cx("lx-sidebar__brand", className)} {...rest}>
      {mark != null && <span className="lx-sidebar__mark">{mark}</span>}
      {children}
    </div>
  );
}

export function Nav({ className, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return <nav className={cx("lx-nav", className)} {...rest} />;
}

export function NavSection({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("lx-nav__section", className)} {...rest} />;
}

export interface NavItemProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  icon?: React.ReactNode;
  active?: boolean;
  badge?: React.ReactNode;
}

export function NavItem({
  icon,
  active = false,
  badge,
  className,
  children,
  ...rest
}: NavItemProps) {
  return (
    <a
      className={cx("lx-nav__item", className)}
      aria-current={active ? "page" : undefined}
      {...rest}
    >
      {icon != null && (
        <span className="lx-nav__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
      {badge != null && <span className="lx-nav__badge">{badge}</span>}
    </a>
  );
}

export interface TopbarProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** A ReactNode slot, not the native `title` tooltip attribute. */
  title?: React.ReactNode;
  actions?: React.ReactNode;
}

export function Topbar({
  title,
  actions,
  className,
  children,
  ...rest
}: TopbarProps) {
  return (
    <header className={cx("lx-topbar", className)} {...rest}>
      {title != null ? <div className="lx-topbar__title">{title}</div> : children}
      {actions != null && <div className="lx-topbar__actions">{actions}</div>}
    </header>
  );
}

export function Page({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <main className={cx("lx-page", className)} {...rest} />;
}

export function PageHeader({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("lx-page__header", className)} {...rest} />;
}

export function Grid({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("lx-grid", className)} {...rest} />;
}

export type ColSpan = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;

export function Col<E extends React.ElementType = "div">({
  span = 12,
  as,
  className,
  ...rest
}: { span?: ColSpan } & Polymorphic<E>) {
  const Component = (as ?? "div") as React.ElementType;
  return <Component className={cx(`lx-col-${span}`, className)} {...rest} />;
}

/* ==========================================================================
   MISC
   ========================================================================== */

export function Skeleton({
  className,
  style,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("lx-skeleton", className)}
      style={{ height: "1em", ...style }}
      aria-hidden="true"
      {...rest}
    />
  );
}

export function Divider(props: React.HTMLAttributes<HTMLHRElement>) {
  return <hr className={cx("lx-divider", props.className)} {...props} />;
}

export function EmptyState({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("lx-empty", className)} {...rest} />;
}

/* ==========================================================================
   INLINE GLYPHS
   Two icons ship with the system so the defaults above render standalone.
   For everything else use your icon set (lucide-react matches the 1.5px
   stroke weight and 20px box this system is drawn for).
   ========================================================================== */

function SearchGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m20 20-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.3l-1.8-5.7L4.5 10.8 10.2 9 12 3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
