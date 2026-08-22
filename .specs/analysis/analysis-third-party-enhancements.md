# Codebase analysis: third-party enhancements

## Scope and current baseline

The draft task is three separate, bounded pilots:

1. Synthea-generated, deterministic synthetic fixtures with FHIR import/export round-trip checks.
2. Authenticated, explicitly selected collaborative note editing using the existing Yjs foundation.
3. An RxDB spike for one patient-rounding workflow, compared with the current Dexie/IndexedDB implementation.

The task explicitly preserves Supabase, the current patient model and FHIR integration, the review-only AI boundary, PHI protections, auditability, and existing release gates. No application source or task-file changes are part of this analysis.

Important current-state distinction: Yjs and `y-indexeddb` are already dependencies, but there is no provider transport or authenticated room implementation. RxDB is not a dependency. The repository contains historical RxDB-compatible SQL, but that is not an existing RxDB client pilot.

## Enhancement 1 — Synthea fixtures and FHIR round trip

### Existing surfaces to reuse

| Surface | Exact file(s) / module(s) | Impact |
| --- | --- | --- |
| Patient domain shape and persistence | `app/src/types/patient.ts`, `app/src/services/patientService.ts`, `app/src/hooks/patients/*` | Fixture output must map to the actual `Patient` shape and owner-scoped create/read/update paths; do not introduce a parallel patient model. |
| FHIR object model and local bundle conversion | `app/src/lib/fhir.ts` (`patientToFHIR`, `fhirToPatient`, `downloadFHIRBundle`, `importFHIRBundle`) | Primary round-trip target. Current conversion covers Patient, selected Observations, and MedicationRequest; it does not currently preserve all requested timeline/lab/vital/allergy semantics. |
| SMART/EHR import | `app/src/integrations/fhir/client.ts`, `app/src/integrations/fhir/mapper.ts`, `app/src/integrations/fhir/index.ts`, `app/src/components/fhir/EHRImportButton.tsx`, `app/src/pages/FHIRCallbackFlow.tsx` | Keep external SMART authorization and test fixtures separate. Synthea should exercise local/import/export paths without replacing SMART flow. |
| Existing FHIR tests | `app/src/integrations/fhir/client.test.ts`, `app/src/integrations/fhir/mapper.test.ts` | Add a new `app/src/lib/fhir.test.ts` if the local bundle conversion is made the round-trip unit boundary; it does not currently exist. |
| Existing synthetic E2E account | `app/e2e/fixture-state.ts`, `app/e2e/global-setup.ts`, `app/e2e/global-teardown.ts`, `app/e2e/production-save-canary.spec.ts`, `app/e2e/README.md` | Reuse the owner-scoped reset model, but do not make generated Synthea data depend on a live production-like account unless the command is explicitly gated. |
| Existing synthetic AI verification | `app/scripts/verify-ai-functions-live.mjs` | Existing non-PHI synthetic payload convention; useful privacy boundary and naming pattern, not a replacement for Synthea fixtures. |
| Import safety and patient fixtures | `app/src/lib/documentImportSafety.ts`, `app/src/hooks/patients/__tests__/usePatientImport.test.ts` | Fixture import must go through the same validation/sanitization boundary as user imports. |

### Likely new files

- `app/scripts/generate-synthea-fixtures.mjs` (or a checked-in, deterministic generator wrapper): fixed seed, version/options recorded, output directory explicitly non-production, no real identifiers.
- `app/scripts/validate-synthea-fixtures.mjs`: schema/PHI scan, required-resource assertions, deterministic hash/manifest check.
- `app/test/fixtures/synthea/manifest.json` plus generated FHIR Bundle/NDJSON fixtures, or an equivalent ignored/generated fixture directory. The repository convention should decide whether generated artifacts are checked in; large upstream Synthea output should not be committed casually.
- `app/src/lib/fhir.test.ts` or `app/src/lib/fhir-fixtures.test.ts`: new import → domain → export → import assertions for identity, labs, vitals, medications, allergies, and timeline data; neither file currently exists.
- Possibly `app/scripts/check-no-phi-fixtures.mjs` if the existing fixture validator cannot prove the task's no-PHI criterion.
- Documentation under `app/docs/testing/` or `app/docs/clinical-data-flow.md` describing generator version, seed, license, fixture refresh, and no-PHI guarantees.

### Exact gaps and risks

