# Immutable-store and named-owner approval gate

Status: `BLOCKED-PREFLIGHT` / `NOT EXECUTED`. This is a pre-execution gate record, not an approval or execution result.

| Gate | Required value | Current value | Status / blocker |
| --- | --- | --- | --- |
| Immutable evidence store | Approved append-only store URI/key, access policy, retention, and later object hash | `UNASSIGNED` | BLOCKED before Step 1; no store selected or approved |
| Named preflight decision owner | Named person accountable for opening the gate | `UNASSIGNED` | BLOCKED before Step 1; no approval authority |
| Named release/program owner | Named person accountable for release and source-boundary gate | `UNASSIGNED` | BLOCKED before Step 1 |
| Named independent verifier | Named person who verifies manifest, isolation, and handoff references | `UNASSIGNED` | BLOCKED before Step 2; no verifier handoff |
| Clinical-safety, privacy/security, accessibility reviewers | Named reviewers and signatures | `UNASSIGNED` | BLOCKED before any pilot execution |

Required before execution: record the immutable-store URI/key and policy, then obtain named-owner approval and a timestamped verifier handoff for `manifest-validation.json` and `isolation-check.txt`. Until every value is assigned and signed, execution remains disabled, no pilot evidence may be created, and production approval is `NO-GO`.
