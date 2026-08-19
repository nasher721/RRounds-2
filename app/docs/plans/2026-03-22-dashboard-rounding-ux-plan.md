# Plan: Dashboard & Rounding UX

## Traceability

- **Brainstorm:** [docs/brainstorms/2026-03-22-dashboard-rounding-ux-brainstorm.md](../brainstorms/2026-03-22-dashboard-rounding-ux-brainstorm.md)
- **Product decision (required fields):** **Option C** — only **patient name** is required to create a record; **MRN** and **bed/location** are optional but strongly encouraged via coaching copy (not blocking validation).

---

## Overview

| Phase | Theme | Goal |
|-------|--------|------|
| **1** | Foundation | Safe add-patient flow, coaching, clearer chrome (stats/sync/filters/toasts), inline affordances, quick-action labels, destructive separation, baseline a11y |
| **2** | Navigation | Desktop two-pane list + detail, selection state, keyboard shortcuts aligned with `KeyboardShortcutSystem` |
| **3** | Depth | Tasks surfacing, optional right-rail checklist, clinical summary / AI trust, FAB vs AI palette merge, high-contrast theme |

Phases are **sequential**; tasks within a phase can often ship in parallel once dependencies are noted.

### Implementation status (rolling)

| Phase | Status |
|-------|--------|
| **1** Foundation | **Shipped** in this branch (new patient sheet, coaching, Sonner position, census/sync header, sync now, inline name/bed, LOS, quick actions + destructive separation, filter badge, menu tabs, contrast/a11y passes). |
| **2** Navigation | **Shipped:** two-pane list + detail + tasks rail (`VirtualizedPatientList`), `desktopSelectedPatientId` in `Index` / `DashboardContext`. **`/`** and **`N`** + **`Cmd+K`** / **`Cmd+Shift+N`** via `useKeyboardShortcuts`, **`Cmd+[` / `Cmd+]`** next/prev patient wired in `useKeyboardShortcuts` (2026-03-22). |
| **3** Depth | **Shipped:** patient tasks + right rail (`PatientTodos` / `hidePatientWideTodos`), AI preview + trust (3.3–3.4), high-contrast (3.5). |

---

## Phase 1 — Foundation

### 1.1 New patient drawer (blocking anonymous cards)

- **Problem:** `handleAddPatient` → `addPatient()` immediately creates a row ([`src/pages/Index.tsx`](../../src/pages/Index.tsx)); empty state disappears while the card can still be blank.
- **Tasks:**
  1. Add a **`NewPatientSheet` / `NewPatientDrawer`** (shadcn `Sheet` or `Dialog`) with fields: **Name** (required), **MRN** (optional), **Bed/room or location** (optional) — labels and placeholders per brainstorm.
  2. On submit: call **`addPatient()` then `updatePatient`** with the collected fields, **or** extend `usePatients` / `addPatientWithData` to accept initial fields in one mutation if that pattern already exists for FHIR.
  3. Replace direct `addPatient` calls from **desktop empty state**, **FAB**, **`Cmd+N`** path, and **mobile** add flows so they **open the drawer** instead of inserting a blank card (grep for `addPatient` / `handleAddPatient`).
  4. **Validation:** trim name; block submit if name is empty after trim; show inline error.

**Depends on:** none.

---

### 1.2 Patient “profile completeness” + coaching banners

- **Problem:** Coaching should persist until **meaningful** data exists, not only when `patients.length === 0`.
- **Decision (with option C):** **Required** = display name present. **Coaching** = optional nudges for empty MRN and/or bed/location (and any other “nice to have” fields you choose).
- **Tasks:**
  1. Add a small **`getPatientProfileCoaching(patient)`** (or similar) in `src/lib/` or next to patient types returning `{ showBanner: boolean; messages: string[] }`.
  2. Render a **dismissible or persistent banner** below the header / above the list when any **visible** patient row matches “needs optional fields” (define rule: e.g. show until MRN and bed both filled, or show once per session — pick one in implementation and keep copy consistent).
  3. Ensure **empty state** for “no patients” remains when `filteredPatients.length === 0 && patients.length === 0` (unchanged); when `patients.length > 0` but filters empty, keep existing “no match” empty state.

