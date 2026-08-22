# Pinned inputs, environment, and ownership handoff

Status: `BLOCKED-PREFLIGHT`; no execution was authorized. Every `UNASSIGNED`
field below is a required handoff, not an observed result.

## Required pinned inputs

| Input | Required value before Step 2 | Status / evidence field |
| --- | --- | --- |
| Synthea release and commit | Exact release, commit, source URI, license, and archive SHA-256 | `UNASSIGNED` |
| Java/toolchain | Exact Java major/minor, Gradle/Maven/runtime versions and image/toolchain digest | `UNASSIGNED` |
| FHIR | R4 profile/package, terminology policy, validator package/CLI and version, validator image digest | `UNASSIGNED` |
| Synthea run | Modules, geography, locale, timezone, reference date, population, seed, config hash | `UNASSIGNED` |
| Normalization | Normalizer version/commit and canonicalization rules | `UNASSIGNED` |
| Browser/device | Exact Chromium and WebKit versions, macOS version, device model, viewport, network profile, storage quota | `UNASSIGNED` |
| Yjs toolchain | Exact Yjs, y-indexeddb, provider/server packages, commits, licenses, and image digests | `UNASSIGNED` |
| RxDB toolchain | Exact RxDB, adapter/plugins, RxJS, Node/npm versions, commits, licenses, and image digests | `UNASSIGNED` |
| Seed and fixture hash | Seed value, fixture-manifest SHA-256, normalized output SHA-256, changed-seed comparison hash | `UNASSIGNED` |

No value may be filled after results are seen. A missing value blocks the
dependent step and must be recorded in the inventory.

## Concrete namespace and evidence-store fields

| Field | Required value | Status |
| --- | --- | --- |
| Run root | `${TMPDIR}/rolling-rounds-third-party-pilots/<run-id>` outside application data | Planned; run-id `UNASSIGNED` |
| Track A namespace | `pilot-third-party/A/<run-id>/fixture` | Planned; owner `UNASSIGNED` |
| Track B namespace | `pilot-third-party/B/<run-id>/yjs` | Planned; owner-document scope `UNASSIGNED` |
| Track C namespace | `pilot-third-party/C/<run-id>/rxdb` | Planned; owner-document scope `UNASSIGNED` |
| Shared namespace | `pilot-third-party/shared/<run-id>` | Planned; owner `UNASSIGNED` |
| Immutable evidence store URI/key | Versioned append-only URI/key with access log and retention policy | `UNASSIGNED` |
| Evidence-store custodian | Named person/role and access group | `UNASSIGNED` |
| Recovery custodian | Named person/role for content-bearing recovery artifacts | `UNASSIGNED` |
| Deletion authority | Named person/role; no deletion before verification | `UNASSIGNED` |

Local staging paths and checksum-only receipts are not the immutable evidence
store and cannot satisfy packet completeness.

## Authority handoff

Technical owner, clinical-safety reviewer, privacy/security reviewer,
accessibility reviewer, business decision owner, release owner, independent
verifier, and cleanup verifier are all `UNASSIGNED`. Named approval and
timestamped immutable references are required before execution.
