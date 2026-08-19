# Rolling Rounds — Cursor Takeover & Completion Plan

Handoff plan for continuing this project to production. Read this first, then the
docs it references. **The release is currently on HOLD** — clinical production use
is not yet approved.

> ### ⚠️ Staleness notice (added 2026-08-19)
>
> Parts of this plan are **out of date**. It was written against
> `docs/release/2026-08-11-release-hold-phase0.md`, which had not been updated
> since 2026-08-11, and so inherited a stale picture.
>
> **Read `docs/release/2026-08-11-release-hold-phase0.md` § "Update 2026-08-19"
> first.** Known-stale items in this document:
>
> - **§3.1 (secrets).** `docs/release/2026-08-12-signoff-packet.md` (updated
>   2026-08-13) states these secrets are already present. That was *not*
>   independently verified — check repo secrets directly rather than trusting
>   either document.
> - **§3.2 (lockfile).** Understated. `npm ci` did not merely churn, it **failed
>   outright**; root-caused and contained on 2026-08-19. See the update section.
> - **§7 Phase 4.** "`MobilePatientDetail` missing-hook-dep" and "44 Fast Refresh
>   warnings" are resolved — lint reports **0 errors, 0 warnings**.
> - **§7 Phase 6.** Per-chunk budgets already exist (14 of them) and all pass;
>   initial JS is **618,671 / 750,000 bytes**.
> - **§9 actions 4, 6, 7.** Already complete; no work required.

---

## 1. What this is

- **App:** "Rolling Rounds" — an ICU rounding / clinical documentation workspace.
  React 18 + TypeScript 5.8 + Vite 8 + Tailwind/shadcn/ui + Supabase (Postgres,
  Auth, Edge Functions). Design system = "Ledgerix" (see `design-system/ledgerix/`).
- **This directory (`app/`)** is the codebase. The HTML mockup one level up
  (`index.html`, `workspace.html`, …) is the design reference only — not shipped code.
- **Desktop:** an Electron shell was added. `electron/main.cjs` (dev → Vite :8080;
  packaged → serves `dist/` over a loopback origin), `electron/preload.cjs`
  (`window.desktop` bridge). See `DESKTOP.md` and `package.json` `desktop:*` scripts.

## 2. Current status (verified, all green)

`npm run verify:local` passes end-to-end: lint, typecheck, **730/730** unit tests,
auth-security config, edge JWT config, **55** migration-order checks, `npm audit`
**0 vulnerabilities**, Deno edge functions **36/36** tests, clinical-mcp-server
**12/12** tests + build. Production `npm run build` succeeds with all bundle-size
budgets under limit (initial JS ≈ 623 KB / 750 KB).

Backend is already deployed to Supabase project `zsavxqvnseqxusfwdovu` ("RollingRounds");
`patients.revision` + `bump_patient_revision` trigger are live. The **frontend has
not yet shipped** the matching release (see §3.2 and the release-hold doc).

## 3. Blockers before anything ships

### 3.1 Credentials / secrets (need the owner — cannot be fixed in code)

From `docs/release/2026-08-11-release-hold-phase0.md` ("Known gap" + "Remaining"):

- [ ] Add GitHub secret **`SUPABASE_ACCESS_TOKEN`** (currently empty → `Deploy Supabase` workflow fails).
- [ ] Add GitHub secret **`VERCEL_DEPLOY_HOOK_URL`** (frontend ships only via hook; Git auto-deploy is disabled in `vercel.json`).
- [ ] Add **`E2E_TEST_EMAIL`** / **`E2E_TEST_PASSWORD`** so credential-gated Playwright specs stop skipping (see `e2e/README.md`).
- [ ] Post-deploy authenticated smoke test, record frontend + DB + edge versions.
- [ ] Rollback drill (rollback = revert frontend; DB migration is additive-only).

### 3.2 ✅ Lockfile reproducibility (P0 — RESOLVED 2026-08-19)

> **Resolved.** `npm ci` was failing outright (not merely churning) under the
> pinned toolchain, root-caused to the `fhirclient` → `isomorphic-webcrypto`
> floating-`*` optional dependency chain pulling the Expo SDK 57 tree. Contained
> via a 7-entry `overrides` block; lock went 1457 → 1083 entries and `npm ci` is
> now reproducible (verified 3× stable lock hash, 2× byte-identical installs).
> A durable fix still needs an owner decision — see the release-hold update.
> The original text is kept below for context.

