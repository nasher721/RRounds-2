# Design Tokens

Single source of truth for spacing, radius, typography, and shadows. Use these across the app for a consistent, premium feel.

## Spacing (4px base)

| Token | Value | Use |
|-------|--------|-----|
| `--space-1` | 0.25rem (4px) | Tight gaps, icon padding |
| `--space-2` | 0.5rem (8px) | Inline spacing, small padding |
| `--space-3` | 0.75rem (12px) | Form fields, list items |
| `--space-4` | 1rem (16px) | Section padding, card padding |
| `--space-5` | 1.25rem (20px) | Large section padding |
| `--space-6` | 1.5rem (24px) | Stack spacing |
| `--space-8` | 2rem (32px) | Page margins, large gaps |

**Tailwind:** Use `space-1` … `space-8` (theme.extend.spacing) or the fluid aliases below.

**Fluid aliases (CSS):**
- `--space-fluid-xs` → `--space-2`
- `--space-fluid-sm` → `--space-3`
- `--space-fluid-md` → `--space-4`
- `--space-fluid-lg` → `--space-6`
- `--space-fluid-xl` → `--space-8`

## Radius

| Token | Value | Use |
|-------|--------|-----|
| `--radius` | 0.5rem (8px) | Cards, panels, modals |
| `--radius-sm` | 0.375rem (6px) | Inputs, buttons, chips |

**Tailwind:** `rounded-lg` → `var(--radius)`, `rounded-md` → `var(--radius) - 2px`, `rounded-sm` → `var(--radius-sm)`.

## Typography

- **Headings:** `var(--font-heading)` (Outfit), weight 600.
- **Body:** `var(--font-sans)` (DM Sans).
- **Scale:** `--text-fluid-xs` through `--text-fluid-3xl` for consistent type scale.

## Shadows

| Token | Use |
|-------|-----|
| `--shadow-card` | Cards, dropdowns, utility panels |
| `--shadow-modal` | Modals, dialogs, popovers |
| `--shadow-elevated` | Elevated cards, hover states |
| `--shadow-floating` | Floating panels, toolbars |

**Tailwind:** `shadow-card`, `shadow-modal`, `shadow-elevated`, `shadow-floating` in theme.

## Surface Elevation (Light Mode)

| Token | Value | Use |
|-------|--------|-----|
| `--surface-0` | `240 100% 100%` | Base background |
| `--surface-1` | `220 14% 96%` | Card background, subtle borders |
| `--surface-2` | `220 14% 94%` | Dropdowns, secondary surfaces |
| `--surface-3` | `220 14% 92%` | Elevated cards, hover states |
| `--surface-4` | `220 14% 90%` | Floating panels, modal backgrounds |

**Dark mode:** `--surface-0` through `--surface-4` scale from `11%` to `22%` lightness (deeper navy).

## Color

- **Primary** (teal): main actions, links, active states. Use for one “active” accent (e.g. selected tab, primary button).
- **Secondary / muted:** backgrounds, borders, disabled. Avoid extra accent colors (e.g. violet/amber for panels); use primary or neutral for active states.

## Usage

- Prefer tokens over ad-hoc values (e.g. `p-[var(--space-4)]` or Tailwind’s `p-4` if mapped).
- Use `shadow-card` for the utility menu and card surfaces, `shadow-modal` for overlays.
- Keep radius consistent: `rounded-lg` for containers, `rounded-md` for inputs.
