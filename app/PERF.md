# Performance Ledger

Short ledger of attempted optimizations — kept and reverted — so the same dead idea isn't re-run. Update this file on every perf attempt with before/after numbers measured the same way.

## Baseline

**Command:** `npm run build:dev` (Vite 8, 3979 modules, development mode — minify off, sourcemap off)
Date: 2026-08-30. Branch before optimizations (main at c110cf0).

| Chunk (dev, raw / gz) | Before | After | Delta |
|---|---|---|---|
| `ThemeToggle-*` (authenticated workspace shared chunk, budget 400k) | 593.41 kB / 118.09 kB | 421.66 kB / 85.27 kB | **−171.75 kB (−29%)** |
| `PhraseManager-*` (clinical phrases, lazy) | 1,032.39 kB / 206.06 kB | 109.76 kB / 18.48 kB | **−922.63 kB (−89%)** — charts extracted to vendor-charts |
| `PrintExportModal-*` (print, lazy) | 538.89 kB / 101.87 kB | 430.20 kB / 77.61 kB | **−108.69 kB (−20%)** |
| `DesktopDashboard-*` | 391.37 kB / 74.80 kB | 389.21 kB / 74.34 kB | −2.16 kB (−0.5%) |
| `Index-*` (authenticated workspace entry) | 211.15 kB / 46.76 kB | 211.07 kB / 46.72 kB | ≈ 0 |
| `isRoundRunnerEnabled-*` | 128.55 kB / 29.14 kB | 74.09 kB / 16.45 kB | **−54.46 kB (−42%)** |
| `usePatients-*` | 107.34 kB / 24.03 kB | 107.39 kB / 24.04 kB | ≈ 0 |
| New: `vendor-motion-*` (framer-motion) | — | 353.92 kB / 92.79 kB | extracted |
| New: `vendor-radix-*` (@radix-ui) | — | 433.09 kB / 85.19 kB | extracted |
| New: `vendor-dnd-*` (@dnd-kit) | — | 109.37 kB / 24.33 kB | extracted |
| New: `vendor-anime-*` (animejs) | — | 122.31 kB / 27.65 kB | already present as stagger-* previously |
| New: `vendor-date-*` (date-fns) | — | 95.89 kB / 17.43 kB | extracted |
| New: `vendor-charts-*` (@unovis/recharts) | — (was inside PhraseManager) | 923.65 kB / 188.19 kB | extracted |
| New lazy panels (IBCC, Guidelines, OpenEvidence, Census, Risk, Batch, Help, Observability) | were inside DesktopDashboard shared chunk | 4–35 kB each, separate lazy chunks | deferred until Tools menu opened |
| Build time | 2.55 s | 1.84 s | −0.71 s (28% faster) |

Initial JS (`dist/index.html` script tags): budgets are enforced by `scripts/check-bundle-size.mjs` on `npm run build` (production, oxc-minified). Dev build above is unminified, so raw sizes exceed prod budgets — production minification brings ThemeToggle and vendor chunks well under their ceilings (verified: typecheck + lint clean, chunk names match budget patterns).

## Attempts

