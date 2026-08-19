# Data-Integrity Validation Matrix — 2026-08-12

Plan reference: `2026-08-11-clinical-production-readiness-plan.md`, Phase 3.
Scope: prove zero silent overwrites, zero endless `syncing` states, and zero
falsely reported saves across browsers, devices, and failure conditions.

## Test account and seed data

- Use the dedicated non-PHI E2E account (see `.env.local` keys
  `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`; never commit credentials).
- Seed at least three patients with clearly fake names (current seed:
  `E2E Alpha`, `E2E Bravo`, `E2E Charlie`).
- Reset between runs: sign out, reload, confirm roster matches the seed.

## Automated coverage (this repository)

`e2e/data-integrity.e2e.spec.ts` — run with:

```bash
E2E_PORT=8173 npx playwright test e2e/data-integrity.e2e.spec.ts
```

(Any free port works; `E2E_PORT` exists because `localhost:8080` may be used
by other local services. Tests run in `serial` mode because they share one
account and roster.)

| Scenario | Coverage | Status 2026-08-12 |
| --- | --- | --- |
| 3. Multi-tab concurrency (same account, two tabs) | Automated — tab B's stale browser edit must surface an explicit "Save conflict," expose the matching `Review conflict` inline state, issue one revision-guarded patient `PATCH`, and never overwrite tab A's persisted content; unit coverage proves the queued-keystroke barrier | PASS (Chromium + WebKit) |
| 5. Offline recovery (queue → recovery copy → reconnect → no duplication) | Automated — the owner-scoped roster and Todo snapshot remain available after an offline service-worker reload; queued chart payloads are projected over the last roster snapshot and restore their `Offline queued` state before chart/End/Export render; the shared Offline indicator remains reachable at desktop/tablet/compact breakpoints; destructive discard stays disabled until the exact queue is downloaded as PHI-marked recovery JSON; cross-tab changes invalidate confirmation and an atomic signature check preserves any mutation not present in that download; cancel preserves the queue; patient Todos remain in IndexedDB, feed the shared End/Export map, drain on reconnect, and persist exactly once. Known-offline work must issue zero clinical-data writes. Chromium additionally proves zero Supabase requests during the offline reload; WebKit must briefly re-enable document transport but blocks clinical-data writes while the shell loads. | PASS (Chromium + WebKit) |
| 7. Completion guard | Automated — an offline Todo disables Done and Mark Complete while End review plus the preloaded Print / Export dialog remain usable; transient Todo or patient-roster read outages preserve locally available clinical truth, mark it unverified, show a persistent retry surface, and block completion; a successful forced read clears the guard without refresh | PASS (Chromium + WebKit) |
| 9. Reload truth | Automated for the two scenarios above (post-reload content match + occurrence count) | PASS (Chromium + WebKit) |

Unit-level coverage that backs the matrix:

- `src/lib/offline/indexedDBQueue.test.ts` — durable queue, owner isolation,
  coalescing, legacy-data discard.
- `src/lib/offline/syncEngine.test.ts` — replay, conflict detection, retries.
- `src/hooks/patients/__tests__/usePatientMutations.test.ts` — write
  serialization, rollback, stale-write rejection, revision tracking.
- `src/lib/offline/patientRosterCache.test.ts` — complete patient snapshot
  preservation, revision/timestamp handling, and owner-scoped queued-update
  projection over a stale snapshot.
- `src/hooks/patients/__tests__/usePatientAuthBoundary.test.tsx` — owner
  isolation plus patient-roster fallback when the browser remains online but
  the server read fails.

## Defects found by this matrix and fixed (2026-08-12)

All nine were reachable during ordinary offline or degraded-network use and violated the
"no falsely reported saves / no silent loss" acceptance criteria:

1. **Offline writes were not queued once the API circuit breaker opened.**
   Background requests trip the breaker within seconds of going offline;
   patient writes then failed fast with `CircuitOpenError`, which
   `isRetryablePatientWriteError` classified as non-retryable, so the edit was
   rolled back and reported "Save failed" instead of entering the durable
   queue. Fix: `CircuitOpenError` (including the `ApiError`-wrapped cause) and
   any status-less failure while `navigator.onLine === false` are now
   retryable/queueable (`src/hooks/patients/usePatientMutations.ts`).
2. **Sync drain burned all retries against the open breaker in under a
   second.** On reconnect during the 30 s breaker cooldown, queued mutations
   exhausted `maxRetries` immediately and were condemned as `failed`.
   Fixes: all circuit breakers reset on the browser `online` event
   (`src/lib/circuitBreaker.ts`), and the sync engine defers a pass on
   `CircuitOpenError` instead of consuming retries
   (`src/lib/offline/syncEngine.ts`).
