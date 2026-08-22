---
title: Evaluate three bounded third-party enhancement pilots
type: feature
status: in-progress
---

# Evaluate three bounded third-party enhancement pilots

## Description

Assess whether three open-source capabilities can improve Rolling Rounds
development and clinical-rounding workflows without changing the production
clinical-safety contract:

1. **Synthea + FHIR:** deterministic, non-PHI clinical fixtures for an
   import/render/export round trip.
2. **Yjs:** a narrowly scoped collaborative draft-note surface for two
   authorized sessions.
3. **RxDB:** a bounded offline-persistence comparison against the existing
   Dexie/IndexedDB owner-scoped sync behavior.

Each pilot produces a reproducible evidence packet and an independent
decision: proceed to a separately approved implementation, extend the pilot,
or stop. A pilot pass is not production approval, a dependency-adoption
decision, or permission to use PHI.

## Business outcome

Reduce uncertainty before investing in integrations that could affect clinical
data integrity, collaboration, offline recovery, privacy, release support,
and rollback. Decisions use observed user value, measured reliability,
operational cost, security/privacy risk, and reversibility—not library
features alone.

## Scope boundaries

### In scope

- A written hypothesis, user scenario, owner, test matrix, success metrics,
  risks, rollback/removal procedure, and decision record for each pilot.
- Seeded deterministic synthetic-data workflow using pinned Synthea FHIR
  resources: at minimum Patient, Observation, MedicationRequest or
  MedicationStatement, AllergyIntolerance, and timeline-compatible encounters.
- A disposable Yjs prototype for one selected draft field/section, two
  authenticated sessions, presence, concurrent edits, offline interruption,
  same-field conflict review, server-restart recovery, and attributable review
  metadata.
- A disposable RxDB spike comparing the same representative round/session
  workload against the current Dexie/IndexedDB path. RxDB does not replace the
  current persistence path during this task.
- Automated deterministic checks and browser/device failure-injection tests
  using synthetic accounts only.

### Out of scope

- Production rollout, broad architecture migration, PHI, live EHR tenants,
  ambient listening, autonomous clinical recommendations, order placement,
  medication changes, or automatic chart insertion.
- Silent background merging of clinical content, automatic conflict selection,
  or claiming remote save when content is only local.
- Replacing current conflict guards, completion guards, RLS policies,
  PHI-safe telemetry, recovery-export controls, or Dexie during the pilot.
- Adding a production replication service, durable collaboration platform,
  broad dependency upgrade, or unreviewed Supabase migration.

## Shared pilot rules and evidence

Use only seeded synthetic patients and the two authorized non-PHI identities
`AUTH-A` and `AUTH-B`; exercise unauthorized `AUTH-U` cases from the matrix
above. Telemetry may contain opaque test-run/document IDs, counts, durations,
statuses, queue age, conflict counts, cleanup results, and error classes. Never log note text,
patient/MRN/bed identifiers, FHIR payloads, CRDT updates, room tokens, or
recovery-export contents.

Each evidence packet must contain:

- packet ID, track, hypothesis, scope, pilot flag, and user scenario;
- named technical owner, clinical-safety reviewer, privacy/security reviewer,
  accessibility reviewer, accountable business decision owner, planned
  decision date, and actual decision timestamp;
- exact library/tool versions, commits, licenses, and an explicit
  existing-versus-new dependency classification;
- no-PHI provenance statement, fixture manifest hash, `AUTH-A`/`AUTH-B`/
  `AUTH-U` classification and authorization matrix, environment,
  browser/device, seed, workload, and failure injection;
- raw results, metric definitions/formulas, baseline, sample counts, pass/fail
  interpretation for every criterion, and independently checked calculations;
- authorization, owner isolation, accessibility, provenance/audit,
  conflict/restart recovery, baseline regression, user-value,
  operational-cost, and rollback/kill-switch evidence;
- metadata receipt, separately verified content-bearing recovery artifact,
  immutable evidence-store URI/hash, known limitations, unresolved risks,
  export/quarantine inventory, purge list, removal steps, and signed decision
  with next action and due date.

Named people must replace role placeholders before execution; a packet with
missing names or signatures is incomplete.

## Pilot 1 — Synthea synthetic fixtures and FHIR round trip

### Hypothesis

Deterministic Synthea fixtures can make import, rendering, medication/allergy
handling, timeline, and FHIR mapping regressions reproducible without exposing
real patient information.

### Acceptance criteria

- [ ] Two runs with the same pinned inputs produce byte-equivalent normalized
  fixture output and manifest; a changed seed changes the manifest hash.
- [ ] The fixture set contains at least three synthetic patients, ten
  observations/vitals, three medications, two allergies, and a multi-event
  timeline, with no real identifiers.
- [ ] Import/export comparison checks at least 20 named fields and classifies
  every difference as preserved, normalized, intentionally lossy, unsupported,
  or absent; no difference is silently discarded.
- [ ] Missing fixture fields render as `Not documented`; units, clinically
  meaningful dates, medication status, allergy severity/reaction, and source
  provenance are preserved where supplied.
- [ ] The reset path is the existing `app/e2e/fixture-state.ts` module.
- [ ] Fixture, mapping, and round-trip checks pass in CI, or an approved
  deterministic exception is recorded in the packet.

### Decision rule

Proceed only if all criteria pass, no unexplained field loss remains, the
workflow is reproducible on a clean environment, and clinical-safety review
finds no misleading mapping or missing-data behavior. Any PHI exposure,
nondeterminism, unsafe date/unit transformation, or inability to remove the
fixture tooling is an immediate no-go.

## Pilot 2 — Yjs collaborative draft-note editing

### Hypothesis and boundary

Yjs can support bounded, reviewable collaboration on one `clinicalSummary`
draft field while preserving authenticated access, explicit conflict state,
provenance, and review-only behavior. The pilot is limited to two authorized
synthetic sessions and is disabled by default.

### Current-to-target mapping

| Current surface | Current behavior | Target pilot behavior |
| --- | --- | --- |
| `app/src/collab/CollaborationProvider.tsx` | Broad local `Y.Doc`, `PatientNoteStore`, and cursor-like state; not an authenticated multi-user room. | A separate feature-gated `PilotCollaborationProvider` owns one authorized document, WebSocket lifecycle, awareness, restart epoch, status, and teardown. |
| `app/src/collab/patient.store.ts` | `@syncedstore/core` stores broad `notes`/`cursors` keyed by `${patientId}:${system}`. | A pilot-only `ClinicalSummaryDraftAdapter` owns one scoped Yjs document; presence uses awareness and is not persisted with note content. The existing store remains the control path. |
| `@syncedstore/core` / `@syncedstore/react` | Existing runtime dependencies that make the current store reactive. | Do not wrap the target in another `syncedStore`. Replace the store only inside the pilot with direct `Y.Doc` + `Y.XmlFragment` adapter APIs; retain the packages for the unchanged control path. |
| `clinicalSummary` / `clinical_summary` | Canonical patient field written through the existing single-writer and revision guard. | A review-only draft with captured server revision. Explicit review/apply is the only route to the existing writer; stale apply returns to conflict review. |
| `app/src/components/RichTextEditor.tsx` | Controlled HTML editor with existing sanitization, toolbar, focus, and accessibility behavior. | `CollaborativeClinicalSummarySurface` wraps it, serializes sanitized HTML to/from one deterministic `Y.XmlFragment`, and preserves the editor contract. Unsupported markup is normalized and recorded, never silently lost. |

### Explicit Yjs wrapping/replacement strategy

Do not extend the broad current provider or nest another `syncedStore` layer.
Keep the current provider/store unchanged when the flag is off. The pilot adds
a typed adapter with `load`, `applyLocalChange`, `observe`, `status`,
`exportRecovery`, `quiesce`, and `destroy`; it creates one fresh `Y.Doc`, one
rich-text root, one authenticated provider, and one namespaced
`y-indexeddb` persistence instance per authorized document. The adapter wraps
the existing `RichTextEditor` at the boundary, but it never calls the chart
writer. Removing the pilot unmounts the wrapper, closes the provider, destroys
only its stores, and returns to the current field path without data migration.

### Acceptance criteria

- [ ] Every room/session request authenticates the existing Supabase session
  and authorizes exact tenant/team, patient, round, and `clinicalSummary`
  scope before WebSocket upgrade. Opaque server-issued IDs contain no bearer
  token, patient identifier, or note content. Guessed/stale IDs cannot read or
  mutate content.
- [ ] In 10/10 scripted online runs, disjoint edits converge to the same
  normalized document within five seconds on the agreed test network.
- [ ] Same-field offline edits capture base revision/digest and actor metadata.
  If both sides changed the same base, the UI marks `needs-review`, preserves
  local/remote/merged candidates, and requires a reviewer choice or manual
  revision. No last-writer-wins or silent auto-apply is allowed.
- [ ] Explicit apply alone calls the existing revision-guarded patient writer.
  A stale revision remains recoverable and returns to review; no Yjs observer,
  benchmark, or replication handler can write the chart.
- [ ] In 10/10 same-field offline/reconnect runs, no edit is silently lost and
  every result is acknowledged, conflict/reviewable, or failed/recoverable.
- [ ] WebSocket interruption shows offline/reconnecting and never claims
  remote save without acknowledgment. `y-indexeddb` retains unacknowledged
  updates under the owner/document namespace.
- [ ] A server restart changes a room/server epoch in the test service. The
  client never replaces populated local content with an empty room; it enters
  `server-restarted/recovery-required`, exports or quarantines the local draft,
  and requires a separate explicit rejoin/apply action. Ephemeral server state
  is a documented pilot limitation; durable snapshots/update logs are required
  before production consideration.
- [ ] Sign-out, expired authorization, reload, provider failure, and account
  switch close transports, stop drains, and purge only through the existing
  owner-transition cleanup path. A new owner cannot read the prior owner's
  draft.
- [ ] Keyboard access, focus recovery, screen-reader labels, visible status,
  conflict state, and review actions have no critical accessibility blocker.

### Decision rule

Proceed only if authorization, provenance, convergence, same-field conflict
review, restart recovery, review-only behavior, accessibility, and rollback
pass with zero silent overwrites or wrong-patient paths. Any authorization
bypass, hidden conflict resolution, unreviewed chart write, PHI telemetry,
unrecoverable edit, or inability to disable quickly is a no-go.

## Pilot 3 — RxDB bounded offline-sync comparison

### Hypothesis and baseline

RxDB may improve local persistence/sync performance for one supported workload,
but it must be compared with the existing Dexie/IndexedDB path under identical
conditions. The Dexie path is measured first and remains the control and source
of truth.

### Acceptance criteria and metrics

- [ ] The fixed synthetic workload contains at least three patients, 20
  representative draft mutations, reloads, reconnects, and injected network,
  authorization, backend 4xx/5xx, quota/storage, and expired-session failures.
- [ ] For the same browser/device, auth state, workload, and failure injection,
  collect at least 30 applicable repetitions for timing metrics and 20
  offline/reconnect correctness runs for each implementation.
