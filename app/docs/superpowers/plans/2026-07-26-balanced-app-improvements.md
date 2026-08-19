# Balanced App Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a high-impact reliability + performance + UX polish pass: roster visibility, bulk import, safe storage adoption, dialog accessibility, and clearer AI patient context—without a full IA redesign or enabling offline write queuing.

**Architecture:** Keep the existing dashboard/patient-hook architecture. Fix layout height so the desktop roster can show multiple patients; batch Supabase inserts for import; route remaining preference persistence through `createSafeStorage`; add missing dialog descriptions; surface selected-patient scope and disabled reasons in the AI command palette. Do not invert the intentional offline-truthfulness contract in `src/lib/offlineUiTruthfulness.test.ts`.

**Tech Stack:** React 18, TypeScript, Vite, TanStack React Query, Supabase JS, shadcn/Radix Dialog, Node.js native test runner (`npm test`).

## Global Constraints

- Do not add new npm dependencies.
- Do not enable offline patient write queuing; keep `src/lib/offlineUiTruthfulness.test.ts` contract intact (mutations must not pretend to enqueue; mounted offline UI must not promise sync of new writes).
- Do not replace the dashboard, patient hooks, or print/export architecture.
- Prefer extending existing patterns (`safeLocalStorage` / `safeSessionStorage`, React Query cache updates, existing import tests).
- Radix `SelectItem` must not use `value=""`.
- Follow TDD: write/adjust failing tests first, then implement, then commit per task.
- Stage and commit only intentional source changes (no `.DS_Store`); leave unrelated untracked paths alone.
- Branch name: `cursor/balanced-app-improvements-fb58` (already created). Base: `main`.

## File Structure

| File | Responsibility |
|------|----------------|
| `src/components/dashboard/VirtualizedPatientList.tsx` | Desktop roster sidebar height / nested scroll fix |
| `src/components/dashboard/DesktopDashboard.tsx` | Parent height / ScrollArea nesting that constrains roster |
| `src/hooks/patients/usePatientImport.ts` | Bulk insert import path |
| `src/hooks/patients/__tests__/usePatientImport.test.ts` | Import behavior tests |
| `src/lib/dashboardPrefs.ts` | Safe storage for dashboard prefs |
| `src/components/theme-provider.tsx` | Safe storage for theme/high-contrast |
| `src/hooks/useReducedMotion.tsx` | Safe storage for motion preference |
| `src/hooks/useLLMModelSelection.ts` | Safe storage for model selection |
| `src/hooks/useSystemsConfig.ts` | Safe storage for systems config |
| `src/utils/safeStorage.test.ts` | Storage denial coverage as needed |
| `src/components/MultiPatientComparison.tsx` | DialogDescription |
| `src/components/VoiceCommandPanel.tsx` | DialogDescription |
| `src/components/tools/AICommandPalette.tsx` | Patient scope label + disabled reasons |
| Focused unit/source tests under existing `__tests__` or colocated `*.test.ts(x)` | Lock behavior |

---

### Task 1: Desktop roster visibility (sidebar height)

**Files:**
- Modify: `src/components/dashboard/VirtualizedPatientList.tsx`
- Modify: `src/components/dashboard/DesktopDashboard.tsx` (only if parent `ScrollArea` / flex height still clamps the roster)
- Test: `src/components/dashboard/__tests__/rosterVisibility.layout.test.ts` (source/layout contract test; or extend existing e2e/layout tests if a closer harness already exists)

**Interfaces:**
- Consumes: existing `patientRosterLayoutMode === "sidebar"` layout in `VirtualizedPatientList`
- Produces: sidebar roster that on typical laptop viewport (`lg+`) fills available workspace height (`h-full` / `min-h-0`), shows multiple compact patient rows without a one-card `max-h-[42vh]` clamp on desktop, and keeps mobile/small breakpoints usable

- [ ] **Step 1: Write the failing layout contract test**

Assert (via reading component source or a small layout helper test) that the desktop sidebar roster region does **not** use `max-h-[42vh]` as the effective `lg+` height cap, and that the aside uses flex height that can show multiple rows (`lg:h-full` + `lg:min-h-0` + no `lg` max-height clamp). Prefer a source-contract test colocated under `src/components/dashboard/__tests__/` matching patterns like `src/lib/offlineUiTruthfulness.test.ts` if no RTL layout harness exists.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/dashboard/__tests__/rosterVisibility.layout.test.ts`  
Expected: FAIL because `max-h-[42vh]` still appears on the sidebar aside without a clear desktop override strategy, or parent nesting still documents the bad clamp.

- [ ] **Step 3: Fix roster height**

In `VirtualizedPatientList.tsx`, change the sidebar `<aside>` so desktop (`lg+`) consumes available column height predictably. Remove or replace the `max-h-[42vh]` clamp for the desktop sidebar case; keep a sensible small-viewport max-height only if needed below `lg`. Ensure nested `ScrollArea` remains `flex-1 min-h-0`. If `DesktopDashboard` wraps the workspace in a `ScrollArea` that forces nested scroll / one-card viewport, adjust that parent to a flex column with `min-h-0` / `overflow-hidden` so the roster owns its scroll, not a tiny nested viewport.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/dashboard/__tests__/rosterVisibility.layout.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/VirtualizedPatientList.tsx src/components/dashboard/DesktopDashboard.tsx src/components/dashboard/__tests__/rosterVisibility.layout.test.ts
git commit -m "$(cat <<'EOF'
fix(dashboard): make desktop patient roster fill workspace height

Remove the one-card viewport clamp so multiple roster rows are visible on laptop layouts.
EOF
)"
```

