---
date: 2026-03-22
topic: dashboard-rounding-ux
---

# Dashboard & Rounding UX — Comprehensive Improvement

## What We're Building

Improve the **main rounding workflow** (desktop-first; mobile should follow where patterns transfer) so clinicians can **add patients safely**, **navigate multiple patients quickly**, **understand what is editable and what each control does**, and **trust AI-assisted actions**. The work spans: first-run and empty states, list/detail layout, inline field affordances, quick actions and destructive actions, tasks and longitudinal context, the clinical summary editor, global navigation and filters, feedback (toasts, sync), accessibility and theming, and a clearer **AI entry point** that does not duplicate or obscure “Quick Actions.”

**Success looks like:** fewer anonymous or empty placeholder patients, faster patient switching at scale, WCAG-friendly contrast and keyboard paths, explicit labels/tooltips on icon-only controls, and AI flows that show **preview + cost/latency signals** before committing text to the chart.

## Problem Themes (from review)

| Theme | Issue | Direction |
|-------|--------|-----------|
| **Empty / first-run** | “Add First Patient” inserts a blank card immediately; no modal; anonymous records possible | **New patient** flow (drawer/sheet) collecting **minimum viable identity** (e.g. name, MRN, location/bed) before list insertion; optional **profile/settings** for which fields are required |
| **Coaching** | Empty state disappears after one placeholder exists even if fields are empty | **Lightweight banners** until required fields pass validation (same pattern as phrases empty vs filtered empty) |
| **List vs detail** | Single tall stack; hard to switch with many patients | **Two-pane layout**: searchable list left, active patient detail right (desktop); preserve mobile list → detail |
| **Stats / header** | Census line is cryptic (duplicate dots); weak sync semantics | Replace with **plain language**: e.g. “Today’s census: N patients • Last sync 11:57 AM” (+ admissions if/when data exists) |
| **Inline editing** | Name and bed look like static text | **Input affordances**: placeholders (“Enter patient name”), focus rings, **required** badges + inline validation |
| **LOS / status pill** | Icon + number lacks meaning | **Tooltip** (“Length of stay: N days”) and/or label adjacent to pill |
| **Quick actions** | Lightning, star, clock, arrow unexplained | **Text labels**, **tooltips**, or a labeled **“Quick actions”** menu; ensure **keyboard focus** + `aria-label` |
| **Destructive actions** | Archive/delete near AI tools | **Visual/logical separation** (footer, danger zone, or overflow) |
| **Tasks** | Dropdown is icon-only; no strong add affordance | **“+ Task”** visible; optional **badges** for due/priority when templates land; consider **timeline/checklist** column so notes are not the only scaffold |
| **Clinical summary editor** | Toolbar cramped; model + mic look tappable without state | **Segmented controls** or tooltips per capability; **AI output panel**: preview before insert, show **tokens/time** (or analogous cost) for trust |
| **Filters / menu** | “Menu” collapses to unclear contents; funnel has no count | **Persistent nav** (Patients / Tasks / Reports) or **sidebar**; **“Filters (k)”** with quick toggles (e.g. Inpatient / Discharged) where data supports it |
| **Feedback** | Toast overlaps FAB | Move toast **top-right** or offset above FAB |
| **Sync** | Tiny “Synced …” | **Color + manual “Sync now”** (or refresh) with clear states |
| **A11y / theme** | Low-contrast gray; icon-only buttons | Deepen text to **≥ 4.5:1**; **high-contrast** theme toggle; **tab order** and shortcuts beyond Ctrl+K (**N** add patient, **/** search — gated by input focus rules) |
| **AI FAB** | Duplicates Quick Actions; unclear | **Merge or cross-link**: opening FAB shows **AI palette** with short descriptions; optional **badge** (“3 suggestions”, “GLM-4 Flash connected”) |

## Why This Approach

Three rollout strategies:

### Approach A: Phased delivery (recommended)

Ship in **layers** aligned to risk and dependencies:

1. **Foundation** — Required-field model + new-patient drawer + coaching banners; toast position; contrast pass on chrome/search; tooltips/`aria-label` on icon buttons; stats line copy fix; sync affordance.
2. **Navigation** — Two-pane desktop layout + list selection state; keyboard shortcuts registry (`/` search, `N` new patient with guardrails).
3. **Depth** — Tasks surfacing (+ Task, badges), optional right-rail timeline/checklist; AI preview panel + token/time; merge FAB vs Quick Actions narrative.

**Pros:** Incremental value, easier review/testing, matches YAGNI. **Cons:** Longer calendar to “full vision.” **Best when:** Production stability matters (clinical app).

### Approach B: Desktop shell redesign (single project)

Rebuild `DesktopDashboard` layout (panes, rails, header) in one initiative, then patch behaviors.

**Pros:** Coherent visual system. **Cons:** Large PR, harder to regress-test, blocks other work. **Best when:** Dedicated design window and QA bandwidth.

### Approach C: AI-trust and editor first

Prioritize clinical summary toolbar clarity + AI preview panel + FAB merge before layout.

**Pros:** Addresses “trust” differentiator early. **Cons:** Leaves navigation pain for heavy lists. **Best when:** AI usage is the primary complaint.

**Recommendation:** **Approach A** with **Phase 1** including onboarding safety, a11y baseline, labeled quick actions, stats/sync copy, and toast position—then **Phase 2** two-pane layout.

## Key Decisions

- **Minimum viable patient (decision C, 2026-03-22):** Only **display name** is **required** to create a patient; **MRN** and **bed/location** are **optional**. Use **coaching banners** to encourage optional fields without blocking save.
- **Coaching banners** use a **completeness / nudge predicate** that can fire while `patients.length > 0` (e.g. optional fields still empty), not merely the global empty list.
- **Two-pane layout** is **desktop-only** initially; mobile keeps established list → detail patterns unless a later spec unifies.
- **Quick actions** get **visible names or tooltips** on every icon control; destructive actions move to a **separate cluster** or confirmation pattern.
- **AI-assisted text** flows through a **preview surface** before merge into the note where feasible; show **model id + usage metadata** when the API exposes it.
- **Filters** show **active count** and prefer **quick toggles** for well-understood cohorts; advanced filters remain in dialog/panel.
- **Theme:** add or strengthen **high-contrast** mode and audit `muted-foreground` against WCAG for body UI text.

## Open Questions

- **Admissions / census:** Do we have reliable fields today for “admissions info” in the stats chip, or is copy-only until schema/UI catch up? *(Plan default: omit until data exists.)*
- **Org-level required fields:** Future **settings** to require MRN/bed — defer past v1.

## Resolved Questions

- **Required fields:** **Option C** — **name only** required; MRN and location optional; coaching for optional identifiers.
- **Timeline/checklist:** **Todos MVP** first (`patient_todos`); richer timeline when event feeds are ready.
- **Sync now:** **Refetch** + **flush offline queue** when safe (see implementation plan).
- **Keyboard shortcuts:** **`N`** and **`/`** active when **not** focused in text inputs / contenteditable.

## Next Steps

→ **Implementation plan:** [docs/plans/2026-03-22-dashboard-rounding-ux-plan.md](../plans/2026-03-22-dashboard-rounding-ux-plan.md)

## Traceability

- **Related repo patterns:** `DesktopDashboard` empty state + `onAddPatient`; `VirtualizedPatientList`; mobile empty states in `VirtualizedMobilePatientList` / `MobilePatientList`.
- **Similar prior UX work:** Phrase manager empty states and sort (see [2026-03-22-autotexts-phrases-ux-brainstorm.md](./2026-03-22-autotexts-phrases-ux-brainstorm.md)).