- [ ] Report raw values, median, p95, and sample count for cold startup/open,
  hydrate/read, local write/enqueue, reconnect-to-drain-complete, maximum
  queue age, and storage bytes.
- [ ] Report conflict count, retry count, duplicate committed mutation rate,
  silent-loss count, failed-write recovery rate, terminal-status visibility,
  and owner-isolation failures.
- [ ] Candidate has zero silent loss, zero duplicate committed mutations, 100%
  visible terminal status, zero owner leaks, intact completion guards, and
  intact recovery export behavior.
- [ ] The comparison records bundle size, lockfile/transitive dependency,
  license, support, schema, replication, checkpoint, tombstone, and migration
  consequences. A required server/schema migration stops this spike for a
  separate design decision.

### Decision threshold

RxDB proceeds only with at least one pre-registered p95 latency metric showing
a **20% or greater improvement** over the Dexie baseline:

`(Dexie baseline p95 - RxDB p95) / Dexie baseline p95 >= 0.20`

It must also have zero integrity/owner-isolation failures and no regression
greater than 10% in any safety-critical metric. A benchmark that misses this
threshold is a no-go or pilot extension, not a reason for a broad rewrite.

## Safe kill-switch sequence

The shared kill switch is fail-closed and safe during network partition:

1. **Stop admission:** atomically disable the server/client pilot flag, reject
   new Yjs room/document admission and RxDB opens, make existing sessions
   read-only, and record flag version/time.
2. **Quiesce:** mark documents draining; stop local edits, queues, retries, and
   replication; close providers after a bounded attempt to acknowledge already
   in-flight work. Do not wait indefinitely or create new writes.
3. **Export/quarantine:** verify owner and document scope; create both an
   immutable metadata receipt and a separately verified, content-bearing
   recovery artifact containing the actual recoverable fixture/draft/queued
   content, base revision, checksum, and result. A receipt containing only an
   opaque ID, status, or checksum is not recovery. If the content-bearing
   artifact cannot be read, parsed, integrity-checked, or owner-verified,
   quarantine the namespaced store read-only and block purge.
4. **Purge confirmed-safe state only:** destroy only closed, named pilot Yjs or
   RxDB namespaces after the metadata receipt and content-bearing recovery
   artifact are both verified (or after an explicit empty-state receipt and
   empty-state verification). Preserve Dexie, chart data, existing recovery
   exports, and uncertain/quarantined stores. Never broadly purge IndexedDB.
5. **Verify/report:** prove no new admission, no active pilot provider, no
   cross-owner visibility, and normal current-path behavior; attach inventory,
   quarantine/export results, purge list, failures, and sign-off to the packet.

## Dependency classification

| Classification | Items | Rule |
| --- | --- | --- |
| Existing control/runtime | `@syncedstore/core@^0.6.0`, `@syncedstore/react@^0.6.0`, `yjs@^13.6.29`, `y-indexeddb@^9.0.12`, `dexie@^4.3.0`, Supabase client, and Playwright/test tooling | Already installed; preserve versions and current behavior during planning. |
| New pilot-only candidates | Pinned WebSocket client/server package if required, `rxdb` plus only benchmark plugins required, and pinned Synthea/Java tooling | Add only in an isolated pilot entry point after license/version review; keep out of the production bundle and remove with the pilot. |
| Not authorized | Production replication service, durable Yjs server persistence, Supabase migration, or broad dependency upgrade | Requires a separate implementation decision. |

## Implementation-ready architecture summary

Track A supplies the shared normalized fixture manifest. Track B uses a
feature-gated, authenticated Yjs adapter for one `clinicalSummary` field and
the existing `RichTextEditor`, with explicit same-field review and restart
recovery. Track C compares a quarantined RxDB adapter with Dexie and uses the
pre-registered 20% p95 threshold. Neither track becomes production state.

The full current-to-target map, lifecycle details, and dependency boundary
are maintained in `.specs/analysis/architecture-third-party-enhancements.md`.
This task changes planning artifacts only; it does not modify application
source code or dependency manifests.

## Evidence ownership and decision schedule

| Track | Technical owner | Clinical-safety reviewer | Privacy/security reviewer | Accessibility reviewer | Business decision owner | Planned decision date |
| --- | --- | --- | --- | --- | --- | --- |
| A — Synthea | Fixture/interop lead (name required before run) | Clinical-safety lead (name required) | Privacy lead (name required) | Accessibility lead (name required) | Product/release owner (name required) | 2026-09-05 |
| B — Yjs | Collaboration lead (name required before run) | Clinical-safety lead (name required) | Security/privacy lead (name required) | Accessibility lead (name required) | Product/release owner (name required) | 2026-09-12 |
| C — RxDB | Offline/persistence lead (name required before run) | Clinical-safety lead (name required) | Security/privacy lead (name required) | Accessibility lead (name required) | Product/release owner (name required) | 2026-09-12 |
| Shared final gate | Release owner | Clinical-safety lead | Security/privacy lead | Accessibility lead | Product/release owner | 2026-09-19 |

The dates are planning targets, not approvals. Final status remains **NO-GO
for production implementation** until each track has its evidence packet,
named owners, reviewer signatures, and tested removal path. One track's
success does not authorize another.

## Planning checklist

- [ ] License and transitive-dependency review complete.
- [x] Current sync/data-flow and current-to-target mapping reviewed.
- [ ] Named technical, clinical-safety, privacy/security, accessibility, and
  business owners recorded.
- [ ] Decision dates and evidence templates approved. Draft templates created in
  `.specs/evidence/third-party-enhancements/`; named approval is still required.
- [ ] No-PHI fixture manifest and account controls verified.
- [x] FHIR profile/validator, RxDB workload/schema, WebSocket boundary,
  browser/device matrix, cache-retention limits, and immutable evidence store
  are explicitly recorded as preflight contracts; execution remains blocked
  until owners approve the currently unassigned values/store.
- [ ] `AUTH-A`, `AUTH-B`, and `AUTH-U` authorization matrix passes.
- [ ] Baseline lint, typecheck, unit, E2E, build, and lockfile regression
  commands pass before any pilot flag is enabled.
- [x] Same-field conflict, WebSocket interruption, server-restart recovery,
  owner transition, and kill-switch tests defined.
- [x] RxDB baseline metrics and 20% p95 threshold pre-registered.
- [x] Applicable timing, safety-critical, accessibility-blocker, user-value,
  operational-cost, and evidence-storage definitions are recorded.
- [ ] Evidence packets completed and independently checked. Planning packet
  scaffolds exist; no pilot raw results or signatures exist.
- [x] Independent stop/no-go dispositions recorded for planning state; no
  production implementation is authorized.

### Implementation status (2026-08-22)

- [x] Created reproducible planning/run manifest, isolated A/B/C namespaces,
  pre-registered identity matrix, seven preflight contracts, and packet index.
- [x] Created bounded evidence scaffolds for fixture determinism/counts,
  20-field FHIR classification, Yjs authorization, RxDB comparison, shared
  gates, decisions, and quarantine.
- [x] Verified this task adds no files under application source, Electron,
  Supabase, or dependency manifests.
- [ ] Close named-owner, immutable-evidence-store, pinned-tool, and baseline
  gates. These are execution blockers and are intentionally not fabricated.
- [ ] Execute pilots. This task does not authorize execution or production
  integration; future runs require a separate approved pilot branch.

## Implementation Process

This process is planning-only for the current task. It does not authorize
application-source edits, dependency-manifest edits, production services, PHI,
or production flags. Any future pilot implementation must use a separate,
pilot-only branch and output namespace. The existing application paths named
below are control and comparison surfaces; they are not to be changed while
this draft is being prepared.

### Pre-pilot blockers and decisions (must be closed before Step 1)

No pilot may start until each item below has a named decision owner, an
immutable decision record, and an explicit value. A blank, `TBD`, or
post-hoc decision is a blocker.

1. **FHIR profile and validator:** Freeze the exact FHIR version/profile,
   validator package/CLI and version, terminology/value-set policy, validation
   severity policy, and the field-level mapping contract for Track A. Record
   them in
   `.specs/evidence/third-party-enhancements/preflight/fhir-contract.md`.
   The validator result cannot substitute for application import/render/export/
   re-import comparison.
2. **RxDB workload and schema:** Freeze the one bounded `draft_field`
   round-workflow workload, field set, owner/tenant scope, string primary key,
   modification-time plus primary-key checkpoint ordering, tombstone policy,
   idempotency/write-ID rule, storage adapter, and migration policy. Record the
   schema, 20-mutation workload, failure matrix, and baseline query set in
   `.specs/evidence/third-party-enhancements/preflight/rxdb-contract.md`.
   A required server/schema migration blocks the pilot.
3. **WebSocket test-service boundary:** Decide whether Track B uses a
   disposable local test service or an already approved non-production service;
   name its owner, endpoint boundary, upgrade-authentication mechanism,
   pre-`handleUpgrade` authorization check, restart/epoch control, size/rate
   limits, and teardown procedure. Record this in
   `.specs/evidence/third-party-enhancements/preflight/websocket-boundary.md`.
   The stock Yjs server is transport only; no production service or Supabase
   Edge assumption is implicit.
4. **Browser/device matrix:** Freeze browser and device versions, viewport,
   network profiles, storage quota, and accessibility technology for every
   run. The minimum matrix is Chromium and WebKit on the supported macOS test
   device, with two authenticated contexts for Track B; any mobile or Electron
   target is either included explicitly or recorded out of scope before runs.
   Record the matrix in
   `.specs/evidence/third-party-enhancements/preflight/browser-device-matrix.md`.
5. **Cache and quarantine retention limits:** Set finite numeric limits before
   execution for fixture-directory size/age, Yjs document size/age, RxDB
   namespace size/age, queue age, local storage usage, and quarantine duration.
   Also record clear-on-sign-out behavior, retention owner, and the review date
   for expired quarantine. Record these in
   `.specs/evidence/third-party-enhancements/preflight/retention-policy.md`.
   No cache may persist indefinitely by omission.
6. **Immutable evidence storage:** Select and approve an append-only,
   access-controlled evidence store with object/version retention or equivalent,
   final URI/key naming, SHA-256 hashing, access log, retention period, and
   deletion authority. Local `.specs/evidence/` files are staging only; the
   packet must identify the immutable final object and hash. Record the choice
   in `.specs/evidence/third-party-enhancements/preflight/evidence-storage.md`.
7. **User-value and operational-cost thresholds:** Freeze the task-success,
   median-time, recovery-time, CI-delta, operator-minute, storage-byte,
   service-runtime, and recurring-support ceilings used by the gates below.
   Record the baseline/control comparison and the owner-approved ceilings in
   `.specs/evidence/third-party-enhancements/preflight/value-cost-thresholds.md`.

### Pre-registered identities and authorization matrix

Use exactly two explicit authorized synthetic identities for the pilot,
`AUTH-A` and `AUTH-B`, plus `AUTH-U` as the unauthorized test identity. `AUTH-A`
and `AUTH-B` are separately authenticated users authorized for the same named
synthetic tenant/team, patient, round, and selected field. `AUTH-U` is tested
both as a wrong-tenant identity and, where the environment permits, as a
same-tenant identity lacking the patient/round/field grant. No real account or
single shared test login is acceptable.

