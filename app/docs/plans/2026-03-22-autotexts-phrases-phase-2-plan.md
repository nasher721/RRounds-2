# Plan: Autotexts & Phrases — Phase 2

## Traceability

- **Brainstorm:** [docs/brainstorms/2026-03-22-autotexts-phrases-ux-brainstorm.md](../brainstorms/2026-03-22-autotexts-phrases-ux-brainstorm.md)
- **Phase 1 (shipped):** Dialog copy, phrase sort, empty states, autotext copy buttons — see brainstorm “Phase 1 shipped” section.
- **Phase 2 scope (from brainstorm):** Link phrase analytics from the phrase manager; shortcut conflict warning when a phrase shortcut duplicates another source.

---

## Overview

| Workstream | Goal |
|------------|------|
| **2.1 Phrase analytics entry** | Surface `ClinicalPhraseAnalytics` from `PhraseManager` so usage charts are discoverable (component exists today but is not mounted anywhere in `src/`). |
| **2.2 Shortcut conflict hints** | When saving a phrase, warn if the autotext shortcut collides with an autotext or another phrase, with copy that reflects **editor precedence** (see below). |

**Out of scope for Phase 2:** Unified picker / editor merge (Phase 3), phrase export bundles, backend validation constraints.

---

## Current behavior (for conflict copy)

- **`RichTextEditor` / `ImagePasteEditor`:** On Space/Tab, the current word is matched against **`autotexts` first** (`shortcut` equals the typed word, case-insensitive). If a match exists, that expansion wins; dictionary autocorrect runs after.
- **Clinical phrases:** Shortcuts are primarily used via **PhrasePicker** / `usePhraseExpansion` flows; the main editor path does **not** call `getPhraseByShortcut` on the same Space/Tab handler as autotexts. Collisions still confuse users in **settings** and if future editor work unifies behavior.
- **Normalization:** Compare shortcuts with `trim().toLowerCase()`. Treat empty/whitespace-only shortcut as “no shortcut” (no conflict).

---

## 2.1 Phrase analytics entry

### 2.1.1 Problem

`ClinicalPhraseAnalytics` ([`src/components/ClinicalPhraseAnalytics.tsx`](../../src/components/ClinicalPhraseAnalytics.tsx)) is implemented (dialog + charts + `phrase_usage_log` queries) but **no route or parent renders it**, so analytics are unreachable in the app.

### 2.1.2 Implementation

1. **Import** `ClinicalPhraseAnalytics` into [`PhraseManager.tsx`](../../src/components/phrases/PhraseManager.tsx).
2. **Placement:** In the main list view header row (same band as search, sort, “New Phrase”), add the component **after** the search/sort cluster so the trigger button sits beside “New Phrase” (or between search and New Phrase — prefer **toolbar order:** Search → Sort → **Analytics** → New Phrase).
3. **Props:** Pass `phrases={phrases}` from existing `useClinicalPhrases()` data (already in scope).
4. **Nested dialogs:** `PhraseManager` is a `Dialog`; `ClinicalPhraseAnalytics` wraps content in its own `Dialog`. Verify focus trap and stacking (Radix/shadcn typically handle this). Manual check: open Phrase Manager → Analytics → scroll charts → close → close manager.
5. **Optional polish:** If the Analytics trigger is too wide on small viewports, rely on existing `hidden sm:inline` on the label inside `ClinicalPhraseAnalytics`, or add `shrink-0` to the toolbar so the row wraps as already done for sort.

### 2.1.3 Acceptance

- [x] From desktop **Manage Phrases**, user can open **Analytics** and see usage data (or empty/zero states) without console errors.
- [x] Same flow reachable when `PhraseManager` is opened from mobile settings (same component).
- [x] No duplicate fetch of phrases solely for analytics beyond what `ClinicalPhraseAnalytics` already does when its dialog opens (`open` → `fetchUsageStats` + `generateSuggestions`).

---

## 2.2 Shortcut conflict warning

### 2.2.1 Data needed

- **Autotext shortcuts:** Merged list from `useCloudAutotexts()` — same source as dashboard (`autotexts` state includes defaults + DB overrides). Import hook in `PhraseManager` **or** extract a tiny helper that accepts `AutoText[]` if you prefer prop injection from parents; **recommended:** `useCloudAutotexts()` inside `PhraseManager` for a single source of truth and minimal prop drilling.
- **Other phrases:** Existing `phrases` from `useClinicalPhrases()`; exclude `editingPhrase?.id` when checking duplicates.

### 2.2.2 Logic

Add a pure helper (e.g. [`src/lib/phraseShortcutConflicts.ts`](../../src/lib/phraseShortcutConflicts.ts)):

```text
getPhraseShortcutConflicts(input: string | null | undefined, ctx: {
  autotextShortcuts: string[]
  phrases: { id: string; shortcut: string | null; name: string }[]
  excludePhraseId?: string
}): { type: 'autotext' | 'phrase'; label: string }[]
```

- Normalize input with `trim().toLowerCase()`; if result is empty, return `[]`.
- Autotext match: any `autotext.shortcut` normalized equals input.
- Phrase match: any phrase with `id !== excludePhraseId` and normalized `shortcut` equals input.
- Return structured conflicts for UI messaging (include phrase **name** for phrase-vs-phrase).

### 2.2.3 UI

- **Location:** Phrase create/edit form — the **Autotext Shortcut** field ([`PhraseManager.tsx`](../../src/components/phrases/PhraseManager.tsx) — `formData.shortcut`).
- **Presentation:** Inline `Alert` variant `default` or muted text below the field (not `destructive` unless you block save — default is **warning only**).
- **Copy:** Explain that **if the same token is also an autotext, the editor expands the autotext first on Space/Tab** (short, non-alarmist).
- **Save behavior:** **Do not block save** in Phase 2 (brainstorm: “warning”). Optional follow-up: settings flag to hard-block duplicates.

### 2.2.4 Performance

- Memoize conflict list with `useMemo` depending on `formData.shortcut`, `autotexts`, `phrases`, `editingPhrase?.id`.

### 2.2.5 Acceptance

- [x] Typing a shortcut that matches an autotext shows a visible warning before save.
- [x] Typing a shortcut that matches **another** phrase shows which phrase name conflicts.
- [x] Editing an existing phrase does not flag a conflict with itself.
- [x] Clearing the shortcut field clears warnings.

---

## Testing (manual)

| Case | Action |
|------|--------|
| Analytics | Open Phrase Manager → Analytics → switch 7d/30d/90d → close |
| Autotext conflict | Create phrase with shortcut identical to a known autotext (e.g. from seeded defaults) → warning visible → save still works |
| Phrase conflict | Two phrases with same shortcut → second shows conflict with first’s name |
| Mobile | Settings → Phrases → same checks |

---

## Risks / follow-ups

- **Double `useCloudAutotexts`:** Dashboard and `PhraseManager` may both subscribe; acceptable unless perf issues appear — then lift autotexts into a shared provider (out of scope for Phase 2).
- **Phase 3:** If product wants **editor** to prefer phrase over autotext or merge flows, revisit `RichTextEditor` key handler order and this warning copy together.

---

## Completion checklist

- [x] `ClinicalPhraseAnalytics` mounted from `PhraseManager` with `phrases` prop
- [x] `getPhraseShortcutConflicts` (or equivalent) + memoized warnings in phrase form
- [x] Brainstorm open question updated: analytics entry resolved (link to this plan)
