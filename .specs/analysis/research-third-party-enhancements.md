# Research: third-party enhancements

Research for `.specs/tasks/draft/third-party-enhancements.feature.md`.

**Research date:** 2026-08-22
**Scope:** Synthea, Yjs `y-websocket`/`y-indexeddb`, and RxDB, with emphasis on APIs, licensing, security/authentication, persistence, and integration pitfalls.
**Evidence convention:** “Verified” means observed in an upstream repository, package manifest/source file, or linked official documentation at the URLs cited. “Assumption” means a proposed application decision or an item that still needs validation in this repository/deployment.

## Executive recommendation

Proceed with three deliberately separate pilots:

1. **Synthea: recommend for immediate test/demo fixtures.** Pin a released commit or version, run it in CI or a controlled fixture-generation container, use a fixed seed and explicit export configuration, and validate the generated FHIR before loading it into any test Supabase project.
2. **Yjs: recommend a bounded prototype only.** Use Yjs for explicitly selected draft-note content, with `y-indexeddb` in the browser and a host-controlled WebSocket service. The stock WebSocket server is not an authorization system; authenticate and authorize the room during the HTTP upgrade, scope room names to tenant/user/patient-round permissions, and persist server-side updates if recovery matters.
3. **RxDB: keep as an evidence-gathering spike.** It could improve the local model and replication machinery, but it is not a drop-in replacement for the existing Dexie queue. Compare one workflow against the current implementation using identical failure injection and recovery tests. Do not adopt it until security boundaries, conflict semantics, tombstone retention, storage behavior, and rollback are demonstrated.

No recommendation supports replacing Supabase, the current patient domain model, or the existing offline architecture without pilot evidence.

## Repository context verified locally

- The application is a React/TypeScript/Vite app with Supabase integration and an Electron shell; the repository guidance says auth, Supabase, and AI are mocked in ordinary tests and real Supabase credentials are needed for E2E. See [`CLAUDE.md`](../../CLAUDE.md).
- Existing project documentation describes an IndexedDB-backed offline queue, explicit conflict UI, recovery export, and owner scoping. The third-party pilot must preserve these guarantees rather than introduce a second silent write path. See [`app/docs/qa/2026-08-12-data-integrity-matrix.md`](../../app/docs/qa/2026-08-12-data-integrity-matrix.md).
- The project’s Supabase edge-function auth helper validates the bearer token with Supabase Auth. A new collaboration or replication endpoint must use an equivalent server-side identity check; a browser-presented publishable/anon key is not proof of patient/room authorization. See [`app/supabase/functions/_shared/auth.ts`](../../app/supabase/functions/_shared/auth.ts).

These are repository observations, not claims about production deployment state.

## 1. Synthea

### Verified facts and APIs