The preflight packet must contain this matrix before any content-bearing run:

| Identity/case | Room admission | Read content | Mutate content | Presence | Recovery export | Expected result |
| --- | --- | --- | --- | --- | --- | --- |
| `AUTH-A`, exact scope | allow | allow | allow within pilot | allow, ephemeral | allow for owned scope | authorized |
| `AUTH-B`, exact scope | allow | allow | allow within pilot | allow, ephemeral | allow for owned scope | authorized |
| `AUTH-U`, wrong tenant | deny | deny | deny | deny | deny | no content or metadata leak |
| `AUTH-U`, wrong patient/round/field | deny | deny | deny | deny | deny | no content or metadata leak |
| revoked/expired `AUTH-A` or `AUTH-B` | deny after revocation | deny | deny | close | deny | existing local state is quarantined or cleared by policy |
| guessed/stale room or document ID | deny | deny | deny | deny | deny | no enumeration or mutation |

### Definitions and measurable value/cost gates

- **Applicable timing metric:** A named timing metric that is measurable for
  the frozen workload and matrix, has the same start/stop events and units in
  Dexie and RxDB, has at least 30 valid repetitions, and has a non-zero Dexie
  baseline. Track C's primary metric is reconnect-to-drain-complete; a
  different metric is allowed only if pre-registered before results are seen.
  A metric with no applicable events is `N/A`, not silently replaced after the
  run.
- **Safety-critical metric:** Any metric whose failure can cause wrong-patient
  access, unauthorized read/write, silent content loss, duplicate committed
  mutation, unreviewed chart write, unrecoverable recovery state, owner leak,
  or hidden completion status. Safety-critical metrics require zero failures
  unless the criterion explicitly says otherwise; a performance improvement
  never offsets one.
- **Critical accessibility blocker:** Any defect that prevents keyboard or
  assistive-technology completion of a core pilot task, traps focus, removes a
  required accessible name/status, hides conflict or recovery state, or makes
  sync/review status materially misleading. One confirmed blocker is a no-go.
- **Evidence storage:** The approved immutable append-only final store selected
  in preflight. It contains versioned raw results, manifests, packets, receipts,
  and recovery artifacts with content hashes and access control. Telemetry and
  local staging are not evidence storage and must not contain payload content.
- **User-value gate:** Before running, pre-register at least one task outcome
  per track. Track A requires 3/3 reproducible fixture-to-round-trip tasks
  without manual repair; Track B requires 10/10 two-user edit/review/apply or
  conflict-review tasks with visible status; Track C requires 20/20 offline or
  reconnect tasks with a visible terminal outcome. Report task success rate,
  median task time, recovery/review time, and control-path comparison where
  applicable. Failure of a safety-critical task is a no-go regardless of speed.
- **Operational-cost gate:** Report pilot setup/operator minutes, CI wall-clock
  delta, local storage bytes, maximum namespace size, dependency/license review
  count, browser/device matrix cost, service CPU/memory and run hours for
  Track B, cleanup/quarantine count, and recurring support steps. Production
  bundle delta must be zero for these disposable pilots; no unowned production
  service/schema cost is allowed; any CI, storage, or operator cost above its
  pre-registered ceiling requires an explicit extend/stop decision.

### Parallelization and Dependencies

The eight pilot-execution steps are executed as dependency waves. A step may
run in parallel with another only when it consumes an immutable, read-only
artifact and uses a distinct namespace, fixture copy, evidence packet, and
failure-injection state. Shared fixture generation, baseline publication,
evidence consolidation, safety gates, decisions, and cleanup are barriers;
they are not parallel work items.

#### Execution graph and critical path

```text
Pre-pilot blockers
        |
      Step 1  Setup and pilot isolation
        |
      Step 2  Shared synthetic fixture baseline
        |
   +------------+------------+------------+
   |                         |            |
 Step 3 Track A           Step 4 Track B  Step 5 Track C
 Synthea/FHIR             Yjs pilot      RxDB vs Dexie pilot
   |                         |            |
   +------------+------------+------------+
                |
      Step 6 Shared safety/privacy/release gates
                |
      Step 7 Independent decision packets
                |
      Step 8 Cleanup/recovery/quarantine
```

The critical path is **preflight → 1 → 2 → max(3, 4, 5) → 6 → 7 → 8**.
Step 2 is the shared-input barrier: it publishes the immutable normalized
fixture manifest and fixed workload that Tracks A, B, and C each consume by
read-only reference. Tracks B and C do not consume Track A's FHIR round-trip
results, field classifications, disposition, or mutable runtime state. A
Track A no-go or extension disposition is evaluated independently and does not
decide, block, or authorize Tracks B or C.

#### Parallel waves

| Wave | Steps | Safe concurrency rule | Required handoff/barrier and named approver |
| --- | --- | --- | --- |
| 0 — preflight | Outside the eight pilot-execution steps | Sequential decisions; all seven pre-pilot blockers must be closed | Named preflight decision owner and release owner approve the immutable contracts, identities, environment, retention, evidence store, and thresholds before Step 1 |
| 1 — isolation | Step 1 | Single setup owner; do not start any pilot tooling | Release/program integration owner and independent verifier approve the baseline regression, isolation checks, flags-off state, and no-source-change boundary before Step 2 |
| 2 — shared baseline | Step 2 | Single fixture/interop owner; no track may mutate the shared fixture | Fixture/interop lead, privacy/security reviewer, and independent verifier approve the normalized no-PHI manifest and fixed workload before Steps 3, 4, and 5 start |
| 3 — parallel pilot execution | Steps 3, 4, and 5 | Run Tracks A, B, and C concurrently in isolated harnesses, namespaces, evidence packets, and failure-injection state; all consume Step 2 read-only inputs | Each track owner and independent verifier approve that track’s raw results, recovery state, and draft packet; release owner confirms all three handoffs before Step 6 |
| 4 — shared gate | Step 6 | Sequential, release-owner-controlled; wait for all three pilot result sets | Release owner plus named clinical-safety, privacy/security, and accessibility reviewers sign the shared matrix, kill-switch rehearsal, and current-path regression before Step 7 |
| 5 — decisions | Step 7 | Sequential after the shared gate; packet assembly may be track-local, but decisions are recorded through one ordered gate | Each accountable business decision owner and the release owner approve the complete immutable packet for that track before Step 8 |
| 6 — cleanup | Step 8 | Sequential authorization and verification; track-local export work may be prepared concurrently only after admission is stopped | Release owner and named privacy/security recovery custodian authorize cleanup; each track owner and independent cleanup verifier approve its receipts, recovery artifact, purge/quarantine list, and post-cleanup check |

#### Step ownership and integration points

| Step | Primary owner | Required reviewers/partners | Integration point |
| --- | --- | --- | --- |
| 1. Setup and pilot isolation | Release/program integration owner | All named technical owners; clinical-safety, privacy/security, accessibility, and business owners; independent verifier | `planning/run-manifest`, identity matrix, environment allowlist, baseline-regression evidence, and distinct A/B/C namespaces feed every later step |
| 2. Shared synthetic fixture baseline | Fixture/interop lead | Privacy/security reviewer; FHIR/application-mapping reviewer; test-infrastructure owner | Immutable normalized fixture manifest and fixed Track C workload feed Tracks 3, 4, and 5 by read-only reference; Step 2 handoff approvers are the fixture/interop lead, privacy/security reviewer, and independent verifier |
| 3. Track A Synthea/FHIR pilot | Fixture/interop lead | Clinical-safety reviewer; privacy reviewer; independent field-comparison verifier | Consumes only the Step 2 manifest; emits independent round-trip, field-classification, and disposition evidence to Step 6, never as an input or gate for Tracks B/C |
| 4. Track B Yjs pilot | Collaboration lead | WebSocket service owner; security/privacy, clinical-safety, accessibility reviewers; independent verifier | Consumes only the Step 2 manifest/workload plus auth/owner-transition contracts; emits isolated convergence, conflict/review, restart/recovery, authz, accessibility, and removal evidence to Step 6 |
| 5. Track C RxDB versus Dexie pilot | Offline/persistence lead | Performance/test engineer; security/privacy and clinical-safety reviewers; independent metrics verifier | Consumes only the Step 2 manifest/workload and existing Dexie control path; emits baseline-first raw metrics, correctness, owner-isolation, recovery, and threshold evidence to Step 6 |
| 6. Shared safety, privacy, and release gates | Release owner | Clinical-safety, privacy/security, accessibility, technical, and business owners; independent verifier | Joins A/B/C raw evidence without rewriting it, applies common stop conditions, and blocks Step 7 until every missing/failing gate has a disposition |
| 7. Decision packets and independent decisions | Accountable business decision owner per track | Track technical owner, clinical-safety, privacy/security, accessibility, release owner, and independent verifier | Publishes A/B/C packets plus the shared-gate packet; decisions authorize only a separately approved next step for that track |
| 8. Cleanup, recovery verification, and quarantine | Release/operations owner | Track owner for each namespace; privacy/security recovery custodian; clinical-safety reviewer; independent cleanup verifier | Consumes signed decisions and kill-switch state; returns immutable receipts, recovery-artifact references, purge/quarantine lists, and post-cleanup current-path evidence |

#### Track-local sequencing inside the parallel pilot wave

- **Shared input rule for Tracks A/B/C:** start each track only after the Step 2
  handoff is approved. Each track reads the same normalized fixture manifest
  and fixed workload from its own read-only copy or mount. Track A's round-trip
  output, field classifications, and decision are not shared inputs to Tracks
  B or C.
- **Track A (Step 3):** establish the disposable FHIR harness and validator;
  run import/render/export/re-import; classify every field difference; then
  independently verify the round-trip evidence and Track A disposition.
- **Track B (Step 4):** establish the authenticated upgrade and exact-scope
  authorization boundary; then smoke-test the adapter and serializer; then
  run online convergence; then offline same-field conflict/review; then
  reconnect, server-epoch restart, owner-transition, accessibility, and
  removal tests. No observer or replication handler may cross the explicit
  review/apply boundary into the chart writer.
- **Track C (Step 5):** measure and publish the Dexie baseline first; freeze
  that result; run the quarantined RxDB candidate against the identical
  workload, browser/device, auth state, and failure matrix; then independently
  recalculate p95, correctness, recovery, owner-isolation, and safety-critical
  deltas. RxDB never becomes a second source of truth during this wave.
- **Evidence isolation:** A, B, and C may append only to their own run
  directories and draft packets during Wave 4. They must not concurrently
  modify the shared manifest, shared gate matrix, final decision packets, or
  cleanup inventory. The immutable evidence store receives finalized objects
  at the handoff barriers, with hashes preserved.

#### Non-negotiable barriers

1. **Preflight → Step 1:** all seven preflight blockers must be closed before
   pilot tooling runs. The named preflight decision owner and release owner
   must sign the immutable contracts, identities, environment, retention,
   evidence-store, and threshold handoff.
2. **Step 1 → Step 2:** the named release/program integration owner and
   independent verifier must approve baseline regression, isolation checks,
   flags-off state, and the no-application-source/dependency-change boundary.
