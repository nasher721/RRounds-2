---
date: 2026-03-19
topic: button-errors-edge-functions
---

## Fix Button Errors and Prevent Edge Function Failures

### What We're Building

A full resilience stack to fix button errors and prevent edge function failures, especially after app updates. The plan covers:

1. **Standardized error handling** – All buttons that invoke edge functions show clear, actionable feedback when something fails.
2. **Coordinated deploys** – Frontend and edge functions deploy in a defined order with optional smoke tests.
3. **Resilience** – Retries, circuit breaker tuning, and observability so failures are fewer and easier to diagnose.

### Why This Approach

- **Button errors are mixed** – Some show toasts, some appear broken, some trigger edge failures with poor feedback.
- **Failures cluster after deploys** – Deployment ordering, CORS, and env/config mismatches are likely causes.
- **Success criteria** – Fewer failures, clear feedback, and safer deploys.
- **Full deployment control** – Both Vercel (frontend) and Supabase (edge functions) can be coordinated.

Approach C (full resilience) was chosen to address all three goals and future-proof against load and transient issues.

### Key Decisions

- **Error normalization** – Extend `getUserFacingErrorMessage` to handle `CircuitOpenError`, 429, and other edge cases. Use it consistently across all button→edge flows.
- **Timeout coverage** – Apply `withCategoryTimeout` to any edge call that doesn’t already use it (e.g. `useBatchCourseGenerator`, `useDailySummaryGenerator`).
- **Button UX** – Every async button must have `disabled={isLoading}` and a visible loading state (spinner).
- **Deploy coordination** – Single workflow or orchestration that deploys edge functions first, then frontend. Optional smoke test hitting key edge functions post-deploy.
- **Retry** – 3 retries with fixed ~1s delay for transient failures (network, 5xx) in the API client or per-call wrappers.
- **Circuit breaker tuning** – Revisit thresholds (e.g. 3 failures, 60s cooldown) and consider deploy-specific behavior.
- **Observability** – Sentry for errors; structured logs for edge calls (latency, errors, circuit state, correlation IDs). Integrate with existing ErrorBoundary where applicable.
- **Graceful degradation** – Call `healthcheck` (or a small version endpoint) before or beside critical actions; when unhealthy, show a dedicated “backend updating” (or similar) message instead of silent failure or generic errors.

### Phases

#### Phase 1 – Error Handling (Quick Wins)

- Extend `getUserFacingErrorMessage` for `CircuitOpenError`, 429, CORS, and common edge cases.
- Audit all button→edge flows and ensure `getUserFacingErrorMessage` + `withCategoryTimeout` are used.
- Ensure every async button has loading state and `disabled={isLoading}`.
- Add `CircuitOpenError` handling in `getUserFacingErrorMessage` with a clear “Service temporarily unavailable” message.

#### Phase 2 – Coordinated Deploys

- Create or update CI workflow to deploy edge functions first, then trigger frontend deploy (or use a single workflow that does both).
- Document required `ALLOWED_ORIGINS` for new Vercel domains.
- Optional: Add smoke test job that hits `healthcheck` or key edge functions after deploy.

#### Phase 3 – Resilience and Observability

- Add 3 retries with fixed ~1s delay for transient failures in the API client.
- Tune circuit breaker (thresholds, cooldown) based on observed behavior.
- Add structured logging/metrics for edge function calls.
- Implement health/version check before or beside critical actions; surface “backend updating” when edge functions aren’t ready.

### Resolved Questions

- **Retry config** – 3 retries with fixed delay (~1s between attempts) for transient failures.
- **Circuit breaker** – Tune after Phase 1; ship better errors first, then adjust thresholds/cooldown from real logs.
- **Observability sink** – Sentry for crashes/errors; structured logs (e.g. console or existing logger) for request correlation and edge-call diagnostics.
- **Graceful degradation** – Proactive healthcheck (or version endpoint) before/beside critical actions; dedicated “backend updating” UX when unhealthy.

### Next Steps

→ Use this document as the guiding roadmap.  
→ For implementation, start with Phase 1 (error handling), then Phase 2 (deploys), then Phase 3 (resilience).
