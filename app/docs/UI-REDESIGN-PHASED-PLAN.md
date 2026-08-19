# UI Redesign: Phased Implementation Plan

**Goal:** Rethink the UI for simplification and a premium full-stack feel while ensuring all existing functions continue to work.

**Principles:**
- **Simplify:** Reduce visual noise, consolidate controls, one clear hierarchy per screen.
- **Premium:** Cohesive design system, intentional spacing and typography, refined interactions.
- **Full-stack:** Auth, patient CRUD, rounding, print/export, FHIR, AI, and mobile must remain fully functional after each phase.

---

## Design Direction (Summary)

| Area | Current | Target |
|------|---------|--------|
| **Shell** | Header + utility bar (Resources / Tools / Settings) + workspace | Single header with primary nav; secondary actions in one predictable place (e.g. one menu or compact bar). |
| **Workspace** | Search, filter pills, sort, section visibility, compare, print, collapse, badges | One search + one “Filters & actions” control (dropdown or compact group); badges only when meaningful. |
| **Patient cards** | Many sections, repeated toolbars, dense controls | Clear section headers, collapsible blocks, minimal toolbar by default; focus on content area. |
| **Modals** | Print, Compare, Phrase Manager, Settings, etc. | Same radius/spacing as design system; clear title and actions; no duplicate chrome. |
| **Mobile** | Tabs (Patients, Add, Reference, Settings) | Same design language; touch targets and spacing from tokens. |
| **Color & type** | Outfit + DM Sans, teal primary, multiple accent colors for panels | Keep fonts; unify accents (e.g. one secondary accent); use tokens for all spacing and radius. |

---

## Functions to Preserve (Verification Checklist)

Use this list when finishing each phase and before release.

- **Auth:** Login, signup, OAuth, redirect to `/`, sign-out.
- **Patients:** Add, update, remove, duplicate, reorder (drag), collapse/expand, clear all.
- **Data:** All patient fields (clinical summary, interval events, imaging, labs, medications, systems review) save and load correctly.
- **Systems review:** Per-system notes, custom system config, todos per section, AI draft/sense check where applicable.
- **Editors:** Rich text (bold/italic/lists/toolbar mode), image paste, phrases, autotexts, dictation, AI assistant, change tracking.
- **Import:** Manual add, Epic handoff, smart import, FHIR callback.
- **Print/export:** Print modal, layout options, PDF/Excel/HTML export.
- **Reference:** IBCC, guidelines, lab trending, timeline, batch course generator (if exposed).
- **Settings:** Font size, theme, sort, section visibility, toolbar mode, change tracking, AI model, autotexts/phrases management.
- **Mobile:** All tabs, patient list, patient detail, add/reference/settings panels, print.

---

## Phase 1: Design System & Tokens

**Objective:** Define a single source of truth for spacing, radius, typography, and shadows so all phases can use it. No removal of features.

**Tasks:**
1. **Spacing scale** – Document and use a single scale (e.g. 4px base) in `index.css` or Tailwind config; ensure `--space-fluid-*` (or equivalent) is used consistently.
2. **Radius** – Standardize on 1–2 radius values (e.g. `--radius` for cards, `--radius-sm` for inputs); replace ad-hoc `rounded-xl`, `rounded-2xl` where they conflict.
3. **Typography** – Confirm one scale for headings and body (e.g. `--text-fluid-*`); assign to `--font-heading` and `--font-sans`; use in components.
4. **Shadows** – Define 1–2 shadow levels (e.g. `--shadow-card`, `--shadow-modal`) and use for cards and overlays.
5. **Accent consolidation** – Choose one secondary accent (or none) for “active” states; reduce violet/amber usage for utility panels in favor of primary or neutral.

**Deliverable:** Updated `src/index.css` (and Tailwind config if needed) with design tokens; short doc in `docs/design-tokens.md` listing variables and usage.

**Verification:** Build passes; app looks unchanged except possibly subtle consistency.

---

## Phase 2: Shell & Navigation (Desktop)

**Objective:** Simplify header and utility bar into a cleaner shell without removing any action.

**Tasks:**
1. **Header** – Single row: logo + app name, primary actions (e.g. Add patient, Print/Export), search (or link to workspace search), theme, presence, sign-out. Remove redundant copy.
2. **Utility bar** – Replace three separate panels (Resources / Tools / Settings) with one of:
   - **Option A:** One “Menu” or “More” dropdown that groups Resources, Tools, Settings into sections, or
   - **Option B:** Icon-only bar with tooltips that open the same panels in a slide-over or modal.
3. **Workspace container** – One main content area with consistent padding from tokens; ensure scroll and focus behavior unchanged.

**Deliverable:** Updated `DesktopDashboard.tsx` (and any extracted header/utility components); same modals and panels opened from new triggers.

**Verification:** All existing entry points (IBCC, Guidelines, Imports, AI, Settings, Autotexts, etc.) still open and work; checklist (auth, add patient, print, settings) passes.

---

## Phase 3: Patient List & Cards

**Objective:** Simplify the workspace toolbar and patient card layout for clarity and a more premium feel.

**Tasks:**
1. **Workspace toolbar** – Combine search, filter, sort, section visibility, compare, print, collapse into:
   - One search field (keep current behavior).
   - One “Filters & actions” control (dropdown or popover) containing: filter (All/Filled/Empty), sort, section visibility, compare, print, collapse/expand.
   - Optionally show a single patient count badge; remove extra badges unless they add value.
