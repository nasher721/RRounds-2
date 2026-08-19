# Plan: Edge Functions & Button Resilience

## Traceability

- **Brainstorm:** [docs/brainstorms/2026-03-19-button-errors-edge-functions-brainstorm.md](../brainstorms/2026-03-19-button-errors-edge-functions-brainstorm.md)
- **Goals:** Fewer post-deploy failures, consistent user-facing errors, coordinated deploys, retries, observability (Sentry + structured logs), proactive health gating.

---

## Overview

| Phase | Focus |
|-------|--------|
| **1** | Error messages, timeouts, loading states, `getUserFacingErrorMessage` everywhere |
| **2** | CI: edge-first deploy, smoke test, CORS/env docs |
| **3** | Edge retries (3× ~1s fixed), structured logging, circuit breaker tuning from data, Sentry, healthcheck gating |

---

## Phase 1 – Error handling and UX (ship first)

### 1.1 Extend `getUserFacingErrorMessage`

**File:** `src/lib/userFacingErrors.ts`

- Import and branch on `CircuitOpenError` from `@/lib/circuitBreaker` → e.g. “Service is temporarily busy. Try again in a few seconds.”
- Map `ApiError` with `status === 429` → rate limit message.
- Map CORS / opaque failure patterns (`Failed to fetch`, `NetworkError`) — already partly present; align wording with “backend updating” when health will be integrated in Phase 3.
- Ensure `normalizeError` wrapping doesn’t hide `CircuitOpenError` — use `instanceof` before generic `Error` handling.

### 1.2 Audit every `supabase.functions.invoke` path

Apply **`getUserFacingErrorMessage(error, fallback)`** for any user-visible failure and **`withCategoryTimeout`** where long AI calls lack it.

| Area | Files (primary) |
|------|------------------|
| AI assistant | `src/hooks/useAIClinicalAssistant.ts`, `src/hooks/useLLMClinicalAssistant.ts` |
| Batch / summaries | `src/hooks/useBatchCourseGenerator.ts`, `src/hooks/useDailySummaryGenerator.ts`, `src/hooks/useIntervalEventsGenerator.ts`, `src/hooks/usePatientCourseGenerator.ts` |
| Patient parse / handoff | `src/components/SmartPatientImport.tsx`, `src/components/EpicHandoffImport.tsx` |
| Todos / meds / transform | `src/hooks/usePatientTodos.ts`, `src/hooks/useMedicationFormat.ts`, `src/hooks/useTextTransform.ts` |
| Dictation | `src/hooks/useDictation.ts` |
| Drug interactions | `src/services/drug-interaction.service.ts` |
| Streaming | `src/hooks/useStreamingAI.ts` — verify error path still reaches toast/UI |

**Concrete checks:**

- Replace raw `error.message` / `toast.error(error.message)` with `getUserFacingErrorMessage` where appropriate (`useDailySummaryGenerator`, `useBatchCourseGenerator`, etc.).
- Add `withCategoryTimeout` to `useBatchCourseGenerator` invocations if missing (match `SmartPatientImport` / `EpicHandoffImport` pattern).

### 1.3 Button loading and disabled state

Scan components that trigger edge calls for:

- `disabled={isLoading}` (or equivalent) on the primary trigger.
- Visible loading indicator (`Loader2`, `aria-busy`, etc.).

Prioritize: `AITextTools`, `AIClinicalAssistant`, `BatchCourseGenerator`, `SmartPatientImport`, `EpicHandoffImport`, mobile equivalents, print/export AI paths.

### 1.4 Acceptance (Phase 1)

- [x] No code path shows raw `CircuitOpenError` text to users (`getUserFacingErrorMessage` handles circuit + `ApiError` cause).
- [x] All listed invoke sites use shared error helper for destructive toasts/alerts (and drug-interaction service).
- [x] Long-running invokes use `withCategoryTimeout` consistent with `requestTimeout.ts` (batch, daily/interval/course, todos, meds, transform, dictation, LLM edge fallback; SmartPatientImport / EpicHandoffImport / useAIClinicalAssistant already had timeouts).

---

## Phase 2 – Coordinated deploys and smoke tests

### 2.1 Current state

- **Supabase:** `.github/workflows/deploy-supabase.yml` runs on `push` to `main` when `supabase/**` changes (migrations + `supabase functions deploy`).
- **Frontend:** Typically Vercel Git integration on `main` (independent timing).

### 2.2 Target behavior

1. **Documentation:** Add `docs/deployment.md` (or extend `CLAUDE.md`) with:
   - Order of operations when changing **both** client and edge (deploy edge first, then frontend — or document exceptions).
   - `ALLOWED_ORIGINS` / `DEFAULT_ALLOWED_ORIGINS` in `supabase/functions/_shared/cors.ts` — how to add new Vercel preview/production URLs.

2. **CI orchestration (choose one):**

   - **Option A:** On `main` push that touches `supabase/**`, workflow deploys Supabase, then triggers Vercel deploy hook (requires `VERCEL_DEPLOY_HOOK_URL` secret).
   - **Option B:** Single “release” workflow dispatch that runs Supabase deploy then Vercel hook (manual or tag-based).
   - **Option C:** Keep separate workflows but add a **required** post-deploy job that runs only after Supabase deploy success.

3. **Smoke test:** After functions deploy, `curl` or script against `functions/v1/healthcheck` with auth as required (anon JWT or service pattern per Supabase docs). Fail workflow if non-200.

