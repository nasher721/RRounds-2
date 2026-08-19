# Release Sign-off Packet — 2026-08-12

Last engineering update: 2026-08-13

Plan: `docs/plans/2026-08-11-clinical-production-readiness-plan.md`
Status: **NO-GO for clinical production** until the human gates in section 4
close. All engineering-controlled items are complete and evidenced below.

## 1. Exact deployed artifacts

| Item | Value |
| --- | --- |
| Repo SHA | The release SHA is the `main` commit attached to the latest successful `Deploy Supabase` workflow. Never copy an older hard-coded SHA into a new sign-off. |
| CI run | Attach the successful `CI` workflow URL for that exact SHA. The main-branch browser jobs must report 32/32 Chromium and 32/32 WebKit with zero skips. |
| Supabase deploy workflow | Attach the successful `Deploy Supabase` workflow URL for the same SHA. It revalidates `main`, deploys migrations/functions, verifies health/telemetry, invokes Vercel, and probes the canonical origin. |
| Frontend production deploy | Read the canonical origin's `<meta name="app-version">`; it must equal `1.0.0+<short release SHA>`. This live value, not a stale packet entry, is authoritative. |
| Supabase project | `zsavxqvnseqxusfwdovu` (RollingRounds) |
| Latest migration versions in prod | through `20260813030000_guard_round_lifecycle_generations`; history repaired per `supabase/manual/2026-08-11-migration-history-repair.sql` plus 18 placeholder files for out-of-band versions |

## 2. Evidence index

- **Phase 0 release-hold assessment:** `docs/release/2026-08-11-release-hold-phase0.md`
  (proved the live frontend predated `revision`; prevented a split-brain deploy)
- **Backend verification (Phase 2):** same document — `patients.revision`
  column + `bump_patient_revision` trigger present; stale-revision write
  matched 0 rows; matching write bumped revision exactly once; RLS enabled on
  all 17 clinical tables; healthcheck returns `{"status":"healthy"}`.
- **Data-integrity matrix (Phase 3):** `docs/qa/2026-08-12-data-integrity-matrix.md`
  — automated multi-tab-conflict and offline-queue-recovery scenarios pass;
  manual matrix defined for WebKit/real-device/failure-injection evidence.
  Includes the offline/conflict defects found and fixed on 2026-08-12/13.
- **Recovery-first queue deletion:** the shared Offline indicator is available
  at every dashboard breakpoint. Discard remains disabled until the exact
  current queue is downloaded as PHI-marked JSON; queued-content changes
  propagate across same-origin tabs without PHI payloads and invalidate that
  confirmation. Deletion atomically compares the exported signature inside the
  owner-scoped IndexedDB transaction, so a delayed cross-tab notification still
  preserves every newer mutation and requires a fresh recovery copy. Cancel
  leaves pending work intact. The
  artifact is for authorized support/manual recovery rather than automatic
  re-import. Authenticated Chromium and WebKit exercise the full boundary.
- **Accessibility/responsive (Phase 4):** automated browser coverage now
  verifies keyboard skip navigation, roster focus restoration, roving mobile
  tabs, live `aria-controls` targets, 44px primary Round targets at 390px,
  public auth layout at 320px and 200% text scaling, reduced-motion preference,
  dark-theme activation, and horizontal-overflow prevention. Device and
  screen-reader passes remain human gates.
- **Flash-free page theme and aligned installed-app metadata:** a synchronous,
  self-hosted first-paint
  bootstrap applies a validated saved/system preference before content renders,
  and keeps browser chrome aligned with the light and dark design tokens. The
  installed-app manifest now declares the canonical app identity, medical and
  productivity categories, language/direction, and the current brand palette;
  the bootstrap is precached for offline launches. Production-preview Chromium
  and WebKit verify dark, system, and explicit-light startup, including the
  first animation frame.
- **Security/dependency (Phase 5.3):** risk acceptance
  `docs/security/2026-08-11-optional-dependency-risk-acceptance.md`
  (expires 2026-11-12); SBOM `docs/security/sbom-2026-08-12.cyclonedx.json`;
  bundle reachability assertion wired into CI
  (`scripts/assert-no-optional-native-in-bundle.mjs`).
