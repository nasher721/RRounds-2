# Preflight contract: Synthea/FHIR

Status: `BLOCKED-PREFLIGHT`; execution is not authorized.

| Decision | Frozen value | Owner/approval |
| --- | --- | --- |
| FHIR version/profile | R4; profile and terminology policy must be named before run | UNASSIGNED |
| Validator | Exact package/CLI and version must be pinned before run | UNASSIGNED |
| Severity policy | Error blocks; warning is retained and dispositioned; no silent suppression | UNASSIGNED |
| Mapping boundary | `app/src/lib/fhir.ts`, existing import-safety path, `Patient` shape, and `app/e2e/fixture-state.ts` | read-only control paths |
| Generator | Synthea version/commit, Java major, modules, locale/timezone, geography, reference date, population, and seed | UNASSIGNED |

Required fields: synthetic Patient identity; Observation value/unit/effective
date/provenance; MedicationRequest or MedicationStatement status/medication/
dates; AllergyIntolerance severity/reaction/dates; Encounter/timeline dates and
provenance. Missing values render `Not documented`. Every difference is
classified `preserved`, `normalized`, `intentionally-lossy`, `unsupported`, or
`absent`. Validator success cannot substitute for application round-trip.