3. **Step 2 → parallel Steps 3/4/5:** the named fixture/interop lead,
   privacy/security reviewer, and independent verifier must approve the
   normalized no-PHI fixture manifest and fixed workload. Tracks A, B, and C
   then consume those shared read-only inputs independently; B/C do not wait
   for or consume Track A round-trip results.
4. **Parallel Steps 3/4/5 → Step 6:** each named track owner and independent
   verifier must approve that track’s complete raw results, recovery state, and
   draft packet. The named release owner confirms all three handoffs; no fast
   pilot may bypass a slower pilot or the shared gate.
5. **Step 6 → Step 7:** the named release owner and named clinical-safety,
   privacy/security, and accessibility reviewers must sign the shared matrix,
   kill-switch rehearsal, and current-path regression. A track pass never
   authorizes another track, production rollout, PHI, a production replication
   service, a Supabase migration, or a broad dependency change.
6. **Step 7 → Step 8:** the named accountable business decision owner for each
   track and the named release owner must approve the complete immutable
   decision packet before cleanup authorization.
7. **Step 8 → task close:** the named release owner, privacy/security recovery
   custodian, and independent cleanup verifier must approve the post-cleanup
   check. No state may be purged until admission is stopped, providers/queues
   are quiesced, owner/document scope is verified, and both the metadata
   receipt and separately verified content-bearing recovery artifact are
   present. Uncertain or unverifiable state remains named, read-only, and
   quarantined for finite retention.

Every barrier record must contain the approver’s name, role, decision,
timestamp, and immutable evidence reference. A role placeholder, `TBD`, or
post-hoc approval does not satisfy a handoff.

### Ordered steps and bounded outputs

#### 1. Setup and pilot isolation

- **Goal:** Establish named accountability, a disposable test environment, and
  fail-closed boundaries before any third-party tool runs.
- **Concrete files/outputs:** Create a planning/run manifest under
  `.specs/evidence/third-party-enhancements/` with packet IDs, named owners and
  reviewers, decision dates, `AUTH-A`/`AUTH-B`/`AUTH-U` classification,
  browser/device, feature-flag defaults, tool versions/commits/licenses, and a
  run directory outside the application data directory. Record an explicit
  pilot namespace for Track A, Track B, and Track C. Do not add or edit files
  under `app/src/`, `app/electron/`, `app/supabase/`, or dependency manifests
  in this task. Also emit `baseline-regression.txt` and retain command output
  in the immutable evidence store.
- **Dependencies:** All seven pre-pilot blockers above; named people replacing
  every role placeholder; two authorized synthetic identities and one
  unauthorized identity; clean test project; license/transitive-dependency
  review; the existing auth, owner transition, recovery-export, and Dexie
  control contracts.
- **Baseline regression commands/tests:** Before enabling any pilot flag, run
  and record the result of:

  ```sh
  npm --prefix app run lint
  npm --prefix app run typecheck
  npm --prefix app test -- src/lib/auth/clearSensitiveClientState.test.ts src/lib/offline/indexedDBQueue.test.ts src/lib/offline/syncEngine.test.ts src/lib/round/sync/roundOutbox.test.ts src/lib/round/roundCompletionSafety.test.ts
  npm --prefix app run test:e2e:synthetic -- e2e/data-integrity.e2e.spec.ts e2e/accessibility.e2e.spec.ts e2e/production-save-canary.e2e.spec.ts
  npm --prefix app run test:e2e:webkit -- e2e/accessibility.e2e.spec.ts
  npm --prefix app run build
  npm --prefix app run verify:lockfile
  ```

  These are regression gates, not pilot evidence. A failing, skipped-without-
  justification, or environment-invalid baseline blocks all pilots until the
  disposition is recorded and the control path is reverified.
- **Success criteria:** Every pilot flag is off by default; each track has a
  distinct namespace and owner; test configuration fails closed for production
  URLs/credentials; telemetry is metadata-only; the full baseline command/test
  set passes with no unexplained skip and is hash-recorded in immutable
  storage; no pilot can write the chart, replace Dexie, or admit an
  unauthorized room.
- **Risks/mitigations:** Accidental production targeting is mitigated by an
  allowlisted test-project check and separate credentials; cross-track data
  contamination is mitigated by distinct namespaces and manifests; a missing
  reviewer blocks execution rather than being filled with `TBD`.
- **Definition of done:** Setup manifest is reviewed and immutable for the
  run, all names and approvals are present, isolation checks pass, and the
  working tree contains no application-source or dependency changes.

#### 2. Shared synthetic fixture baseline

- **Goal:** Produce one reproducible, no-PHI workload that all three pilots
  can reference without sharing runtime state.
- **Concrete files/outputs:** Pin Synthea version/commit, Java major version,
  modules, properties, locale/timezone, geography, reference date, seed, and
  population size. Emit a normalized fixture manifest with resource counts,
  input hashes, normalization version, fixture hash, provenance/classification,
  and the fixed Track C workload (at least three patients and 20 mutations).
  Use `app/e2e/fixture-state.ts` as the reset contract and record the planned
  FHIR boundary (`app/src/lib/fhir.ts`, existing import-safety path, and
  existing patient shape) as read-only comparison inputs.
- **Dependencies:** Step 1; the existing `Patient` shape and owner-scoped
  paths; the FHIR conversion/import modules identified in the analysis; no
  live patient data.
- **Success criteria:** Two runs with identical pinned inputs produce
  byte-equivalent normalized fixture output and manifest; a changed seed
  changes the manifest hash; minimum patient/observation/medication/allergy/
  timeline counts are present; a no-PHI/secret/production-endpoint scan
  passes; the reset path is deterministic.
- **Risks/mitigations:** Synthea output can look clinically real, so retain it
  only in the controlled test namespace and never log payloads; toolchain drift
  is mitigated by recording every input hash; a mapping assumption is mitigated
  by treating this manifest as a fixture baseline, not clinical truth.
- **Definition of done:** The shared manifest and hash are independently
  checked and referenced by three isolated run manifests; generated content is
  not committed unless explicitly approved as a small golden fixture.

#### 3. Track A — Synthea/FHIR round-trip pilot

- **Goal:** Measure deterministic import, render, export, and re-import fidelity
  without introducing a parallel patient model or changing SMART/EHR flow.
- **Concrete files/outputs:** Produce a Track A run manifest, normalized FHIR
  fixture set, field comparison table with at least 20 named fields, raw test
  results, rendered/imported/exported hashes, and a Track A evidence draft.
  Exercise the existing `app/src/lib/fhir.ts`, patient/import safety boundary,
  and `app/e2e/fixture-state.ts` through a disposable harness; keep
  `app/src/integrations/fhir/` and application source unchanged for this task.
- **Dependencies:** Steps 1–2; pinned FHIR profile/version and validator;
  existing patient mapping and sanitization contracts; deterministic reset.
- **Success criteria:** Every difference is classified as preserved,
  normalized, intentionally lossy, unsupported, or absent; missing data
  renders as `Not documented`; units, dates, medication status, allergy
  severity/reaction, timeline, and provenance are checked; no unexplained
  field loss, unsafe transformation, real identifier, or production write is
  observed; 3/3 pre-registered fixture-to-round-trip user tasks complete
  without manual repair and their median task time is recorded.
- **Risks/mitigations:** FHIR validity can hide application mapping loss, so
  compare application round-trip fields rather than validator status alone;
  accidental fixture seeding is mitigated by a test-project allowlist and the
  existing reset path; generated content is retained only as controlled test
  content with its manifest hash.
- **Definition of done:** Track A raw results, normalized fixture hash, field
  classifications, failure log, and independently checked pass/fail matrix are
  complete; any failed criterion is recorded as no-go or extension and does
  not gate the independently scoped Tracks B or C.

#### 4. Track B — Yjs collaborative draft pilot

- **Goal:** Test one authenticated, review-only `clinicalSummary` draft across
  two authorized synthetic sessions while preserving the current writer,
  revision guard, owner transition, and accessibility contracts.
- **Concrete files/outputs:** In a separate pilot harness/branch, define the
  scoped `PilotCollaborationProvider`/`ClinicalSummaryDraftAdapter`, the
  deterministic HTML/`Y.XmlFragment` serializer around
  `app/src/components/RichTextEditor.tsx`, the approved authenticated
  upgrade/room test service, the frozen Chromium/WebKit two-context matrix,
  the `AUTH-A`/`AUTH-B`/`AUTH-U` authorization matrix, and status/audit
  fixtures. Emit raw online convergence, offline same-field conflict,
  reconnect, sign-out/expiry, server-epoch restart, review/apply,
  accessibility, authorization-denial, and kill-switch results. The adapter
  must expose `load`, `applyLocalChange`, `observe`, `status`, `exportRecovery`,
  `quiesce`, and `destroy`, but must never call the chart writer from an
  observer or replication handler.
- **Dependencies:** Steps 1–2 and the closed WebSocket-boundary/browser-device
  decisions; existing Supabase session/auth boundary;
  `ownerTransitionBarrier`, `syncAuthTransitionGate`, and
  `clearSensitiveClientState` cleanup contracts; Yjs and `y-indexeddb`
  versions/license review; the two authorized identities and unauthorized
  identity matrix. The stock Yjs server is transport only and is not
  authorization.
- **Success criteria:** Exact tenant/team, patient, round, and field scope is
  authorized before upgrade; every row of the `AUTH-A`/`AUTH-B`/`AUTH-U` matrix
  has the expected allow/deny result; room IDs contain no bearer token,
  patient ID, or note content; 10/10 online disjoint-edit runs converge;
  10/10 offline runs are acknowledged, reviewable, or recoverable; same-base
  edits show local, remote, and merged candidates with explicit review; stale
  apply returns to review; interruption never claims remote save; restart epoch
  never replaces populated local content with an empty room; sign-out/account
  change leaves no cross-owner access; user-value tasks meet the pre-registered
  completion/time threshold; no critical accessibility blocker exists.
- **Risks/mitigations:** Query-string leakage is mitigated with opaque IDs and
  session-bound upgrade authorization; awareness is treated as ephemeral
  presence, not audit; in-process server loss is mitigated by verified
  content-bearing recovery export or quarantine; hidden last-writer-wins is
  blocked by explicit same-field review and the existing revision guard; the
  flag remains off and the current collaboration/control path remains intact.
- **Definition of done:** Both sessions, all failure injections, recovery
  behavior, review-only apply, owner isolation, accessibility, and removal
  rehearsal are evidenced in the Track B packet; any silent loss, wrong-owner
  read, unreviewed chart write, or unverifiable recovery is immediate no-go.

#### 5. Track C — RxDB versus Dexie comparison pilot

- **Goal:** Determine whether RxDB materially improves one bounded offline
  workload without becoming a second source of truth or weakening current
  Dexie safety behavior.