- `app/src/lib/fhir.ts` currently emits only a subset of the domain into FHIR and maps only selected observations/medications back. Allergies, vitals beyond the current status fields, and timeline events need an explicit mapping decision rather than silently being dropped.
- Synthea's full output contains many resources and may contain generated identifiers that look realistic. The validator must reject PHI-like or non-deterministic output and must not use production data.
- FHIR export is a download surface (`downloadFHIRBundle`) and therefore belongs in export/audit verification; generated fixture output must not accidentally flow into a live export or chart insertion path.
- FHIR SMART state is token-bearing and owner-bound. Fixture tests must not bypass or weaken `reconcileFHIRStateForAuthOwner` / `assertFHIRLaunchOwner`.

### Tests and gates

- Unit: fixture determinism/hash, no-PHI scan, FHIR resource validation, field-level round trip, unsupported-resource behavior, malformed bundle failure.
- Integration: fixture import through the patient import path and export through `patientToFHIR`/download serialization; assert no automatic chart insertion and no AI submission.
- E2E: a dedicated synthetic Chromium project (`npm run test:e2e:synthetic`) may consume a generated fixture, but it must remain owner-scoped and reset by `fixture-state.ts`.
- Release gate additions likely belong in `app/package.json` scripts and CI: generation/validation before tests, fixture-size/bundle checks, and a fail-closed no-PHI check.

## Enhancement 2 — authenticated Yjs collaborative note surface

### Existing Yjs and collaboration surfaces

| Surface | Exact file(s) / module(s) | Current behavior / required change |
| --- | --- | --- |
| Yjs document/store | `app/src/collab/patient.store.ts` | `syncedStore` holds `notes` and `cursors`; keys are `${patientId}:${system}`. Add a privacy-safe room/document identity layer and selected-note scope rather than sharing the whole patient. |
| React collaboration context | `app/src/collab/CollaborationProvider.tsx`, `app/src/collab/hooks.ts`, `app/src/collab/index.ts` | Creates a random local user and a local `Y.Doc`; `isConnected` becomes true without a network connection. `roomPrefix` is currently unused for transport. This is the main prototype seam and must not be presented as two-session collaboration until replaced/wrapped. |
| Presence UI/types | `app/src/components/CollaborationPresence.tsx`, `app/src/components/PresenceIndicator.tsx`, `app/src/types/collaboration.ts`, `app/src/hooks/usePresence.ts`, `app/src/hooks/usePresence.test.tsx` | Existing presence UI and a deliberately disabled public Realtime adapter exist. Reconcile the two paths; do not open public Supabase Realtime channels. Presence must be authenticated, ephemeral, and avoid patient text/PHI in payloads. |
| Workspace provider boundary | `app/src/components/AuthenticatedAppProviders.tsx`, `app/src/App.tsx` | `CollaborationProvider` is not currently in the authenticated provider tree. Any integration belongs below the resolved auth boundary and should be lazy/feature-gated to protect public bundle budgets. |
| Note/editor surfaces | `app/src/components/RichTextEditor.tsx`, `app/src/components/ImagePasteEditor.tsx`, `app/src/components/round/PatientFocus.tsx`, `app/src/components/round/DesktopRoundShell.tsx`, `app/src/components/round/MobileRoundShell.tsx`, `app/src/components/round/FieldConflictDialog.tsx` | Select one note surface/field and define how Yjs content is converted to the existing chart field. Avoid replacing the revision-guarded normal patient writer globally. |
| Existing offline CRDT cleanup | `app/src/lib/auth/clearSensitiveClientState.ts` (`clearCrdtDatabases`) and `app/src/lib/auth/clearSensitiveClientState.test.ts` | Deletes IndexedDB databases whose names start with `crdt-` during owner changes/sign-out. New Yjs persistence names must remain discoverable by this contract or the cleanup must be made explicit and tested. |
| Auth/offline transition barriers | `app/src/lib/offline/ownerTransitionBarrier.ts`, `app/src/lib/offline/syncAuthTransitionGate.ts`, `app/src/lib/auth/clearSensitiveClientState.ts` | Provider disconnect, persistence flush, and room teardown must occur inside the existing identity transition safety model. |
| Activity/audit UI/API | `app/src/hooks/usePatientActivity.ts`, `app/src/components/patient/ActivityFeed.tsx`, `app/src/hooks/__tests__/usePatientActivity.test.tsx`, `app/src/components/patient/ActivityFeed.test.tsx` | Current actions are `created`, `updated`, `assigned`, `exported`, `ai_used`; summaries are intended to contain no PHI. Add attributable collaboration events without storing note bodies or unsafe room IDs. |

### Likely new files