- **Bundle budgets (Phase 6):** local release candidate total initial
  JavaScript is 616,452 bytes, down from 937,658 (34%). The public shell now
  defers the authenticated provider/state graph, Landing and workspace routes
  are separate chunks, and the EHR callback keeps only a small eager recovery
  shell. Login validation no longer ships the general-purpose Zod runtime for
  two fields. The application entry is 233,338 bytes with stable React (139,836)
  and Supabase (208,548) runtime chunks. CI now enforces 300,000-byte entry,
  750,000-byte total-initial, 160,000-byte React, and 230,000-byte Supabase
  ceilings in `scripts/check-bundle-size.mjs`. Device-specific shells,
  print/export, charts, and AI tools load on demand. Spreadsheet and Word
  parsers load only after a matching file is selected, reducing the normal
  authenticated shared chunk from 1,285,010 to 301,584 bytes; CI separately
  budgets the deferred parser chunks. Excel, vector-PDF,
  table-PDF, and HTML-PDF engines now load only after the corresponding export
  action, reducing the print/export modal from 1,393,480 to 228,852 bytes
  (84%); CI separately budgets every deferred export engine.
- **Launch branding:** browser, Apple touch, and 192/512 PWA icons now use a
  compact Rolling Rounds mark instead of the generic scaffold favicon. The
  auth/loading shell uses the 55 KB icon rather than shrinking and downloading
  the 277 KB full wordmark; compact landing and workspace placements now reuse
  that same mark, and the unreferenced wordmark has been removed. A source
  contract verifies every icon path and PNG dimension, and browser review
  passed on the production build. The obsolete
  1 MB intro video, gradient favicon, placeholder SVG, and unused poster were
  removed from the shipped `public/` payload, reducing the built deployment
  from approximately 7.6 MB to 6.5 MB.
- **Provisioned-access funnel:** production landing CTAs now say `Sign in`
  instead of implying self-service account creation, the secondary action
  scrolls to product detail instead of duplicating the login action, and the
  developer-only contact configuration hint is hidden from production. The
  public Chromium/WebKit suite asserts the copy, interaction, and absence of
  configuration instructions.
- **Public metadata:** production builds inject one explicit HTTPS canonical
  origin across canonical, Open Graph, and social-image metadata. The build
  fails closed if those URLs are absent or diverge, the public browser suite
  verifies the rendered tags, and the unverified scaffold social handle was
  removed. CI maps the required `PRODUCTION_APP_URL` to
  `VITE_PUBLIC_APP_URL`; missing, placeholder, private, credential-bearing, or
  non-origin values block production builds. Post-deploy verification checks
  the exact release SHA, matching canonical origin, and public machine-readable
  index before the deploy job can pass. Route-aware
  metadata keeps the public landing page and Security page independently
  canonical and indexable while marking authenticated, callback, unknown, and
  placeholder Privacy surfaces `noindex`. The landing page publishes a factual
  `SoftwareApplication` JSON-LD record, and the build emits origin-correct
  `robots.txt` and `sitemap.xml` assets that list only approved public surfaces.
  The package, lockfiles, release version, and CycloneDX root component now use
  the `rolling-rounds@1.0.0` production identity instead of the Vite scaffold.
  An origin-correct `llms.txt` index describes only the approved public product,
  Security, and operator privacy pages; the authenticated workspace and patient
  routes remain intentionally undisclosed.
- **Fail-closed launch contact:** the logged-out conversion path no longer
  falls back to the unconfigured `hello@rollingrounds.app` address. Production
  builds require a syntactically valid, non-example `VITE_CONTACT_EMAIL`; CI
  obtains it from the required `PRODUCTION_CONTACT_EMAIL` repository variable,
  and the browser suite verifies the rendered `mailto:` destination. Vercel
  must use the same public operator address.
- **Fail-closed privacy destination:** public builds require a real HTTPS URL
  for the deployment operator's reviewed privacy notice. Footer and AI
  transparency links use that destination; reserved/example hosts, embedded
  credentials, fragments, and the in-app development placeholder are rejected.
  CI receives the URL from `PRODUCTION_PRIVACY_NOTICE_URL`, and Vercel must use
  the same value as `VITE_PRIVACY_NOTICE_URL`.
