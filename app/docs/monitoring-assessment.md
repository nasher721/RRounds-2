# Monitoring assessment — Round Robin Notes

Step-by-step plan following **Assess → Instrument → Collect → Visualize → Alert**.

---

## Step 1: Assess (current state)

### What exists

| Area | What you have |
|------|----------------|
| **Structured logging** | `src/lib/observability/logger.ts` — PHI-safe JSON console output plus bounded central delivery when an approved sink is configured. |
| **Telemetry / errors** | `src/lib/observability/telemetry.ts` — Persists events to IndexedDB, fingerprinting, frequency tracking, `recordTelemetryEvent()`, PHI-safe `sanitizeContext()`. |
| **Global error capture** | `initGlobalErrorCapture()` in `main.tsx` — unhandled errors and unhandled promise rejections → telemetry. |
| **Render errors** | `GlobalErrorBoundary` uses `recordTelemetryEvent('render_error', …)`. |
| **API errors** | `apiClient.ts` records `api_error` / `network_error` via telemetry; circuit breaker + retries. |
| **Request timeouts** | `requestTimeout.ts` records `network_error` on timeout. |
| **AI errors** | `useAIClinicalAssistant` records `ai_error`. |
| **Sync** | The owner-scoped queue emits aggregate length/oldest-age pressure plus replay duration, completed, failed, and conflict counts. No mutation payload is included. |
| **Patient fetch** | `usePatientFetch.ts` emits fixed success, failure, latency, and offline-cache-fallback metrics without owner or patient identifiers. |
| **Cache metrics** | React Query + service worker: hits, misses, latency in `performanceMonitor.ts` and `CacheMonitorPanel`; not exported to a central backend. |
| **Clinical AI operations** | Authenticated Edge functions emit fixed, content-free provider/status/duration logs through `safeLog`; browser provider logging was removed with the direct-provider runtime. |
| **Business metrics** | `src/types/analytics.ts` + `AnalyticsDashboard` / `MobileAnalytics` — unit/task/alert/protocol metrics computed from patient/todo data (in-app only). |
| **Public funnel** | `marketingTelemetry.ts` emits fixed PHI-free events for landing view, sign-in intent, feature exploration, security guidance, pricing/contact intent, email intent, and footer workspace intent through the optional collector. |
| **Browser performance** | `webVitals.ts` reports TTFB, FCP, LCP, CLS session windows, and p98 INP as fixed scalar metrics. Performance-entry URLs, elements, interaction names, and page content are never collected. |
| **Health** | Supabase Edge Function `healthcheck` — DB ping + 200/503; suitable for UptimeRobot/Datadog. |

### Gaps

1. **Central collection is deployment-gated** — the repository now includes a
   fixed-schema Supabase ingest and 30-day store, but production remains
   intentionally blocked until the operator approves and configures that URL
   or hosted Sentry. IndexedDB remains the local diagnostic store.
2. **Request IDs are partial** — Patient fetches and selected API/Edge paths carry correlation IDs; complete browser-to-Edge propagation is still incremental.
3. **Edge metrics are partial** — Shared structured safe logging exists, but not every function emits full rate/error/duration measurements.
4. **RED coverage is partial** — Patient fetch, authentication, patient mutation, and offline replay measurements are emitted; a configured backend is still needed to aggregate them.
6. **Alert rules are deployment work** — Repository code emits the required fixed metrics, but production thresholds and notification destinations are not configured here.

### Critical paths to monitor

