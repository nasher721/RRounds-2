# Operations Runbooks — Round Robin Notes

Created 2026-08-12 for the clinical production-readiness program (plan Phase 7).
Owner during the release window: _name required before go-live_ (see
`docs/release/2026-08-12-signoff-packet.md`).

Systems: Vercel (frontend, `remix-of-remix-of-round-robin-notes.vercel.app`),
Supabase project `zsavxqvnseqxusfwdovu` (RollingRounds; Postgres, Auth,
Edge Functions, Realtime), AI providers reached only through the
`parse-handoff` / AI Edge Functions.

---

## 1. Sync incidents (failed / queued / conflicting writes)

**Signals**

- Client: save-state badge stuck on `Saving`, `Offline queued`, or
  `Save failed`; Offline indicator shows pending/failed counts; toast
  `Save conflict` / `Save failed` / `Synced N changes`.
- Logs: structured events `patient.update.failed`,
  `patient.field_history.failed`; `[SyncEngine]` / `[IndexedDBQueue]`
  console lines; Sentry (when `VITE_SENTRY_DSN` is set).

**Diagnosis**

1. Ask for device, browser, approximate time, patient count, and whether
   the app showed offline banners.
2. In Supabase logs (Edge/Postgres), look for elevated 4xx/5xx or
   `consume_edge_rate_limit` rejections in the same window.
3. Check the `patients.revision` trail via `patient_field_history` for the
   affected patient to reconstruct what actually persisted.

**Remediation**

- Single user, queued writes: have them reconnect and keep the tab open;
  the sync engine drains automatically on `online`. If the badge shows
  `N pending`, clicking it forces a sync.
- Conflict: use the conflict dialog (Keep My Changes / Use Server Version).
  Never ask the user to "just retype" or discard the queue before downloading
  **Download recovery copy** from the Offline indicator. The recovery JSON
  contains PHI and is for authorized support/manual recovery; it is not an
  automatic import file (see the QA matrix, scenario 8).
- Queue growth across many users → treat as backend incident; go to
  Runbook 3 or 4.

**Known behaviors (as of 2026-08-12)**

- While offline, edits are queued durably (IndexedDB) and replay with a
  revision guard; server-newer data produces an explicit conflict, never a
  silent overwrite.
- Circuit breakers reset automatically on reconnect; a sync pass defers
  instead of consuming retries while a breaker is open.

---

## 2. Stale-client conflicts

**Signal:** user sees `Save conflict — this patient changed in another tab
or device`.

**Expected causes:** same account in two tabs/devices editing the same
patient; a tab asleep long enough to miss realtime refetches.

**Remediation**

1. Tell the user **not** to keep editing in the stale tab.
2. The app refetches the patient after a conflict; review the refreshed
   chart, then re-apply the intended change.
3. If conflicts repeat for one account with only one active device, suspect
   a wedged background tab (check for duplicate browser windows) or a
   realtime subscription loop — escalate to engineering with the
   `patient_field_history` timeline.

---

## 3. AI provider outage (parse-handoff / generation)

**Signals:** import parsing or AI actions hang or return provider errors;
edge logs show provider 429/5xx; client timeout (~180 s) messages.

**Remediation**

1. Check Edge logs for the failing provider's fixed-schema error metadata.
   Requests resolve Gemini-first and automatically fail over to other
   configured providers on 429/5xx, so a user-visible failure means every
   configured provider was exhausted.
2. Verify the provider credentials (`GEMINI_API_KEY`, `OPENAI_API_KEY`,
   `GROQ_API_KEY`) in Edge Function secrets and rotate keys as needed, then
   redeploy.
3. If the `CLINICAL_AI_DISABLED` kill switch is set, document/image parsing
   stays unavailable. The primary Import Patient List flow still supports
   client-side CSV upload, paste, mapping, and import without an AI provider.
4. During a multi-provider outage, use client-side CSV import or type notes
   manually and retry document/image parsing later. Announce through the
   support channel and log a clinical incident review if work is delayed past
   a rounding session.

---

## 4. Database migration failure

**Prevention:** migrations deploy only via the `Deploy Supabase` GitHub
workflow, which refuses to run when the repo SHA differs from the deployed
frontend SHA ordering rules, and `scripts/verify-supabase-migration-order.mjs`
runs in CI.

**If a migration fails mid-deploy**

1. Do **not** re-run blindly. Capture the failing migration filename and
   the exact error from the workflow logs.
2. Inspect `supabase_migrations.schema_migrations`: if the version row was
   recorded, the failure happened after the DDL committed — assess whether
   the DDL is idempotent before replaying.
3. If the row was not recorded, the transaction rolled back; fix the
   migration in a new file (never edit an applied migration) and redeploy.
4. If production is in a mixed state, pause the frontend deploy hook and
   follow the manual repair precedent:
   `supabase/manual/2026-08-11-migration-history-repair.sql` documents how
   history was reconciled in the 2026-08-11 incident.

---

## 5. Vercel/Supabase version mismatch

**Signal:** frontend build references columns/behavior the database does
not have (e.g. `revision`), or vice versa. The 2026-08-11 release hold was
exactly this (see `docs/release/2026-08-11-release-hold-phase0.md`).

**Rule:** frontend deploys only via the Vercel deploy hook
(`vercel.json` disables git-triggered deploys for `main`), and only after
the Supabase deploy workflow succeeds for the same SHA. The deploy job remains
red until the live page's `app-version` marker matches that SHA.

