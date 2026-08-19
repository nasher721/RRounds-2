# Ledgerix Design System

A portable design system for finance / CRM / analytics dashboards, reconstructed
from the **Ledgerix CRM — FMS & UX/UI Dashboard** project by
[RonDesignLab](https://rondesignlab.com/cases/ledgerix-crm-finance-saas-ux-ui-design)
([Behance](https://www.behance.net/gallery/232976091/Ledgerix-CRM-FMS-UX-UI-Dashboard-Design),
[Dribbble](https://dribbble.com/shots/25924450-Ledgerix-CRM-Finance-Management-Dashboard)).

Self-contained and framework-agnostic. It does **not** touch the host app's
existing styles — nothing here is imported by Round Robin Notes unless you
import it yourself.

> **On provenance.** The environment this was built in blocks Behance, Dribbble
> and rondesignlab.com at the network layer, so the source screens could not be
> viewed directly. The system below is reconstructed from the studio's own
> published design rationale — the Urbanist typeface, the "vibrant green for
> action, growth and reliability against neutral black, white and grey" palette,
> and the documented screen inventory — and then engineered out into a complete,
> internally consistent system. It is faithful to the stated design language,
> not pixel-matched to the renders. See
> [Tuning to the source](#tuning-to-the-source) to close the last gap in minutes.

---

## What's in the box

| File | What it is |
|---|---|
| `ledgerix.css` | **Everything in one file** — tokens + components. Start here. |
| `tokens.css` | Source of truth. All CSS variables, light + dark. |
| `components.css` | `.lx-*` component classes. Framework-free. |
| `tokens.ts` | Typed mirror of the tokens, for charts / canvas / PDF / RN. |
| `tailwind.preset.ts` | Tailwind 3.x preset mapping tokens to utilities. |
| `react/index.tsx` | React primitives (Button, Card, StatCard, Table, shell…). |
| `react/charts.tsx` | Chart components — tooltip, legend, gradient. |
| `react/chartTheme.ts` | Chart prop bundles, theme hook, formatters. |
| `react/utils.ts` | `cx` class joiner. |
| `style-guide.html` | Living style guide — open it in a browser, no build step. |

`style-guide.html` inlines `tokens.css` and `components.css` verbatim, so it is a
snapshot: after changing a token, regenerate it (or just read it as the
reference it was at the time). Everything it renders — the demo dashboard, the
components, the charts — is drawn by the shipped system, not mocked up.

Pick the layer you want. Plain HTML + `components.css` is a complete answer;
so is Tailwind + the preset with no CSS classes at all.

---

## Quick start

### 1. Any project (plain CSS)

One file, nothing else required:

```html
<link rel="stylesheet" href="ledgerix.css">

<body class="lx-root">
  <button class="lx-btn lx-btn--primary">Export</button>
</body>
```

`ledgerix.css` is `tokens.css` + `components.css` concatenated, and pulls
Urbanist itself. Use the two files separately instead if you want to swap the
token layer without touching components:

```html
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components.css">
```

`tokens.css` also `@import`s Urbanist itself, so the font links are an
optimisation, not a requirement. If you keep them, delete the `@import` at the
top of `tokens.css` — a `<link>` avoids the request waterfall behind your
stylesheet.

The `lx-root` class is what scopes the box-sizing reset, focus ring and
scrollbar styling. Without it the components still render; they just don't own
the document.

### 2. Vite / React

```ts
// main.tsx
import "./design-system/ledgerix/tokens.css";
import "./design-system/ledgerix/components.css";
```

```tsx
import { Card, StatCard, Button, Delta } from "./design-system/ledgerix/react";
import { formatCurrency } from "./design-system/ledgerix/tokens";

<StatCard
  label="Net revenue"
  value={formatCurrency(482_140, { compact: true })}
  delta={0.124}
  comparison="vs last month"
/>
```

### 3. Tailwind

```ts
// tailwind.config.ts
import ledgerix from "./design-system/ledgerix/tailwind.preset";

export default {
  presets: [ledgerix],
  content: ["./src/**/*.{ts,tsx}"],
};
```

Then write semantic utilities that follow the theme with no `dark:` variants:

```tsx
<div className="bg-surface border border-line rounded-card p-5 shadow-xs">
  <p className="text-2xs font-semibold tracking-wider uppercase text-ink-muted">
    Net revenue
  </p>
  <p className="text-4xl font-bold text-ink tabular-nums">$482.1K</p>
</div>
```

You still need `tokens.css` imported — the preset maps to CSS variables that
`tokens.css` declares.

> **Adding it to an existing shadcn app:** the preset sets
> `darkMode: ["class", '[data-theme="dark"]']` and adds new colour names
> (`surface`, `ink`, `line`, `brand`) rather than overwriting shadcn's
> (`background`, `foreground`, `primary`). The two coexist. To move shadcn
> components onto this palette instead, point shadcn's HSL variables at the
> Ledgerix tokens in your own CSS.

---

## Dark mode

The full **light** palette is declared on bare `:root`. Dark is applied by
three routes, all supported at once:

| How | Selector |
|---|---|
| OS preference | `@media (prefers-color-scheme: dark)`, unless `data-theme="light"` |
| Explicit attribute | `<html data-theme="dark">` |
| Tailwind / shadcn class | `<html class="dark">` |

So an explicit user choice always beats the OS, in both directions. Toggling is
one attribute:

```ts
document.documentElement.dataset.theme = "dark"; // or "light", or remove for system
```

Every component reads semantic tokens only, so there is no per-component dark
styling to maintain.

---

## The design language

Six decisions carry the look. Change these and it stops being Ledgerix.

### 1. Urbanist, tracked tight

A geometric sans. Because the counters are round and open, headings look loose
at default tracking — so the scale applies **negative letter-spacing that grows
with size**: `-0.01em` at 18px, `-0.02em` at 24–36px, `-0.03em` at 44px+. Body
text stays at `0`.

Weights in use: 400 body, 500 nav/labels, 600 titles and buttons, 700 figures
and headings, 800 for the wordmark only.

### 2. One green, used sparingly

`--lx-brand` `#00C56A` carries action, growth and reliability. It appears on:
the primary button, the active nav pill, positive deltas, and the first chart
series. That is the whole list. A screen with green in six places has no accent
at all.

`--lx-signal` `#C8F94E` is the scarce hyper-saturated highlight — a live
indicator, at most one hero CTA, one emphasised mark on a *dark* chart. It
always takes **ink text, never white** (`--lx-on-signal`).

Both greens take dark text on top, never white. That is a measurement, not a
taste call — see [Accessibility](#accessibility).

### 3. Neutrals with a green cast

The greys are hue-shifted toward green (`#F5F7F3`, `#242821`, `#0A0B0A`) rather
than pure. It is nearly invisible on its own and it is what makes the chrome
and the accent read as one family instead of a swatch dropped onto Bootstrap.

### 4. Radius by role, not by size

| Role | Radius | Token |
|---|---|---|
| Cards, panels | **20px** | `--lx-radius-xl` |
| Buttons, inputs, selects | 12px | `--lx-radius-md` |
| Inner tiles, menus, tooltips | 16px | `--lx-radius-lg` |
| Chips, badges, avatars | pill | `--lx-radius-full` |

Two cards with different radii is the fastest way to lose the look.

### 5. Depth from lightness, not shadow

Light mode gets very soft shadows (4–14% alpha). Dark mode drops them to almost
nothing and builds depth from a surface ladder instead —
canvas `#0A0B0A` → surface `#121412` → raised `#1A1D18` — with hairline borders
doing the structural work. Drop shadows on near-black are invisible; stacking
them just muddies the panel.

### 6. Charts: "one bright, rest quiet"

The most recognisable move in the system. When one value is the answer and the
rest are context — this month against the other eleven — fill the emphasised
mark with the brand green and **every other mark with `--lx-chart-neutral`**.

```tsx
const fills = useEmphasisFills(data.length, currentMonthIndex);

<Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
  {data.map((d, i) => <Cell key={d.month} fill={fills[i]} />)}
</Bar>
```

Reach for the full categorical ramp (`--lx-chart-1` … `-8`) only when series
are genuinely peer-level. Other chart rules that hold throughout: horizontal
grid lines only, no axis lines or tick marks, tabular figures everywhere, money
right-aligned.

---

## Layout

Three numbers make two different apps read as the same product:

```
sidebar    264px   (76px collapsed)
topbar      68px
card pad    20px   ·  grid gutter 20–24px  ·  content max 1440px
```

```tsx
<Shell>
  <Sidebar>…</Sidebar>
  <div>
    <Topbar title="Dashboard" actions={<Button variant="primary">Export</Button>} />
    <Page>
      <Grid>
        <Col span={3}><StatCard … /></Col>
        <Col span={3}><StatCard … /></Col>
        <Col span={6}><Card>…</Card></Col>
        <Col span={8}><Card>…</Card></Col>
        <Col span={4}><Card>…</Card></Col>
      </Grid>
    </Page>
  </div>
</Shell>
```

The grid is 12 columns, collapsing to 6-wide pairs under 1280px and to single
column under 768px. `Col` accepts spans 3/4/5/6/7/8/9/12 — anything else is a
one-off and should be styled as one.

---

## Component reference

**Layout** — `Shell` `Sidebar` `SidebarBrand` `Nav` `NavSection` `NavItem`
`Topbar` `Page` `PageHeader` `Grid` `Col`

**Data display** — `Card` `CardHeader` `CardBody` `CardFooter` `StatCard`
`Delta` `Badge` `Table` `Progress` `Meter` `Avatar` `AvatarGroup` `Insight`
`Skeleton` `EmptyState` `Divider`

**Input** — `Button` `Field` `Input` `Textarea` `Select` `SearchInput`
`Switch` `Segmented`

**Charts** — components in `react/charts.tsx`: `AreaGradient` `LedgerixTooltip`
`ChartLegend`. Everything else in `react/chartTheme.ts`: `useChartTheme`
`useEmphasisFills` `axisProps` `gridProps` `chartMargin` `compactCurrency`
`compactNumber`.

The split is deliberate: a module that exports both components and non-components
breaks React Fast Refresh, so components live in `.tsx` files and helpers in
`.ts` ones throughout. `useChartTheme` is intentionally **not** memoised — its
whole job is to follow the active theme, and a memo keyed on anything short of
"the theme actually changed" hands back the previous theme's colours.

Every React component is a thin wrapper over a `.lx-*` class and forwards all
native props, so anything you can do in HTML you can do here.

### Notable behaviours

`Delta` takes a **ratio**, not a percentage — `0.124` renders `▲ +12.4%`. Pass
`invertColor` for metrics where down is good (costs, churn, latency): the arrow
still points the way the number moved, but the colour flips.

`StatCard` follows a fixed structure — overline label, figure, delta + comparison
— because a KPI row only scans if every tile is built the same way. `sparkline`
bleeds to the tile's bottom edge.

`Insight` is the AI-generated observation card, tinted so a reader can always
tell generated content from entered data.

These primitives are **not** built on Radix and carry no behaviour beyond what's
described. For real modals, menus and comboboxes use your existing
shadcn/Radix components and apply the matching `.lx-*` class — styling and
behaviour are separate layers on purpose.

---

## Accessibility

Every token pairing below was measured against WCAG 2.1 (4.5:1 for text, 3:1
for graphical objects and UI boundaries) in **both** themes, resolved straight
out of `tokens.css` — so these describe the shipped values, not intentions.

| Pairing | Light | Dark |
|---|---|---|
| `text` on surface | 19.25 | 17.83 |
| `text-secondary` on surface | 7.84 | 8.29 |
| `text-muted` on surface | 4.96 | 5.71 |
| `text-brand` on surface | 5.10 | 8.85 |
| `positive` / `negative` on surface | 5.10 / 6.50 | 8.85 / 5.58 |
| `warning-fg` / `info-fg` on surface | 5.14 / 5.97 | 11.12 / 7.52 |
| `on-brand` on the brand fill | 8.43 | 8.63 |
| `on-signal` on the lime fill | 15.69 | 16.07 |
| chart series 1–8 vs surface *(3:1)* | 3.23 – 4.14 | 5.58 – 15.09 |
| `border-control` / `border-focus` *(3:1)* | 3.24 / 3.33 | 3.73 / 8.85 |

Three of those numbers explain why certain tokens look the way they do.

**`--lx-on-brand` is ink, not white — in both themes.** White on `#00C56A` is
**2.28:1**, which fails outright; near-black on it is **8.43:1**. So the primary
button is dark text on vibrant green. That is not a compromise — it is the rule
the lime already followed, and dark-on-green is the look this system is after.
If you re-theme to a deeper green, revisit it: white on `green-700` is 5.10:1
and would be correct there.

**The light chart ramp sits a step deeper than the equivalent UI colours.**
Chart marks are graphical objects needing 3:1 against the card. On white,
`green-500` is 2.28:1 and the lime is **1.23:1** — effectively invisible. So in
light mode `--lx-chart-1` resolves to `green-600` and `--lx-chart-7` to
`lime-800`; dark mode has the headroom and uses the bright 400 steps directly.
The upshot: **the lime signal is a fill-with-ink-text and a dark-surface
accent, not a mark colour on white.**

**`--lx-border-control` is separate from `--lx-border`.** An input's edge is a
meaningful UI boundary and must clear 3:1 (3.24 light / 3.73 dark). A card's
hairline is decorative — the surface-to-canvas lightness step is what actually
describes the card — so `--lx-border` stays soft at 1.26 on purpose. Don't swap
one for the other.

Beyond colour:

- Focus is a single 2px `:focus-visible` ring, keyboard-only, clearing 3:1
  against both surface and canvas.
- Direction is never colour alone: `Delta` ships an arrow glyph, `Badge`
  supports a leading `dot`.
- `--lx-text-disabled` is deliberately below 4.5:1. WCAG 1.4.3 exempts inactive
  controls, and a disabled field that reads as active is the worse failure.
- `prefers-reduced-motion` collapses every duration token to 1ms, neutralising
  all component transitions at once because they share `--lx-transition`.

Not covered, and worth checking yourself: your content against
`.lx-card--inverse` / `.lx-card--brand` panels, and any colour you introduce
outside these tokens.

## Tuning to the source

If you have the Behance screens in front of you and want to close the last gap,
everything visual resolves to `tokens.css` — you should not need to touch a
component:

1. **Green.** Set `--lx-green-500` to the sampled hex and adjust the 400/600
   steps around it. Every button, nav pill, delta and chart series follows.
2. **Light or dark first.** If the source is dark-first, the dark blocks are
   already complete — just default `<html data-theme="dark">`.
3. **Card radius.** One value, `--lx-radius-xl`. Try 16 or 24 against a
   screenshot.
4. **Density.** If the source is tighter, drop `--lx-space-5` (card padding)
   to `1rem` and `--lx-grid-gap` to `1rem`.
5. **Neutral cast.** If the greys are cool rather than green, replace the
   `--lx-neutral-*` ramp; nothing else references those hues.

---

## Keeping tokens.css and tokens.ts in sync

`tokens.ts` duplicates the primitive hex values so non-DOM consumers (charts,
canvas, PDF export) can read real strings. Inside the DOM, prefer the live
variables — `cssVar("brand")` or `readToken("chart-1")` — so values follow the
theme automatically. If you change a primitive, change it in both files.

## License and attribution

The code here is yours to use. The visual direction is derived from the
Ledgerix CRM project by RonDesignLab — credit them for the design language, and
don't reuse their brand name, logo, copy or screens in a shipped product. The
**Urbanist** typeface is by Corey Hu, under the SIL Open Font License 1.1.