3. **Save-state indicator never left "Offline queued" after a successful
   drain.** `usePatientMutations` now reconciles `patientSaveStates` against
   the queue: a drained patient write becomes `Saved`, an exhausted one
   becomes `Save failed`, and the cached expected revision is dropped plus a
   forced refetch issued so the next edit cannot hit a spurious conflict.
4. **One stale edit burst issued a conflict request for every queued
   keystroke.** Patient writes are serialized, but every value already waiting
   behind the first rejected revision still reached the API, duplicated error
   telemetry, and repeated the same conflict work. A patient-scoped conflict
   barrier now stops all versions that were queued when the first rejection
   arrived, triggers one refresh and one conflict notification, labels the
   inline state `Review conflict`, and makes a genuinely new edit wait for the
   refresh before using the updated revision. Unit coverage proves the blocked
   burst emits one request; credentialed Chromium and WebKit each measure one
   revision-guarded `PATCH` for the native stale browser edit.
5. **The authenticated shell survived an offline reload, but the roster did
   not.** React Query started empty and its network-only patient fetch could not
   rebuild the workspace, so clinicians could see the dashboard but could not
   select a patient or continue rounds. The patient roster is now snapshotted
   atomically in the existing owner-bound IndexedDB database, updated after
   successful fetches and local roster mutations, restored before any offline
   transport, and purged by the existing auth-owner transition. The Chromium
   scenario now adds and completes Todos after the offline reload while
   asserting that no Supabase request begins until reconnect.
6. **Round completion ignored unresolved patient and Todo writes.** The guard
   only considered the Round continuity outbox, so a clinician could finish
   while the separate clinical queue was pending, failed, or conflicted. The
   completion policy now combines both queues plus in-flight patient saves,
   while preserving End review and Print / Export as recovery actions. The
   closed export modal no longer requests its lazy chunk offline; both Round
   shells warm that chunk online. Persistent network notifications are
   non-blocking except for their own controls, so they cannot cover End or Todo
   recovery actions.
7. **A cold offline reload could hide a queued chart edit behind the last
   roster snapshot.** The durable mutation survived, but patient hydration
   returned the snapshot without applying that newer payload and the per-patient
   `Offline queued` indicator lived only in React memory. The roster query now
   overlays unresolved owner-scoped patient updates on both offline snapshots
   and successful server reads before publishing UI state. Queue subscription
   also reconstructs queued, failed, and conflict save states after reload.
   Credentialed Chromium and WebKit each cold-reload while the note is still
   pending, verify the note and status remain visible, assert zero offline
   patient `PATCH` attempts, then prove one reconnect replay and one persisted
   occurrence.
8. **A transient Todo read failure could empty End Round while the browser
   still reported online.** The shared query previously consulted the durable
   snapshot only when `navigator.onLine` was already false. Network/5xx read
   failures now retain the snapshot plus pending queue overlay, label that map
   `stale`, retry on focus/reconnect and a bounded timer, and block Round
   completion until server verification succeeds. Review and Print / Export
   remain available as recovery paths and explicitly disclose the unverified
   state.
9. **A transient patient-roster read failure could empty the entire workspace
   while the browser still reported online.** Patient hydration previously
   consulted IndexedDB only after the browser's connectivity flag changed, so
   a backend 5xx, DNS failure, or captive portal discarded a valid local
   roster from the visible workspace. Patient reads now fall back to the
   owner-scoped roster plus pending mutation overlay on any remote failure,
   label the result `stale`, retry on focus/reconnect and a bounded timer, and
   expose a persistent forced-retry banner. Done and Mark Complete stay blocked
   until a successful server read verifies the roster; Review and Print /
   Export remain available and disclose that local data may be incomplete.
   Credentialed Chromium and WebKit each inject a patient-read 503 while the
   browser remains online, confirm the roster stays navigable, and prove the
   retry removes the warning only after an actual successful patient read.
10. **A completed Round could reopen as mutable Focus or be overwritten by a
   stale device.** Completed lifecycle state now survives local, remote, and
   new-browser hydration and opens on Round Home with an explicit **Start New
   Round** boundary. Terminal walk state is immutable. The authenticated RPC
   updates only the addressed Round id, so delayed completion cannot replace a
   newer active generation. Competing active generations remain blocked and
   visible until retry succeeds or the clinician explicitly adopts the active
   Round saved by another device; chart notes and Todos remain separate.

## Manual matrix (evidence required before sign-off)