- **PHI-safe launch funnel:** the public page now emits a fixed event vocabulary
  for landing view and sign-in, feature, security, pricing/contact, email, and
  workspace intent. Events contain no dynamic page, account, contact, or
  patient content. Production now requires hosted Sentry or an approved
  same-origin/Supabase collector. The repository now ships that first-party
  Supabase option with distributed rate limiting, fixed-schema validation,
  service-role-only scalar storage, and enforced 30-day retention. The Sentry
  bridge preserves only fixed tags and bounded measurements; custom collector
  delivery remains serialized and bounded. Deploy and hourly workflows verify
  first-party receipt; approval and alert rules remain deployment gates.
- **PHI-safe sign-in outcomes:** password sign-in success and fixed failure
  categories, plus OAuth redirect/error outcomes, emit bounded count and
  duration metrics. The telemetry API accepts no email, credential, account
  identifier, redirect URL, or provider message, so the launch funnel can be
  measured through authentication without widening the data boundary.
- **Single clinical-AI trust boundary:** every clinical completion, document
  import, medication formatter, and dictation request now traverses an
  authenticated Supabase Edge Function. The browser no longer accepts vendor
  API keys, connects directly to AI providers, or selects the deployment
  provider/model. `CLINICAL_PHI_LLM_PROVIDER` and
  `CLINICAL_PHI_LLM_MODEL` define one approved pair; the server rejects
  cross-provider and same-provider model overrides and never discovers or
  fails over to another configured vendor. Deployment verifies that the
  matching Edge credential exists before releasing functions, while the
  production bundle gate rejects every supported direct-provider origin. The
  dormant browser multi-provider router, direct provider adapters, runtime-key
  setter, provider health checks, and model-selection hook were deleted rather
  than relying on tree-shaking to keep that obsolete capability unreachable.
  Settings hydration removes legacy provider/model fields from both local and
  synced preferences.
- **Explicit non-AI deployment state:** repository policy may set the provider
  and model to `disabled`, allowing migrations, Edge functions, monitoring, and
  frontend release to deploy together without asserting contractual approval.
  Clinical AI stays fail-closed in this state; provider approval remains a
  human gate before those workflows can be marketed or used with PHI.
- **Usable roster intake without clinical AI:** the first-class Round Home
  import now opens the deterministic, client-side CSV/spreadsheet mapper by
  default. The optional document/image tab states its approved-provider
  requirement explicitly, so a deployment in `disabled` mode still has a
  complete first-run roster path. Component coverage and authenticated
  Chromium/WebKit coverage exercise the tab order and 390px layout.
- **Fail-closed federated sign-in:** production is password-only by default.
  Google and Apple controls render only when the provider is configured in
  Supabase Auth and explicitly allowlisted through
  `VITE_APPROVED_OAUTH_PROVIDERS`. Unsupported or malformed provider values
  block the production build, preventing a visible sign-in path that cannot
  complete.
- **Alertable operational telemetry:** the PHI-safe logger now preserves flat
  metric name/value/unit fields instead of silently discarding every
  measurement at its allowlist boundary. Patient-write outcome/latency and
  offline queue length/age/replay results use fixed vocabularies with no chart
  identifiers or content. Saved/queued per-input writes and rapid enqueue
  pressure aggregate over five seconds, while conflicts and hard errors emit
  immediately. The optional
  collector now serializes flushes, treats non-2xx as failures, requeues failed
  batches even when newer events arrive, applies exponential retry backoff
  capped at five minutes, caps retained memory, and attaches the public
  Supabase key only for Supabase-hosted ingest. The first-party Edge
  function rejects arbitrary event names, context fields, unbounded batches,
  and stale timestamps before storage. Sink approval/configuration and
  production alert rules remain deployment gates.
- **PHI-free browser experience metrics:** production startup measures TTFB,
  FCP, LCP, CLS session windows, and p98 INP through native browser performance
  observers. Only fixed scalar names, numeric values, and units cross the
  logger, first-party telemetry schema, or Sentry bridge; entry URLs, DOM
  elements, interaction names, route data, and clinical content are never
  retained. Unsupported entry types are omitted instead of reported as false
  zeroes, and final navigation measurements flush on page hide.