**Depends on:** 1.1 (same field names).

---

### 1.3 Toasts vs FAB overlap

- **Problem:** Sonner toasts can cover the floating primary FAB.
- **Tasks:**
  1. In [`src/components/ui/sonner.tsx`](../../src/components/ui/sonner.tsx) (and [`src/App.tsx`](../../src/App.tsx) where `<Sonner />` is mounted), set **`position="top-right"`** (or `top-center`) and verify on desktop + mobile.
  2. Spot-check common flows (“Patient added”, sync errors) for overlap with [`DesktopDashboard`](../../src/components/dashboard/DesktopDashboard.tsx) FAB.

**Depends on:** none.

---

### 1.4 Header stats line (census + sync copy)

- **Problem:** Census chip is cryptic (duplicate separators, weak semantics).
- **Tasks:**
  1. Locate the stats string in `DesktopDashboard` (and any shared header component); replace with readable pattern: **“Today’s census: N patients • Last sync h:mm AM/PM”** using existing `lastSaved` or a dedicated **last sync** timestamp from the same source patients use.
  2. **Admissions:** if no reliable field exists in `Patient` type, **omit** admissions from the string until data is available (document in code comment).

**Depends on:** none.

---

### 1.5 Sync status: emphasis + “Sync now”

- **Tasks:**
  1. Find where **“Synced …”** / sync text renders (likely `DesktopDashboard` or `EdgeHealthContext` consumers).
  2. Add **semantic color** (e.g. green when ok, amber when degraded — reuse `EdgeHealth` / network hooks if present).
  3. Add **manual “Sync now”** control: `refetch()` from `usePatients` and, if offline queue exists, call existing **flush** from [`src/lib/offline/`](../../src/lib/offline/) / `syncService` (confirm in implementation).

**Depends on:** none (coordinate with 1.4 if same header real estate).

---

### 1.6 Inline editing affordances (name, bed)

- **Problem:** Fields look like static text.
- **Tasks:**
  1. In [`PatientCard`](../../src/components/PatientCard.tsx) (or extracted header subcomponent), render **name** and **bed/room** as **`Input`** or **`InlineEdit`** pattern with placeholders (“Enter patient name”, “Bed or room”), visible **focus ring**, and **optional** badges only for fields that are required (name only → “Required” on name until filled, if desired).
  2. Keep **debounced** or existing `onUpdatePatient` behavior; no behavior regression on blur.

**Depends on:** none.

---

### 1.7 Length-of-stay (LOS) mini pill

- **Tasks:**
  1. Add **`title` + `aria-label`** (and `Tooltip` if the app uses Radix tooltip elsewhere) on the LOS control: e.g. **“Length of stay: N day(s)”**.

**Depends on:** none.

---

### 1.8 Quick actions cluster (icons)

- **Tasks:**
  1. Inventory icon buttons on `PatientCard` (lightning, star, clock, arrow, etc.).
  2. For each: add **`aria-label`**, **`Tooltip`** with plain-language description, ensure **focusable** and visible focus style.
  3. Optionally wrap in **`DropdownMenu`** labeled **“Quick actions”** if clustering reduces clutter.

**Depends on:** none.

---

### 1.9 Destructive actions separation

- **Tasks:**
  1. Group **Archive / Delete** (and similar) in a **separate** row, **`DropdownMenu`**, or bottom “danger zone” with **confirm** dialogs unchanged or strengthened.
  2. Visual spacing from AI / quick-action icons.

**Depends on:** 1.8 (same card layout).

---

### 1.10 Filters: active count + quick toggles