- **Concrete files/outputs:** Record a pre-registered Dexie baseline using the
  existing `app/src/lib/offline/database.ts`, `indexedDBQueue.ts`,
  `syncEngine.ts`, round outbox/sync modules, completion guard, and offline
  status surfaces as read-only controls. Run a quarantined RxDB adapter using
  the frozen schema, primary key, checkpoint, tombstone, idempotency, and
  workload contract against the identical browser/device, auth state,
  throttling, and failures. Emit raw per-run data and a comparison table for
  cold open, hydrate/read, local enqueue, reconnect drain, queue age, storage
  bytes, conflicts, retries, duplicate commits, silent loss, recovery,
  terminal status, owner isolation, completion guards, recovery export, task
  success, and task time.
- **Dependencies:** Steps 1–2 and the closed RxDB workload/schema,
  browser/device, retention, and identity decisions; current Dexie path
  measured first; at least 30 applicable timing repetitions and 20
  offline/reconnect correctness runs; exact RxDB/storage/plugin versions and
  license review; no Supabase schema, replication service, or broad dependency
  migration.
- **Success criteria:** Both implementations use the same workload and
  injected network/auth/4xx/5xx/quota/session failures; RxDB has zero silent
  loss, zero duplicate committed mutations, zero owner leaks, 100% visible
  terminal status, intact completion/recovery guards, and no safety-critical
  regression over 10%; it meets the pre-registered >=20% p95 improvement on
  the applicable timing metric or is recorded as no-go/extension. The
  pre-registered offline/reconnect user-value tasks meet 20/20 completion and
  the median recovery/review time is reported against Dexie.
- **Risks/mitigations:** RxDB conflict defaults or tombstone/checkpoint gaps are
  mitigated by testing explicit conflict, missed-event, clock-skew, partial
  acknowledgement, retry, revocation, and deletion-retention cases; storage
  leakage is mitigated by owner namespaces and the existing transition gate;
  benchmark bias is mitigated by measuring Dexie first and publishing raw
  results; migration pressure is avoided by keeping Dexie authoritative.
- **Definition of done:** The baseline and candidate results are independently
  recalculated, the threshold decision is recorded, and the RxDB namespace is
  either demonstrably empty/verified for cleanup or retained quarantined with
  its recovery state. No production path or dependency manifest is changed by
  this task.

#### 6. Shared safety, privacy, and release gates

- **Goal:** Apply common stop conditions and verify that each pilot remains
  reversible, review-only, owner-scoped, and no-PHI.
- **Concrete files/outputs:** Complete a shared gate matrix covering fixture
  provenance, telemetry redaction, authorization/RLS, identity attribution,
  accessibility, persistence across reload/tab/browser/device/server restart,
  token revocation, schema/version change, operational limits, feature-flag
  rollback, dependency notices, baseline regression, user-value outcomes,
  operational-cost outcomes, and test/deployment evidence. Attach the
  kill-switch rehearsal, the `AUTH-A`/`AUTH-B`/`AUTH-U` matrix, and an
  inventory of all pilot namespaces. Store the signed matrix and raw results in
  the approved immutable evidence store, not only in local staging.
- **Dependencies:** Tracks A–C raw results; named clinical-safety,
  privacy/security, accessibility, technical, release, and business owners;
  existing recovery-export and owner-transition contracts.
- **Success criteria:** No PHI or payload content appears in logs/telemetry;
  no pilot path writes chart state without explicit review/apply; no
  unauthorized cross-tenant/patient/owner access; all claimed persistence and
  recovery guarantees are tested; disablement leaves current Dexie/chart paths
  working; user-value and operational-cost thresholds are met or explicitly
  dispositioned; evidence objects are hash-verified in immutable storage; every
  failed or missing gate is a no-go, not an inferred pass.
- **Risks/mitigations:** A green unit suite masking runtime failures is
  mitigated with browser/device, authz, restart, storage-failure, and
  deployment checks; uncertain state is mitigated by quarantine; role-only
  approvals are mitigated by requiring named signatures and timestamps.
- **Definition of done:** The shared gate matrix is signed, all critical gates
  pass or have an explicit no-go/extension disposition, and production
  implementation remains disabled regardless of an individual pilot pass.

#### 7. Decision packets and independent decisions

- **Goal:** Convert observed evidence into three independent, auditable
  proceed/extend/stop decisions without allowing one pilot to authorize
  another.
- **Concrete files/outputs:** Publish one immutable packet per track under
  `.specs/evidence/third-party-enhancements/`, plus a shared-gate packet. Each
  packet includes packet ID, hypothesis, scope, flag state, scenario, named
  owners/reviewers, exact versions/licenses, manifest hash, environment,
  workload, failure injection, raw results, formulas, sample counts,
  applicable timing-metric definition, safety-critical-metric definition,
  user-value and operational-cost results, independently checked calculations,
  limitations, risks, inventory receipt, separately verified content-bearing
  recovery artifact reference, recovery/quarantine evidence, purge list,
  removal steps, signatures including the accessibility reviewer, immutable
  evidence-store URI and SHA-256, actual decision timestamp, decision, next
  action, and due date.
- **Dependencies:** Steps 1–6; no `TBD` names; reviewer access to raw results;
  content-bearing recovery artifacts verified before any cleanup decision.
- **Success criteria:** A packet is incomplete if it lacks raw results,
  metric definitions, user-value/cost results, signatures from the
  accessibility reviewer and other required reviewers, both recovery
  deliverables, immutable-store verification, or tested removal; decisions explicitly say
  proceed to a separately approved implementation, extend the pilot, or stop;
  a Track A pass cannot authorize Yjs/RxDB, and a Track B/C pass cannot
  authorize production rollout or PHI.
- **Risks/mitigations:** Selective reporting is mitigated by retaining raw
  results and independent recalculation; ambiguous success is mitigated by
  the pre-registered criteria; packet tampering is mitigated by immutable
  hashes and timestamps.
- **Definition of done:** All four packets are immutable, complete, signed,
  and cross-referenced; the final status is recorded as NO-GO for production
  implementation unless a later separately approved implementation decision
  exists.

#### 8. Cleanup, recovery verification, and quarantine

- **Goal:** Remove only confirmed-safe disposable state while preserving every
  piece of content that might be needed for clinical-safety review or recovery.
- **Concrete files/outputs:** First create a **metadata receipt** for every
  fixture directory, Yjs document, IndexedDB/RxDB namespace, queue, export, and
  temporary service. The receipt is a separate metadata-only record containing
  opaque receipt ID, track, namespace, owner-scope hash, state class, byte
  count, content checksum, creation/verification time, status, disposition,
  and immutable-store location; it must not contain FHIR payloads, note text,
  CRDT updates, queue payloads, room tokens, or other content. A checksum or
  receipt is not recovery by itself. Separately create a
  **content-bearing verified recovery artifact** for every non-empty or
  uncertain state: the actual fixture/draft/queued-mutation content plus its
  manifest/base revision, owner/document scope, content checksum, immutable
  storage location, and a successful authorized read/parse/integrity
  verification result. Both the metadata receipt and the separately verified
  content-bearing artifact must be referenced by the packet. Record export and
  quarantine results in the packet, not in application telemetry.
- **Dependencies:** Steps 1–7; providers closed and drains stopped; owner and
  document scope verified; existing recovery-export and sensitive-client-state
  cleanup paths; an approved retention location for recovery content.
- **Success criteria:** No purge occurs merely because a metadata receipt,
  checksum, or inventory entry exists. A non-empty content-bearing state is
  purged only after both its metadata receipt and separately verified recovery
  artifact are present, readable, complete, owner-scoped, immutable, and
  recorded in the packet. If content export or verification fails, or state
  cannot be proven empty, retain the named namespace read-only in quarantine
  with a disposition, finite retention limit, retention owner, and next review
  date. Confirmed-empty state may be purged only after provider closure,
  metadata receipt, explicit empty-state verification, and immutable recording
  of that verification. Existing Dexie, chart data, approved recovery
  exports, and uncertain/quarantined state are never broadly purged.
- **Risks/mitigations:** A metadata-only record could create false confidence,
  so inventories and recovery artifacts use different types, locations, and
  acceptance checks; network partitions are mitigated by bounded quiesce and
  quarantine rather than indefinite retries; broad IndexedDB deletion is
  prohibited and cleanup targets must be named explicitly.
- **Definition of done:** The purge list names only confirmed-safe targets,
  the quarantine list names every unresolved target with retention owner and
  next review date, recovery artifacts have verified content, and a post-cleanup
  check proves no pilot admission, no active provider, no cross-owner access,
  and normal current Dexie/chart behavior.

## Verification Plan

This verification plan is part of the planning artifact; it does not authorize
application-source or dependency changes. The verifier must run each command
from the repository root, capture stdout/stderr and exit status, record the
exact input/output hashes, and write results only to the step-owned evidence
directory. A planned pilot harness command below is a required command/file
contract for the future pilot branch; it is not an instruction to add the
harness in this task.

### Verification protocol and levels

- **Single-agent:** one independent verifier checks the artifact against its
  contract and records command-level evidence. This is sufficient for setup and
  decision-planning artifacts, but it cannot waive a hard-stop condition.
- **Per-item:** the verifier evaluates every fixture, field row, or packet as an
  individually addressable item, then independently recalculates the aggregate
  result. One failed item remains failed in the aggregate.
- **Panel:** the named technical, clinical-safety, privacy/security,
  accessibility, release, and independent-verifier roles review the raw evidence
  together. A panel score cannot convert an unknown, missing, or failed
  safety-critical check into a pass.

Each rubric uses a 1–5 score for every criterion and the displayed weights must
sum to **1.00**. Use these anchors for every criterion; do not interpolate a
score from the weighted average:

| Score | Anchor |
| ---: | --- |
| **1** | Absent, contradicted, unsafe, or not executed. Required evidence is missing, the result is not reproducible, or the criterion fails a hard-stop check. |
| **2** | Materially incomplete or only partially evidenced. The intended control exists in outline, but coverage, samples, scope, or independent checking is insufficient to support a decision. |
| **3** | Basic criterion coverage is present and plausible, but evidence has a bounded gap, manual-only step, limited sample, unresolved limitation, or non-critical exception. It is not a strong pass. |
| **4** | Substantially and reproducibly evidenced with the required command/file/result, independent checking, and an explicit disposition for any bounded limitation; no safety-critical gap remains. |
| **5** | Fully evidenced: all required scenarios, samples, scope checks, raw outputs, hashes, independent calculations/review, and named approvals pass exactly as specified, with no exception or unresolved limitation. A score of 5 is reserved for this standard. |

The following safety-critical criteria have an explicit per-criterion minimum;
each must meet its minimum independently before the step can pass. The
minimum is not a suggested average and cannot be offset by another criterion.

