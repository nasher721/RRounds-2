# 2026-08-11 — Release hold: Phase 0 deployment-risk assessment

**Status:** HOLD remains in effect. Clinical production use is NOT approved.
**Incident/release owner:** Nash (web engineering). Pilot users must not be told
this build is clinically production-ready.

## Findings (verified 2026-08-11, ~21:10 local)

### Frontend (Vercel production)

- Production URL: `https://remix-of-remix-of-round-robin-notes.vercel.app/`
- Served entry bundle: `/assets/index-Bi_xN442.js` (~2.47 MB)
- Bundle contains **zero** occurrences of `revision`. Source at `434200a`
  references the optimistic-concurrency `revision` field in 11+ client modules,
  so production is serving a **pre-`434200a` build** (Vercel's `npm ci` install
  fails on the same lockfile defect that broke CI, so Git auto-deploy never
  shipped the release commit).

### Database (Supabase project `zsavxqvnseqxusfwdovu`, "RollingRounds")

- `public.patients.revision` column: **absent**
- `bump_patient_revision` trigger: **absent**
- `public.round_state` table: present
- Remote migration history does **not** contain
  `20260811000000_add_patient_optimistic_revision`.
- Remote history also shows version drift vs. local filenames:
  `add_distributed_edge_rate_limits` recorded as `20260811014046` (local file
  `20260711230000_...`) and `create_round_state` as `20260811133644` (local file
  `20260811000000_...`). Local repo additionally has two files sharing the
  `20260811000000` version prefix, which `supabase db push` cannot apply
  cleanly. This must be repaired as part of Phase 2.

## Risk verdict

The dangerous split-brain scenario (revision-aware frontend against a
revision-less schema) is **NOT live**: frontend and database are both
pre-release and mutually consistent. No production rollback of Vercel is
required tonight. The release stays held until Phases 1–2 complete and the
backend deploys ahead of the frontend.

## Acceptance tracking

- [x] Frontend and database schema versions explicitly recorded (above).
- [x] No production client performs revision-aware writes against a
      revision-less schema (verified: live bundle has no revision code path).
- [x] Release hold documented here; owner: Nash.

---

## Phase 1–2 update (2026-08-12, ~01:45 UTC)

### CI repair — commit `4761978`, CI run `31553909471` GREEN

- `package-lock.json` regenerated under Node 22.23.2 / npm 10.9.8 (Linux
  container); `npm ci` verified twice from empty dirs; lockfile stable.
  Toolchain pinned via `packageManager`, `.nvmrc`, `engines`, CI assertion.
- `edge:verify` green (deno fmt applied to `parse-handoff`).
- clinical-mcp-server audit: **0 vulnerabilities** (sdk 1.30.0, hono 4.13.1,
  fast-uri 3.1.5, ip-address 10.5.0, body-parser 2.3.0). Server is stdio-only;
  SSRF/DoS advisories were in unused HTTP transport code paths.
- Web gates from clean Linux install: lint 0 errors, typecheck OK, 440/440
  unit tests, migration order OK, prod audit 0, build + bundle budgets OK,
  secret canaries OK.
- **Documented exception (plan 1.4):** credential-gated Playwright specs skip
  in CI until `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` secrets are added; the
  auth-page smoke spec always runs.
- `vercel.json` now disables Git auto-deploy on `main`; production frontend
  ships only via `VERCEL_DEPLOY_HOOK_URL` after backend verification.

### Backend deployed to production (RollingRounds `zsavxqvnseqxusfwdovu`)

Migration history was reconciled first (20 versions already reflected in the
schema were recorded via `supabase/manual/2026-08-11-migration-history-repair.sql`;
two filenames renamed to match remotely recorded versions). Then all 10 pending
migrations were applied and recorded under their repo versions:
`20260327000000` extend_patient_schema, `20260328000000` create_patient_activity,
`20260711000000` replay_deferred_schema_hardening, `20260711180000`
harden_phrase_team_access, `20260711190000` harden_patient_image_storage,
`20260711200000` harden_child_record_ownership, `20260711210000`
add_atomic_patient_json_patch, `20260711220000` purge_legacy_ai_credentials,
`20260711240000` add_atomic_phrase_usage, `20260811000000`
add_patient_optimistic_revision.

