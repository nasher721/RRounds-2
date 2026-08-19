# Round Robin Notes — Phased Improvement Plan

Generated from extensive code review (security, performance, architecture, simplicity, code quality).  
**Date:** 2026-03-14

## Status note: 2026-07-26 balanced app improvements

A focused follow-up on roster visibility, bulk import, safe storage hardening, dialog accessibility, and AI patient-scope polish shipped on branch `cursor/balanced-app-improvements-fb58`. See `docs/superpowers/plans/2026-07-26-balanced-app-improvements.md` for the task-by-task implementation plan and verification sweep.

---

## Phase 1: Critical correctness & security (P0)

**Goal:** Fix data bugs and security vulnerabilities that affect correctness or safety.

| # | Item | Source | Action |
|---|------|--------|--------|
| 1.1 | **last_modified not persisted** | Code review | In `usePatientMutations`, include `last_modified` in the Supabase update payload so DB stays in sync. |
| 1.2 | **Patient field history for medications** | Code review | In `usePatientMutations`, serialize object values (e.g. `JSON.stringify`) for `medications` when writing `old_value`/`new_value`. |
| 1.3 | **Invalid type import in patientMapper** | Code review | Remove `defaultMedications` from type-only import in `patientMapper.ts`. |
| 1.4 | **useAIWorkflow uses anon key** | Security | Send user session JWT in `Authorization` header for Edge calls instead of `VITE_SUPABASE_ANON_KEY`. |
| 1.5 | **Storage policy: public patient images** | Security | Addressed by migration `20260205190811`: bucket set private and policy dropped. Ensure this migration is applied in all environments. |
| 1.6 | **AutotextManager XSS** | Security | Sanitize template content (e.g. `sanitizeHtml()` or `stripHtml()`) before `dangerouslySetInnerHTML`. |
| 1.7 | **Update failure has no user feedback** | Code review | Add `notifications.error(...)` on patient update failure in `usePatientMutations`. |

**Deliverables:** All Phase 1 items implemented and verified.

---

## Phase 2: High-impact performance & architecture

**Goal:** Single source of truth for server state, fewer duplicate fetches, and correct provider/cache usage.

| # | Item | Source | Action | Done |
|---|------|--------|--------|------|
| 2.1 | **Use optimized QueryClient** | Perf, Arch | In `App.tsx`, use `createOptimizedQueryClient()` from `src/lib/cache/queryClientConfig.ts` instead of inline `new QueryClient()`. | ✅ |
| 2.2 | **Duplicate todo fetches** | Perf | Have `PatientCard` and mobile detail use `todosMap` from context for **read**; use `usePatientTodos` only for **mutations** (or single query backing both). | ✅ |
| 2.3 | **Stabilize dashboard context** | Perf, Arch | Split or restructure so `todosMap` (and other high-churn data) doesn’t replace the whole context value; e.g. separate “data” context or ref + stable getter. | ✅ |
| 2.4 | **Patient list on React Query** | Arch, Perf | Refactor `usePatientFetch` to `useQuery` with `QUERY_KEYS.patients`; dashboard and cache warming read/write same cache. | ✅ |
| 2.5 | **Use todos in generators** | Perf | Accept todos from caller in both generators; BatchCourseGenerator and PatientCard pass `todosMap`/`todos` when available. | ✅ |
| 2.6 | **OfflineSyncIndicator / Provider** | Arch | Either mount `OfflineSyncProvider` and render `OfflineSyncIndicator`, or remove dead import and document that offline UI is not wired. | ✅ |
| 2.7 | **UnifiedAIChatbot patient source** | Arch | Feed chatbot from same patient source as dashboard (e.g. pass `patients` from Index or shared cache) so one source of truth. | ✅ |

**Deliverables:** QueryClient and todo-dedup in place; optional: patient React Query migration and context split.

---

## Phase 3: Edge Functions & ops

**Goal:** Safer error handling and no PHI in logs.

| # | Item | Source | Action | Done |
|---|------|--------|--------|------|
| 3.1 | **Healthcheck: no raw DB error** | Security | Do not return `dbError.message` to client; return generic "Database unavailable". | ✅ |
| 3.2 | **parse-handoff: no PHI in logs** | Security | Redact patient names/beds in logs; log AI response length only (no content). | ✅ |
| 3.3 | **safeErrorMessage** | Security | Do not forward messages containing API_KEY, SECRET, PASSWORD, TOKEN to client. | ✅ |
| 3.4 | **Dependency upgrades** | Security | Upgrade react-router-dom, dompurify, ajv (or rxdb) to address advisories; run tests after. | ✅ |

**Deliverables:** Edge functions return generic errors and don’t log PHI; dependencies updated.

---

## Phase 4: Cleanup & maintainability

**Goal:** Remove dead code, consolidate duplicates, improve types and docs.

| # | Item | Source | Action | Done |
|---|------|--------|--------|------|
| 4.1 | **Dead hooks** | Simplicity | Document as unused: file-header comments added to `useOptimizedQuery`, `useCRDT`, `useAIWorkflow`. | ✅ |
| 4.2 | **Print modal consolidation** | Simplicity | Use `PrintExportModalProps` and `PatientTodosMap` from `print/types.ts` in PrintExportModalFull; re-export from Full. | ✅ |
| 4.3 | **patient_number concurrency** | Code review | Use functional update for counter or derive next number from current list/ref in add/duplicate/import. | ✅ |
| 4.4 | **CLAUDE.md** | Arch | Update provider hierarchy (ThemeProvider, GlobalErrorBoundary), note React Query vs current useState for server state, and route-scoped contexts. | ✅ |
| 4.5 | **patientService vs patientMapper** | Code review | Add short comment documenting which module owns DB→UI mapping and update payload building. | ✅ |
| 4.6 | **Lazy panel error boundary** | Simplicity | Single shared error boundary + parameterized fallback for IBCC and Guidelines lazy panels. | ✅ |

**Deliverables:** Dead code removed, single Print types, docs updated, optional refactors.

---

## Phase 5: Testing & hardening (optional)

| # | Item | Action | Done |
|---|------|--------|------|
| 5.1 | Auth flow tests | Unit tests for `useAuth` and Auth.tsx (mocked Supabase). | ✅ |
| 5.2 | Patient CRUD hook tests | Unit tests for `usePatientMutations` / `usePatientImport` with mocked Supabase. | ✅ |
| 5.3 | E2E / integration | At least one flow: login → dashboard; optional: print/export open → export. | ✅ |
| 5.4 | Null checks | After Supabase `.single()` (and similar), check `data == null` before mapping. | ✅ |

---

## Implementation order (this run)

1. **Phase 1** — All items (correctness + security + one UX fix).
2. **Phase 2** — 2.1 (QueryClient), 2.6 (OfflineSync fix or document), and groundwork for 2.2 (document or minimal change for todo usage).
3. **Phase 4** — 4.1 (dead hooks: remove or document), 4.2 (Print types only if low-risk), 4.3 (patient_number), 4.4 (CLAUDE.md update).

Phases 3 (Edge Functions) and 5 (testing) can follow in separate PRs or sessions.