| Step | Safety-critical criterion(s) | Minimum score |
| --- | --- | ---: |
| 1 | Baseline regression; Isolation and flags; Identity and authorization readiness; No application/dependency change | 4.0 |
| 2 | Determinism and provenance; No PHI/secrets/production endpoints | 4.0, and **5.0 for no-PHI/secrets/production endpoints** |
| 3 | No-PHI and deterministic round trip; FHIR field classification; Clinical rendering semantics; Import/export safety boundary | 4.0, and **5.0 for import/export safety boundary** |
| 4 | Authorization and no-PHI boundary; Convergence and conflict/restart recovery; Review-only chart boundary; Owner transition and recoverability; Accessibility and status honesty | **4.5**; authorization/no-PHI and review-only chart boundary also require **5.0** |
| 5 | Integrity and recovery; Owner isolation and completion safety; User value and terminal status | **4.5**; integrity/recovery and owner isolation/completion safety also require **5.0** |
| 6 | Privacy and telemetry redaction; Authorization and owner isolation; Current-path regression; Accessibility and status honesty; Kill-switch and reversibility; Evidence and release-gate honesty | **4.5**; privacy, authorization, current-path, kill-switch, and evidence honesty also require **5.0** |
| 7 | Packet completeness; Traceability and immutability; Independent calculations; Decision independence; Named approval and release honesty | 4.0; decision independence and release honesty require **5.0** |
| 8 | Recovery content verification; Purge safety and scope; Kill-switch and quarantine; Post-cleanup isolation and control path; Retention and auditability | **4.5**; recovery, purge, kill-switch, and post-cleanup isolation also require **5.0** |

The weighted score is `sum(score × weight)`, but a weighted average can never
override a failed hard stop, a safety-critical criterion below its listed
minimum, missing evidence, an unexplained skip, or an unresolved unknown. Such
a result is `no-go` or `extension` regardless of the average. Evidence is
accepted only when the command, input, output, exit status, timestamp, verifier,
and SHA-256 are recorded.

### Step 1 — Setup and pilot isolation verification

- **Verification level:** Single-agent, with an independent read-only source
  boundary check.
- **Commands/files/evidence:**
  1. Run every baseline command listed in Step 1 (`lint`, `typecheck`, the
     focused auth/offline/round unit tests, synthetic Chromium E2E, WebKit
     accessibility E2E, `build`, and `verify:lockfile`) and save the exact
     invocations and output to
     `.specs/evidence/third-party-enhancements/step-01/baseline-regression.txt`.
  2. Run
     `git status --short -- app/src app/electron app/supabase app/package.json app/package-lock.json`
     and
     `git diff --exit-code -- app/src app/electron app/supabase app/package.json app/package-lock.json`;
     both must prove that this planning task changed no application source or
     dependency manifest. Save output as `source-boundary.txt`.
  3. Inspect `planning/run-manifest.json`, the seven preflight contracts,
     `auth-matrix.json`, and the A/B/C namespace declarations with
     `jq -e` required-field checks. Save the normalized result as
     `manifest-validation.json` and its SHA-256 as `manifest.sha256`.
  4. Verify flags, endpoints, credentials, and run-directory placement with
     `rg -n 'pilot|feature.?flag|production|credential|endpoint|namespace'`
     over the planning manifest and `find` the run directory outside the
     application data directory. Save `isolation-check.txt`; do not print
     credential values.
- **Required evidence:** `baseline-regression.txt`, `source-boundary.txt`,
  `manifest-validation.json`, `isolation-check.txt`, immutable-store URI/hash,
  and the named verifier’s signed handoff to Step 2.
- **Custom rubric (weights sum to 1.00):**

  | Criterion | Weight | Score 5 requirement |
  | --- | ---: | --- |
  | Baseline regression | 0.30 | All commands pass with no unexplained skip and reproducible environment metadata. |
  | Isolation and flags | 0.25 | Flags are off, production URLs/credentials are rejected, and A/B/C namespaces are distinct. |
  | Identity and authorization readiness | 0.20 | `AUTH-A`, `AUTH-B`, and `AUTH-U` are named, separately authenticated, and every matrix row is present. |
  | Evidence integrity | 0.15 | Manifest, command output, status, timestamps, and hashes are complete and immutably stored. |
  | No application/dependency change | 0.10 | The source-boundary commands are clean and no pilot output is in an app data directory. |

- **Threshold:** `4.0/5.0`, plus zero hard-stop failures.
- **Failure handling:** Any source/manifest change, flag-on state, production
  target, credential leak, missing identity, unexplained baseline skip, or
  namespace collision blocks Step 2. Correct the planning/run manifest or
  environment, rerun the failed command set, and create a new immutable result;
  never overwrite the failed evidence.

### Step 2 — Shared synthetic fixture baseline verification

- **Verification level:** Per-item verification for every generated fixture and
  manifest field, followed by an independent aggregate hash check.
- **Commands/files/evidence:**
  1. Run the pinned generator twice with the exact command recorded in
     `preflight/fhir-contract.md`, for example
     `node app/scripts/generate-synthea-fixtures.mjs --seed <seed> --manifest <manifest> --output <run-a>`
     and the identical command for `<run-b>`. Run the pinned validator on both:
     `node app/scripts/validate-synthea-fixtures.mjs --manifest <manifest> --input <run> --no-phi --deterministic`.
  2. Compare normalized outputs and manifests with
     `diff -ru <run-a>/normalized <run-b>/normalized` and
     `cmp <run-a>/manifest.json <run-b>/manifest.json`; rerun with a changed
     seed and prove the manifest hash changes. Record all hashes in
     `step-02/determinism.json`.
  3. Run the no-PHI/secret/endpoint scan against every fixture and manifest,
     including `rg -n -i '(mrn|medical record|social security|date of birth|bearer|api[_-]?key|production\.supabase|localhost:[0-9]+)' <run>`;
     expected matches must be zero or explicitly allowlisted synthetic test
     labels. Save `step-02/no-phi-scan.txt` and the allowlist hash.
  4. Use `jq -e` to assert at least 3 patients, 10 observations/vitals, 3
     medications, 2 allergies, and multiple timeline events, then execute the
     `app/e2e/fixture-state.ts` reset contract twice and compare the resulting
     state hashes. Save `counts.json` and `reset-determinism.json`.
- **Required evidence:** `manifest.json`, `determinism.json`, `no-phi-scan.txt`,
  `counts.json`, `reset-determinism.json`, generator/Java/Synthea input hashes,
  and the Step 2 immutable handoff signed by the fixture, privacy/security, and
  independent verifiers.
- **Custom rubric (weights sum to 1.00):**

  | Criterion | Weight | Score 5 requirement |
  | --- | ---: | --- |
  | Determinism and provenance | 0.30 | Identical pinned inputs are byte-equivalent; changed seed changes the hash; all tool inputs are pinned. |
  | No PHI/secrets/production endpoints | 0.30 | Every fixture and manifest passes the scan with no unapproved match or payload logging. |
  | Required synthetic workload | 0.20 | Counts and timeline requirements pass and the reset contract is repeatable. |
  | Manifest completeness | 0.20 | Normalization version, resource counts, hashes, classification, and fixed Track C workload are present. |

- **Threshold:** `4.0/5.0`, with any no-PHI or nondeterminism failure as an
  immediate no-go.
- **Failure handling:** Quarantine the affected fixture copy and preserve its
  failed hash. A PHI-like identifier, secret, production endpoint, or
  non-deterministic output stops all three tracks until the fixture is regenerated
  from clean pinned inputs and independently rescanned. A count or reset failure
  requires a new manifest; do not silently amend the shared baseline.

### Step 3 — Track A Synthea/FHIR round-trip verification

- **Verification level:** Per-item verification for each named field and each
  of the three pre-registered user tasks; an independent verifier recalculates
  the aggregate result.
- **Commands/files/evidence:**
  1. Run the fixture validator from Step 2, the frozen FHIR validator command
     in `preflight/fhir-contract.md`, and the existing mapping tests:
     `npm --prefix app test -- src/integrations/fhir/client.test.ts src/integrations/fhir/mapper.test.ts`.
     If the future pilot branch adds the explicitly planned local round-trip
     test, run it as `npm --prefix app test -- src/lib/fhir.test.ts` and record
     the commit/path in the packet.
  2. Run the disposable import/render/export/re-import harness against
     `app/src/lib/fhir.ts`, the existing import-safety path, and
     `app/e2e/fixture-state.ts`. Capture source/imported/exported/re-imported
     hashes and save raw output under `step-03/raw/`.
  3. Validate `step-03/field-comparison.csv` has at least 20 named rows and
     that every row’s classification is exactly one of `preserved`,
     `normalized`, `intentionally-lossy`, `unsupported`, or `absent`; use
     `awk -F, 'NR>1 && $4 !~ /^(preserved|normalized|intentionally-lossy|unsupported|absent)$/ {exit 1}'`
     and save the command result as `field-classification.txt`.
  4. Explicitly inspect `Not documented`, units, clinically meaningful dates,
     medication status, allergy severity/reaction, timeline events, and source
     provenance in `rendered-field-checks.json`. Assert no automatic chart
     insertion, no AI submission, no SMART token bypass, and no production
     write in `side-effects.json`.
- **Required evidence:** `raw/`, `field-comparison.csv`,
  `field-classification.txt`, `rendered-field-checks.json`, `side-effects.json`,
  three user-task results with median task time, validator output, and the
  per-item disposition table.
- **Custom rubric (weights sum to 1.00):**

  | Criterion | Weight | Score 5 requirement |
  | --- | ---: | --- |
  | No-PHI and deterministic round trip | 0.25 | Fixture hash, import/export/re-import hashes, and no-PHI scan are clean and repeatable. |
  | FHIR field classification | 0.35 | Every required field difference has one allowed classification, evidence reference, and reviewer disposition; no silent loss. |
  | Clinical rendering semantics | 0.20 | `Not documented`, units, dates, medication status, allergy severity/reaction, timeline, and provenance are correct where supplied. |
  | Import/export safety boundary | 0.10 | No chart write, AI submission, SMART-owner bypass, or production write occurs. |
  | User-value reproducibility | 0.10 | All 3/3 fixture-to-round-trip tasks complete without manual repair and task times are recorded. |

- **Threshold:** `4.0/5.0`; any unexplained field loss, PHI exposure,
  nondeterminism, unsafe date/unit transformation, or side effect is an
  immediate no-go.
- **Failure handling:** Mark the field or task failed in the immutable matrix,
  retain the raw bundle and hashes in the controlled test namespace, and return
  the mapping decision for explicit classification. Do not reinterpret a FHIR
  validator pass as application fidelity. Track A may be recorded as no-go or
  extension independently; it must not block or authorize Tracks B/C.

### Step 4 — Track B Yjs collaborative draft verification

- **Verification level:** Panel verification. Required panel: collaboration
  technical owner, WebSocket service owner, clinical-safety reviewer,
  privacy/security reviewer, accessibility reviewer, and independent verifier.
