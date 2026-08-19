# Brainstorm: Patient List Workflow UX

## What We're Building

Redesign the main patient-list experience around a workflow-centered workspace that is cleaner, easier to scan, and easier to act on for mixed users (power users and occasional users).

The new direction prioritizes reducing confusion over where actions live by organizing the UI into clear, task-oriented areas:
- Roster (find/select patients quickly)
- Patient Workspace (do focused patient work)
- Team Actions (batch, compare, print, AI, and shared workflows)

This is a major redesign (not incremental polish) with a user-centered emphasis on clarity, orientation, and safer interactions.

## Why This Approach

The current UI is feature-rich but action surfaces are fragmented across headers, menus, utility bars, and contextual controls. That increases cognitive load and makes it harder for mixed users to confidently find the next action.

A workflow-centered structure aligns with clinical rounding behavior:
1. Find the right patient/cohort
2. Work the active patient
3. Trigger team-level actions when needed

Compared with a command-surface-only cleanup, this approach should deliver larger clarity gains. Compared with a cohort-first redesign, it keeps complexity lower while still enabling future grouping and batch workflows.

## Key Decisions

- **Primary objective:** reduce confusion and cognitive load in the main dashboard/patient list flow.
- **Target users:** mixed team users (power + occasional), not a single persona.
- **Scope:** major redesign of interaction model and view patterns.
- **Success signal:** users more easily understand where actions live and what to do next.
- **Information architecture direction:** workflow-centered lanes (`Roster`, `Patient Workspace`, `Team Actions`).
- **Consistency direction:** align desktop/mobile mental model around the same action hierarchy, while preserving platform-appropriate interaction patterns.
- **Safety direction:** standardize destructive-action behavior and confirmations.

## Resolved Questions

1. **Alternate list views in first rollout:** Include a second list view (for example, compact table mode) in v1.
2. **Team actions visibility:** Keep team-level actions always visible as a persistent lane.

