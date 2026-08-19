# Alert rules — client observability sink

**Status:** proposed, **not yet deployed**. Authored 2026-08-19 to close the
Phase 7 gap recorded in `docs/monitoring-assessment.md` ("production alert rules
remain deployment gates").

**Thresholds below are provisional starting values, not calibrated ones.** No
production baseline exists yet, so every number here is an engineering estimate
derived from the clinical hazard it guards, not from observed traffic. Run them
in a report-only mode for one full clinical week, record the observed
distribution, then have the owner sign off on the final values before they page
anyone. Shipping uncalibrated thresholds that fire constantly is worse than
shipping none, because responders learn to ignore them.

## Source

All rules query `public.client_observability_events`
(`supabase/migrations/20260813020000_create_client_observability_sink.sql`),
populated by the `telemetry` edge function. Metric names are constrained by the
allowlist in `supabase/functions/_shared/telemetry-schema.ts`; every metric
referenced below is in that allowlist. Emission sites are
`src/lib/observability/operationalMetrics.ts` and `src/lib/offline/syncEngine.ts`.

Rows carry no PHI by construction — the edge function projects a fixed schema.
Alert payloads must therefore never be enriched with patient context.

## Severity model

| Severity | Meaning | Response |
|---|---|---|
| **P1** | Clinical data at risk of loss, or blind to that risk | Page on-call immediately |
| **P2** | Degraded save path; loss not yet indicated | Notify on-call during hours |
| **P3** | Quality signal; review at next operational check | Dashboard only |

---

## P1 — unacknowledged write age (closest proxy for data loss)

The single most important signal. A write sitting in the offline queue is
clinical documentation that exists only on one device. `oldest_age_ms` crossing
a shift boundary means a handoff may occur against data the server has never seen.

```sql
-- P1: any client holding an un-drained write older than 30 minutes.
SELECT max(metric_value) / 60000.0 AS oldest_queue_age_minutes
FROM public.client_observability_events
WHERE environment = 'production'
  AND metric_name = 'offline.sync.oldest_age_ms'
  AND occurred_at > now() - interval '10 minutes';
-- Alert when oldest_queue_age_minutes > 30
```

Rationale for 30 minutes: comfortably longer than a transient network outage or
an elevator ride, comfortably shorter than a rounding block. Tighten only after
observing the real distribution — a noisy P1 is a disabled P1.

## P1 — telemetry silence (dead-man's switch)

Every other rule here fails open: if ingest stops, nothing fires and the system
looks healthy. This rule is what makes the rest trustworthy.

```sql
-- P1: no production events received recently at all.
SELECT count(*) AS events_last_15_min
FROM public.client_observability_events
WHERE environment = 'production'
  AND received_at > now() - interval '15 minutes';
-- Alert when events_last_15_min = 0
```

Calibrate the window against real off-hours traffic. Overnight ICU usage is
low but rarely zero; if it legitimately reaches zero, widen the window or gate
the rule by hour rather than deleting it.

## P2 — sustained sync failures

```sql
-- P2: failed sync attempts over the last 15 minutes.
SELECT coalesce(sum(metric_value), 0) AS failed_syncs
FROM public.client_observability_events
WHERE environment = 'production'
  AND metric_name = 'offline.sync.failed'
  AND occurred_at > now() - interval '15 minutes';
-- Alert when failed_syncs > 10
```

## P2 — conflict rate

Conflicts are expected occasionally (two clinicians, one patient) and are
handled by the revision guard. A sudden rise suggests the guard is misfiring or
a client is looping on a stale revision.

```sql
-- P2: conflicts over the last hour.
SELECT coalesce(sum(metric_value), 0) AS conflicts
FROM public.client_observability_events
WHERE environment = 'production'
  AND metric_name = 'offline.sync.conflicts'
  AND occurred_at > now() - interval '1 hour';
-- Alert when conflicts > 20
```

## P2 — patient write errors

```sql
-- P2: mutation errors as a share of all mutations, last 15 minutes.
SELECT
  count(*) FILTER (WHERE outcome IN ('error', 'unexpected_error')) AS errors,
  count(*)                                                        AS total,
  round(
    100.0 * count(*) FILTER (WHERE outcome IN ('error', 'unexpected_error'))
    / nullif(count(*), 0)
  , 1) AS error_pct
FROM public.client_observability_events
WHERE environment = 'production'
  AND metric_name = 'patients.mutation.total'
  AND occurred_at > now() - interval '15 minutes';
-- Alert when total >= 20 AND error_pct > 5
```

The `total >= 20` floor prevents a single failed write at 03:00 from paging
on-call at 100% error rate. Ratio alerts without a volume floor are a classic
false-positive source.

## P3 — queue depth

```sql
-- P3: deepest observed offline queue, last 15 minutes.
SELECT max(metric_value) AS deepest_queue
FROM public.client_observability_events
WHERE environment = 'production'
  AND metric_name = 'offline.sync.queue_length'
  AND occurred_at > now() - interval '15 minutes';
-- Alert when deepest_queue > 50
```

Depth matters less than age — a deep queue that drains is fine, a shallow queue
that never drains is not. Age is the P1; depth is context for it.

## P3 — auth failure rate, fetch fallback rate, web vitals

```sql
-- P3: cache fallbacks indicate the server read path is degrading.
SELECT coalesce(sum(metric_value), 0) AS cache_fallbacks
FROM public.client_observability_events
WHERE environment = 'production'
  AND metric_name = 'patients.fetch.cache_fallback'
  AND occurred_at > now() - interval '15 minutes';
-- Alert when cache_fallbacks > 25
```

`auth.sign_in.total` with `outcome = 'invalid_credentials'`, and the
`web.vital.*` metrics, are dashboard-only until a baseline exists.

---

## Deployment checklist (all open)

- [ ] Create the rules in the alerting backend (Supabase scheduled queries, or
      the Sentry/monitor path already wired in `.github/workflows/production-monitor.yml`).
- [ ] Run report-only for one full clinical week; capture observed distributions.
- [ ] Owner sign-off on final threshold values.
- [ ] Name the on-call rota and escalation path — currently unrecorded, and an
      alert with no named responder is not an alert.
- [ ] Link each rule to its runbook entry in `docs/operations/runbooks.md`.
- [ ] Verify alert payloads carry no PHI (they should not by construction —
      confirm empirically once).
- [ ] Backup/restore drill (separate Phase 7 gate).