- **Clean CI runtime configuration:** both production-build jobs now receive
  the public Supabase URL and browser publishable key explicitly from GitHub
  Actions configuration. CI no longer depends on a tracked developer `.env`;
  that file is ignored and remains local-only. Repository variables
  `VITE_SUPABASE_URL` and `PRODUCTION_APP_URL` were configured on 2026-08-13.
- **Interaction-lazy references:** the two secondary clinical-reference
  datasets are no longer preloaded after sign-in or redundantly loaded by
  provider hooks. An authenticated production-browser test proves that neither
  dataset is requested on dashboard entry, then verifies that IBCC and guideline
  assets load independently only after their corresponding reference surface is
  opened. The Focus-first Round shell also no longer mounts the redundant
  floating AI assistant over bedside content; AI remains available from Tools,
  while the explicitly selected classic workbench retains its global assistant.
- **Network-resilient typography:** public and authenticated pages now use a
  native system font stack, eliminating Google Fonts requests and the related
  external CSP allowances. Production-browser capture shows zero third-party
  origins on the landing page while preserving the approved visual hierarchy.
- **Viewport-correct first paint:** the mobile breakpoint is resolved from the
  current viewport during the first browser render instead of coercing an
  unresolved value to desktop. The workspace keeps its accessible loading shell
  for the SSR/hydration fallback, so phones never mount or fetch the desktop
  Round shell before switching to mobile. Hook/source contracts cover the first
  render and unresolved fallback; the Chromium/WebKit mobile browser scenario
  also proves the mobile shell loads without requesting either desktop chunk.
  The deployment variable
  inventory also names the required 300–3600 second hosted/browser inactivity
  timeout, preventing an operator-complete setup from failing CI unexpectedly.
- **Bounded auth bootstrap:** public and recovery routes no longer wait through
  the full Auth network retry envelope. After three seconds, a structurally
  valid, unexpired persisted session may restore its owner-scoped offline
  workspace while Supabase refresh continues; an expired/corrupt session is
  rejected, and a later authoritative Auth event always supersedes the local
  recovery. A transient bootstrap rejection releases signed-out public routes
  without treating uncertainty as a destructive sign-out. Unit coverage locks
  cache validation, timeout recovery, eventual sign-out precedence, and
  sensitive-state preservation; production-preview Chromium and WebKit both
  render the cached route before an intentionally stalled refresh completes.
- **Visible production updates:** a newly installed service worker now surfaces
  an accessible in-app refresh prompt instead of writing only to DevTools.
  Clinicians can refresh deliberately or defer it to avoid interrupting an
  active note edit. Installed updates remain in the browser's waiting phase
  when `Later` is selected, preserving the incumbent worker and its exact
  hashed-chunk cache for the open session. `Refresh now` explicitly activates
  the waiting worker, waits for both controller handoff and the worker's
  post-cleanup activation signal, and only then reloads; an activation failure
  stays visible instead of pretending the update landed.
  Because activation claims sibling tabs, the worker retains every dynamic
  generation that still contains a fresh, exact hashed script/style asset for
  the 24-hour recovery window. This covers suspended tabs spanning rapid
  consecutive deployments without making retained HTML authoritative. Empty
  or expired dynamic generations, all API caches, and obsolete static/image
  caches are deleted. Chromium/WebKit, component contracts, source-level cache
  harnesses, and a same-origin real-browser three-worker upgrade scenario cover
  deferral, explicit activation, one- and two-release sibling-tab chunk safety,
  bounded expiry, and
  the case where another tab activates first: its already-activated worker is
  treated as reload-ready instead of timing out on a second activation request.