#### Original text

`package-lock.json` was regenerated locally under **Node 24 / npm 11** to add the
Electron dependencies. CI pins **Node 22 / npm 10.9.8** (`.nvmrc`, `engines`,
`packageManager`). Phase 1.1 of `docs/plans/2026-08-11-clinical-production-readiness-plan.md`
requires the lockfile to reproduce under the pinned toolchain on a clean Linux install.

- [ ] `nvm use` (Node 22) then `npm ci` twice from an empty dir; confirm the lockfile is stable.
- [ ] If `npm ci` fails or churns, regenerate `package-lock.json` under Node 22/npm 10.9.8 (including optional deps), keeping the new Electron deps.
- [ ] Re-run `verify:local` from that clean install.

## 4. Environment

- **Node 22**, **npm 10.9.8** (pinned). `deno` (edge functions), `bun` (optional), Playwright (E2E).
- Gotcha: if `NODE_ENV=production` is exported in your shell, `npm install` skips
  `devDependencies` (vite/electron/tsc go missing). `unset NODE_ENV` before installing.

```sh
npm install            # unset NODE_ENV first
npm run dev            # Vite on http://localhost:8080
npm run build:dev      # build w/o production env validation
npm run build          # production build (fails closed w/o env; see .env.example)
npm run verify:local   # full local gate
npm run edge:verify    # deno fmt/lint/check/test
npm test               # 730 unit tests
npm run test:e2e       # Playwright (needs real Supabase + E2E creds)
npm run desktop:dev    # Electron dev
```

## 5. Codebase map (start here)

- `src/App.tsx` — routing shell. Static imports for `Auth`/`FHIRCallback`/`PrintExportTest` are intentional (lazy chunks can strand Suspense behind stale SW caches).
- `src/pages/` — `Landing`, `Auth`, `Index`, `Privacy`, `Security`, `FHIRCallback`, `NotFound`.
- `src/components/dashboard/` — `DesktopDashboard`, `MobileDashboard`, `PatientWorkspace`, `PatientRosterRail`.
- `src/components/round/` — the "Today's Round" focus-first runner (`DesktopRoundShell`, `RoundHome`, `PatientFocus`).
- `src/hooks/patients/` + `src/services/` + `src/lib/mappers/` — data layer (see `ARCHITECTURE.md` for the 5-layer model).
- `src/lib/offline/` — sync engine, IndexedDB queue, conflict rules.
- `src/lib/print/` + `src/components/print/` — PDF/Excel/HTML export (interaction-lazy).
- `supabase/migrations/` + `supabase/functions/` — schema + Edge Functions (Deno).
- `scripts/` — verification/security/bundle-budget helpers. `check-bundle-size.mjs` holds the bundle budgets.
- `clinical-mcp-server/` — separate stdio MCP server (calculations/content/interactions).

## 6. Conventions & gotchas (from `AGENTS.md` + `ARCHITECTURE.md`)

- UI goal: simple, clean, low note-burden for ICU attendings/residents/fellows.
- Radix `SelectItem` must not use `value=""` (empty string = clear); use a sentinel.
- Never prefix a provider credential with `VITE_*` (browser-public). Keys live in Supabase Edge secrets only.
- Import flow = extract → parse → organize in `src/lib/import/`; entry labeled "Import Patient List". PDF client-side import stays blocked.
- LLM import parsing runs through the `parse-handoff` edge function, Gemini-first failover, ~180s client timeout.
- Rate limiting uses `edge_rate_limits` / `consume_edge_rate_limit`.
- Mobile: scroll-reset on open, mount only active section, ≥44px targets, strong dark-theme contrast.
- Don't reintroduce `scrollIntoView` smooth-scroll into the embedded preview paths (see the design prototype notes) — the React app may still use it internally; verify against the app's own motion policy.

## 7. Remaining work (ordered)

### A. Ship the held release (P0 — mostly §3 items)

Complete §3.1 (secrets) + §3.2 (lockfile), then frontend deploy via hook, post-deploy
smoke, rollback drill. Track in `docs/release/2026-08-11-release-hold-phase0.md`.

### B. Complete the readiness plan (P0/P1)

The authoritative checklist is `docs/plans/2026-08-11-clinical-production-readiness-plan.md`
(Phases 3–8). Status as of handoff: Phases 0–2 essentially complete; 3–8 open.