- **Commands/files/evidence:**
  1. Run the frozen two-context matrix in Chromium and WebKit:
     `npm --prefix app run test:e2e:synthetic -- e2e/collaboration.e2e.spec.ts`
     and
     `npm --prefix app run test:e2e:webkit -- e2e/collaboration.e2e.spec.ts`.
     Save browser/device/network versions and raw traces under `step-04/raw/`.
  2. Run the planned authorization harness against the approved upgrade
     boundary and `step-04/auth-matrix.json`; use `jq -e` to require every row
     from the pre-registered `AUTH-A`/`AUTH-B`/`AUTH-U` matrix and exact expected
     allow/deny outcomes. Save request/response metadata with tokens and note
     content redacted, plus `authorization-result.json`.
  3. Run 10 online disjoint-edit cases and 10 offline same-field/reconnect
     cases. Verify normalized convergence, base revision/digest, actor
     attribution, `needs-review`, local/remote/merged candidates, explicit
     reviewer choice, stale-revision return to review, and no silent loss in
     `convergence.json`, `conflicts.json`, and `review-apply.json`.
  4. Inject WebSocket interruption, server-epoch restart, sign-out, expired
     session, reload, account switch, and provider failure. Verify
     `offline/reconnecting`, `server-restarted/recovery-required`, non-empty
     local content is never replaced by an empty room, transport/drain closure,
     owner cleanup, and content-bearing recovery or quarantine. Save
     `restart-recovery.json` and the separately verified artifact reference.
  5. Run keyboard-only and screen-reader/axe checks with
     `npm --prefix app run test:e2e:webkit -- e2e/accessibility.e2e.spec.ts e2e/collaboration.e2e.spec.ts`.
     Inspect focus recovery, accessible names/status, conflict/recovery
     visibility, and review actions; save `accessibility.json`.
  6. Prove the adapter’s observer and replication paths do not call the chart
     writer by recording the explicit review/apply trace in `chart-write-trace.json`;
     only the reviewed apply action may reach the existing revision-guarded
     writer. Scan captured URLs/logs for patient IDs, note text, bearer tokens,
     CRDT updates, or room enumeration and save `telemetry-redaction.txt`.
- **Required evidence:** raw two-browser traces, full authorization matrix,
  10/10 online and 10/10 offline results, conflict/restart/recovery artifacts,
  chart-write trace, accessibility report, no-PHI telemetry scan, and panel
  signatures. Recovery content must be read, parsed, scope-checked, and hash
  verified separately from its metadata receipt.
- **Custom rubric (weights sum to 1.00):**

  | Criterion | Weight | Score 5 requirement |
  | --- | ---: | --- |
  | Authorization and no-PHI boundary | 0.25 | Every matrix row has the expected result; guessed/stale IDs, wrong scopes, tokens, patient IDs, and note content are denied or absent. |
  | Convergence and conflict/restart recovery | 0.25 | 10/10 online convergence and 10/10 offline outcomes pass; same-base edits require review and restart never loses populated content. |
  | Review-only chart boundary | 0.20 | Only explicit reviewed apply reaches the revision-guarded writer; stale apply returns to review and no observer/replicator writes. |
  | Owner transition and recoverability | 0.15 | Interruption, expiry, sign-out, reload, switch, and provider failure close safely with verified content recovery or quarantine and no cross-owner read. |
  | Accessibility and status honesty | 0.10 | Keyboard, focus, screen-reader labels/status, conflict/recovery state, and review actions have no critical blocker or misleading save claim. |
  | Removal/operational evidence | 0.05 | Kill-switch/removal trace, versions, limits, raw results, and immutable hashes are complete. |

- **Threshold:** `4.5/5.0` panel score, plus zero hard-stop failures. The panel
  must reach consensus that every safety-critical criterion passes.
- **Failure handling:** Any authorization bypass, wrong-owner read, PHI
  telemetry, silent loss/overwrite, unreviewed chart write, empty-room data
  replacement, unverifiable recovery, or critical accessibility blocker is an
  immediate no-go. Stop admission, quiesce the provider, export or quarantine
  the namespace, preserve raw evidence, and rerun only after the defect and
  test disposition are reviewed. A disagreement or unknown state is
  quarantine/no-go, not a pass.

### Step 5 — Track C RxDB versus Dexie verification

- **Verification level:** Panel verification. Required panel: offline/persistence
  owner, performance/test verifier, clinical-safety reviewer, privacy/security
  reviewer, and independent metrics verifier.
- **Commands/files/evidence:**
  1. Measure Dexie first using the existing control tests and surfaces:
     `npm --prefix app test -- src/lib/offline/indexedDBQueue.test.ts src/lib/offline/syncEngine.test.ts src/lib/round/sync/roundOutbox.test.ts src/lib/round/roundCompletionSafety.test.ts`.
     Run the planned benchmark command
     `node app/scripts/benchmark-rxdb-pilot.mjs --implementation dexie --manifest <step-02-manifest> --timing-runs 30 --correctness-runs 20 --raw-out step-05/raw/dexie.json`.
     Freeze its hash before running RxDB.
  2. Run the identical command with `--implementation rxdb` and the same
     manifest, browser/device, auth state, throttling, failure matrix, and raw
     output contract. Inject network loss, auth expiry/revocation, 4xx/5xx,
     quota/storage failure, clock skew, missed events, partial acknowledgement,
     conflict, retry, and deletion-retention cases.
  3. Recalculate results with
     `node app/scripts/recalculate-rxdb-results.mjs --dexie step-05/raw/dexie.json --rxdb step-05/raw/rxdb.json --metric reconnect-to-drain-complete --required-improvement 0.20 --max-safety-regression 0.10`.
     Save raw per-run data, median/p95/sample count, formula output, and the
     independent verifier’s checksum under `step-05/metrics/`.
  4. Use `jq -e` to assert zero silent loss, zero duplicate committed
     mutations, zero owner leaks, 100% visible terminal status, intact
     completion/recovery guards, and successful recovery export for both
     implementations. Run the same round-runner/data-integrity E2E cases and
     save `correctness.json` and `recovery-content.json`.
  5. Compare dependency/license/bundle/storage/operator metrics in
     `comparison.json`; verify the candidate is not authoritative and that no
     required server/schema migration is hidden in the spike.
- **Required evidence:** frozen Dexie baseline, RxDB raw results, 30 timing and
  20 correctness samples per implementation, independent recalculation,
  zero-failure integrity matrix, recovery-content verification, owner-isolation
  results, user-value task results, and panel signatures.
- **Custom rubric (weights sum to 1.00):**

  | Criterion | Weight | Score 5 requirement |
  | --- | ---: | --- |
  | Integrity and recovery | 0.25 | Zero silent loss/duplicates, all failure injections recover visibly, and recovery content is verified. |
  | Owner isolation and completion safety | 0.20 | Zero owner leaks and completion/recovery guards match Dexie in every applicable run. |
  | Baseline metrics and reproducibility | 0.20 | Dexie is measured first; both implementations use identical frozen workload, conditions, samples, and formulas. |
| Performance decision threshold | 0.15 | **Score 5 only:** applicable p95 improves by at least 20% with no safety-critical regression over 10%. An honestly evidenced no-go/extension is a decision-record result and scores no higher than 4 for this technical criterion. |
  | User value and terminal status | 0.10 | 20/20 tasks complete with visible terminal outcome and recovery/review time is compared with Dexie. |
  | Dependency and operational cost | 0.10 | Bundle, storage, support, license, runtime, and migration consequences are complete and within registered ceilings. |

- **Threshold:** `4.5/5.0` panel score. Zero integrity, duplicate, owner,
  terminal-status, completion-guard, or recovery-content failures are hard
  requirements; the 20% p95 threshold cannot offset one.
- **Step 5 outcome distinction:** A correctly evidenced `no-go` or `extension`
  caused by missing the 20% p95 performance threshold may satisfy the
  **decision-record integrity** requirement: raw runs, frozen Dexie baseline,
  formulas, sample counts, safety-critical results, limitations, and the
  disposition are complete and independently checked. It cannot receive a
  score of **5** for the `Performance decision threshold` criterion, because
  score 5 requires the candidate to actually meet the pre-registered
  performance result with the required safety conditions. It also cannot
  authorize RxDB adoption, production use, or a dependency migration. The
  panel must record the technical outcome as `no-go` or `extension`, even if
  the overall verification score is high enough to pass the quality of the
  decision record.
- **Failure handling:** Freeze the Dexie baseline and retain all raw runs. Any
  candidate integrity/recovery/owner failure, hidden migration, or sample
  mismatch is an immediate no-go and the RxDB namespace remains quarantined.
  A missed performance threshold is recorded as no-go or extension, never as a
  justification for a broad rewrite. Recalculate after any harness correction;
  do not delete outliers or replace an inapplicable metric after observing
  results.

### Step 6 — Shared safety, privacy, and release-gate verification

- **Verification level:** Panel verification. Required panel: release owner,
  clinical-safety reviewer, privacy/security reviewer, accessibility reviewer,
  technical owners, business decision owner, and independent verifier.
- **Commands/files/evidence:**
  1. Rerun the Step 1 baseline and the release/security checks identified in the
     analysis: `npm --prefix app run lint`, `npm --prefix app run typecheck`,
     `npm --prefix app test`, `npm --prefix app run verify:lockfile`,
     `npm --prefix app run security:check-auth-config`,
     `npm --prefix app run security:check-client-bundle`,
     `npm --prefix app run security:check-bundle-reachability`,
     `npm --prefix app run audit:prod`, `npm --prefix app run build`,
     `npm --prefix app run test:e2e:synthetic -- e2e/data-integrity.e2e.spec.ts e2e/accessibility.e2e.spec.ts`,
     and `npm --prefix app run test:e2e:webkit -- e2e/accessibility.e2e.spec.ts`.
     Record command exit status, skip reason, tool versions, and hashes in
     `step-06/release-command-results.json`.
  2. Run the no-PHI validator against all raw logs, telemetry fixtures, room
     metadata, recovery receipts, and packet staging directories; save
     `no-phi-telemetry.txt`. Assert that only approved opaque IDs, counts,
     durations, statuses, queue ages, conflict counts, cleanup results, and
     error classes are present.
  3. Re-run the complete `AUTH-A`/`AUTH-B`/`AUTH-U` matrix and the exact
     tenant/team, patient, round, field, revocation, and stale-ID cases; save
     `authorization-owner-isolation.json`.
  4. Execute the kill-switch rehearsal during a network partition using the
     Step 4/5 harnesses. Verify stop-admission, read-only transition, bounded
     quiesce, verified recovery or quarantine, named purge targets, and normal
     current Dexie/chart behavior after disablement. Save
     `kill-switch-rehearsal.json` and the namespace inventory.
  5. Have the independent verifier compare every matrix claim with its raw
     command result, immutable object hash, sample count, formula, and named
     signature. Missing, skipped, or unverified evidence must be recorded as
     `no-go`, never inferred as green. Save `release-gate-honesty.json`.
- **Required evidence:** signed shared gate matrix, all release-command output,
  no-PHI scan, authorization matrix, accessibility result, kill-switch and
  current-path regression, namespace inventory, immutable evidence-store
  hashes, and the panel’s explicit pass/no-go/extension dispositions.