- **Resilient installed-app navigation:** a fresh cached app shell now covers
  transient hosting and edge HTTP 5xx responses as well as rejected network
  requests. Authoritative 4xx responses still reach the browser, and cached
  entries remain bounded by the existing 24-hour navigation TTL. The worker
  cache generation is bumped so previously installed clients adopt the policy;
  an executable worker harness covers both 503 recovery and 404 pass-through.
  Exact cached hashed JavaScript URLs also bridge the narrow interval where an
  already-open tab requests a previous deployment chunk after hosting cleanup
  returns 404, rewrites the missing asset to an HTML app shell, or rejects the
  request while offline. Unexpected asset MIME types are never cached as
  executable chunks. HTML navigation 404 responses remain authoritative, and
  the worker cache generation is bumped again to distribute the chunk policy.
- **Authenticated browser gate:** local isolated runs execute 22 credentialed
  scenarios per engine in Chromium and WebKit with zero skips, including multi-tab conflicts,
  offline queue drain, Round navigation, roster state, and real Excel/PDF
  downloads. The 2026-08-13 release-candidate run passed **44/44** credentialed
  browser executions after the browser suite
  exposed and engineering fixed a continuity-hydration race that could replace
  navigation performed before the restored Round was ready. Desktop and mobile
  shells now show an accessible restoring state until continuity is hydrated.
  Main-branch CI now fails closed when credentials are missing or any test
  skips. Owner-scoped setup and teardown reset exactly the three named
  synthetic patients plus Round continuity, preventing failed or repeated runs
  from accumulating test markers; the reset does not run for the production
  canary. Pull requests retain the public Chromium/WebKit compatibility suite;
  `main` serializes the complete authenticated Chromium and WebKit suites
  against the dedicated seeded account. WebKit's service-worker navigation
  cannot use Playwright's browser-wide offline transport, so that engine loads
  the shell with Supabase blocked and asserts zero offline clinical-data
  writes; Chromium additionally asserts zero Supabase reads or writes during
  the offline reload.
  Multi-tab coverage additionally counts patient requests: the first stale
  revision now blocks every keystroke already queued behind it, so one stale
  input burst produces one patient `PATCH` in unit coverage; Chromium and
  WebKit each measure one revision-guarded `PATCH` for the native stale browser
  edit, one conflict notification, and a matching `Review conflict` inline
  state. A new edit waits for the forced refresh before writing against the
  updated revision.
- **Durable Round Todos:** add, complete/reopen, and delete now use the same
  owner-scoped durable queue standard as chart edits. Accepted offline tasks
  render an explicit `Queued` state, survive document reload in IndexedDB,
  replay idempotently by client-generated ID, retain stale-delete conflicts for
  review, and invalidate patient plus roster Todo caches after sync. The
  credentialed browser scenarios verify durable storage, reconnect replay,
  exactly-one persistence, final deletion, and continued patient navigation
  plus Todo add/complete after an offline service-worker reload. The roster is
  restored from an atomic owner-scoped IndexedDB snapshot and remains inside
  the existing auth-transition purge boundary. Mobile task deletion remains a
  visible 44px touch target without relying on hover, and the Focus-first empty
  state no longer advertises the intentionally demoted AI action. Global
  connectivity notices are
  capability-scoped: offline copy identifies only changes showing `Offline
  queued` or `Queued` as device-resident, and reconnect copy requires users to
  confirm `Queued` clears or `Saved` appears before leaving the device.
  Known-offline chart edits now bypass doomed patient network writes and go
  directly to the durable owner-scoped queue. Superseded same-field keystrokes
  coalesce to the latest value, and `Offline queued` appears only after that
  latest value is stored. The credentialed browser scenario asserts zero
  patient `PATCH` attempts while offline before reconnecting and verifying the
  exactly-once persisted result. The shared Todo map now also maintains an
  atomic owner-scoped IndexedDB snapshot. A cold offline reload overlays queued
  create/update/delete mutations on that snapshot before publishing dashboard
  context, so End Round counts and Print / Export cannot silently omit locally
  available tasks. Supabase/network read failures also retain that local map
  even when the browser still reports online; the UI marks it unverified,
  permits recovery export, retries automatically, and blocks completion until
  server truth is verified. The snapshot is purged in the same transactional
  auth-owner boundary as the roster and mutation queue.