- `app/src/collab/authenticatedProvider.ts` (or equivalent): obtains the current Supabase session, authenticates the collaboration transport, derives an opaque room ID, and rejects unauthenticated/unauthorized access.
- `app/src/collab/roomAuthorization.ts` plus unit tests: allowlist selected note scope, validate patient ownership/team access, and keep patient IDs out of externally visible room names/logs (use a server-issued opaque identifier or keyed digest).
- `app/src/collab/persistence.ts` plus tests: `y-indexeddb` lifecycle, namespaced database/store, quota/error recovery, owner purge, and offline reload behavior.
- `app/src/collab/audit.ts` plus tests: metadata-only collaboration event records (actor, opaque document, event type, timestamp/version), never Yjs update payloads or note text.
- A bounded UI component such as `app/src/components/collab/CollaborativeNoteSurface.tsx` and `CollaborationPresence.test.tsx`, integrated into exactly one selected note field.
- A server transport/edge service if `y-websocket` is used. This is likely outside the current Vite/Supabase Edge Function set and needs its own deployment, auth handshake, connection limits, and log-redaction files. Do not assume an Edge Function can hold a WebSocket lifecycle without checking the deployment runtime.

### Migration/API impact

- No database migration is needed merely for local Yjs persistence.
- A migration is likely if collaboration authorization or metadata is persisted: a dedicated table/RPC with owner/team RLS, metadata-only columns, retention policy, and no raw Yjs update column. Extending `patient_activity` would require updating `20260328000000_create_patient_activity.sql` (prefer a new forward migration, not editing history) and its action constraint/tests.
- Existing patient writes use `app/src/lib/round/sync/roundRemote.ts`, revision/field timestamps, and `app/supabase/migrations/20260711210000_add_atomic_patient_json_patch.sql` / `20260811000000_add_patient_optimistic_revision.sql`. Collaboration acknowledgement must not silently bypass these guards. Define the explicit “review then chart insertion” commit boundary.

### Tests and risks

- Unit: room derivation contains no raw patient/PHI; unauthorized/anonymous access fails; auth transition purges CRDT stores; local Yjs merge is deterministic; invalid/oversize updates are rejected; audit metadata is PHI-safe.
- Integration: two authorized sessions edit the selected surface, receive presence, make concurrent edits, go offline, reload, reconnect, and produce explicit conflict/review behavior. Assert one user's room cannot observe another user's document.
- E2E: add a credentialed two-context Playwright spec, likely alongside `app/e2e/data-integrity.e2e.spec.ts` or a new `collaboration.e2e.spec.ts`; cover Chromium and WebKit, offline reload, reconnect, sign-out/user switch, and export/review before chart commit.
- Security: update `app/src/contexts/TeamAccessControl.test.ts`, `app/src/lib/deploymentSecurity.test.ts`, `app/scripts/assert-edge-verify-jwt-config.mjs` only if a new edge handler is introduced, and `app/scripts/assert-client-secret-not-bundled.mjs` / logging checks as applicable.
- Main risks are false connection status in the current provider, room-ID leakage, stale CRDT data crossing auth identities, WebSocket deployment mismatch, unbounded document growth, and accidental automatic chart insertion.

## Enhancement 3 — bounded RxDB offline-sync spike

### Existing offline baseline to measure against

| Surface | Exact file(s) / module(s) | Measurement/compatibility target |
| --- | --- | --- |
| Dexie schema/owner isolation | `app/src/lib/offline/database.ts` (`RoundRobinNotesDB`, versions 2–6, `transitionDatabaseOwner`, `clearAllTables`) | Baseline startup, schema-open, storage size, owner purge, and migration behavior. A new RxDB database must match owner isolation and sign-out guarantees. |
| Generic mutation queue | `app/src/lib/offline/indexedDBQueue.ts` and tests `indexedDBQueue.test.ts` | Baseline enqueue/coalescing/retry/conflict/storage-failure behavior. |
| Sync engine | `app/src/lib/offline/syncEngine.ts`, `syncEngine.test.ts`, `queueSignature.ts` | Baseline reconnect drain, retry, telemetry, and auth pause/resume. |
| Round-specific outbox | `app/src/lib/round/sync/roundOutbox.ts`, `outboxMerge.ts`, `roundOutbox.test.ts`, `outboxMerge.test.ts`, `roundSyncEngine.ts`, `roundSyncEngine.test.ts`, `roundRemote.ts`, `types.ts` | Best bounded pilot candidate: one patient-rounding workflow, particularly `draft_field` plus status/conflict recovery. |
| Offline UX/completion guard | `app/src/components/offline/OfflineSyncIndicator.tsx`, `app/src/components/OfflineIndicator.tsx`, `app/src/lib/round/roundCompletionSafety.ts`, `roundCompletionSafety.test.ts`, `syncPresentation.ts`, `syncPresentation.test.ts` | RxDB must expose equivalent pending/syncing/failed/conflict/offline states and preserve completion blocking/recovery export. |
| Offline E2E baseline | `app/e2e/round-runner.e2e.spec.ts`, `app/e2e/data-integrity.e2e.spec.ts`, `app/e2e/round-no-self-conflict.e2e.spec.ts`, `app/e2e/round-lifecycle.e2e.spec.ts`, `app/e2e/README.md` | Compare identical scenarios and request counts against Dexie; do not declare improvement from microbenchmarks alone. |