- **Tasks:**
  1. **`usePatientFilter`** / filter UI: show **“Filters (k)”** when `k > 0` (derive from `searchQuery`, `filter`, and any extra filter state).
  2. Add **segmented toggles** or chips for **Inpatient / Discharged** (or whatever enums exist on `Patient`) **only if** the patient model supports them; otherwise ship **count + existing filter** first and add toggles when fields exist.

**Depends on:** schema review of `Patient` / disposition fields.

---

### 1.11 “Menu” discoverability

- **Tasks:**
  1. Audit top **`Menu`** in `DesktopDashboard`: either **inline links** (Patients / Tasks / Reports — routes or scroll targets as appropriate) or a **persistent narrow sidebar** for primary nav (pick smaller scope: **inline header links** first unless design demands sidebar).
  2. Ensure **aria** and **focus trap** in any dropdown.

**Depends on:** none.

---

### 1.12 Accessibility: contrast + icon buttons

- **Tasks:**
  1. Token pass: increase **muted text** contrast on **top bar** and **search** to target **WCAG AA** for normal text (audit with DevTools / contrast checker).
  2. Global pass: **icon-only** `Button` / `button` elements have **`aria-label`** (tie to 1.8).

**Depends on:** none.

---

## Phase 2 — Navigation (desktop)

### 2.1 Two-pane layout

- **Tasks:**
  1. **`DashboardContext`** (or local state in `DesktopDashboard`): add **`selectedPatientId`** for desktop; initialize to first `filteredPatients[0]` when list changes.
  2. **Layout:** left column — **scrollable list** (compact rows or existing card chrome slimmed); right column — **full `PatientCard`** (or detail bundle) for selected patient only.
  3. **`VirtualizedPatientList`:** split **list item** vs **detail** or introduce **`PatientListSidebar` + `PatientDetailPane`** wrappers; keep **single source of truth** for updates.
  4. **Mobile:** no change to list → detail in Phase 2 unless bandwidth allows parity later.

**Depends on:** Phase 1 complete enough to avoid two migrations of add-patient flow.

---

### 2.2 Keyboard shortcuts: `/` and `N` (and alignment with existing)

- **Tasks:**
  1. Extend [`KeyboardShortcutSystem`](../../src/components/KeyboardShortcutSystem.tsx) / global handler: **`/`** focuses patient search when focus is not inside `input` / `textarea` / `contenteditable`.
  2. **`N`** opens **new patient drawer** (same as 1.1) with same guardrails.
  3. Document in the shortcuts dialog; align with existing **`Cmd+N`** (already listed) so behavior matches.

**Depends on:** 1.1, 2.1 (optional: 2.1 first makes “next/prev patient” more meaningful).

**Status:** [`useKeyboardShortcuts`](../../src/hooks/useKeyboardShortcuts.ts) implements **`/`**, **`n`/`N`**, **`Cmd+K`**, **`Cmd+Shift+N`**, **`Cmd+Shift+F`**, **`Cmd+Shift+C`**, **`Cmd+P`**, and **`Cmd+[` / `Cmd+]`** (via `event.code` `BracketLeft` / `BracketRight`) for **previous / next** patient in **`filteredPatients`** order. Help dialog lists shortcuts in [`KeyboardShortcutSystem`](../../src/components/KeyboardShortcutSystem.tsx).

---

## Phase 3 — Depth

### 3.1 Patient tasks row

- **Tasks:**
  1. **Patient Tasks** control: visible **label** + **“+ Task”** button opening existing todo UI / modal.
  2. When template/due metadata exists in `patient_todos`, show **badges** (due time, priority).

**Depends on:** `useAllPatientTodos` / todo components survey.

---

### 3.2 Optional right rail: checklist / timeline

- **Tasks:**
  1. **MVP:** embed **`patient_todos`** checklist in a **right column** or collapsible panel on desktop (two-pane becomes three-pane or split right stack).
  2. **Later:** feed from interval/course generators — **out of scope** until APIs/UI are defined.

