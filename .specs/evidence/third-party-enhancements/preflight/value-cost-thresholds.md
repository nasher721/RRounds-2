# Preflight contract: user value and operational cost

Status: `BLOCKED-PREFLIGHT`; ceilings require named business/release approval.

| Gate | Requirement |
| --- | --- |
| Track A | 3/3 round-trip tasks; no manual repair; median time |
| Track B | 10/10 edit/review/apply or conflict-review tasks; visible status |
| Track C | 20/20 offline/reconnect tasks; visible terminal outcome |
| Performance | RxDB reconnect-drain p95 improvement >=20% over frozen Dexie baseline |
| Safety | zero silent loss, duplicates, owner leaks, unreviewed writes, hidden terminal status |
| Cost | operator minutes, CI delta, storage, namespace maximum, service CPU/memory/run hours, cleanup/support/dependency-review counts against approved ceilings |
| Bundle | disposable-pilot production bundle delta is zero |

Numeric ceilings must be approved before results are seen. Owner: `UNASSIGNED`.
