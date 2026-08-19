---
title: Declutter desktop dashboard UI (BrowserStack-informed)
type: feat
status: active
date: 2026-03-22
---

# Declutter desktop dashboard UI

## Overview

The main desktop dashboard (`DesktopDashboard`, `VirtualizedPatientList`/`PatientCard`) presents many simultaneous controls: sticky header (logo, in-header nav links, Add patient, Print, census chip, presence, account, shortcuts, theme, sign-out), collapsible **Menu** (Resources / Tools / Settings), search + **Filters & actions**, a meta strip (filtered count · active query · last updated · Sync now), the patient workspace (list · card · tasks rail), and a floating AI button with model badge.

**Related roadmap:** Broader rounding UX (empty states, two-pane layout, AI trust, quick actions) is tracked in [docs/plans/2026-03-22-dashboard-rounding-ux-plan.md](./2026-03-22-dashboard-rounding-ux-plan.md) and [docs/brainstorms/2026-03-22-dashboard-rounding-ux-brainstorm.md](../brainstorms/2026-03-22-dashboard-rounding-ux-brainstorm.md). **This plan** focuses narrowly on **density, redundancy, and progressive disclosure** of chrome—not on net-new clinical features.

## Code examination (local, 2026-03-22)

Verified in `src/components/dashboard/DesktopDashboard.tsx`:

| Area | Finding |
|------|---------|
| **Header** | “Patients” / “Search” anchor links, **Add patient**, **Print**, census strip (**N on roster** · offline · date), presence, email, `KeyboardShortcutSystem`, theme, sign-out. Roster total is **only** in the header when the list scope is “all / no search”; meta row then says **All patients** without repeating N. |
| **Collapsed Menu** | `menuOpen === false` uses `border-border/15 bg-muted/15 shadow-none`—visually subordinate when closed. |
| **Menu persistence** | `localStorage` key `rr-desktop-utility-menu-open` (`1`/`0`). |
| **Tools tab** | `Collapsible` **Import & AI** (`defaultOpen`) and **Analytics & batch** (closed by default). |
| **Print** | Header **Print** + modal; **Filters & actions** dropdown has no duplicate Print (dedupe done). |
| **Meta row** | Stacks below `480px`; from `md` shows shortcut hint (`aria-hidden`—full list in **?** dialog). Left: counts when filtered/searching, else **All patients**; right: **Updated** time + **Sync**. |
| **FAB** | Gradient `Sparkles` button + truncated model `Badge`; high visual weight (by design for AI entry). |

`VirtualizedPatientList` hosts the three-column patient layout; clutter work that touches list density should be coordinated with `PatientCard` and the tasks rail.

## BrowserStack examination (2026-03-22)