### Existing RxDB-related database surface

- `app/supabase/migrations/20240101000000_add_rxdb_replication_fields.sql` defines `_modified`, `_deleted`, indexes, a timestamp trigger, and owner RLS for a historical/forward-compatible replication shape. It predates `patients`; `app/scripts/verify-supabase-migration-order.mjs` explicitly protects this ordering and the later catch-up migration `20260711000000_replay_deferred_schema_hardening.sql`.
- `app/supabase/manual/2026-08-11-migration-history-repair.sql` records the historical RxDB migration. Treat this as compatibility history, not permission to change replication semantics.
- No RxDB package, replication client, schema, collection, or benchmark currently exists in `app/src` or `app/scripts`.

### Likely new files and migrations

- `app/src/lib/rxdb-pilot/` with a schema, database factory, owner-scoped collection, adapter to one selected round workflow, and an explicit feature flag; likely files `database.ts`, `schema.ts`, `adapter.ts`, `metrics.ts` and tests.
- `app/scripts/benchmark-rxdb-pilot.mjs` (or a TypeScript test runner): records startup/open, read/write latency, offline mutation recovery, reconnect drain, conflict handling, quota/storage limits, and injected failure recovery for both RxDB and the current Dexie path.
- `app/src/lib/rxdb-pilot/rollback.ts` and documentation under `app/docs/` describing the go/no-go decision, dual-run boundaries, data discard/rollback, and the condition for adoption.
- `app/package.json` and `app/package-lock.json` only if the spike actually adopts RxDB; pin the version and update lockfile reproducibility/security checks. Do not add it just to plan the spike.
- A new Supabase migration is not required for a client-only comparison if the pilot uses the existing patient/round RPC contract. It becomes required for RxDB replication metadata/endpoint changes, tombstone/clock semantics, or server-side conflict records. If required, add a forward migration after the current schema, update `verify-supabase-migration-order.mjs`, types, RLS tests, and deployment verification.

### Tests and risks

- Unit/benchmark: compare cold/warm startup, read/write, batch and storage behavior with fixed fixture sizes; include quota errors and corrupt/local database recovery.
- Integration: exact same owner, auth transition, queue replay, stale revision, conflict choice, and reconnect cases as Dexie. Record p50/p95 and correctness outcomes, not just speed.
- E2E: keep the existing Dexie path as control; run the pilot behind a flag in the same round-runner/data-integrity matrix and prove no change to completion guards, review/export recovery, or auth boundaries.
- Risks: RxDB's replication protocol could conflict with the existing revision-guarded RPCs; `_modified`/`_deleted` may be insufficient for the current conflict model; two IndexedDB databases can double PHI storage and complicate sign-out; package size and optional dependencies can violate bundle/security gates; a spike can accidentally become a second source of truth.

## Cross-cutting activity, export, auth, and clinical safety surfaces