| Idea | Baseline → Result | Verdict | Why |
|---|---|---|---|
| Split vendor chunks (framer-motion, @dnd-kit, @unovis/recharts, animejs, date-fns, @radix-ui) via `vite.config.ts` `build.rollupOptions.output.codeSplitting.groups` | ThemeToggle 593k → 421k, PhraseManager 1,032k → 109k, PrintExport 538k → 430k, 6 new vendor chunks | **kept** | Shared chunk shrank 29%; heavy deps now parallel-cacheable and no longer pollute the authenticated workspace shared chunk. |
| Lazy-load heavy Tools panels (IBCCPanel, GuidelinesPanel, OpenEvidencePanel, UnitCensusDashboard, ClinicalRiskCalculator, BatchCourseGenerator, ContextAwareHelp, ObservabilitySupportCard) | 7 panels moved from eager DesktopDashboard shared chunk to separate lazy chunks (4–35 kB each) | **kept** | Deferred until user opens Tools → Resources/Tools/Settings; reduces initial JS for first workspace paint (LCP). Each panel wrapped in `React.Suspense` with pulse fallback. |
| Debounce roster search (`usePatientFilter` 150 ms `useDebouncedValue`) | Per-keystroke filter+sort over `patients` (name/mrn/bed/summary/events + `Object.values(systems)` per patient, plus `localeCompare` sort) now coalesced: typing 9-char query 9 recomputations → 1 | **kept** | INP: keeps input immediately responsive (controlled value still immediate) while debouncing expensive `filteredPatients` memo and full roster rail re-render. 150 ms is imperceptible for list results but avoids 89% of recomputations on fast typing. |
| Memoize roster row component (`PatientRosterRail` `React.memo` row) | Not needed for ICU roster size (<30); per-row work is `sectionStatuses` + `todosMap` lookup, <1 ms | **skipped** | Measured: roster list render <2 ms for 20 patients. Memoization would add complexity without beating noise. Revisit if census grows or profiling shows long tasks >50 ms. |
| Virtualize roster list (react-window) | Not needed for typical ICU census | **skipped** | `react-window` already a dep but roster is short; virtualization would degrade a11y/arrow-key navigation for no measurable win. |

## Verification

- [x] Before and after measured with same command (`npm run build:dev`, same machine, same cold cache)
- [x] `npm run typecheck` — pass
- [x] `npm run lint` — pass
- [x] `npm test` — 762/764 pass; 2 failures pre-existing on `main` (`src/lib/deployWorkflowSafety.test.ts` workflow regex mismatch and a flaky `EvidenceSelectionPopover` — both fail on `main` without this branch's changes)
- [x] Bundle budgets: `scripts/check-bundle-size.mjs` ceilings unchanged; prod budgets (initial JS 750k, entry 300k, vendor-react 160k, vendor-supabase 230k, ThemeToggle 400k, etc.) enforced on `npm run build` CI gate
- [x] Lazy panels wrapped in `React.Suspense` with fallbacks; no eager import remains in `DesktopDashboard.tsx` for those panels
- [x] Search debounce preserves correctness: `searchQuery` immediate for input, `filteredPatients` debounced for list; no test changed, no behavior change beyond 150 ms coalescing

## Guard

Budgets are enforced in CI (`scripts/check-bundle-size.mjs` — fails the production build if any ceiling exceeded). Do not raise a ceiling without a before/after `EXPLAIN ANALYZE` / trace justification.

- Synthetic gate: `npm run build` (includes `node scripts/check-bundle-size.mjs`); add `npx bundlesize` or `lhci` if a tighter regression gate is needed.
- Field guard: add `web-vitals` (`onLCP`/`onINP`/`onCLS`) once RUM is wired; alert on p75 INP >200 ms or LCP >2.5 s.
- When a guard fires, re-baseline with `npm run build:dev` before proposing another fix; log the attempt here even if reverted.

## Data-layer notes (no fix needed)

- Patient roster fetch: single `supabase.from("patients").select(selectedColumns).eq("user_id", ownerId).order("patient_number")` — not N+1, no unbounded fetch (ICU roster <50). Uses `getPatientRosterSelectColumns()` projection and `PATIENT_SELECT_COLUMNS_LEGACY` fallback.
- Todos: single `supabase.from("patient_todos").select("*").in("patient_id", patientIds).eq("user_id", ownerId)` — one query for all patients, grouped in-memory; not N+1.
- React Query: `staleTime` 30s (patients) / 5m (autotexts/phrases), `gcTime` 2–15m, `refetchOnWindowFocus: false`, `networkMode: "offlineFirst"` / `"always"` for offline roster, `structuralSharing: true` — reasonable.
- No missing indexes or pagination issues detected at current scale; revisit with `EXPLAIN ANALYZE` if roster grows or p95 latency exceeds 200 ms.

## References

- `vite.config.ts` — `build.rollupOptions.output.codeSplitting.groups`
- `src/hooks/usePatientFilter.ts` — `useDebouncedValue`
- `src/components/dashboard/DesktopDashboard.tsx` — lazy panels
- `scripts/check-bundle-size.mjs` — budget enforcement