- **Custom rubric (weights sum to 1.00):**

  | Criterion | Weight | Score 5 requirement |
  | --- | ---: | --- |
  | Privacy and telemetry redaction | 0.20 | No PHI, payload, token, patient identifier, room content, or CRDT update appears in logs/telemetry. |
  | Authorization and owner isolation | 0.20 | All exact-scope, wrong-scope, revocation, stale-ID, and cross-owner cases have expected results. |
  | Current-path regression | 0.15 | Dexie, chart, review/apply, export, completion, and baseline release gates remain green after disablement. |
  | Accessibility and status honesty | 0.15 | Accessibility has no critical blocker and sync, recovery, conflict, and release status claims match observed state. |
  | Kill-switch and reversibility | 0.15 | Admission stops atomically, work quiesces boundedly, recovery/quarantine is verified, and only named safe state is removable. |
  | Evidence and release-gate honesty | 0.15 | Every pass is backed by raw immutable evidence, formula/sample check, reviewer signature, or is explicitly no-go/extension. |

- **Threshold:** `4.5/5.0` panel score; every critical gate and every
  release-gate honesty check must pass.
- **Failure handling:** Any PHI exposure, authorization failure, critical
  accessibility blocker, current-path regression, unverified recovery,
  kill-switch failure, or claim/evidence mismatch is an immediate shared-gate
  no-go. Stop all promotion, keep every affected namespace read-only and
  quarantined, and issue a corrected evidence object rather than editing the
  signed matrix in place. Step 7 cannot begin until the panel records a new
  disposition.

### Step 7 — Decision packets and independent decisions verification

- **Verification level:** Per-item verification for each of the four packets
  (Tracks A, B, C, and shared gates), with a single-agent completeness review
  and independent metric recalculation.
- **Commands/files/evidence:**
  1. Enumerate the four packet directories and require all fields from the
     packet contract with `jq -e`; save one validation result per packet under
     `step-07/packet-checks/`.
  2. Run `rg -n '\b(TBD|TODO|placeholder)\b' step-07/packets` and fail on any
     unresolved role/name/date/decision. Verify named accessibility,
     clinical-safety, privacy/security, technical, release, business, and
     independent-verifier signatures and timestamps.
  3. Recalculate every reported metric from retained raw results, including
     the RxDB p95 formula, sample counts, safety-critical zero counts, user
     value, operational cost, and hashes. Save `independent-recalculation.json`.
  4. Verify each packet references its own manifest, recovery artifact,
     metadata receipt, quarantine/purge list, removal rehearsal, immutable
     object URI/SHA-256, and actual timestamp. Confirm Track A’s decision is not
     used as an input or authorization for Tracks B/C and that all production
     decisions remain `NO-GO` absent a separately approved implementation.
- **Required evidence:** four packet validation files, `independent-recalculation.json`,
  cross-track independence check, signature/timestamp roster, immutable packet
  hashes, and the per-track proceed/extend/stop disposition.
- **Custom rubric (weights sum to 1.00):**

  | Criterion | Weight | Score 5 requirement |
  | --- | ---: | --- |
  | Packet completeness | 0.25 | Every required field, raw result, limitation, risk, recovery reference, removal step, and decision is present. |
  | Traceability and immutability | 0.25 | Claims trace to raw evidence, formulas, hashes, manifests, receipts, and immutable objects. |
  | Independent calculations | 0.20 | A verifier reproduces metrics and safety-critical counts from retained raw data without changing denominators. |
  | Decision independence | 0.15 | Each track has its own proceed/extend/stop decision; no pass authorizes another track or production. |
  | Named approval and release honesty | 0.15 | Required names/signatures/timestamps exist and missing or failed gates are explicitly no-go/extension. |

- **Threshold:** `4.0/5.0` for each packet and the aggregate review.
- **Failure handling:** Reject only the incomplete packet back to its track
  owner, preserve the original immutable version, and publish a superseding
  version with the failed check and correction. Do not authorize cleanup,
  implementation, or production from a packet missing a signature, raw result,
  recovery deliverable, independent calculation, or honest disposition.

### Step 8 — Cleanup, recovery verification, and quarantine verification

- **Verification level:** Panel verification. Required panel: release/operations
  owner, privacy/security recovery custodian, clinical-safety reviewer, each
  track owner, and independent cleanup verifier.
- **Commands/files/evidence:**
  1. Inventory every named fixture directory, Yjs document, IndexedDB/RxDB
     namespace, queue, export, and temporary service. Record a metadata-only
     receipt and content checksum in `step-08/receipts/`; inspect the receipt
     with `jq` to prove it contains no FHIR payload, note text, CRDT update,
     queue payload, room token, or other content.
  2. For every non-empty or uncertain state, run the planned verifier
     `node app/scripts/verify-recovery-artifact.mjs --receipt <receipt> --artifact <artifact> --owner-scope <scope> --require-content --verify-integrity`.
     It must perform an authorized read, parse the actual content, verify base
     revision/manifest and owner/document scope, recalculate the checksum, and
     record the immutable URI/hash in `recovery-verification.json`. A metadata
     receipt or checksum alone is a failure.
  3. Rehearse the shared kill-switch sequence during a partition and record
     stop-admission, read-only mode, bounded quiesce, provider/queue closure,
     recovery export, and purge/quarantine decisions in `kill-switch.json`.
     For failed export, unreadable content, uncertain emptiness, or failed
     verification, assert a named read-only quarantine with finite retention,
     owner, disposition, and next review date in `quarantine.json`.
  4. Purge only explicitly named confirmed-empty or fully recovered pilot
     namespaces. Verify no broad IndexedDB deletion with the cleanup command
     log and a before/after namespace inventory; preserve Dexie, chart data,
     approved recovery exports, and uncertain/quarantined state.
  5. After cleanup, rerun the synthetic data-integrity/accessibility checks and
     owner-isolation cases, then prove no pilot admission, no active provider,
     no cross-owner visibility, and normal current Dexie/chart behavior. Save
     `post-cleanup-control-path.json` and the signed purge/quarantine list.
- **Required evidence:** one metadata receipt per state, separately verified
  content-bearing recovery artifact for every non-empty/uncertain state,
  `recovery-verification.json`, kill-switch and quarantine results, explicit
  purge list, before/after inventory, post-cleanup control-path results,
  immutable hashes, retention owner/review dates, and panel signatures.
- **Custom rubric (weights sum to 1.00):**

  | Criterion | Weight | Score 5 requirement |
  | --- | ---: | --- |
  | Recovery content verification | 0.25 | Every non-empty/uncertain state has readable, complete, owner-scoped, content-bearing recovery verified independently from its receipt. |
  | Purge safety and scope | 0.20 | Only named closed safe targets are purged; Dexie, chart data, approved exports, and uncertain state are preserved. |
  | Kill-switch and quarantine | 0.20 | Admission stops, work quiesces, failed/uncertain recovery becomes read-only finite quarantine, and no indefinite retry occurs. |
  | Post-cleanup isolation and control path | 0.20 | No active provider/admission/cross-owner visibility remains and normal current Dexie/chart behavior passes. |
  | Retention and auditability | 0.15 | Receipts, artifacts, hashes, inventory, disposition, owner, next review date, and immutable references are complete. |

- **Threshold:** `4.5/5.0` panel score, with unanimous approval for every
  purge target and zero unverified non-empty state.
- **Failure handling:** If any content-bearing artifact cannot be read, parsed,
  scope-checked, or hash-verified, cancel that purge, retain the exact named
  namespace read-only in quarantine, and record a finite retention deadline,
  owner, disposition, and next review date. If a purge exceeds its named scope,
  touches Dexie/chart data, or bypasses the kill switch, treat it as a critical
  incident and fail the cleanup gate. Cleanup is not complete until the panel
  signs the post-cleanup control-path evidence.

## Verification Summary

| Step | Verification focus | Level | Weighted threshold | Required hard-stop conditions | Handoff evidence |
| --- | --- | --- | ---: | --- | --- |
| 1. Setup/isolation | Baseline, flags, identities, namespaces, no source/dependency changes | Single-agent | 4.0/5.0 | Production target, credential leak, flags on, unexplained baseline skip, or source-boundary diff | `step-01/baseline-regression.txt`, `source-boundary.txt`, manifest/hash, signed Step 2 handoff |
| 2. Fixture baseline | Determinism, no PHI/secrets, required counts, reset | Per-item | 4.0/5.0 | PHI-like content, secret/production endpoint, nondeterminism, or invalid reset | `step-02/manifest.json`, `determinism.json`, `no-phi-scan.txt`, counts/reset hashes |
| 3. Synthea/FHIR | Round-trip fidelity, 20+ field classifications, missing-data rendering, no side effects | Per-item | 4.0/5.0 | Unexplained field loss, unsafe date/unit transform, PHI, nondeterminism, chart/AI/production write | `step-03/field-comparison.csv`, raw hashes, render/side-effect checks, 3/3 tasks |
| 4. Yjs collaboration | Authorization matrix, convergence/conflict/restart, review-only apply, recovery, accessibility | Panel | 4.5/5.0 | Auth bypass, wrong-owner read, silent loss, unreviewed write, empty-room replacement, unverifiable recovery, critical accessibility blocker | `step-04/auth-matrix.json`, 10/10 results, recovery artifact verification, chart trace, accessibility report, panel signatures |
| 5. RxDB vs Dexie | Baseline-first metrics, integrity/recovery, owner isolation, terminal status, 20% p95 rule | Panel | 4.5/5.0 | Integrity/duplicate/owner/recovery/terminal-status failure, sample mismatch, hidden migration; p95 miss is no-go/extension | `step-05/raw/`, independent metrics, correctness/recovery results, comparison, panel signatures |
| 6. Shared gates | No PHI, authorization, accessibility, current-path regression, kill switch, release-gate honesty | Panel | 4.5/5.0 | Any privacy/auth/accessibility/current-path/kill-switch failure or claim/evidence mismatch | Signed gate matrix, command results, no-PHI scan, auth matrix, kill-switch rehearsal, honesty check |
| 7. Decision packets | Completeness, traceability, independent calculations, independent decisions, signatures | Per-item + single-agent | 4.0/5.0 | Missing raw evidence, signature, recovery deliverable, calculation, immutable hash, or honest disposition | Four packet checks, recalculation, cross-track independence, signed packets |
| 8. Cleanup/quarantine | Content-bearing recovery, named purge, kill-switch quarantine, post-cleanup controls | Panel | 4.5/5.0 | Unverified recovery, broad/over-scoped purge, bypassed kill switch, unresolved state not quarantined | Receipts plus verified artifacts, inventory, purge/quarantine list, post-cleanup checks, panel signatures |

## Safe-checkpoint remediation record (2026-08-22)

The task remains `in-progress` with explicit `BLOCKED-PREFLIGHT` and `NO-GO
FOR PRODUCTION` semantics. The missing-artifact inventory, pinned-input and
ownership handoff, baseline command ledger, and artifact schemas are recorded
under `.specs/evidence/third-party-enhancements/`. The implementation process
is planning text only; no Step 2–8 artifact is promoted from a template to an
execution result. Historical command timestamps/statuses that were not
captured remain `NOT RECORDED`, and the pre-existing lockfile failure remains
an open blocker.

The overall verification result is **NO-GO** unless every applicable step meets
its threshold and every hard-stop condition is clear. A failed or missing
criterion is recorded as `no-go` or `extension`, never silently omitted. A
successful Track A, B, or C result authorizes only its own separately approved
next action; it does not authorize production rollout, PHI, a production
replication service, a Supabase migration, or a broad dependency change.
