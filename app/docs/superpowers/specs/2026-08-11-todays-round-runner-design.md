# Design: Today’s Round Runner (Focus-first UI)

**Date:** 2026-08-11  
**Status:** Approved for implementation planning  
**Product:** Round Robin Notes (`remix-of-remix-of-round-robin-notes`)

## Goal

Make ICU rounding feel seamless across phone and workstation by redesigning the product around a **Round runner**, not a feature dashboard. Optimize for **bed-by-bed rounds speed** and **device continuity**, with a ruthless mid-rounds core and offline-capable session sync.

## Decisions (locked)

| Topic | Decision |
|-------|----------|
| Primary goals | Rounds speed + mixed-device continuity |
| Feature posture | Ruthless mid-rounds core; demote secondary tools |
| Mid-rounds chart | Identity, clinical summary, systems review, todos, next/prev |
| Systems UX | Compact stack; one system expanded at a time |
| Device mix | Truly mixed phone ↔ workstation mid-list |
| Continuity bar | Full session: list position, filters, patient, section, drafts, expanded systems |
| Connectivity | Offline-capable mid-rounds core; explicit field conflicts |
| Product model | “Today’s Round” as top-level object |
| Shell | Focus-first (roster as overlay); quiet `Round · N/M` cue |
| Visual companion | Focus-first chosen over split runner and round-strip |

## Non-goals (v1)

- Cohort boards / spatial bed board as home
- Dual “Rounds vs Workbench” modes
- Keeping every current control one tap away in primary chrome
- Multi-user live cursors, ambient AI, rich timeline as primary surfaces
- Silent conflict resolution that drops edits

## Product concept

### Top-level objects

- **Round** — Today’s working session: ordered patient list, current position, filters, done/skip state, joinable from multiple devices.
- **Patient (in round)** — Identity plus mid-rounds chart slice.
- **Chart slice** — Clinical summary, systems review (compact stack), todos.
- **Tools** — Secondary surface for demoted capabilities; never primary chrome.

### Primary user loop

1. Start or resume Today’s Round (or open from import).
2. Land on current patient (session restores position and filters).
3. Scan systems stack → expand hot systems → todos → summary as needed.
4. Mark done / next / prev.
5. End Round → print/export/handoff → mark Round complete.

### Screens (same mental model on both devices)

- **Round Home** — Today’s list, position marker, minimal search/filter, Start/Resume, Import.
- **Patient Focus** — Default screen: identity, summary, compact systems, todos, done/next/prev.
- **Roster Overlay** — Summoned list for jump/search; does not leave Patient Focus route.
- **Round End** — Print/export/handoff; clear completion state.
- **Tools Sheet** — Single secondary entry (`Tools •••`).

## Shell & interaction (Focus-first)

### Chrome

- Top: `☰ Round · N/M`, quiet offline/sync cue, `Tools •••`.
- Identity: name · bed · light meta.
- Sticky actions: Done · Next (Prev available).
- Clinical summary: compact by default; expand when focused.
- Systems: compact rows with short collapsed cues; **one expanded at a time**.
- Todos: always visible under systems with `+ Task`.

### Navigation

- Roster overlay via ☰ / `R` / Esc-to-close.
- Desktop keys: `J`/`K` or `]`/`[` next/prev; `D` done; `/` search in roster overlay.
- Mobile: list → Patient Focus; overlay for roster; sticky next/prev; mount only active section (no stacked screens).

### First-class vs Tools

**First-class**

- Mid-rounds core (roster, identity, summary, systems, todos, next/prev/done)
- Import Patient List
- End-Round print/export
- Account basics (theme, sign-out)

**Tools ••• (demoted)**

- AI command palette / drafts
- IBCC, guidelines
- Phrases / autotexts admin
- Compare, risk calc, timeline, census
- Change-tracking prefs, advanced settings
- Destructive admin (e.g. clear-all)

**Rule:** If it isn’t needed between Next taps at the bedside, it does not get primary chrome.

## Session sync, offline, conflicts

### Channels

1. **Round state** — list order, filters/search, current index/selected patient, done/skip, active section, expanded system id(s).
2. **Chart drafts** — clinical summary, per-system notes, todos, identity fields.