- The upstream project describes Synthea as a synthetic patient population simulator that produces realistic-but-not-real patient data and associated health records in multiple formats: [GitHub repository](https://github.com/synthetichealth/synthea), [README](https://github.com/synthetichealth/synthea/blob/master/README.md).
- The current README documents Java JDK 17 or newer and recommends LTS Java 17 or 25. This is a build/runtime prerequisite for a reproducible generator job.
- The documented CLI supports deterministic seeding with `-s seed`, population size with `-p`, geography, age/gender, a reference date, an output directory (`--exporter.baseDirectory`), and configuration/module paths. Example: `./run_synthea -s 21 -p 100 Utah "Salt Lake City"`.
- The README documents FHIR R4, STU3, DSTU2, Bulk FHIR NDJSON, C-CDA, CSV, and CPCDS exporters. The checked-in default properties currently enable FHIR and US Core settings while leaving several other exporters disabled: [synthea.properties](https://github.com/synthetichealth/synthea/blob/master/src/main/resources/synthea.properties).
- Synthea supports custom modules and configuration. That is useful for fixtures but means a seed alone does not guarantee identical output if the Synthea version, modules, config, locale, or export settings change. The fixture workflow should pin all of those inputs.
- GitHub currently reports the repository as active, non-archived, default branch `master`, with Apache-2.0 metadata: [GitHub API repository record](https://api.github.com/repos/synthetichealth/synthea). The repository README carries the Apache License 2.0 notice.

### Security, privacy, and persistence

- **Verified:** Synthea is designed to generate synthetic data; that is a property of the generator, not an exemption from safe handling. Generated data can still contain sensitive-looking clinical narratives and identifiers, and exporting it to shared logs, screenshots, or a production database would create an avoidable data-boundary risk.
- **Verified:** The generator writes files under an output directory and supports JSON/FHIR-style exports. The generator itself is not a tenant-aware storage service, access-control layer, or PHI scanner.
- **Assumption/recommendation:** Treat every fixture directory as test data with a documented classification. Add an automated scan that rejects real-looking secrets/identifiers and checks that no production Supabase URL or credential is used. Never use real patient data to “enrich” Synthea output.
- **Assumption/recommendation:** Do not commit generated populations by default. Generate them in CI or a reproducible fixture command, retain only small approved golden fixtures, and clean temporary output on failure and success.

### Integration pitfalls and acceptance tests

- Pin the Synthea version/commit, Java major version, module set, properties, locale/timezone, seed, geography, population size, and reference date. Record a manifest containing hashes of these inputs.
- Generate at least one small deterministic population and assert stable, expected resource counts and identifiers. Do not assert the entire export byte-for-byte unless the pinned toolchain makes that a deliberate contract.
- Validate FHIR using the version actually consumed by the application. Test import → application mapping → export/round-trip, including labs, observations, medications, allergies, encounters, missing fields, and duplicate/conflicting identifiers. Synthea’s FHIR validity does not prove that the application’s mapping is correct.
- Keep fixture generation separate from any “seed database” command so a developer cannot accidentally target production. Require an explicit test-project URL and fail closed for non-test environments.
- Use the FHIR specification and implementation guide relevant to the app in addition to Synthea’s exporter documentation: [HL7 FHIR R4](https://hl7.org/fhir/R4/), [US Core](https://hl7.org/fhir/us/core/).

**Decision:** adopt Synthea as a reproducible fixture source after the safety and round-trip tests pass; do not treat its output as a production-data validator or clinical truth source.

## 2. Yjs `y-websocket` and `y-indexeddb`

### Verified facts and APIs

- `y-indexeddb` exposes `new IndexeddbPersistence(docName, ydoc)`. It loads updates from browser IndexedDB, emits `synced` after local content is loaded, and exposes `destroy()`, `clearData()`, `get()`, `set()`, and `del()`: [official Yjs documentation](https://docs.yjs.dev/ecosystem/database-provider/y-indexeddb), [README](https://github.com/yjs/y-indexeddb/blob/master/README.md), [source](https://github.com/yjs/y-indexeddb/blob/master/src/y-indexeddb.js).
- The provider persists Yjs document updates and periodically compacts them. Its `set/get/del` custom properties are local provider metadata and are explicitly not synced to peers. They should not be used as the audit trail for clinical attribution.
- The current `y-indexeddb` package manifest declares MIT, version `9.0.12` at the time checked, peer dependency `yjs ^13.0.0`, and Node/npm engine requirements for package tooling: [package.json](https://github.com/yjs/y-indexeddb/blob/master/package.json), [LICENSE](https://github.com/yjs/y-indexeddb/blob/master/LICENSE).
- The current `y-websocket` client exports `WebsocketProvider`. Its constructor accepts a server URL, room/document name, `Y.Doc`, and options including awareness, query `params`, WebSocket `protocols`, and `shouldReconnect`: [source](https://github.com/yjs/y-websocket/blob/master/src/y-websocket.js).
- The provider uses Yjs sync and awareness protocols, supports status/sync events, and reconnects with backoff. The source’s current behavior treats close codes `4400–4499` as deliberate non-retry decisions; this should be tested against the deployed server and client versions rather than assumed as a complete auth policy.
- The package manifest currently identifies `@y/websocket` as a `4.0.0-rc.4` prerelease, MIT licensed, Node >=16, and dependent on `@y/protocols`/`lib0`: [package.json](https://github.com/yjs/y-websocket/blob/master/package.json). Pin exact versions and review the prerelease status before production use.
- The current server package/example is `@y/websocket-server`; its server code creates a WebSocket server and explicitly comments that the host must check authorization during the HTTP upgrade before calling `handleUpgrade`: [server source](https://github.com/yjs/y-websocket/blob/master/src/server.js), [GitHub repository](https://github.com/yjs/y-websocket).
- Both Yjs packages are MIT licensed in their package manifests and license files. Review transitive dependencies for notice generation before distribution.

### Security and authentication

- **Verified:** The stock server does not decide whether a user may enter a room. Its own comment says to check cookies or URL parameters during upgrade. Therefore, `y-websocket` must be treated as a transport/provider, not as an authorization layer.
- **Verified:** The client’s `params` option becomes URL query parameters. Query parameters can leak through logs, proxies, browser history, and monitoring; do not place bearer tokens or patient identifiers in room URLs.
- **Assumption/recommendation:** Authenticate the upgrade using a short-lived credential or a server-side session/cookie, validate it against Supabase Auth, then perform an authorization query for the exact room/patient-round scope. Reject unauthorized upgrades before `handleUpgrade`.
- **Assumption/recommendation:** Use opaque, non-PHI room IDs. Keep the mapping from room ID to patient/round in an authorized server-side table. Do not encode patient names, MRNs, or note text in URLs, awareness state, logs, or metrics.
- **Verified:** Yjs awareness is presence metadata, not durable audit history. Awareness can expose user names, cursors, or selection state to room members and is removed as connections expire. Store a separate privacy-safe audit event for accepted edits if attribution is required.
- **Assumption/recommendation:** Keep the collaborative document review-only until a user explicitly applies/copies content into a chart. Yjs merge success must never be interpreted as chart persistence, clinical approval, or authorization to export.
- Browser persistence is readable by the browser profile. **Assumption/recommendation:** Treat locally persisted draft notes as sensitive cached clinical content: use managed-device/browser controls, minimize retention, provide sign-out/clear-data behavior, and document the residual risk. Yjs IndexedDB does not provide application-level encryption or access control by itself.

### Server persistence and failure behavior

- **Verified:** The basic server example keeps active document state in process and does not, by itself, establish durable database persistence, backups, retention, or disaster recovery. A process restart or an unpersisted room can therefore lose server-side state; local `y-indexeddb` copies may or may not be sufficient depending on device continuity.
- **Assumption/recommendation:** For a pilot, choose one explicit persistence policy: a tested server-side update log/snapshot store, or a clearly documented ephemeral room whose recovery comes only from authorized clients. The acceptance criteria should state which failures are expected to recover.
- Test two clients editing the same selected note offline and online, reconnect ordering, browser reload, tab close, server restart, expired session, revoked room permission, duplicate reconnect, and malformed/oversized messages. Verify no silent overwrite and no room-crossing data exposure.
- Enforce maximum room/document size, update rate, connection count, and idle retention. Add structured security logging without note content or PHI. Use WSS/TLS in deployed environments and restrict CSP `connect-src` to the approved WebSocket origin.

**Decision:** prototype only, with a custom authenticated upgrade boundary and explicit persistence/recovery design. Do not deploy the stock example server as a clinical collaboration backend.

## 3. RxDB

### Verified facts and APIs

- RxDB describes itself as a local-first, reactive JavaScript database. Its API creates a database, adds collections with JSON schemas, inserts documents, queries with `find().exec()`, and exposes reactive query observables: [official quickstart](https://rxdb.info/quickstart.html), [GitHub repository](https://github.com/pubkey/rxdb).
- The current repository package manifest reports RxDB `17.5.0`, Apache-2.0, Node >=20, and a required `rxjs ^7.8.2` peer for the base package: [package.json](https://github.com/pubkey/rxdb/blob/master/package.json), [LICENSE](https://github.com/pubkey/rxdb/blob/master/LICENSE.txt). Verify the exact published package selected for the pilot; the GitHub default branch and npm release can move independently.
- RxDB has pluggable storage, including IndexedDB, OPFS, Dexie, memory, SQLite, and others: [storage documentation](https://rxdb.info/rx-storage.html). A storage adapter choice is a performance/reliability decision, not merely an import change.
- The replication API is based on `pull` and `push` handlers, checkpointed incremental pulls, optional live `pullStream$`, retry/error state, and conflict handling: [replication documentation](https://rxdb.info/replication.html).
- The documented push handler receives the assumed master state and the new fork state, and must return master states for conflicts. The default conflict handler favors the master state; a custom handler can be supplied. This is materially different from a field-level clinical conflict UI unless the pilot designs and tests a deliberate mapping.
- RxDB’s documented replication model uses a checkpoint that must provide a complete, deterministic ordering (commonly modification time plus primary key). Reconnects must be able to catch up through checkpoint iteration even when live events were missed.
- The replication documentation says deletes should be represented as tombstones (normally `_deleted`) rather than hard-deleting remote rows before all clients can observe the deletion. This affects schema, retention, privacy deletion, and Supabase RLS/migration design.
- RxDB documents a Supabase replication plugin using PostgREST for pull/push and Supabase Realtime for live change detection: [Supabase replication documentation](https://rxdb.info/replication-supabase.html).

### Security, authentication, and persistence

- **Verified:** RxDB is a client-side database/replication engine; its presence does not authorize a user to read or write a Supabase row. The remote endpoint must enforce authorization. For browser use, the RxDB Supabase documentation calls for the publishable/anon key plus strict Supabase RLS; a service-role key belongs only on a trusted server and must never be shipped to clients.
- **Verified:** The Supabase integration expects a string primary key, a modification timestamp for ordering, and a deletion marker/tombstone. It warns against hard deletion because offline clients would miss the deletion.
- **Assumption/recommendation:** Do not replicate an entire patient record as a first spike. Select one bounded, owner/tenant-scoped workflow and define the exact fields, row policy, retention, and deletion semantics before measuring performance.
- Local RxDB storage is persistent browser/device data and may contain clinical content. Apply the same offline-cache classification and clear-on-sign-out/retention policy as the existing queue. RxDB’s optional encryption/plugin features do not eliminate the need for OS/browser/device controls or server authorization.
- If the current application’s revision-guarded writes and recovery export are safety boundaries, an RxDB replication layer must surface equivalent states: pending, retrying, failed, conflict, resolved, and exported-for-recovery. A local document becoming “saved” in RxDB is not proof of remote persistence.

### Integration pitfalls and pilot measurements

- Compare against the existing Dexie queue with the same workflow, dataset, browser/device, network throttling, and failure injection. Measure cold startup, first usable read, local write latency, batch size, storage growth, reconnect time, duplicate-write rate, conflict rate, and recovery after tab/browser/process termination.
- Test token expiry and refresh during both pull and push; revoked users must stop receiving data and must not drain old writes under a new user/session. Test tenant and patient authorization at the server, not only in client selectors.
- Test missed Realtime events and forced resync. A live stream is not enough; the checkpoint path must recover from disconnects and server restarts.
- Test clock skew and equal modification timestamps. The checkpoint must be deterministic and unique enough to avoid skipped or repeated records.
- Test partial push acknowledgement, timeout after server commit, retry, duplicate request, 4xx authorization rejection, 409/conflict, 429/rate limit, 5xx, quota exhaustion, IndexedDB unavailable, schema migration, and app-version rollback. The replication docs explicitly note that a write may reach the remote before its response fails; idempotency/write IDs or equivalent duplicate detection are needed.
- Decide how tombstones are retained and eventually purged. Purging too early reintroduces missed-delete bugs; retaining them indefinitely can conflict with privacy deletion requirements and storage budgets.
- If using the Supabase plugin, verify the project’s RLS policies, Realtime publication, nullable-column mapping, schema types, and query filters. Do not infer that a query filter is an authorization policy.

**Decision:** keep RxDB at spike status until the measured comparison shows a correctness/recovery improvement that justifies migration cost and the pilot passes authorization, retention, conflict, and rollback gates.

## Cross-cutting release and security gates

1. **No production PHI in fixtures or pilot logs.** Synthea output is synthetic, but all generated files and local caches remain controlled test artifacts. Redact document content from telemetry and WebSocket/RxDB logs.
2. **Review-only clinical boundary.** Collaborative or offline data remains draft/review state. Chart insertion, export, or finalization requires the existing explicit user action and audit path.
3. **Server-side authorization.** Supabase RLS and/or an authenticated service endpoint must enforce tenant, user, patient, round, and room scope. Client-side room names, RxDB selectors, or Synthea fixture labels are not security controls.
4. **Identity attribution.** Record authenticated user ID, room/workflow ID, operation type, timestamp, and outcome in a privacy-safe audit event. Do not use Yjs awareness or local provider metadata as the durable audit record.
5. **Persistence and recovery contract.** Document what survives reload, tab close, browser restart, device loss, server restart, token revocation, schema upgrade, and rollback. Test each claimed guarantee.
6. **Operational limits.** Set maximum fixture population, document/update size, room count, connection count, replication batch size, retries, retention, and local storage usage. Fail visibly when a limit is reached.
7. **Rollback.** Keep the existing Dexie path available behind a feature flag for any RxDB/Yjs pilot. A failed pilot must be disableable without data conversion being required to restore the current workflow.
8. **Dependency review.** Pin exact versions/lockfile entries, record MIT/Apache-2.0 notices, scan transitive dependencies, and review prerelease packages such as the currently documented `@y/websocket` release candidate before approval.
9. **Verification.** Require unit, integration, browser E2E, security/authz, offline/reconnect, concurrent editing, storage failure, and release/deployment tests. A green unit suite alone is insufficient for these persistence and authorization claims.

## Verified facts vs assumptions summary

| Area | Verified from cited sources | Still an assumption / must be decided and tested |
|---|---|---|
| Synthea | Seeded CLI generation; configurable modules and exporters; FHIR formats; Apache-2.0 | Exact reproducibility contract, fixture retention, production-target guard, app round-trip validity |
| Yjs WebSocket | `WebsocketProvider`, room URL, params/protocols, sync/awareness/reconnect behavior; MIT | Auth mechanism, room authorization, durable server persistence, retention, audit attribution, encryption/device policy |
| Yjs IndexedDB | Local update persistence; `synced`, `destroy`, `clearData`, custom local metadata; MIT | Whether local clinical drafts are acceptable on target devices, clear-on-sign-out behavior, recovery expectations |
| RxDB | Schema-backed local database; pluggable storage; checkpoint pull/push; conflict handler; tombstones; Supabase plugin; Apache-2.0 | Whether it improves this app’s Dexie queue, exact RLS/query design, idempotency, conflict UX, migration/rollback cost |

## Source links

- Synthea: [repository](https://github.com/synthetichealth/synthea), [README](https://github.com/synthetichealth/synthea/blob/master/README.md), [properties](https://github.com/synthetichealth/synthea/blob/master/src/main/resources/synthea.properties), [Apache-2.0 license](https://github.com/synthetichealth/synthea/blob/master/LICENSE), [FHIR R4](https://hl7.org/fhir/R4/), [US Core](https://hl7.org/fhir/us/core/).
- Yjs: [y-websocket repository](https://github.com/yjs/y-websocket), [client source](https://github.com/yjs/y-websocket/blob/master/src/y-websocket.js), [server example](https://github.com/yjs/y-websocket/blob/master/src/server.js), [y-websocket docs](https://docs.yjs.dev/ecosystem/connection-provider/y-websocket), [y-indexeddb repository](https://github.com/yjs/y-indexeddb), [y-indexeddb docs](https://docs.yjs.dev/ecosystem/database-provider/y-indexeddb), [Yjs security guidance](https://docs.yjs.dev/getting-started/installation), [MIT licenses](https://github.com/yjs/y-websocket/blob/master/LICENSE) and [y-indexeddb LICENSE](https://github.com/yjs/y-indexeddb/blob/master/LICENSE).
- RxDB: [repository](https://github.com/pubkey/rxdb), [quickstart](https://rxdb.info/quickstart.html), [storage](https://rxdb.info/rx-storage.html), [replication](https://rxdb.info/replication.html), [Supabase replication](https://rxdb.info/replication-supabase.html), [Apache-2.0 license](https://github.com/pubkey/rxdb/blob/master/LICENSE.txt), [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security), [Supabase Auth server-side validation](https://supabase.com/docs/reference/javascript/auth-getuser).

## Open questions for the planning phase

- Which exact note fields are eligible for collaborative editing, and which must remain single-writer/revision-guarded?
- Is a self-hosted WebSocket service acceptable operationally, or must collaboration run through an existing Supabase/Edge boundary?
- What server-side durable persistence and retention period are required for Yjs updates, and what is the approved privacy deletion procedure?
- Which one workflow is the RxDB spike’s comparison target, and what current Dexie queue metrics are the baseline?
- What browser/device storage and sign-out guarantees are required for clinical drafts?
- Which FHIR profile/version and validation tooling are the application’s actual import/export contract?
