# Preflight contract: RxDB comparison

Status: `BLOCKED-PREFLIGHT`; RxDB is not installed and must not be added by this task.

| Contract item | Frozen planning value |
| --- | --- |
| Workload | one owner-scoped `draft_field` round workflow; 3 synthetic patients; 20 representative mutations; reload/reconnect |
| Primary key | opaque string `{ownerScope}:{roundId}:{patientId}:{field}:{writeId}`; no patient identifiers in telemetry |
| Checkpoint | `(modifiedTime, primaryKey)` ascending; duplicate write IDs are idempotent |
| Tombstones | retained until finite retention limit and verified owner-scoped purge |
| Storage | isolated disposable RxDB namespace; Dexie/IndexedDB remains control/source of truth |
| Failures | network, auth, backend 4xx/5xx, quota, clock skew, missed event, partial acknowledgement, conflict, retry, deletion retention |
| Migration | no server/schema migration allowed; any requirement stops the spike for separate design |

Timing requires 30 applicable repetitions per implementation and 20
offline/reconnect correctness runs. Primary metric is reconnect-to-drain-complete;
report raw values, median, p95, sample count, and formula. Candidate threshold:
`(Dexie p95 - RxDB p95) / Dexie p95 >= 0.20`, with zero integrity/owner failures.