- **Cold-reload chart truth:** the patient roster now applies unresolved,
  owner-scoped patient-update payloads over the last server snapshot before
  either offline hydration or an online fetch result reaches chart and export
  surfaces. The separate durable queue remains replay authority and the base
  snapshot remains server-derived. Per-patient queued/error/conflict state is
  rebuilt from that queue after reload, so recovered text cannot appear without
  its corresponding save warning. Remote patient-read failures now also retain
  the owner-scoped roster when `navigator.onLine` remains true, show a
  persistent retry warning, and block completion until a forced server read
  succeeds. The targeted credentialed matrix passed **8/8** across Chromium
  and WebKit: multi-tab conflict, cold-offline patient edit recovery, online-
  flagged backend outage recovery, Todo recovery, exactly-once reconnect
  replay, and cleanup.
- **Fail-safe Round completion:** Done and Mark Complete now consider the Round
  continuity outbox, patient chart saves, and the shared patient/Todo queue.
  End review and Print / Export remain accessible while unresolved work blocks
  completion. The export dialog is warmed online and no longer mounts its lazy
  chunk while closed, so opening End offline cannot trip the route boundary.
  Persistent network toasts no longer intercept underlying lifecycle controls.
  Authenticated Chromium and WebKit scenarios prove offline Todo queueing,
  blocked completion, offline review/export access, replay, and automatic
  unlock after reconnect.
- **Protected healthcheck:** the local candidate uses `SUPABASE_ANON_KEY`, not
  the service-role key or the service-role-backed rate limiter. It requires
  either a validated app-user session or a dedicated monitor secret before it calls the
  dedicated `healthcheck_database()` RPC after anonymous access to all other
  current and future public-schema tables, sequences, and routines is revoked.
  The Edge auth CI invariant rejects a privileged or table-reading public
  handler.
- **Browser PHI ownership:** IndexedDB, Round outbox/session data, Yjs stores,
  telemetry, cache hydration, and SMART-on-FHIR state are quarantined across
  sign-out and A→B account changes before the next identity reaches the UI.
  The unused bulk IndexedDB PHI import/export API was removed, and a regression
  invariant prevents it from returning without an owner-aware design.
- **Hosted Auth baseline:** the deployment candidate disables public signup,
  enables HaveIBeenPwned leaked-password protection through the Management API,
  enforces the operator-selected 5–60 minute hosted inactivity timeout, and
  fails unless the returned hosted configuration confirms all three controls.
  The authenticated browser uses the same timeout, warns one minute before
  closing the workspace, and clears the local session plus clinical caches even
  if remote token revocation fails. Interaction resets the client deadline;
  returning to an expired background tab does not. The exact value remains a
  deployment-policy decision recorded through
  `PRODUCTION_SESSION_IDLE_TIMEOUT_SECONDS`.
  Supabase Pro or above and Auth-config write permissions are required.
- **Operations (Phase 7):** `docs/operations/runbooks.md` — sync incidents,
  stale-client conflicts, provider outage, migration failure,
  Vercel/Supabase mismatch, escalation/breach paths, RPO/RTO, monitoring
  gaps, staged rollout with stop conditions.
- **Production synthetic:** the local candidate adds an hourly Edge/database
  health probe plus a reversible deployed-app save/reload/restore canary. A
  live manual run passed against the deployed Vercel URL on 2026-08-13 and
  restored `E2E Alpha`; `PRODUCTION_APP_URL` is now configured, and scheduled
  proof begins after the candidate workflow is committed/deployed. GitHub now
  has the production URL and generated healthcheck token; deployment must sync
  the token to Supabase before the first scheduled run. Failures deduplicate
  into one GitHub incident and recovery closes it.
- **Deployment procedure:** `docs/deployment.md` (verify:local pre-push
  checklist). The candidate now fails closed unless the Vercel deploy hook is
  configured and the canonical production page publishes an `app-version`
  marker matching the exact CI-verified backend SHA.
- **Structured roster import:** CSV and SMART-on-FHIR identity fields now stay
  structured end to end (DOB, normalized sex/gender, admission, attending,
  service, code status, isolation/allergies) instead of being flattened into
  clinical prose. CSV imports submit only validated rows, and keyboard/screen-
  reader contracts cover the entry cards, mapping controls, and mobile Round
  tab panels. Migration `20260813010000_add_patient_roster_identity_fields.sql`
  adds the missing durable roster columns.
