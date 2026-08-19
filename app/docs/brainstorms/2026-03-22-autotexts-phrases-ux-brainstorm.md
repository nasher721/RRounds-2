---
date: 2026-03-22
topic: autotexts-phrases-ux
---

# Improve Autotexts and Clinical Phrases Sections

## What We're Building

Users have two overlapping systems: **Autotexts & Templates** (shortcut → expansion in the rich text editor, plus spell-check dictionary and named templates) and **Clinical Phrases** (foldered phrases with `{{fields}}`, version history, sharing, usage stats, picker integration). The goal is to make both areas easier to discover, organize, and use during rounding—without merging them into one confusing product.

Success looks like: faster insertion of the right snippet, fewer “wrong tool” moments, and better findability (search, recency, usage) in the phrase manager.

## Why This Approach

Three directions were considered:

### Approach A: Lightweight UX (recommended first)

Clarify purpose in-dialog, add copy/quick actions, sort phrases by name / recent / usage, and improve empty states (search vs truly empty). **Pros:** Small surface area, uses existing `usageCount` / `lastUsedAt`, no schema changes. **Cons:** Does not unify data models. **Best when:** Shipping value quickly (YAGNI).

### Approach B: Deeper editor integration

Single picker entry point that surfaces both autotext rows and phrases with badges, or conflict warnings when shortcuts collide. **Pros:** One mental model at insertion time. **Cons:** More engineering and testing across `RichTextEditor` and `PhrasePicker`. **Best when:** Users repeatedly confuse the two at charting time.

### Approach C: Analytics and team workflows

Promote `ClinicalPhraseAnalytics` from settings, phrase export bundles, team onboarding. **Pros:** Power users and admins. **Cons:** Heavier scope. **Best when:** Adoption and governance matter more than day-one list UX.

**Recommendation:** Start with **Approach A**, then revisit B if shortcut confusion remains measurable.

## Key Decisions

- **Keep two systems** for now; differentiate with short copy: autotexts = fast shorthand in any note field; phrases = structured, reusable blocks with optional fields and folders.
- **Phrase list ordering** — Expose sort: name (default), recently used, most used—aligned with `PhrasePicker` recency/popularity logic.
- **Empty states** — Distinguish “no phrases yet” from “no matches for search/folder.”
- **Autotext rows** — Add copy-to-clipboard on expansion text for quick reuse outside the editor.
- **Defer** — Shortcut conflict matrix between `autotexts` table and `clinical_phrases.shortcut` (document as open question; resolve in planning if prioritized).

## Open Questions

- **Resolved (Phase 1):** The autotext dialog uses a single `DialogDescription` for all tabs, so templates share the same “use Phrases for longer snippets” guidance without per-row copy.
- **Resolved (Phase 2 plan):** Link `ClinicalPhraseAnalytics` from the Phrase Manager toolbar (see [docs/plans/2026-03-22-autotexts-phrases-phase-2-plan.md](../plans/2026-03-22-autotexts-phrases-phase-2-plan.md)).

## Phase 1 shipped (2026-03-22)

- `AutotextManager`: dialog description clarifies autotexts vs phrases; copy button per autotext row; search-no-match messages for autotexts and templates.
- `PhraseManager`: sort by name / recently used / most used; header blurb pointing to autotexts; empty states for true empty library vs filtered empty.

## Phase 2 shipped (2026-03-22)

- `ClinicalPhraseAnalytics` in Phrase Manager toolbar (`phrases` prop); nested dialog for charts.
- `getPhraseShortcutConflicts` in `src/lib/phraseShortcutConflicts.ts`; `useCloudAutotexts` in `PhraseManager`; amber overlap alert under shortcut fields (save not blocked).

## Phased Delivery

| Phase | Focus |
|-------|--------|
| **1** | Dialog copy, phrase sort, empty-state messaging, autotext copy buttons |
| **2** | Optional: link to phrase analytics from manager; shortcut conflict warning in phrase form when duplicate |
| **3** | Optional (Approach B): unified insertion surfacing or picker tabs |

## Next Steps

→ Implementation plan: [docs/plans/2026-03-22-autotexts-phrases-phase-2-plan.md](../plans/2026-03-22-autotexts-phrases-phase-2-plan.md) (Phase 2). Phase 3 remains optional (unified picker / editor).
