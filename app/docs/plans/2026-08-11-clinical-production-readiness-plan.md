# Clinical production readiness plan

**Scope:** Remaining work after commit `434200a` (`prevent silent clinical data loss`)

**Release rule:** Do not use this release for clinical production until every P0 and P1 gate below is complete and the named clinical, privacy, security, and operational owners have signed off.

## Current state

- Local implementation verification passed: 440 unit tests, TypeScript, production build and bundle budgets, migration-order checks, client-secret canaries, and production audit.
- GitHub CI run `31552100541` failed on the exact release commit.
- The Supabase deployment was skipped because CI failed, so migration `20260811000000_add_patient_optimistic_revision.sql` is not proven deployed.
- Vercel Git integration may have deployed the frontend independently of the skipped backend workflow. This creates a possible frontend/database version mismatch and must be checked first.
- The broad root audit still reports 16 advisories in optional Expo/React-Native packages inherited through `fhirclient`/`isomorphic-webcrypto`.
- Formal PHI data-flow approval, live multi-tab/backend validation, clinical validation, and operational readiness are not complete.

## Workstream and ownership map

| Workstream | Accountable owner | Supporting roles |
| --- | --- | --- |
| CI and dependency repair | Web engineering | Clinical MCP owner, security |
| Supabase migration and deployment | Platform/database | Web engineering, QA |
| Data-integrity and recovery validation | QA lead | Web engineering, clinical safety |
| Accessibility and responsive validation | Accessibility/UX | QA, clinical users |
| Privacy, security, and AI provider approval | Privacy/security | Legal/compliance, platform |
| Clinical validation | Clinical safety officer | ICU attendings, residents, fellows |
| Monitoring, rollback, and support | Operations/SRE | Platform, support |

## Phase 0 — Contain the current deployment risk (P0, immediate)

1. Determine whether Vercel production is serving commit `434200a`.
2. Determine whether the production database has the `patients.revision` column and `bump_patient_revision` trigger.
3. If the new frontend is live without the migration, immediately roll Vercel back to `8d63687` or block clinical writes until the backend is deployed and verified.
4. Notify pilot users that the release is held; do not represent the current deployment as clinically production-ready.

**Acceptance criteria**

- Frontend and database schema versions are explicitly recorded.
- No production client performs revision-aware writes against a schema that lacks the revision column and trigger.
- Release hold and responsible incident owner are documented.

## Phase 1 — Repair the release pipeline (P0)

### 1.1 Make root installs reproducible on CI

The GitHub runner rejected `package-lock.json` because it is incomplete for a clean Linux/Node 22 install. The lock was generated locally with Node 24/npm 11, while CI uses Node 22 and its bundled npm.

1. Pin one Node/npm toolchain for local development and CI (`packageManager` plus an explicit npm version in Actions, or an equivalent version file).
2. Regenerate `package-lock.json` from an empty Linux-compatible install with optional dependencies included.
3. Prove `npm ci` succeeds in a clean directory/container with the same Node/npm versions as CI.
4. Run lint, typecheck, unit tests, migration checks, production audit, build, bundle budgets, and secret-canary checks from that clean install.

**Acceptance criteria**

- `npm ci` succeeds twice from an empty workspace on Linux.
- `package.json` and `package-lock.json` remain unchanged after the second install.
- Web quality gates pass on GitHub Actions.

### 1.2 Restore Edge Function verification

1. Run Deno formatting on `supabase/functions/parse-handoff/index.ts`.
2. Run the full `npm run edge:verify` sequence: format check, lint, frozen-lock typecheck, and tests.
3. Add formatting to the normal pre-commit/release checklist so local verification matches CI.

**Acceptance criteria**

- `npm run edge:verify` passes locally and in GitHub Actions.
- No uncommitted formatter output remains.

### 1.3 Clear Clinical MCP production advisories

The Clinical MCP audit currently reports six vulnerabilities, including high-severity `fast-uri` and `ip-address` findings.

1. Update `@modelcontextprotocol/sdk` and its transitive dependencies to patched versions.
2. Regenerate `clinical-mcp-server/package-lock.json` without weakening the audit gate.
3. Review URL/host validation and request-size limits because the advisories touch SSRF boundaries and denial-of-service controls.
4. Run Clinical MCP typecheck, tests, build, and production audit.

**Acceptance criteria**

- `npm audit --prefix clinical-mcp-server --omit=dev` reports zero known vulnerabilities.
- Clinical MCP typecheck, tests, and build pass.
- Any dependency API changes have targeted regression tests.

### 1.4 Re-run the complete CI graph

1. Push the CI repair commit.
2. Require green results for Web quality gates, Edge function checks, Clinical MCP checks, and Browser smoke test.
3. Confirm the exact green SHA still equals live `main` before any production mutation.