| Action | Result |
|--------|--------|
| **Live session** | Chrome on macOS Sequoia against production: `https://remix-of-remix-of-round-robin-notes.vercel.app/`. Use the dashboard link from the BrowserStack Live session to walk the UI interactively. |
| **Accessibility scan** (`startAccessibilityScan`) | Uses **BrowserStack REST API credentials** (username + access key from [Account settings](https://www.browserstack.com/accounts/profile)). Logging into browserstack.com or fixing Live does not automatically configure the **Cursor MCP server** — add the same username/key to the MCP plugin env if scans still return `Invalid credentials`. |
| **Automate screenshots** | Requires an Automate session ID after a test run; not used for this pass. |

**Production URL for testing:** `https://remix-of-remix-of-round-robin-notes.vercel.app/`

## Problem statement

- **Cognitive load:** Primary work (patient note) competes with secondary chrome (status pills, menu, sync, FAB).
- **Redundancy (addressed in Phase 1):** Roster total stays in the header; the meta row avoids repeating N when scope is “all patients” and there is no search. “Updated” time remains next to sync (see rounding UX plan for richer census/sync copy).
- **Density:** Even with collapsible Tools groups, Resources + Settings tabs remain large when Menu is open.

## Proposed solution (phased)

### Phase 1 — Quick wins (visual hierarchy, no feature removal)

- [x] Soften collapsed **Menu** panel chrome so it does not read as a second “hero” card (lighter border/background when closed).
- [x] **Meta row polish:** Stack on narrow viewports (`min-[480px]` row), `flex-nowrap` + `shrink-0` for sync row; **Last updated** shortened to **Updated {time}**; search query truncated; **Sync** label on small screens (`sm` breakpoint). `LiveRegion` kept for screen readers.
- [x] **Keyboard discoverability:** Shortcut row in meta area (`md+`, decorative `aria-hidden`), help button `title`, dialog description + new entries for AI (⌘⇧A) and print (⌘P); `KeyboardShortcutSystem` list updated.
- [x] **Header census vs list meta:** Header uses **on roster**; roster total stays in header chip only. When filter is **All** and no search, meta left shows **All patients** (no duplicate count). Counts appear in meta when searching or filtering.

### Phase 2 — Information architecture

- [x] **Tools** tab: collapsible **Import & AI** (default open) and **Analytics & batch** (default closed); progressive disclosure.
- [x] Deduplicate **Print**: header **Print** remains; removed **Print / Export** from **Filters & actions**.
- [x] **Utility menu persistence**: `localStorage` key `rr-desktop-utility-menu-open`.

### Phase 3 — Verification

Operator / CI (requires BrowserStack credentials in MCP or dashboard):

- [ ] Run `startAccessibilityScan` on `/auth` (public) and, if needed, authenticated pages via `createAccessibilityAuthConfig` + `authConfigId`.
- [ ] If the Cursor agent still sees **Invalid credentials**, confirm the BrowserStack MCP server in **Cursor Settings → MCP** is enabled, shows **connected**, and env vars match [Account → Access key](https://www.browserstack.com/accounts/profile). Reload the window after saving. **Live** sessions can work while **Accessibility API** calls still fail if only one credential type is wired.
- [ ] Optional Playwright smoke with `setupBrowserStackAutomateTests` for regression on critical paths.

**Manual fallback:** Run an accessibility scan from the [BrowserStack Accessibility](https://www.browserstack.com/docs/accessibility) product UI against the production URL if MCP API access is blocked in a given environment.

**Code-side a11y (done in app):** Meta shortcut line is `aria-hidden` so it does not duplicate the shortcuts dialog for screen readers; `LiveRegion` still announces filter/search counts.

## Technical considerations

- **Primary files:** `src/components/dashboard/DesktopDashboard.tsx` (header, `DesktopUtilityPanel`, search/meta row, FAB), `src/components/dashboard/VirtualizedPatientList.tsx`, `PatientCard` as needed.
- **Risk:** Hiding controls without discoverability hurts new users; pair reductions with tooltips or first-run hints.
- **Performance:** Fewer DOM nodes in default view helps low-end machines; prefer CSS collapse over conditional mount where state is toggled often.
- **Mobile:** `MobileDashboard.tsx` has its own density (tabs, nav, print icon); schedule a **separate** pass or a short subsection once desktop declutter patterns stabilize.

## Acceptance criteria

- [x] Collapsed utility menu is visually subordinate to the patient workspace (no heavy card shadow when closed).
- [x] Plan documents BrowserStack Live URL pattern and credential requirement for a11y scans.
- [x] Meta row and header do not redundantly communicate the same patient count without intentional, differentiated copy—or one count is removed.
- [x] Shortcuts for search, AI palette, and navigation are discoverable without reading source.
- [x] No removal of required clinical workflows without a tracked follow-up.

## Success metrics

- Subjective: fewer users describe the main screen as “cluttered” in feedback.
- Objective: time-to-first-patient-edit unchanged or improved; support tickets about “where is X?” not increasing.

## Dependencies & risks

- **BrowserStack MCP:** Accessibility and Percy require valid API credentials in the MCP server config.
- **Auth:** Full dashboard review on production requires login; unauthenticated Live session only shows `/auth`.
- **Overlap:** Do not conflict with open items in [2026-03-22-dashboard-rounding-ux-plan.md](./2026-03-22-dashboard-rounding-ux-plan.md) (toast position, stats copy, two-pane behavior)—link PRs across both docs when touching shared chrome.

## References & research

- Internal: `src/components/dashboard/DesktopDashboard.tsx`, `src/components/dashboard/VirtualizedPatientList.tsx`
- Plans: [2026-03-22-dashboard-rounding-ux-plan.md](./2026-03-22-dashboard-rounding-ux-plan.md)
- External: [BrowserStack Live](https://www.browserstack.com/live) — manual cross-browser review
- `docs/deployment.md` — production URL origin for CORS