| Path | SLI idea | Current coverage |
|------|----------|------------------|
| Patient load | Success rate, p95 latency | Fixed `patients.fetch.*` success, error, duration, and cache-fallback metrics. |
| Patient mutations | Outcome count, average latency | Fixed `patients.mutation.*` metrics; saved/queued per-input writes aggregate over five seconds, conflicts and hard errors emit immediately. |
| Edge Functions (AI, format, etc.) | Invocations, errors, duration | Not instrumented. |
| Public launch funnel | Landing → feature/sign-in/contact intent | Fixed PHI-free events; centrally visible only when collector ingest is configured. |
| Auth | Login outcome count, average latency | Password success and fixed failure categories plus approved-provider OAuth redirect/error outcomes emit `auth.sign_in.*`; OAuth is hidden unless deployment-allowlisted, and background session-restoration failures remain console-only. |
| Offline sync | Queue length/age, sync success/failure/conflict | Fixed `offline.sync.*` queue-pressure and replay-result metrics. |
| Global errors | Count by fingerprint, trend | Telemetry + frequency in-memory + IndexedDB; not aggregated. |
| Browser experience | TTFB, FCP, LCP, CLS, INP | Fixed `web.vital.*` measurements delivered through the approved first-party collector or Sentry bridge. |

---

## Step 2: Instrument (done)

- **Request IDs:** `generateRequestId()` in `src/lib/observability/logger.ts`; use in log/telemetry context for correlation.
- **Patient fetch:** `usePatientFetch` now logs:
  - `patients.fetch.duration_ms` (with `requestId`, `count`, `status: success|error`)
  - `patients.fetch.success` (1 per success)
  - `patients.fetch.error` unchanged, now includes `requestId`.
- **Patient mutations:** add, update, remove, duplicate, collapse-all, and clear-all emit:
  - `patients.mutation.duration_ms` (average duration plus aggregate count)
  - `patients.mutation.total` (count by fixed operation/outcome)
  - Saved and queued per-input writes coalesce for five seconds; conflict and hard-error outcomes emit immediately.
- **Offline sync:** the owner-scoped queue and replay engine emit:
  - `offline.sync.queue_length`, `offline.sync.oldest_age_ms`
  - `offline.sync.duration_ms`, `offline.sync.completed`,
    `offline.sync.failed`, `offline.sync.conflicts`
  - Rapid enqueue pressure publishes the latest aggregate snapshot once per
    five seconds; sync start/completion/error snapshots remain immediate.
- **Edge Functions:** `format-medications` logs `requestId`, `function: 'format-medications'`, `durationMs`, `status: success|error`; use as template for other functions.
- **Public funnel:** `marketingTelemetry.ts` uses a compile-time and runtime-fixed
  event vocabulary. Events contain only a funnel classification and the shared
  pseudonymous tab-session identifier—never form, contact, account, or patient
  content.
- **Authentication:** `authTelemetry.ts` emits `auth.sign_in.duration_ms` and
  `auth.sign_in.total` with only fixed method/outcome classifications. Email,
  password, account id, redirect URL, and upstream provider messages cannot be
  attached at this API boundary.
- **Browser experience:** `webVitals.ts` emits TTFB, FCP, LCP, CLS session
  windows, and p98 INP as fixed scalar metrics. Unsupported browser entry
  types are omitted instead of reported as false zeroes. No entry metadata is
  retained.
- **Not yet done:** Full RED coverage for every Edge Function.

---

## Step 3: Collect (done)

- **Current flow:** Keep console + IndexedDB; add a “Export logs” or “Send last N errors” for support.
- **Collector** (`src/lib/observability/collector.ts`): Buffers payloads; when `VITE_TELEMETRY_INGEST_URL` is set, batches (max 50) and POSTs after 5s or on buffer full. Concurrent flushes serialize, non-2xx/network failures requeue with exponential backoff capped at five minutes, retained memory is capped at 200 sanitized events, and `pagehide` flushes the final mutation aggregate before delivery.
- **Telemetry** (errors) remains in IndexedDB; use existing **Export error report** for support.
- **First-party backend:** `supabase/functions/telemetry` accepts bounded JSON
  batches, applies the distributed rate limiter and a second fixed-vocabulary
  validation boundary, then persists only projected scalar columns in
  `client_observability_events`. Browser roles have no table access; raw
  context and session identifiers are discarded; retention is 30 days.