**Depends on:** 2.1.

---

### 3.3 Clinical summary editor: toolbar + AI trust

- **Tasks:**
  1. Identify clinical summary **RichTextEditor** host (likely under `PatientCard` or systems section).
  2. Toolbar: **tooltips** / labels for **model selector**, **microphone**, **phrase insert**, etc.; show **recording state** when applicable.
  3. **AI insert path:** intermediate **preview panel** (side panel or modal) with **Insert** / **Discard**; display **token count and/or latency** when returned from edge function.

**Depends on:** edge function response shape review.

**Status (2026-03-22):** Shipped via shared editor chrome: **`useTextTransform`** returns **`TextTransformResult`** (`text`, `latencyMs`, rough **`approxTokensOut`** estimate client-side); **`UnifiedAIDropdown`** opens a **Review AI result** dialog (Insert / Discard, optional original selection); **`QuickModelSwitcher`**, **`DictationButton`**, and **Phrases** in **`RichTextEditor`** have stronger **`title` / `aria-label`**. Server-side token counts are not required for MVP.

---

### 3.4 AI FAB vs Quick Actions

- **Tasks:**
  1. Map **FAB** and **Quick Actions** / **`AICommandPalette`** entry points; **single primary entry** to AI features with **short descriptions** per action.
  2. Optional **badge** on FAB: suggestion count or **“Connected · {modelName}”** when session ready.

**Depends on:** 3.3 for coherent copy.

**Status (2026-03-22):** Desktop **FAB** wrapped in **`Tooltip`** with copy tying it to the same AI workspace as **`AICommandPalette`**, plus **active model label** in **`aria-label` / `title`** (see **`AVAILABLE_MODELS`** / settings). **Visible** truncated model **`Badge`** on the FAB corner (full name in `title` on badge). Suggestion-count badge not implemented (YAGNI).

---

### 3.5 High-contrast theme

- **Tasks:**
  1. Add **`high-contrast`** variant in theme provider (or CSS variables) and a **toggle** next to theme switcher.
  2. Verify focus rings and **muted** colors still meet contrast in HC mode.

**Depends on:** 1.12.

---

## Defaults for remaining brainstorm questions

| Question | Plan default |
|----------|----------------|
| Admissions in stats chip | **Copy-only / omitted** until a stable field exists on `Patient`. |
| Timeline vs todos MVP | **Todos checklist** in Phase 3.2 first; timeline when events API is product-ready. |
| Sync now | **Refetch patients** + **flush offline queue** if `syncService` exposes a safe flush. |
| `N` and `/` vs text fields | **No action when focus is in** `input`, `textarea`, or `contenteditable` (match common app patterns). |

---

## Verification (each phase)

- `npm run lint` (do **not** use a global **`ajv`** npm override — it forces Ajv v8 onto `@eslint/eslintrc`, which expects Ajv v6 and crashes with `defaultMeta`)
- `npm run build` (if SWC or `date-fns` fail with missing/corrupt native binary or missing `date-fns/index.mjs`, reinstall those packages from the lockfile)
- `npm test`
- Manual: add patient (drawer), edit name/bed, filter, toast position, desktop two-pane selection, keyboard shortcuts with focus inside/outside editor

---

## Suggested implementation order (strict sequence)

1. **1.3** (toasts) — quick win, unblocks visual QA for later tasks  
2. **1.1** (drawer) — core behavior change  
3. **1.2** (coaching)  
4. **1.4**, **1.5** (header)  
5. **1.6**, **1.7**, **1.8**, **1.9** (card UX)  
6. **1.10**, **1.11** (filters/menu)  
7. **1.12** (contrast)  
8. **2.1**, **2.2**  
9. **3.1** → **3.2** → **3.3** → **3.4** → **3.5**

Parallel tracks after **1.1**: (1.4–1.5) with (1.6–1.9); (1.12) anytime.
