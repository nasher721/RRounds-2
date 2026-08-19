# Code Review: Phased Remediation Plan

## Phase 0 — Stabilize Tooling (Immediate)
- Restore deterministic dependency installs (`npm ci`) by reconciling `package.json` and `package-lock.json`.
- Re-enable baseline CI checks:
  - `npm run lint`
  - `npm run build`
  - `npm test`
- Add a lightweight "health" CI workflow that fails fast if core toolchain packages are missing.

## Phase 1 — Reliability & UX Defects (High Priority)
- Standardize timeout handling for long-running Supabase edge-function calls.
- Eliminate event-propagation bugs in selectable cards/rows where nested controls trigger duplicate handlers.
- Normalize user-facing error messages for clarity and actionability.

## Phase 2 — Type Safety & Maintainability (High Priority)
- Remove dead imports and unreachable state synchronization logic.
- Add stricter type coverage for external service responses to avoid implicit `any` pathways.
- Address files with `eslint-disable` usage and convert to safe hook patterns where possible.

## Phase 3 — Security & Data Quality (Medium Priority)
- Review import/parsing paths for PHI-safe logging and redact sensitive fields from console output.
- Add guardrails for malformed OCR content and large-document handling (page limits, retries, partial processing).

## Phase 4 — Test Coverage Expansion (Medium Priority)
- Add unit tests for parsing timeout behavior and import selection interactions.
- Add integration tests for:
  - PDF text extraction fallback to OCR
  - Clipboard import failure states
  - Duplicate-bed warning behavior

## Phase 5 — Performance & Observability (Medium/Long-Term)
- Add instrumentation around parse duration and failure rate by path (text extraction vs OCR).
- Add user-facing progress telemetry checkpoints for long OCR runs.
- Profile rendering cost for large parsed patient lists and virtualize if needed.