Production verification (all evidence gathered 2026-08-12 01:40–01:46 UTC):

- `public.patients.revision bigint NOT NULL DEFAULT 0` — **present** ✓
- `bump_patient_revision` — attached as `BEFORE UPDATE` trigger ✓
- Behavioral test (rolled back, zero data footprint): stale revision predicate
  updated **0 rows**; matching revision updated 1 row and bumped revision
  **exactly once** (0→1) ✓
- RLS enabled on all 17 clinical tables; patients has 4 owner-scoped policies ✓
- Healthcheck: HTTP 200 `{"status":"healthy","database":"connected"}` ✓
- All 12 edge functions ACTIVE in production.

### Known gap: deploy workflow secret

`Deploy Supabase` run `31554068909` failed because GitHub secret
`SUPABASE_ACCESS_TOKEN` is **empty**. Backend was therefore deployed via the
authenticated Supabase management API instead. To restore the automated path:
add `SUPABASE_ACCESS_TOKEN` (and `VERCEL_DEPLOY_HOOK_URL` for the frontend) in
repo secrets, then re-run the failed workflow — its SHA check passes because
`4761978` is live `main`.

### Remaining before frontend ships

- [ ] Frontend deploy via hook after `VERCEL_DEPLOY_HOOK_URL` is set.
- [ ] Post-deploy authenticated smoke test with recorded versions.
- [ ] Rollback drill (Vercel previous deployment + migration is additive-only,
      so rollback = revert frontend; trigger/column are backward compatible).

---

## Update 2026-08-19 — toolchain/install P0 found and contained

> **Why this section exists.** This document had not been updated since
> 2026-08-11. `COMPLETION_PLAN.md` was written against it and therefore
> inherited a stale picture (its §3.1 blocker list in particular). Anyone
> reading the plan should read this section first.

### Status of the "Remaining before frontend ships" list above

**Not verified in this pass.** `docs/release/2026-08-12-signoff-packet.md`
(last engineering update 2026-08-13) states that `SUPABASE_ACCESS_TOKEN`,
the Vercel deploy hook, and full-suite E2E credentials are present. That
claim was **not** independently confirmed here — GitHub/Vercel secrets are
not inspectable from a local checkout. The checkboxes above are therefore
left unticked deliberately. Confirm against the repo secrets before relying
on either document.

### P0 — `npm ci` was broken on the committed lockfile (FIXED)

`npm ci` failed outright under the pinned toolchain (Node 22.23.2 /
npm 10.9.8) — EUSAGE, 26 out-of-sync entries, no install possible. This is
more severe than the "lockfile churn" risk described in `COMPLETION_PLAN.md`
§3.2: CI could not install at all.

**Root cause.** `fhirclient@^2.6.3` → `isomorphic-webcrypto@2.3.8` declares
`optionalDependencies` with floating `*` ranges (`expo-random`,
`@unimodules/*`). `expo-random` peer-depends on `expo: *`, which dragged in
the Expo SDK 57 tree — 484 of 1457 lock entries (33%), ~240 MB — none of it
reachable from a browser/Electron build. The tree broke on **2026-08-17**,
when Expo published the SDK 57.0.8 batch.

**Release-gate consequence.** 2026-08-17 is *after* the 2026-08-13 sign-off
packet. The packet's install-dependent evidence (unit tests, build, audit)
was therefore not reproducible at the time this was found. It has now been
re-established — see the verification table below — but any future sign-off
should treat "`npm ci` reproduces" as an explicit, dated gate item rather
than an assumption.

**Containment applied.** A 7-entry `overrides` block in `package.json`
pinning `expo-random` to `11.0.0` (the last release without an `expo: *`
peer) and its siblings, plus a re-resolved lockfile.