- **Alternative:** Hosted Sentry remains supported. Its operational bridge
  emits only fixed tags and bounded numeric measurements.
- **Launch analytics:** Once an approved ingest endpoint is configured, chart
  `marketing.landing_view` → sign-in/contact intent → `auth.sign_in.total`.
  The code emits no cookies and does not send page content, email addresses,
  credentials, account identifiers, or clinical data.

---

## Step 4: Visualize (done)

- **Business metrics:** Use existing **AnalyticsDashboard** / **MobileAnalytics** for unit, task, alert, and protocol metrics.
- **Cache:** **CacheMonitorPanel** shows React Query + service worker hit rate and latency.
- **Errors:** Use `getErrorFrequencies()` and `exportErrorReport()` for local support. Query the service-role-only central table through approved operations tooling; never expose it to the clinical browser.

---

## Step 5: Alert (done — documented)

- **Uptime / health:** Use the Supabase Edge Function `healthcheck` (DB ping). In UptimeRobot or Datadog, add an HTTP monitor to your `.../functions/v1/healthcheck` URL with the `x-healthcheck-token` secret header; alert on 401, 5xx, or timeout.
- **Error rate:** After the first-party sink is deployed, add an alert when error rate > 5% on a critical path. Example (Prometheus-style):

```yaml
# Example: when you have metrics in a backend
- alert: HighErrorRate
  expr: rate(patients_fetch_errors_total[5m]) / rate(patients_fetch_requests_total[5m]) > 0.05
  for: 2m
  annotations:
    summary: "Patient fetch error rate above 5%"
```

- **Client-side:** Optional in-app banner or support report when `getErrorFrequencies()` shows a spike (e.g. same fingerprint > N times in session).

---

## Summary

Steps 1–5 have repository support. You have: assessment and gaps, request IDs
and success/duration metrics on patient fetch, authentication, patient writes,
and sync; a failure-safe collector; a fixed-schema first-party Supabase ingest
and 30-day store; a PHI-safe Sentry operational bridge;
fixed TTFB/FCP/LCP/CLS/INP browser measurements without PerformanceEntry
metadata;
existing in-app dashboards; and documented alerting. Sink provisioning,
receipt verification, and production alert rules remain deployment gates.

### Follow-up: local monitoring UX (errors → fixes)

| Piece | Purpose |
|-------|---------|
| **`breadcrumbs.ts`** | In-memory trail (`nav` = pathname only). Attached to every stored telemetry event as `recentBreadcrumbs` for repro steps. |
| **`exportDiagnosticsReport()`** | JSON bundle: errors with **stack previews**, **fingerprints**, `fixHints`, breadcrumbs, session id, build mode. Use for tickets or local grep. |
| **`window.__RR_OBSERVABILITY__`** | `exportReport()`, `copyReport()`, `getFrequencies()`, `getRecentEvents()`, `clearAll()` — installed from `main.tsx`. |
| **`ObservabilitySupportCard`** | Settings (desktop utility **Settings** tab, mobile **Settings**): copy diagnostics / clear local DB. |
| **`NavigationBreadcrumbTracker`** | React Router pathname logging inside `App.tsx`. |
| **`captureHandledError(err, extra)`** | Try/catch paths: same pipeline as global errors (`handled_error` category). |
| **Error boundaries** | `AIErrorBoundary`, `LazyPanelErrorBoundary`, `ErrorBoundary`, section boundaries, and global fallback record `render_error` with boundary metadata. |

**Triage workflow:** reproduce → Settings → **Copy diagnostics** (or console `await __RR_OBSERVABILITY__.exportReport()`) → search codebase using `message` / `stackPreview` / `fingerprint`. Set `VITE_TELEMETRY_INGEST_URL` to the deployed Supabase telemetry function so structured logger batches reach the approved central store.