Record each cell as PASS/FAIL/N-A with a screenshot or screen recording.
Template per run: date, build SHA, browser/device + OS version, account,
observer, notes.

| # | Scenario | Chromium | WebKit/Safari | Real phone | Expected result |
| --- | --- | --- | --- | --- | --- |
| 1 | Todo isolation: expand/collapse every editor; type in Todo input | | | | Todo input keeps focus; clinical notes unchanged |
| 2 | Toolbar routing: customize toolbar, AI model selector, phrase library, formatting, overflow | | | | Each control performs only its intended action |
| 3 | Multi-tab concurrency (covered by browser automation) | PASS (auto) | PASS (auto) | | Native stale edit → one revision-guarded patient `PATCH`, one explicit conflict notification, matching `Review conflict` inline state, and no silent overwrite; unit coverage proves queued trailing edits stop at the barrier |
| 4 | Cross-device concurrency: edit same field on phone and workstation | | | | Same explicit-conflict behavior as scenario 3 |
| 5 | Offline recovery: queue chart edits and patient Todos offline, reload, continue from the cached roster, reconnect, retry | PASS (auto) | PASS (auto; zero writes, Supabase blocked during shell reload) | | Owner-scoped roster remains navigable; post-reload Todo add/complete stays local; known-offline work makes zero Supabase writes; queued work survives reload and persists exactly once; Todo status goes Queued → synced and remains removable; global notices identify only changes showing `Offline queued` or `Queued` as device-resident and require confirming `Queued` clears or `Saved` appears after reconnect |
| 6 | Failure injection: expired session, rejected write, storage unavailable, rate limit, timeout, 4xx/5xx | | | | Actionable retry/conflict/recovery path; no false "Saved" |
| 7 | Completion guard: Done / End Round with pending, failed, conflicting, or queued changes | PASS (auto) | PASS (auto) | | Done and Mark Complete block; End review and Print / Export remain usable; reconnect replay unlocks completion without refresh |
| 8 | Recovery export: download failed/pending changes, inspect content and identifiers, cancel discard, and perform authorized manual recovery if needed | | | | Discard is unavailable before download; JSON retains mutation/patient identifiers and local content; cancel leaves the queue intact |
| 9 | Reload truth: compare rendered content vs database rows after refresh on every tab/device | | | | Rendered content matches DB exactly |
| 10 | Terminal Round lifecycle: complete, reload locally/new browser, then reconnect a stale device | | | | Completed Round opens review-only Home; Start New Round is explicit; stale completion cannot overwrite the newer active Round; competing generation has retry/adopt resolution |

### Scenario 6 notes (failure injection recipes)

- **Expired session:** sign in, then revoke the session from another device
  (or wait for token expiry with auto-refresh disabled); the next write must
  surface an auth error, not a false save.
- **Rate limit:** trigger the `parse-handoff` edge function repeatedly;
  expect HTTP 429 handling with a user-visible retry message.
- **Backend 5xx:** block/rewrite `*.supabase.co/rest/v1/*` to return 500 via
  DevTools request interception; writes must queue or fail loudly.
- **Storage unavailable:** run in a profile with IndexedDB disabled; the app
  must fall back to the in-memory queue and still report honestly.

### Scenario 7/8 pointers

- Completion guard lives in the round-completion flow (`Done` / `End Round`);
  exercise it with one patient in each state: pending, failed, conflicting,
  offline-queued.
- Recovery export: use the Offline indicator's pending-changes surface. Open
  **Review discard**, prove **Discard local changes** is disabled, download the
  PHI-marked JSON, inspect the mutation/patient identifiers and local content,
  then choose **Keep changes** and verify the queue remains. The file is an
  authorized support/manual-recovery artifact, not an automatic import format.

## Acceptance criteria mapping (plan Phase 3)

- Zero silent overwrites / endless syncing / falsely reported saves —
  enforced by revision-predicate writes (server-side), conflict UI,
  queue-state reconciliation, and the automated scenarios above.
- Every failure state offers an actionable path — validated per scenario row.
  Pending clinical work has a recovery-first destructive boundary: the shared
  indicator is visible across dashboard breakpoints, export precedes discard,
  and automatic re-import is never implied.
- Automated Playwright coverage exists for stable Chromium scenarios plus a
  production-bundle WebKit auth/login/dashboard smoke. The browser suite also
  covers keyboard skip/focus restoration, roving tabs, live ARIA panel
  relationships, 320px/390px overflow, 44px primary Round targets, 200% text,
  reduced motion, and dark-theme activation. Manual evidence covers screen
  readers, WebKit clinical workflows, real devices, and injection conditions
  that automation cannot reproduce reliably.