**Acceptance criteria**

- The full CI workflow is green at one exact SHA.
- No credential-gated browser test is silently skipped without an explicit documented exception.

## Phase 2 — Deploy backend first, then frontend (P0)

1. Prevent Vercel from racing ahead of the backend deployment. Configure `VERCEL_DEPLOY_HOOK_URL` and/or temporarily disable automatic production Git deploys for coupled schema releases.
2. Let the green-SHA Supabase workflow deploy migrations and Edge Functions.
3. Verify in production:
   - `public.patients.revision bigint NOT NULL DEFAULT 0` exists;
   - `bump_patient_revision` is attached as a `BEFORE UPDATE` trigger;
   - an update increments the revision exactly once;
   - a stale revision predicate updates zero rows and is surfaced as a conflict;
   - RLS still prevents cross-user patient access;
   - the healthcheck returns HTTP 200 with `status: healthy`.
4. Deploy the matching frontend SHA only after backend verification succeeds.
5. Run a post-deploy authenticated smoke test and record frontend, database, and Edge Function versions.

**Acceptance criteria**

- Deploy Supabase workflow succeeds for the same SHA as production frontend.
- Revision behavior and RLS are validated against production or a production-equivalent staging project.
- Rollback steps are tested and documented before ending the release window.

## Phase 3 — Validate clinical data integrity and recovery (P0/P1)

Use a seeded, non-PHI test account with at least three patients. Run the matrix on Chromium, WebKit/Safari, and a real phone or device farm.

1. **Todo isolation:** Every editor expanded/collapsed; Todo input retains focus and typing never changes clinical notes.
2. **Toolbar routing:** Customize toolbar, AI model selector, phrase library, formatting, and overflow controls perform only their intended action.
3. **Multi-tab concurrency:** Edit the same field in two tabs; the second stale write must become an explicit conflict with Mine/Theirs/merge choices.
4. **Cross-device concurrency:** Repeat the conflict scenario between phone and workstation.
5. **Offline recovery:** Queue edits offline, reload, reconnect, retry, and verify eventual persistence without duplication.
6. **Failure injection:** Test expired sessions, rejected writes, unavailable storage, rate limits, timeouts, and backend 4xx/5xx responses.
7. **Completion guard:** Done and End Round must block or clearly resolve pending, failed, conflicting, or offline-queued required changes.
8. **Recovery export:** Export failed/pending changes, inspect content and identifiers, re-import through the documented recovery process, and verify no silent data loss.
9. **Reload truth:** Compare rendered content and database rows after refresh in every tab/device.

**Acceptance criteria**

- Zero silent overwrites, endless `syncing` states, or falsely reported saves.
- Every failure state offers an actionable retry, conflict, or local recovery path.
- Automated Playwright coverage exists for stable scenarios; manual evidence covers browser/device conditions automation cannot reproduce reliably.

## Phase 4 — Finish accessibility and responsive validation (P1)

1. Fix the `MobilePatientDetail` missing Hook dependency warning and determine whether it can create stale tab/chip state.
2. Move non-component exports out of component modules or document a narrow exception, reducing the remaining 44 Fast Refresh warnings.
3. Run keyboard-only tests for editors, tabs, roster, dialogs, tool sheets, AI review, import preview, and completion/reopen flows.
4. Run VoiceOver on Safari and one additional screen reader/browser combination.
5. Verify roving tab focus, Arrow keys, Home/End, `aria-controls`, accessible panel relationships, dialog focus restoration, and editor escape behavior.
6. Measure primary touch targets at 320, 390, 600, 768, and 900 CSS-pixel widths; require at least 44 by 44 CSS pixels where applicable.
7. Verify no overlap among AI actions, bottom navigation, safe areas, sticky composers, and system keyboard.
8. Test text zoom to 200%, reduced motion, high contrast, and dark theme.

**Acceptance criteria**

- ESLint has zero errors and no unresolved correctness warnings.
- No critical or serious accessibility findings remain.
- Mobile and tablet task flows complete without clipping, overlap, keyboard traps, or inaccessible controls.

## Phase 5 — Close privacy, security, and dependency risks (P1)

### 5.1 PHI and external-provider approval

Complete every evidence item in `docs/clinical-data-flow.md`:

1. Provider/model allowlist and exact server-side endpoints.
2. Executed BAA/DPA and permitted PHI use.
3. Retention/deletion and training-use settings.
4. Server-side key custody, rotation, and incident revocation process.
5. Payload minimization/redaction rules and audit-log schema.
6. Sentry/telemetry redaction tests proving note text, identifiers, tokens, query strings, and request bodies are absent.
7. Clinician review requirements for AI generation and import parsing.
8. Rotation of any legacy provider credentials that may have existed before the purge migration.