**If a mismatch reaches production anyway**

1. Immediately redeploy the last known-good frontend from the Vercel
   dashboard (instant rollback).
2. Verify the live page's `app-version` meta value matches the intended
   package version plus seven-character Git SHA. For schema-sensitive releases,
   also confirm the deployed bundle contains the matching feature markers.
3. Record the incident and re-run Phase 0 of the release checklist before
   the next attempt.

---

## 6. Support escalation, clinical incident review, breach response

- **Support path:** user reports → #support channel / on-call owner →
  engineering. Every data-integrity report gets a `patient_field_history`
  reconstruction before closing.
- **Clinical incident review:** any wrong-patient context, lost note, or
  misleading saved/completed state is logged as a clinical incident with
  timeline, affected patients (by internal id only), and corrective action.
- **Breach response:** on suspected PHI exposure (logs, telemetry,
  screenshots, wrong recipient): stop the source, revoke/rotate affected
  credentials (Supabase keys, provider keys), preserve evidence, notify the
  privacy officer, and follow the organization breach-notification policy.
- **User communication:** template — acknowledge, state scope honestly,
  state what persisted vs what must be re-entered, give the recovery-export
  path, follow up in writing.

---

## 7. Backup / restore (RPO / RTO)

- Supabase managed backups: daily logical backups (plan-dependent) plus
  point-in-time recovery if enabled on the project tier.
- **RPO target:** 24 h with daily backups; ≤ 5 min if PITR is enabled.
- **RTO target:** 4 h for full project restore; 1 h for single-table
  surgical restore from a SQL dump.
- **Drill (human task, schedule quarterly):** restore the latest backup
  into a throwaway Supabase project, verify `patients` row counts and one
  day's `patient_field_history`, document timings. Record drill evidence in
  this file's drill log below. _No restore drill has been performed yet —
  required before general availability._

Drill log: (date / operator / backup point / RTO measured / result)

---

## 8. Monitoring and alerting — current state and gaps

**In place today**

- Sentry browser SDK, lazily loaded, active when `VITE_SENTRY_DSN` is set;
  CSP allows only the approved Sentry ingest origin.
- Structured client logger (`src/lib/observability/logger.ts`) with stable
  event names (`patient.update.failed`, etc.).
- First-party Supabase telemetry ingest with distributed rate limiting,
  fixed-vocabulary validation, service-role-only storage, no raw context or
  session identifiers, and enforced 30-day retention.
- Fixed PHI-safe operational metrics for patient-write outcome/latency and
  offline queue length/age/replay results. Saved/queued per-input writes and
  rapid enqueue pressure aggregate over five seconds; conflicts and hard errors
  emit immediately. Collector delivery is
  serialized, bounded, and requeues network/non-2xx failures.
- Supabase logs for Postgres, Auth, and Edge Functions; edge rate-limit
  table `edge_rate_limits` / `consume_edge_rate_limit`.
- CI bundle assertions: `scripts/check-bundle-size.mjs`,
  `scripts/assert-no-optional-native-in-bundle.mjs`.
- Hourly production monitor (`.github/workflows/production-monitor.yml`):
  calls the least-privileged Edge/database healthcheck, verifies the configured
  first-party telemetry ingest, signs in with the
  dedicated non-PHI account, writes a unique marker to `E2E Alpha`, proves the
  marker from a cold reload, and restores the exact original summary. Failures
  create or update one deduplicated GitHub issue; the next successful run
  records recovery and closes it.

**Open gaps (must close or formally accept before GA)**

- Production builds and the hourly monitor fail closed unless hosted Sentry or
  the bundled Supabase collector is configured. Deployment and monitoring now
  verify first-party ingest receipt; the operator must still approve the sink
  and configure an alert destination. Alert on
  degraded `auth.sign_in.total` outcomes and auth latency,
  `patient.update.failed` volume, `patients.mutation.total` degraded outcomes,
  `offline.sync.oldest_age_ms`, and sustained `offline.sync.queue_length`.
- The repository now contains an hourly uptime/save synthetic with GitHub-issue
  alerting. It becomes an operating control only after `PRODUCTION_APP_URL`
  and the required E2E/Supabase secrets are configured and a scheduled run is
  observed. GitHub Actions is not an independent third-party uptime service;
  operations may still add an external pinger for provider-level redundancy.

---

## 9. Staged rollout plan

| Stage | Audience | Entry criteria | Stop conditions | Decision-maker |
| --- | --- | --- | --- | --- |
| 0. Internal | Developers + E2E account | CI green at release SHA; Phase 2 backend verified | Any P0 defect | Engineering lead |
| 1. Limited pilot | 1 team, ≤ 5 clinicians, non-critical census | Stages 0 pass; monitoring gaps accepted in writing | Any lost/overwritten note; any wrong-patient event; sustained save failures > 30 min | Clinical safety owner |
| 2. Monitored expansion | One full ICU team | 2 pilot weeks with zero open P0/P1 | Same as pilot + unresolved a11y serious findings | Clinical safety owner + ops |
| 3. General availability | All intended units | Stage 2 exit + restore drill complete + sign-off packet complete | — | Go/no-go board |

**Rollback criteria (any stage):** silent data loss, wrong-patient data
exposure, RLS bypass, or sustained write failure → immediate frontend
rollback (Vercel instant rollback) + freeze deploy hook + incident review.

**On-call for release window:** _name + contact required before go-live._