- **Lossless multiline CSV import:** the CSV parser now scans complete records
  with quote state instead of splitting on physical line breaks first. Quoted
  multiline diagnoses and clinical summaries remain attached to one patient,
  CRLF input is normalized inside the field, escaped quotes remain intact, and
  physically blank records do not create patients. Parser-to-mapping regression
  coverage proves the full multiline value reaches the imported patient.
  Unclosed or misplaced quotes, duplicate or unnamed headers, and records whose
  column count differs from the header now produce line-specific parse errors
  and never reach mapping or preview, preventing malformed files from
  collapsing patients or silently losing a duplicate column.
  Direct CSV uploads share the 15 MB spreadsheet limit, and pasted/extracted
  content shares the one-million-character patient-list parsing envelope.
- **Idempotent patient-list commits:** every import batch receives stable,
  client-generated patient IDs that are retained only while its outcome is
  ambiguous. If Supabase commits the batch but its response is lost, retry
  reconciles those exact owner-scoped rows instead of allocating new patient
  numbers and duplicating the roster. The retry record contains only a SHA-256
  content fingerprint, generated IDs, and a timestamp in the existing
  owner-keyed IndexedDB ledger; it never stores patient content, and confirmed
  imports remove it immediately. Ambiguous retry identities survive an auth
  transition so a response-loss race cannot turn into a duplicate when the
  original owner returns; all clinical caches and drafts are still purged, and
  another account cannot address the retained owner-keyed record. A full local
  data clear removes the ledger too. If durable site storage is unavailable,
  the browser blocks the import before sending rather than permitting an
  unsafe retry path.
- **Complete End Round handoff:** End Round Print / Export always receives the
  full Round patient roster. An unrelated Dashboard search or filter can no
  longer silently reduce the handoff while the completion summary still shows
  the full Round count; a regression harness opens the real lazy export dialog
  and verifies every Round patient is present.
- **Terminal Round lifecycle:** Marking a Round complete now makes its walk,
  filters, section, and sync metadata immutable. Completed state restores to
  Round Home after local, remote, or new-browser hydration and requires the
  explicit **Start New Round** action before Focus can reopen. Completion is
  durably queued before the new active generation, while a failed terminal
  write cannot prevent the new generation from being saved. The authenticated
  Round RPC now addresses the exact Round id, so a delayed device cannot
  overwrite a newer active Round. A rejected competing generation remains
  visible and retryable; End Round offers an explicit action to adopt the
  authoritative Round from another device without discarding patient notes or
  Todos. Store, provider, hydration, UI, migration-contract, and rejection-path
  regressions cover these boundaries.

## 3. Final release gate status (from plan)

| Gate | Status |
| --- | --- |
| CI/deployment workflows green at exact production SHA | DONE — the latest main-branch CI ran 32/32 Chromium and 32/32 WebKit with zero skips; the gated deploy applied migrations/functions, verified the canonical Vercel revision, and the post-deploy production monitor passed |
| Backend migration deployed; revision/RLS proven | DONE (2026-08-11, evidence above) |
| Live multi-tab/cross-device/offline/failure/recovery scenarios pass | PARTIAL — required credentialed Chromium/WebKit suites pass in deployed main CI and the 20-test public suite passes against the canonical Vercel origin; real cross-device and manual failure/recovery cells remain open |
| Accessibility/responsive validation on representative devices | PARTIAL — automated keyboard/ARIA/320px/390px/44px/200%-text/reduced-motion/dark/overflow checks pass; manual screen-reader and real-device evidence remains open |
| Runtime audits clean; optional findings removed or time-bounded | DONE — clinical-mcp-server `npm audit` 0 vulns; risk acceptance time-bounded |
| PHI/provider, telemetry, access-control, legal evidence | OPEN (human) — see section 4 |
| Monitoring/backup/rollback/support runbooks tested | PARTIAL — protected health, first-party ingest, and reversible save canary pass in the post-deploy production monitor; the restore drill and deliberate failure/recovery alert exercise remain open |
| Clinical UAT and hazard review signed off | OPEN (human) |