### 2.3 Acceptance (Phase 2)

- [x] Documented deploy order and CORS checklist (`docs/deployment.md`, `CLAUDE.md` link).
- [x] Automated smoke test runs after edge deploy (`.github/workflows/deploy-supabase.yml` — requires `SUPABASE_ANON_KEY`).
- [x] Optional Vercel hook after edge deploy (`VERCEL_DEPLOY_HOOK_URL` secret).

---

## Phase 3 – Resilience, observability, health gating

### 3.1 Edge retries (3× fixed ~1s)

**File:** `src/api/apiClient.ts`

- Today: edge requests use `retryCount = 0`; non-edge uses exponential backoff inside the retry loop.
- **Change:** For `isEdgeFunction`, set `retryCount = 3` and `retryDelayMs = 1000` per brainstorm.
- **Change:** Use **fixed** delay between attempts for edge only (no `Math.pow(2, attempt)` for edge path — add a flag e.g. `retryBackoff: 'fixed' | 'exponential'` or separate loop branch).

**Retry only on:** network errors, `AbortError` timeout (optional — product decision: usually don’t retry full 5min timeout), and **5xx** responses if the fetch layer can detect them (may require reading `response.ok` before treating as success — align with current `cb.execute` behavior).

Document in code comments: do **not** retry 4xx (except maybe 429 with backoff — Phase 3.5). 

### 3.2 Structured logging

**Files:** `src/lib/observability/logger.ts`, `src/api/apiClient.ts` (or thin wrapper)

- On edge invoke failure paths, log structured objects: `{ event: 'edge_invoke_failed', functionName, status, requestId?, durationMs, circuitState? }`.
- Reuse `recordTelemetryEvent` where it fits; ensure **no PHI** in payloads (existing telemetry rules).

### 3.3 Circuit breaker tuning

- After Phase 1 is live, use telemetry/IndexedDB export or aggregated logs to decide:
  - `failureThreshold` / `resetTimeoutMs` for `edge:*` in `apiClient.ts`.
- Implement changes in one place (`circuitNameFromUrl` + options).

### 3.4 Sentry

- **Current:** No `@sentry/react` in repo grep; `telemetry.ts` uses IndexedDB + logger.
- **Add:** `@sentry/react` (or `@sentry/vite-plugin` + SDK init in `main.tsx` / `App.tsx`) with:
  - DSN from env (`VITE_SENTRY_DSN`).
  - `beforeSend` scrubbing for PHI (strip patient payloads, query strings if needed).
- Wire **critical** edge failures (optional: sample rate) to `Sentry.captureException`, in addition to `recordTelemetryEvent`.

### 3.5 Healthcheck gating

**Existing:** `supabase/functions/healthcheck/index.ts` returns 200 + `{ status: 'healthy' }` or 503.

**Client:**

- Add `src/lib/edgeHealth.ts` (or hook `useEdgeHealth`):
  - `checkEdgeHealth(): Promise<'healthy' | 'unhealthy'>` via `supabase.functions.invoke('healthcheck')` or raw `apiFetch` to the function URL.
  - Short timeout (e.g. 5–10s) so dashboard load isn’t blocked forever.
- **Where to call:**
  - On app/dashboard mount (or lazy after auth) — cache result + TTL (e.g. 60s).
  - Before **critical** actions (batch generate, parse handoff, AI palette) — if unhealthy, show banner/toast “Backend is updating, try again shortly” and skip invoke.

**UI:**

- Small dismissible banner on `Index` / dashboard when unhealthy (don’t block entire app if health check itself fails — treat as “unknown” vs “unhealthy” if needed).

### 3.6 Acceptance (Phase 3)

- [x] Edge calls retry 3 times with ~1s fixed spacing on eligible failures (network + 5xx; not 4xx/timeout).
- [x] Structured logs / telemetry for edge retries and final failures (`correlationId`, `functionName`, no bodies).
- [x] Sentry optional via `VITE_SENTRY_DSN`; `beforeSend` scrubs query strings and breadcrumb payloads; boundary sends to Sentry.
- [x] Health gating: banner + `assertBackendReady` on batch import, smart/epic parse, AI clinical hooks.

---

## Suggested implementation order (tasks)

1. `userFacingErrors.ts` + unit tests if test harness exists for lib.
2. Patch hooks/components in Phase 1 table; manual QA on one patient flow per feature.
3. `docs/deployment.md` + CI smoke test for healthcheck.
4. (Optional) Vercel deploy hook after Supabase job.
5. `apiClient.ts` edge retry behavior.
6. Logger integration on failure paths.
7. Sentry SDK + env vars documented in `.env.example`.
8. `useEdgeHealth` + banner + gating on selected actions.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Healthcheck adds latency | Cache + TTL; non-blocking UI; short timeout. |
| Retries amplify load during outage | Cap at 3; circuit breaker still opens. |
| Sentry PHI | Strict `beforeSend` scrubbing; no request bodies with patient text. |
| Deploy hook secrets | Document rotation; use Vercel project-scoped hooks. |

---

## Done when

- Brainstorm acceptance criteria met: fewer silent/broken buttons after deploy, clear messages, documented and automated deploy path, retries + logs + optional Sentry + health UX.

Next step: execute Phase 1 as first PR; track phases as separate PRs or a single stacked series.
