# Baseline command record

Status: `BLOCKED-PREFLIGHT`. This ledger records required commands without inferring execution. The lockfile failure remains open and no baseline or pilot success is claimed.

| Command | Status | Timestamp (America/New_York) | Stdout/stderr reference | Blocker / disposition |
| --- | --- | --- | --- | --- |
| `npm --prefix app run lint` | UNKNOWN / NOT EXECUTED | UNRECORDED | `step-01/baseline-regression.txt` (no command-specific output) | NOT EXECUTED; no pass claim; baseline remains blocked |
| `npm --prefix app run typecheck` | UNKNOWN / NOT EXECUTED | UNRECORDED | `step-01/baseline-regression.txt` (no command-specific output) | NOT EXECUTED; no pass claim; baseline remains blocked |
| `npm --prefix app test -- src/lib/auth/clearSensitiveClientState.test.ts src/lib/offline/indexedDBQueue.test.ts src/lib/offline/syncEngine.test.ts src/lib/round/sync/roundOutbox.test.ts src/lib/round/roundCompletionSafety.test.ts` | UNKNOWN / NOT EXECUTED | UNRECORDED | `step-01/baseline-regression.txt` (no command-specific output) | NOT EXECUTED; no pass claim; baseline remains blocked |
| `npm --prefix app run test:e2e:synthetic -- e2e/data-integrity.e2e.spec.ts e2e/accessibility.e2e.spec.ts e2e/production-save-canary.e2e.spec.ts` | UNKNOWN / NOT EXECUTED | UNRECORDED | `step-01/baseline-regression.txt` (no command-specific output) | BLOCKED-PREFLIGHT; not run |
| `npm --prefix app run test:e2e:webkit -- e2e/accessibility.e2e.spec.ts` | UNKNOWN / NOT EXECUTED | UNRECORDED | `step-01/baseline-regression.txt` (no command-specific output) | BLOCKED-PREFLIGHT; not run |
| `npm --prefix app run build` | UNKNOWN / NOT EXECUTED | UNRECORDED | `step-01/baseline-regression.txt` (no command-specific output) | NOT EXECUTED; no pass claim; baseline remains blocked |
| `npm --prefix app run verify:lockfile` | FAIL (exit 1) | UNRECORDED | `step-01/baseline-regression.txt` | OPEN PRE-EXISTING FAILURE; blocks baseline and all pilots; do not claim success |

Historical handoff did not capture command-specific stdout/stderr or exact timestamps. A future rerun must append fresh values rather than overwrite this open failure record.