| Metric | Before | After |
|---|---|---|
| Lock entries | 1457 | 1083 |
| Optional entries | 484 | 110 |
| Expo/RN/metro/hermes entries | 125 | 0 |
| Installed packages | 1411 | 1023 |
| `node_modules` | 1.4 GB | 1.1 GB |
| `isomorphic-webcrypto` on disk | 114 MB | 448 KB |

Non-optional dependency tree provably unchanged: 0 versions changed, 0 added,
0 removed; root `dependencies`/`devDependencies` byte-identical. Electron 33.4.11
and electron-builder 25.1.8 intact. `fhirclient`, `isomorphic-webcrypto`, and the
`xlsx` remote-tarball pin untouched.

Backups for revert: `package-lock.json.prebreak-backup`,
`package.json.prebreak-backup` (repo root).

**Honest caveat.** In the resulting state the `overrides` are *inert* — a
control run with them removed produces the identical 1083-entry lock, because
the original failure was a stale partial Expo tree rather than a live
resolution conflict. They are retained because they cap a from-scratch resolve
at 1274 entries with no `expo`, instead of 1471+ and a fresh break on Expo's
next publish.

**This is containment, not a cure — owner decision required.** The durable fix
is eliminating the `fhirclient` → `isomorphic-webcrypto` path (upgrade, patch,
or replace `fhirclient`). That touches a production FHIR surface and would
require re-collecting the credentialed sign-off evidence, so it is not taken
unilaterally. It should be scheduled before the optional-dependency risk
acceptance expires **2026-11-12**. Recommend also adding a CI check that fails
when `npm ci` stops being reproducible, since that is the failure mode that
silently invalidated the sign-off evidence here.

### Portability bug in build scripts (FIXED)

`scripts/assert-no-optional-native-in-bundle.mjs` and
`scripts/check-bundle-size.mjs` resolved paths via `new URL(...).pathname`,
which percent-encodes. Any checkout path containing a space resolved to
`.../RR%20clone/...` and threw `ENOENT`. Because `check-bundle-size.mjs` runs
inside `npm run build`, the production build failed for this reason alone.
Both now use `fileURLToPath()` from `node:url`.

`electron/main.cjs:39` also uses `.pathname`, but correctly — it parses a
request URL and applies `decodeURIComponent`. Left unchanged. `scripts/ts-loader.mjs`
uses `.pathname` for extension matching and for an esbuild sourcemap label only;
the actual file read passes a `URL` object, which is correct. Left unchanged.

### Verification performed 2026-08-19 (Node 22.23.2 / npm 10.9.8)

| Check | Result |
|---|---|
| `npm ci` reproducibility | PASS — 3× stable lock sha, 2× clean install, byte-identical trees |
| `npm run lint` | PASS — 0 errors, **0 warnings** |
| `npm run typecheck` | PASS |
| `npm test` | PASS — **730/730**, 68 suites, 0 failed |
| `security:check-auth-config` | PASS |
| `edge:check-jwt-config` | PASS |
| `verify:migrations` | PASS |
| `audit:prod` | PASS — 0 vulnerabilities |
| `edge:verify` (Deno) | PASS |
| `clinical:typecheck` / `test` / `build` | PASS — 12/12 |
| `npm run build` (production) | PASS |
| Bundle budgets | PASS — 14/14 under limit; initial JS **618,671 / 750,000** |
| Bundle-reachability guard | PASS — no Expo/RN/isomorphic-webcrypto markers in `dist/` |

Two corrections to `COMPLETION_PLAN.md` arising from this:

- The plan's Phase 4 item "fix `MobilePatientDetail` missing-hook-dep; 44 Fast
  Refresh warnings" is **stale**. Lint reports 0 errors and 0 warnings; the hook
  dependency is already present.
- The plan's Phase 6 note that per-chunk budgets may be missing is **stale**.
  14 per-chunk budgets exist in `scripts/check-bundle-size.mjs` and all pass.