2. **Patient card** – Reduce visual weight of section headers and borders; use tokens for padding and radius; keep sections collapsible and all fields editable.
3. **Patient navigator** – Style to match; ensure scroll-to-patient and keyboard/sr behavior unchanged.

**Deliverable:** Updated `VirtualizedPatientList`, `PatientCard`, and desktop workspace section in `DesktopDashboard.tsx`.

**Verification:** Search, filter, sort, section visibility, compare, print, collapse all work; patient CRUD and all section edits save and load; checklist (patients, data, systems review) passes.

---

## Phase 4: Editors & Forms

**Objective:** Ensure editors feel consistent and premium; keep all formatting and AI features working.

**Tasks:**
1. **Rich text** – Toolbar already has minimal/full/custom; align toolbar and editor container with design tokens (radius, padding, focus ring).
2. **Systems review** – Cards use token spacing and radius; “Pop out” and section todos unchanged; no new features, only visual alignment.
3. **Other inputs** – Medications, imaging, labs, etc.: consistent label + input spacing and focus states from tokens.
4. **Change tracking** – Visual treatment for “recent” or “marked” content aligned with design system (e.g. one accent).

**Deliverable:** `RichTextEditor`, `PatientSystemsReview`, and any shared form/input styles updated to use tokens; no removal of toolbar options or pop-out.

**Verification:** All editor functions work (formatting, phrases, autotexts, dictation, AI draft/sense check, change tracking, pop-out); checklist (editors, systems review) passes.

---

## Phase 5: Modals & Overlays

**Objective:** Unify modal/dialog styling and behavior so they feel part of the same app.

**Tasks:**
1. **Print/Export** – Apply design tokens to modal container, title, and actions; ensure print preview and export paths unchanged.
2. **Phrase Manager, Multi-patient comparison, AI command palette** – Same token-based layout and spacing; preserve all behavior.
3. **Settings (e.g. AI model, Display, Workflow, Authoring)** – Group in one settings surface if not already; style with tokens.
4. **Destructive dialogs** – Clear all, remove patient, etc.: consistent button hierarchy (primary danger, secondary cancel) and spacing.

**Deliverable:** Shared modal/dialog wrapper or token usage in `PrintExportModal`, `PhraseManager`, comparison modal, settings dialogs, and alert dialogs.

**Verification:** Print/export, phrase management, comparison, AI palette, settings, and destructive actions all work; checklist (print/export, reference, settings) passes.

---

## Phase 6: Mobile Parity

**Objective:** Apply the same design language and simplification to mobile without breaking flows.

**Tasks:**
1. **Mobile header & nav** – Use same typography and spacing tokens; ensure tabs (Patients, Add, Reference, Settings) remain clear and touch-friendly.
2. **Mobile patient list & detail** – Same token-based spacing and radius; all fields and actions (including systems review, todos, AI) still available.
3. **Mobile modals** – Print, phrase manager, settings, etc. use same token set and feel consistent with desktop overlays.
4. **Touch targets** – Minimum 44px for primary actions; spacing from design system.

**Deliverable:** Updated `MobileDashboard`, `MobileHeader`, `MobileNavBar`, `MobilePatientDetail`, `MobileSettingsPanel`, and any mobile modals.

**Verification:** Full mobile checklist: add patient, edit all sections, systems review, todos, print, reference, settings, sign-out.

---

## Phase 7: Polish & Verification

**Objective:** Accessibility, performance, and a full function pass.

**Tasks:**
1. **Accessibility** – Focus order, ARIA where needed, keyboard access to new dropdowns/menus; contrast check for text and controls.
2. **Performance** – No new heavy re-renders from layout changes; virtualized list and lazy panels unchanged.
3. **Full checklist** – Run through the entire “Functions to Preserve” list on desktop and mobile; fix any regressions.
4. **Documentation** – Update CLAUDE.md or README if shell or navigation structure changed; keep design-tokens.md in sync.

**Deliverable:** List of a11y fixes applied; confirmation that checklist is passed; any final doc updates.

---

## Implementation Order

| Phase | Focus | Depends on |
|------|--------|------------|
| 1 | Design system & tokens | — |
| 2 | Shell & navigation (desktop) | 1 |
| 3 | Patient list & cards | 1, 2 |
| 4 | Editors & forms | 1 |
| 5 | Modals & overlays | 1, 2 |
| 6 | Mobile parity | 1, 2, 3, 4, 5 |
| 7 | Polish & verification | All |

**Suggested sprint split:**  
- **Sprint 1:** Phase 1 + Phase 2 (tokens and shell).  
- **Sprint 2:** Phase 3 + Phase 4 (list/cards and editors).  
- **Sprint 3:** Phase 5 + Phase 6 (modals and mobile).  
- **Sprint 4:** Phase 7 (polish and full verification).

---

## Success Criteria

- UI feels simpler (fewer competing buttons and badges; one clear hierarchy per view).
- Visual language is consistent (tokens for spacing, radius, type, shadows).
- All items in the “Functions to Preserve” checklist still work on desktop and mobile.
- No regressions in auth, patient data, print/export, FHIR, or AI features.