---

### Task 2: Bulk patient import

**Files:**
- Modify: `src/hooks/patients/usePatientImport.ts`
- Modify: `src/hooks/patients/__tests__/usePatientImport.test.ts`

**Interfaces:**
- Consumes: `buildPatientInsertPayload`, `getNextPatientCounter`, `mapPatientRecord`, `appendPatients`, existing conflict helper `isPatientNumberConflict` / `getLatestPatientNumber`
- Produces: `importPatients` that for N>1 attempts one (or few) bulk `.insert([...]).select()` with precomputed patient numbers, then a single `appendPatients` cache update; preserves partial-failure notifications and owner-switch guards

- [ ] **Step 1: Extend failing tests for bulk insert**

In `usePatientImport.test.ts`, add coverage that importing multiple patients calls Supabase `insert` with an **array of length > 1** (or a single multi-row insert) rather than one insert per patient in the happy path. Keep existing conflict/auth-transition coverage green.

- [ ] **Step 2: Run focused import tests (expect new assertion to fail)**

Run: `npm test -- src/hooks/patients/__tests__/usePatientImport.test.ts`  
Expected: new bulk-insert assertion FAIL; existing tests may still pass.

- [ ] **Step 3: Implement bulk import**

Refactor the happy path in `importPatients` to:
1. Precompute sequential `patient_number` values from `getNextPatientCounter`.
2. Build payloads for all rows.
3. Insert in one multi-row call (`.insert(payloads).select()`).
4. On `patient_number` unique conflict, fall back to conflict recovery (rebase numbers via `getLatestPatientNumber` and retry bulk, or bounded per-row retry only for conflict recovery—not the happy path).
5. Map returned rows and `appendPatients` once.
6. Keep success / partial / total-failure toast behavior.

- [ ] **Step 4: Run import tests**

Run: `npm test -- src/hooks/patients/__tests__/usePatientImport.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/patients/usePatientImport.ts src/hooks/patients/__tests__/usePatientImport.test.ts
git commit -m "$(cat <<'EOF'
perf(patients): bulk-insert multi-patient imports

Replace sequential per-patient inserts with a multi-row insert and single cache append on the happy path.
EOF
)"
```

---

### Task 3: Route remaining preference storage through safeStorage

**Files:**
- Modify: `src/lib/dashboardPrefs.ts`
- Modify: `src/components/theme-provider.tsx`
- Modify: `src/hooks/useReducedMotion.tsx`
- Modify: `src/hooks/useLLMModelSelection.ts`
- Modify: `src/hooks/useSystemsConfig.ts`
- Modify/Test: `src/utils/safeStorage.test.ts` and/or existing prefs tests (`src/lib/dashboardPrefs.test.ts`) as needed

**Interfaces:**
- Consumes: `safeLocalStorage` / `createSafeStorage` from `src/utils/safeStorage.ts`
- Produces: listed call sites no longer touch raw `window.localStorage` for reads/writes/removes in production code paths (tests may still use real localStorage)

- [ ] **Step 1: Write/extend failing tests**

Add or extend tests proving that when storage getters/methods throw, theme init, dashboard prefs load/save, motion preference, LLM model selection, and systems config do not throw (memory fallback / graceful degrade). Prefer extending `safeStorage.test.ts` / `dashboardPrefs.test.ts` over new frameworks.

- [ ] **Step 2: Run tests (expect fail where raw localStorage remains assumed)**

Run: `npm test -- src/utils/safeStorage.test.ts src/lib/dashboardPrefs.test.ts`  
Expected: FAIL or incomplete coverage until call sites migrate.

- [ ] **Step 3: Migrate call sites**

Replace raw `localStorage` usage in the five files above with `safeLocalStorage` (or a module-local `createSafeStorage()` if the file already patterns that way). Preserve key names and JSON shapes exactly.

- [ ] **Step 4: Re-run tests**

Run: `npm test -- src/utils/safeStorage.test.ts src/lib/dashboardPrefs.test.ts`  
Expected: PASS. Also run a quick grep-based sanity: production files listed no longer contain bare `localStorage.` (except comments).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardPrefs.ts src/components/theme-provider.tsx src/hooks/useReducedMotion.tsx src/hooks/useLLMModelSelection.ts src/hooks/useSystemsConfig.ts src/utils/safeStorage.test.ts src/lib/dashboardPrefs.test.ts
git commit -m "$(cat <<'EOF'
fix(storage): route preference persistence through safeStorage

