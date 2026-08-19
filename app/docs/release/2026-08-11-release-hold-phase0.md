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