## 4. Open human gates (required before GO)

1. **Public operator identity and legal destination** — configure matching
   GitHub/Vercel production contact and counsel-approved privacy-notice values.
   Until then the contact conversion action remains suppressed and the in-app
   `/privacy` page remains an explicitly labeled, non-indexed development
   placeholder. Exact-SHA CI/deploy proof, the 1,800-second inactivity timeout,
   and the first-party observability destination are configured and verified.
2. **BAA/DPA and PHI/provider approvals** — evidence items in
   `docs/clinical-data-flow.md` (approved provider/model pair, retention, key custody,
   redaction tests, clinician review, legacy credential rotation). Approve the
   managed-device, shared-device, session-retention, and local-site-data policy;
   browser offline storage remains an intentional product capability.
3. **Clinical UAT + hazard review** — scenario-based UAT with ICU
   attendings/residents/fellows; written sign-off from engineering, QA,
   security/privacy, operations, clinical safety owner.
4. **Accessibility passes** — automated keyboard, ARIA relationship, 320px and
   390px layout, 44px primary Round target, 200% text, reduced-motion, dark
   theme, and overflow checks are complete. Run VoiceOver/Safari plus one more
   screen reader, real touch devices at 320–900px, and manual high-contrast
   review.
5. **Manual data-integrity cells** — real Safari/VoiceOver and phone workflows,
   cross-device concurrency, failure-injection, completion-guard, and
   recovery-export rows in
   `docs/qa/2026-08-12-data-integrity-matrix.md`.
6. **Restore drill + scheduled alert proof** — quarterly restore drill (first
   one before GA), deploy the protected healthcheck and monitor workflow,
   observe a scheduled canary, and validate failure/recovery issue lifecycle;
   remaining monitoring gaps in
   `docs/operations/runbooks.md` §8 closed or formally accepted.
7. **On-call owner + decision-makers** — named in runbooks §9.
Read-only GitHub configuration inventory on 2026-08-13 confirms the public
Supabase URL, Supabase/deploy/healthcheck credentials, Vercel deploy hook, and
full-suite E2E credentials are present. The 1,800-second inactivity timeout and
first-party telemetry destination are configured and verified. Clinical AI is
explicitly configured as `disabled` pending provider/model approval. Production
contact and approved privacy-notice repository variables remain absent; public
surfaces suppress the contact action and use the non-indexed development privacy
placeholder until those human-owned values are supplied.

## 5. Security advisor findings

From the Supabase security advisors on 2026-08-11/12:

- ~~`pg_graphql` exposes the REST-backed clinical tables through an unused
  second API surface~~ — RESOLVED in the local candidate by
  `20260813000000_harden_public_database_surface.sql`, which drops the unused
  extension and revokes anonymous public-schema object access. Confirm the
  advisor is clear after deployment.
- ~~`rls_auto_enable()` is `SECURITY DEFINER` and executable by `anon`~~ —
  RESOLVED in the local candidate by revoking all browser-role execution from
  every matching production overload. Confirm the advisor is clear after
  deployment.
- ~~Auth leaked-password protection is disabled~~ — RESOLVED in the local
  candidate by enforcing `password_hibp_enabled: true` through the deployment
  workflow and verifying the returned hosted Auth configuration. Confirm the
  advisor is clear after deployment.
- ~~Several RLS policies lack `TO authenticated`~~ — RESOLVED in the local
  candidate by narrowing every legacy PUBLIC-scoped policy on app-owned tables
  to `authenticated`. Confirm the advisor is clear after deployment.
- ~~`disable_signup` unverified~~ — RESOLVED 2026-08-12: the deploy workflow
  enforced `disable_signup: true` and the Auth settings response confirmed
  restricted enrollment is active.

All four repository-addressable advisor findings now have fail-closed candidate
controls. Their live status remains unproven until this exact candidate deploys
and the Security Advisor is checked again.

## 6. Sign-off

| Role | Name | Date | Signature |
| --- | --- | --- | --- |
| Engineering | | | |
| QA | | | |
| Security/Privacy | | | |
| Operations | | | |
| Clinical safety owner | | | |