Each device keeps a local Round cache, draft buffer, and outbox. Online: near-real-time sync. Offline: full mid-rounds core remains editable; outbox drains on reconnect.

### Conflict rules (same clinician, two devices)

- Non-overlapping edits → last-write-wins **per field**.
- Same field diverged offline → conflict UI: Mine / Theirs / Edit merge; never silent drop.
- Round position → newest device navigation wins.
- Expanded system → last-focused device wins.
- UI cues: quiet `offline · syncing · conflict` in the top bar; modal only when a field needs a choice.

### Persistence sketch

- IndexedDB for offline core + outbox (extend existing offline/queue patterns where safe).
- Supabase for patients and Round session state (`round_state` or equivalent).
- Reuse existing patient hooks/services for chart persistence.

## Round lifecycle

1. **Start Round** — empty list or resume today’s open Round.
2. **Build list** — Import Patient List (first-class) or add one patient (no blank anonymous insert by default; coaching for empty Round).
3. **Run** — Focus-first Patient Focus + roster overlay.
4. **End Round** — Print/Export / handoff summary → mark Round complete.

One active Round per user in v1 (team join later is out of scope unless already trivial).

## Architecture & migration

### UI components

`RoundHome` · `PatientFocus` · `RosterOverlay` · `RoundEnd` · `ToolsSheet`

### Domain

- Round session store
- Chart slice adapters (summary / systems / todos)
- Outbox + conflict resolver

### Migration stance (strangler)

- Introduce Round shell routes/components first.
- Demote `DesktopDashboard` / mobile utility megabar into `ToolsSheet`.
- **Reuse:** systems editors, todos, import pipeline, print modal, auth (re-skinned, not rewritten).
- **New:** Round entity, session sync, offline outbox for Round state, conflict UI, Focus-first navigation.
- Preserve verification checklist from existing UI redesign docs for auth, CRUD, systems save/load, import, print — entry points may move into Tools or End Round.

## Error handling

| Situation | Behavior |
|-----------|----------|
| Offline | Cue visible; mid-rounds core editable; pending writes shown |
| Sync fail | Retry with backoff; never wipe local drafts; clear pending only after ack |
| Field conflict | Inline on that field; rest of chart usable |
| Import fail / timeout | Actionable error on Round Home; no silent partial apply without summary |
| Empty Round | Coaching: Import or Add — no anonymous blank insert by default |
| Tools offline | Disabled or “needs network”; Patient Focus remains usable |

## Testing bar

1. **Rounds path E2E** — import → walk ≥5 patients (systems + todos) → next/prev/done → end print.
2. **Device hop** — edit on A offline, open B, resume same Round/position/drafts; cover same-field conflict.
3. **Focus-first chrome** — roster overlay open/close; Tools absent from primary chrome.
4. **Regression preserve** — auth, patient CRUD, systems save/load, import, print still work (demoted entry points OK).
5. **A11y smoke** — keyboard next/prev, roster search, dark-theme contrast.

Out of scope for this redesign’s test bar: full AI trust UI, compare, ambient listening, multi-user live cursors.

## Relationship to prior work

Supersedes incremental “polish only” framing for the main shell. Aligns with and replaces the north star of:

- `docs/brainstorms/2026-03-26-patient-list-workflow-ux-brainstorm.md` (workflow lanes) — Round runner is the stronger product frame.
- `docs/UI-REDESIGN-PHASED-PLAN.md` — token/shell polish remains useful inside the new shell, not as the primary strategy.
- `docs/brainstorms/2026-03-22-dashboard-rounding-ux-brainstorm.md` — retain new-patient safety, a11y, and coaching patterns where they fit Focus-first.

## Success criteria

- Clinician can run a full list with almost no hunting for controls.
- Switching phone ↔ workstation mid-patient restores Round position, filters, section, drafts, and expanded system without re-orienting.
- Mid-rounds core works offline; conflicts are explicit and recoverable.
- Secondary tools remain available but never compete with Next/Done.

## Next step

Invoke **writing-plans** to produce an implementation plan after user review of this spec.