### 5.2 Access-control and abuse testing

1. Verify restricted enrollment remains enabled.
2. Test RLS isolation for patients, rounds state, images, todos, imports, and exports using two users.
3. Test Edge Function authentication, authorization, CORS allowlists, rate limits, request-size limits, and provider failure handling.
4. Verify CSP blocks direct browser calls to unapproved AI providers and permits only deployment-approved Supabase/Sentry/FHIR origins.
5. Confirm logs, errors, analytics, and support artifacts contain no PHI.

### 5.3 Resolve or formally accept optional dependency findings

1. Trace the browser and build-time use of `fhirclient` and `isomorphic-webcrypto`.
2. Prefer an upgrade or browser-specific import that removes the optional Expo/React-Native dependency tree.
3. If upstream cannot be removed safely, document that the packages are not shipped in browser bundles, capture an SBOM, add an automated bundle-reachability check, set an expiry date for the exception, and assign an owner to monitor upstream fixes.

**Acceptance criteria**

- Security/privacy owners sign the data-flow evidence packet.
- Production runtime dependencies and Clinical MCP audit at zero known vulnerabilities.
- Any optional build-time advisory has a time-bounded, evidence-backed risk acceptance rather than a silent exclusion.

## Phase 6 — Reduce performance and bundle risk (P1/P2)

The application entry is approximately 2,283,487 bytes against a 2,300,000-byte budget, leaving roughly 16.5 KB of headroom.

1. Capture bundle composition and identify the largest entry-path modules.
2. Make AI, export/PDF, charts, legacy workbench, FHIR, and secondary clinical tools truly route- or interaction-lazy.
3. Remove ineffective dynamic imports where a module is also eagerly imported elsewhere.
4. Decide whether `isomorphic-webcrypto` can be excluded or replaced in the browser build.
5. Set a lower target budget with meaningful headroom and add per-chunk budgets for AI and export vendors.
6. Measure cold load, patient-switch latency, and offline startup on a representative mobile device and constrained network.

**Acceptance criteria**

- Entry bundle is at least 15% below its enforced limit.
- No unexplained chunk-size or ineffective-dynamic-import warnings remain.
- Core round navigation remains responsive under the agreed mobile performance budget.

## Phase 7 — Operational readiness (P1)

1. Add monitoring for failed/queued/conflicting writes, queue age, Edge Function errors, auth failures, rate limits, database health, and frontend release version.
2. Alert on sustained save failures or queue growth before users report missing notes.
3. Create runbooks for sync incidents, stale-client conflicts, provider outage, database migration failure, and Vercel/Supabase version mismatch.
4. Test database backup restoration and document recovery-point and recovery-time objectives.
5. Define support escalation, clinical incident review, breach response, and user communication paths.
6. Establish a staged rollout: internal test, limited pilot, monitored expansion, then general availability.
7. Record rollback criteria and an on-call owner for the release window.

**Acceptance criteria**

- Alerts are tested with synthetic failures.
- Backup restore and rollback drills succeed.
- Pilot has explicit stop conditions and named decision-makers.

## Phase 8 — Clinical validation and final go/no-go (P1)

1. Conduct scenario-based UAT with ICU attendings, residents, and fellows on phone and workstation.
2. Validate the complete bed-by-bed workflow: import, identify patient, review summary/systems/todos, edit, navigate, complete, and print/export.
3. Test representative import formats and verify every extracted field against source material.
4. Validate AI output review, insertion destination, provenance, and correction workflows; never score generated text as independently authoritative.
5. Perform a clinical hazard review covering wrong-patient context, stale data, missing tasks, duplicated tasks, incomplete imports, and misleading saved/completed states.
6. Obtain written sign-off from engineering, QA, security/privacy, operations, and the clinical safety owner.

**Acceptance criteria**

- All release-blocking hazards have effective controls and evidence.
- No open P0/P1 defects remain.
- Sign-off packet links the exact deployed SHA, migration version, test evidence, provider approvals, monitoring dashboards, and rollback runbook.

## Final release gate

Clinical production release is **GO** only when all of the following are true:

- CI and deployment workflows are green at the exact production SHA.
- Backend migration is deployed and revision/RLS behavior is proven.
- Live multi-tab, cross-device, offline, failure, and recovery scenarios pass.
- Accessibility and responsive validation pass on representative devices.
- Clinical MCP and production runtime audits are clean; optional findings are removed or formally time-bounded.
- PHI/provider, telemetry, access-control, and legal evidence is approved.
- Monitoring, backup/restore, rollback, support, and incident runbooks are tested.
- Clinical UAT and hazard review are signed off.

Any failed item keeps the release at **NO-GO**.
