# Business rationale — third-party enhancement pilots

The original draft named useful technologies but mixed three different
decisions: synthetic test-data enablement, collaborative draft editing, and an
offline-storage replacement. It also left success thresholds, user value, and
stop conditions implicit. This refinement separates the pilots so each can be
judged on its own evidence and does not let a successful data-fixture pilot
authorize a clinical collaboration or storage change.

The scope is intentionally pilot-only. The repository already has FHIR and
Dexie/IndexedDB-based clinical workflows, Yjs and explicit offline/conflict
controls, and release documentation that requires synthetic data, PHI-safe
telemetry, review-before-chart insertion, and named clinical/privacy/security
sign-off. The feature brief therefore treats existing behavior as a safety
contract to preserve, not as proof that any third-party library is ready.

The business decision is:

- adopt Synthea fixtures only if they are deterministic and expose mapping loss;
- consider Yjs only if collaboration is authorized, attributable, recoverable,
  accessible, and review-only;
- consider RxDB only if it materially improves a measured offline outcome
  without weakening ownership isolation or recovery.

Any safety failure, PHI exposure, silent loss/duplication, wrong-patient path,
unreviewed chart mutation, or missing required sign-off is an immediate no-go.
Passing a pilot creates a new implementation decision and evidence package; it
does not authorize production rollout or a broad rewrite.