Prevent theme, dashboard prefs, motion, LLM, and systems config from crashing when localStorage is blocked.
EOF
)"
```

---

### Task 4: Dialog accessibility descriptions

**Files:**
- Modify: `src/components/MultiPatientComparison.tsx`
- Modify: `src/components/VoiceCommandPanel.tsx`
- Modify: at least two additional high-traffic dialogs from the production-readiness list that still lack descriptions (prefer among: `UnifiedAIDropdown`, `PhraseManager`, `PrintExportModal` / `PrintExportModalFull`, `PatientInfoToolbarCustomizeDialog`, mobile clear-all / tool dialogs in `MobileDashboard.tsx`)
- Test: `src/components/__tests__/dialogAccessibility.contract.test.ts` (source-contract test asserting targeted files include `DialogDescription` or intentional `aria-describedby={undefined}` with a title)

**Interfaces:**
- Consumes: shadcn `DialogDescription` from `@/components/ui/dialog`
- Produces: each targeted dialog has an accessible name (title) and either a useful `DialogDescription` or an explicit `aria-describedby={undefined}` only when description would be noise

- [ ] **Step 1: Write failing contract test** listing exact target files

- [ ] **Step 2: Run test (expect FAIL)**

Run: `npm test -- src/components/__tests__/dialogAccessibility.contract.test.ts`

- [ ] **Step 3: Add DialogDescription (or intentional undefined) to each target**

Keep clinical copy short. Do not globally suppress dialog warnings in the primitive.

- [ ] **Step 4: Run test (expect PASS)**

- [ ] **Step 5: Commit**

```bash
git add src/components/MultiPatientComparison.tsx src/components/VoiceCommandPanel.tsx src/components/__tests__/dialogAccessibility.contract.test.ts [other touched dialog files]
git commit -m "$(cat <<'EOF'
fix(a11y): add dialog descriptions to high-traffic modals

Give screen-reader users useful dialog context for comparison, voice, and related surfaces.
EOF
)"
```

---

### Task 5: AI command palette patient scope + disabled reasons

**Files:**
- Modify: `src/components/tools/AICommandPalette.tsx`
- Test: `src/components/tools/__tests__/aiCommandPalette.context.test.ts` (source or RTL contract: when `patient` prop absent, patient-required actions expose a visible disabled/reason path; when present, UI surfaces patient name/scope—not first-patient fallback)

**Interfaces:**
- Consumes: existing `patient?: Patient` prop already passed from `DesktopDashboard` as `selectedPatient`
- Produces: visible selected-patient label when open; patient-required commands disabled (or clearly blocked) with reason text when `patient` is undefined; no toast-only-required instruction for the primary disabled reason

- [ ] **Step 1: Write failing context test**

- [ ] **Step 2: Run test (expect FAIL)**

Run: `npm test -- src/components/tools/__tests__/aiCommandPalette.context.test.ts`

- [ ] **Step 3: Implement UI**

Near the palette header/empty state, show “Selected: {patient.name}” or “Select a patient to run clinical AI actions”. For commands that require a patient, disable the item (or show reason inline) when `!patient` instead of relying only on a destructive toast after click. Keep toast as a secondary safeguard if needed.

- [ ] **Step 4: Run test (expect PASS)**

- [ ] **Step 5: Commit**

```bash
git add src/components/tools/AICommandPalette.tsx src/components/tools/__tests__/aiCommandPalette.context.test.ts
git commit -m "$(cat <<'EOF'
fix(ai): clarify selected-patient context in command palette

Show patient scope and disable patient-required actions with visible reasons when none is selected.
EOF
)"
```

---

### Task 6: Verification sweep + docs touch

**Files:**
- Modify: `docs/IMPROVEMENT_PLAN.md` (short note under a new Phase or status line pointing at this plan) — only if a one-paragraph status update fits without rewriting history
- No feature code unless a prior task left a regression

- [ ] **Step 1: Run lint and unit tests**

Run: `npm run lint` and `npm test`  
Fix only regressions introduced by Tasks 1–5.

- [ ] **Step 2: Run production build**

Run: `npm run build`  
Expected: success.

- [ ] **Step 3: Commit any verification fixes / plan status note**

```bash
git add docs/superpowers/plans/2026-07-26-balanced-app-improvements.md docs/IMPROVEMENT_PLAN.md
git commit -m "$(cat <<'EOF'
docs: add balanced app improvements plan and verification status
EOF
)"
```

---

## Out of Scope (explicit)

- Offline write queue / mounting `OfflineSyncProvider` as if writes enqueue
- Secure Realtime presence re-enable
- Full Roster/Workspace/Team Actions IA redesign (`docs/brainstorms/2026-03-26-patient-list-workflow-ux-brainstorm.md`)
- Edge gateway `verify_jwt` flip
- New clinical CDS / collaboration features from `FEATURE_SUGGESTIONS.md`