- **Phase 3 — data integrity & recovery.** Matrix in `docs/qa/2026-08-12-data-integrity-matrix.md`.
  Todo isolation, multi-tab/cross-device conflicts, offline queue recovery, failure
  injection, completion guard, recovery export. Needs a staged Supabase + Playwright.
- **Phase 4 — accessibility/responsive.** Fix `MobilePatientDetail` missing-hook-dep;
  move non-component exports out of component modules (44 Fast Refresh warnings);
  keyboard-only pass; VoiceOver; 44×44 touch targets at 320–900px; 200% zoom; high-contrast + dark.
- **Phase 5 — privacy/security.** Complete every evidence item in `docs/clinical-data-flow.md`;
  two-user RLS isolation; edge auth/CORS/rate-limit testing; CSP vs unapproved AI origins;
  resolve or time-bound the `fhirclient`/`isomorphic-webcrypto` optional-dependency advisories
  (bundle-reachability check already asserts they don't ship).
- **Phase 6 — bundle/perf.** Entry is already ≈623 KB / 750 KB (the plan's "2.28 MB" note is stale).
  Confirm and add per-chunk budgets for AI/export vendors; measure cold-load/patient-switch/offline on a real device.
- **Phase 7 — operations.** Monitoring + alerts for queued/failed/conflicting writes and queue age;
  runbooks (`docs/operations/runbooks.md`); backup/restore drill; staged rollout.
- **Phase 8 — clinical UAT.** Scenario-based UAT (import → identify → review → edit → complete → export),
  hazard review, written sign-off. Packet template: `docs/release/2026-08-12-signoff-packet.md`.

### C. Feature backlog (P2 — do NOT block release)

`FEATURE_SUGGESTIONS.md` + `IMPLEMENTATION_SUMMARY.md` list ~14 remaining features
(AI differential builder, "similar patients", note-quality score, handoff assistant,
voice actions, doc-time tracker, protocol heatmap, patient-flow timeline, session
audit trail, export anonymization, smart todo delegation, card-layout customization).
Several already have stubs in `src/components/` (e.g. `ShiftHandoff`, `MultiPatientComparison`,
`ContextAwareHelp`) — verify what's wired vs. dead before building.

## 8. Definition of done (release gate)

From the readiness plan's "Final release gate" — GO only when **all** hold:

- CI + deploy green at the exact production SHA; backend migration + revision/RLS proven.
- Multi-tab / cross-device / offline / failure / recovery scenarios pass.
- Accessibility + responsive validation pass; Clinical MCP + runtime audits clean.
- PHI/provider + telemetry + access-control + legal evidence approved.
- Monitoring / backup-restore / rollback / runbooks tested.
- Clinical UAT + hazard review signed off. Any failed item = NO-GO.

## 9. Suggested first 10 actions (credential-free, in order)

1. Read `docs/plans/2026-08-11-clinical-production-readiness-plan.md` and the release-hold doc.
2. `nvm use` (Node 22); `unset NODE_ENV; npm ci` → confirm lockfile reproducibility (§3.2); fix if not.
3. `npm run verify:local` on the clean install; fix any drift.
4. Phase 4: fix `MobilePatientDetail` hook dep + Fast Refresh export warnings; run `npm run lint`.
5. Phase 4: keyboard-only + touch-target (≥44px) sweep on `PatientWorkspace`, `PatientRosterRail`, `RoundHome`.
6. Phase 6: confirm entry-bundle budget; add per-chunk budgets to `scripts/check-bundle-size.mjs` if missing.
7. Phase 5.3: trace `fhirclient`/`isomorphic-webcrypto` browser use; write the time-bounded risk acceptance (`docs/security/`).
8. Phase 7: implement queued/failed/conflicting-write monitoring signal + alert wiring (telemetry edge fn).
9. Phase 3: extend Playwright specs for the data-integrity matrix (todo isolation, offline recovery).
10. Update `docs/release/2026-08-11-release-hold-phase0.md` with current state after each completed item.

**Blocked-on-owner actions** (queue for when secrets exist): §3.1 — SUPABASE_ACCESS_TOKEN,
VERCEL_DEPLOY_HOOK_URL, E2E_TEST_EMAIL/PASSWORD, post-deploy smoke, rollback drill.