The production build required `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_PUBLIC_APP_URL`,
`VITE_SESSION_IDLE_TIMEOUT_SECONDS`, and one of
`VITE_SENTRY_DSN`/`VITE_TELEMETRY_INGEST_URL`. It fails closed on each in turn —
good gate behaviour. The build measured above used **throwaway placeholder
values for measurement only**; that `dist/` was deleted immediately and must
never be deployed. Bundle figures are unaffected by the placeholder values.

### E2E coverage added (authored, NOT executed)

Data-integrity matrix rows 1, 2, 4, 6, 8, 10 now have Playwright automation in
`e2e/data-integrity.e2e.spec.ts` and `e2e/round-lifecycle.e2e.spec.ts`. These
specs have **never been run** — they are credential-gated and no run has been
performed. They are recorded in the matrix as `AUTO (unverified)` and no row is
marked PASS. Executing them against a staged Supabase remains open Phase 3 work.

### Follow-up work, same day (2026-08-19)

**`e2e/` was in no tsconfig — Playwright specs were never typechecked.**
Added `tsconfig.e2e.json` and chained it into `npm run typecheck` (and into
`tsconfig.json` references for editors). Enabling it immediately surfaced 5 real
strict-mode errors that had been invisible:

- 3× `page.keyboard.insertText(originalText)` where the existing
  `originalText !== undefined` guard did not narrow, because `originalText` is a
  `let` captured by a closure. Fixed by hoisting to a `const` inside the guarded
  block — no behaviour change.
- 1× `JSON.stringify(mutation.payload).includes(offlineStamp)` with
  `offlineStamp: string | undefined`. Fixed by hoisting to a `const` plus an
  explicit throw. Deliberately **not** defaulted to `""` — `includes("")` is
  always true, which would have made the surrounding
  `expect(exportedMutation?.id).toBeTruthy()` pass vacuously.
- 1× pre-existing `NoSkippedReporter.onEnd` returning its result synchronously;
  Playwright's `Reporter` interface only permits the object via a Promise. Made `async`.

**`npm ci` reproducibility is now guarded in CI.** New
`scripts/check-lockfile-reproducible.mjs` (`npm run verify:lockfile`), wired into
`.github/workflows/toolchain-health.yml`. Two assertions: `npm ci --dry-run`
resolves against the committed lockfile, and no Expo/React-Native package has
crept back in. **Negative-tested** — against the pre-fix lockfile it fails with
the original `EUSAGE` error and the Expo 57.0.7→57.0.8 drift, so it is not a
vacuous check. This closes the gap that let an upstream publish silently
invalidate the sign-off evidence.

**Phase 7 alert rules authored** — `docs/operations/alert-rules.md`, with
executable SQL against `public.client_observability_events` using only
allowlisted metric names. Covers queue age (P1), telemetry silence as a
dead-man's switch (P1), sync failures, conflicts, write errors, queue depth.
Thresholds are **provisional and uncalibrated**; deploy report-only for one
clinical week and get owner sign-off before they page anyone. The on-call rota
is still unnamed and remains a blocking Phase 7 gate.

**Static review of the new E2E specs** (the two judge agents assigned to this
died on an API spend limit before scoring, so this is a reduced substitute, not
the intended panel review). Verified: every selector resolves to real source;
credential gating matches the established `test.skip(!hasCredentials, …)` idiom;
`round-lifecycle` uses serial mode for the shared account; no arbitrary
`waitForTimeout` sleeps; all specs typecheck under `strict`. **Not verified:**
whether each test genuinely exercises its matrix invariant. That requires
execution against a staged Supabase and remains open.

Verification after all of the above: `npm run verify:local` exit 0
(730/730 + 12/12, 0 vulnerabilities), production build exit 0 with 14/14 bundle
budgets (initial JS 618,641 / 750,000), bundle-reachability guard clean, and
`src/`, `supabase/`, `electron/` byte-identical to an untouched control copy.