- Activity/audit: `app/src/hooks/usePatientActivity.ts`, `app/src/components/patient/ActivityFeed.tsx`, migration `20260328000000_create_patient_activity.sql`, and telemetry schema/events in `app/supabase/functions/_shared/telemetry-schema.ts`. Existing activity summaries are metadata-only by contract; collaboration and offline events must preserve that property and must not log note text, FHIR payloads, Yjs updates, room IDs, or patient identifiers where logs are not protected.
- Export/review: `app/src/components/PrintExportModal.tsx`, `PrintExportModalFull.tsx`, `app/src/components/print/ExportHandlers.ts`, `app/src/components/round/roundPrintExportLoader.ts`, `app/src/lib/print/roundsWordExport.ts`, `app/src/lib/exportPendingRecovery.ts`, `app/src/lib/exportRoundRecovery.ts`, `app/src/lib/fhir.ts`, and `app/e2e/auth-dashboard.spec.ts`. New collaborative/offline content must remain reviewable before chart insertion/export, retain the existing recovery-export safeguards, and keep deferred export chunks offline-safe.
- Auth and sensitive state: `app/src/hooks/useAuth.tsx`, `app/src/lib/auth/clearSensitiveClientState.ts`, `clearSensitiveClientState.test.ts`, `app/src/lib/offline/ownerTransitionBarrier.ts`, `syncAuthTransitionGate.ts`, `app/src/integrations/fhir/client.ts`, and `app/src/integrations/supabase/client.ts`. Any new local DB, CRDT store, room token, or replication worker must be paused/closed/purged at the existing owner transition boundary.
- Review-only AI: `app/src/components/AIClinicalAssistant.tsx`, `AIGeneratorTools.tsx`, `AITextTools.tsx`, `UnifiedAIChatbot.tsx`, edge shared LLM sanitization, and `app/scripts/verify-ai-functions-live.mjs`. These enhancements must not turn collaborative drafts or generated fixture data into automatic chart writes or send PHI to third parties.
- Clinical data flow and security documentation: `app/docs/clinical-data-flow.md`, `app/docs/security/2026-08-11-optional-dependency-risk-acceptance.md`, `app/src/pages/Privacy.tsx`, and `app/src/pages/Security.tsx` need updates if third-party processing, local persistence, retention, or transport changes.

## Release gates affected

The existing release contract is documented in `app/docs/release/2026-08-12-signoff-packet.md`, `app/docs/release/2026-08-11-release-hold-phase0.md`, `app/docs/plans/2026-08-11-clinical-production-readiness-plan.md`, and `app/docs/qa/2026-08-12-data-integrity-matrix.md`. The enhancements affect these gates:

1. `npm run lint`, `npm run typecheck`, `npm test`, and `npm run verify:lockfile` for new modules, fixtures, package changes, and test loaders.
2. `npm run verify:migrations`, `npm run edge:check-jwt-config`, `npm run edge:verify`, and deployment migration replay if any collaboration/RxDB server contract is added. Never edit historical migrations; add forward migrations and update ordering assertions.
3. `npm run security:check-auth-config`, `security:check-client-bundle`, `security:check-bundle-reachability`, and `npm run audit:prod`; third-party licenses, transitive dependencies, WebSocket/auth credentials, optional native dependencies, and bundle budgets need review.
4. `npm run build`, bundle-size checks, and production preview E2E. Yjs/RxDB code should remain behind authenticated/lazy boundaries where possible; generated fixture data must not ship in the public bundle.
5. `npm run test:e2e:synthetic`, credentialed Chromium/WebKit authenticated suites, and a new two-session collaboration/pilot matrix. Existing `app/e2e/no-skipped-reporter.ts` and fixture reset behavior must remain fail-closed.
6. Data-integrity gates: offline reload, reconnect, queue recovery, explicit conflicts, owner switching, sign-out, storage/quota failure, recovery export, completion blocking, and exact database/rendered-state comparison. The current Dexie path remains the control for RxDB.
7. Human clinical/privacy/security gates: no real patient data in fixtures/demos/dev, no unreviewed chart insertion, no PHI in logs/room identifiers/third-party telemetry, license approval, two-user authorization review, real-device/WebKit/offline review, rollback rehearsal, and updated release/sign-off evidence. The current sign-off packet remains NO-GO until its human gates close; these pilots must not be treated as closing them automatically.

## Recommended decomposition and sequencing

1. Lock current behavior with/extend fixture, FHIR, offline, auth-transition, activity, export, and release-contract tests.
2. Land Synthea generation/validation first because it supplies deterministic, no-PHI inputs for the other pilots and FHIR round-trip tests.
3. Prototype Yjs only for one selected note surface with authenticated room authorization, local persistence cleanup, two-session tests, and an explicit review-to-chart boundary.
4. Build the RxDB measurement harness against the same synthetic fixture and identical Dexie scenarios. Make the go/no-go document a deliverable, not an implicit migration.
5. Run the complete release gates and human sign-offs before any production rollout. Likely new files are listed above; no existing application source or task file should be modified during this analysis phase.

## Highest-risk decisions requiring explicit planning

- Which exact note field is collaborative, and how a Yjs document is reviewed/committed through the existing revision-guarded patient writer.
- Which authenticated service can host Yjs WebSockets and how it validates Supabase identity without leaking room/patient information.
- Whether collaboration audit metadata belongs in `patient_activity` or a dedicated RLS-protected table with retention controls.
- Whether RxDB is measurement-only, dual-run, or allowed to write; it must not become a second source of truth before evidence and rollback are documented.
- Which Synthea resources map to existing fields and which are intentionally reported as unsupported/`Not documented`; silent data loss would invalidate round-trip acceptance.
