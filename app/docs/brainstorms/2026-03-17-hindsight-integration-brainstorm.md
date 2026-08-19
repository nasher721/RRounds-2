---
date: 2026-03-17
topic: hindsight-integration
---

## Hindsight Integration for Per-Clinician Agents

### What We're Building

Integrate the Hindsight agent memory system into Round Robin Notes to create per-clinician agents that learn over time. These agents will:
- Adapt existing AI helpers (clinical assistant, transformers, summaries) to each clinician’s style and preferences.
- Personalize phrase/template suggestions and ranking based on real usage.
- Enable workflow-level “rounding assistant” behaviors that surface longitudinal insights about patients and clinician habits.

Hindsight will run as a separate service with a thin TypeScript client in the app. Memories will be organized primarily by clinician, with contextual metadata for patient, note type, and tool surface.

### Why This Approach

We favor a central Hindsight service with a thin client because it:
- Minimizes invasive changes to the current architecture while enabling reuse across multiple surfaces (AI helpers, phrases, rounding workflows).
- Keeps Hindsight upgrades and hosting concerns decoupled from the main app.
- Allows gradual rollout: start with low-risk personalization of AI helpers, then extend to phrases/templates and finally to more opinionated workflow suggestions.

Deeper backend-only or worker-centric integrations remain options for later, but the initial focus is on a pragmatic, incremental path.

### Key Decisions

- **Memory identity model**: Use per-clinician banks keyed as `clinician:{supabase_user_id}`, with metadata for `patient_id`, `note_type`, `tool_name`, `timestamp`, and other contextual fields. Consider patient-scoped banks or stronger patient tagging in later phases.
- **Deployment model (initial)**: Run Hindsight via Docker in dev and a dedicated container/VM in staging/prod, fronted by internal networking and env-configured base URL and API key.
- **Integration style**: Implement a thin TypeScript wrapper around the Hindsight HTTP API and use it from existing AI utilities/hooks/functions to call `retain`, `recall`, and later `reflect`.
- **Scope of data retained (initial)**: Focus on non-raw or lightly processed content where possible (e.g., prompts, AI outputs, and short derived summaries of clinician edits), avoiding unnecessary PHI in the earliest iterations.
- **Rollout strategy**: Start with opt-in or limited pilot for a subset of clinicians, with clear toggles to disable learning-based behavior if needed.

### Phase 0 – Foundations & Safety

- Decide and document:
  - Bank ID format and metadata schema.
  - Which AI flows and text types are allowed to send content into Hindsight.
  - Retention and deletion policies for clinician memories.
- Stand up Hindsight in dev via Docker and configure:
  - Base URL and API key in app config.
  - LLM provider and model for the Hindsight server.
- Implement a small TypeScript client wrapper:
  - `retainMemory({ bankId, content, metadata })`
  - `recallMemories({ bankId, query, filters })`
  - `reflectOnMemories({ bankId, query })` (stubbed for later phases).
- Add observability hooks (logging/metrics stubs) around calls to the wrapper.

### Phase 1 – Personalize Existing AI Helpers (Goal A)

- Identify all current AI helper flows:
  - Clinical assistant, daily/interval summaries, text transforms, and any other AI edge-function integrations.
- For each flow:
  - Before building the LLM prompt, call `recallMemories` with a high-level query such as “summarization and writing preferences for this clinician in this note type and tool”.
  - Inject a compact “clinician style & preferences” segment into the system prompt, derived from recalled memories.
  - After receiving the AI output (and optionally after clinician edits if available), call `retainMemory` with:
    - `content`: input, AI output, and short derived summary of how the clinician changed the text (if known).
    - `metadata`: `{ tool_name, note_type, patient_id?, timestamp, action: 'ai_helper' }`.
- Add a per-user setting (and a global feature flag) to enable/disable Hindsight-powered personalization.
- Define simple success metrics and logging fields to track adoption and potential regressions (e.g., error rates, latency changes).

### Phase 2 – Personalize Phrases and Templates (Goal B)

- Map current phrase/autotext/template flows:
  - Where suggestions are generated and how clinicians accept, ignore, or edit them.
- Extend integration:
  - `retainMemory` on key interactions:
    - Accepted suggestion with minimal edits.
    - Heavily edited suggestion.
    - Suggestions consistently ignored in certain contexts.
  - Use `recallMemories` to:
    - Rank/boost phrase and template suggestions by clinician and context.
    - Provide context into LLM prompts that generate new phrases so they align with clinician style and prior choices.
- (Optional) Introduce periodic `reflectOnMemories` jobs:
  - Generate explicit “style model” or “preferred phrase/template” summaries per clinician bank.
  - Store and reuse these summaries directly in prompts to reduce token usage.
- Track impact using:
  - Suggestion acceptance rates.
  - Time to complete notes when using suggestions.

### Phase 3 – Workflow-Level Rounding Assistant (Goal C)

- Extend the memory model to better capture longitudinal context:
  - Decide whether to:
    - Continue using a single clinician bank with heavier use of `patient_id` metadata, or
    - Introduce composite bank IDs for clinician+patient where appropriate.
- Instrument key rounding and patient-course events:
  - Major course changes, critical labs/imaging, dispo decisions.
  - Todo creation and completion patterns (especially repeated or missed tasks).
  - AI-generated course summaries and how clinicians modify them.
- Define concrete “assistant behaviors” powered by `reflectOnMemories`, for example:
  - Highlight likely overlooked todos or follow-ups based on similar past cases for that clinician.
  - Summarize “what changed in the last 24–48 hours” for a given patient, tuned to that clinician’s focus areas.
  - Suggest patterns of practice or risks (e.g., frequent delays in ordering standard follow-ups) to surface non-judgmental nudges.
- Surface insights in the UI in low-friction ways:
  - A lightweight “Hindsight insights” section on the patient card or rounding view.
  - Small, dismissible suggestions rather than blocking workflows.
- Pilot with a limited group of clinicians and gather structured feedback.

### Phase 4 – Hardening, Controls, and Iteration

- Strengthen observability:
  - Add metrics for call latency, error rates, recall/reflect usage, and memory volume per bank.
  - Add structured logs for privacy/security auditing where needed.
- Expand controls:
  - Per-clinician toggles for learning and personalized behavior.
  - Admin tools to inspect, export, and purge memory banks for support or compliance.
- Iterate on:
  - Prompting patterns for `retain`, `recall`, and `reflect`.
  - Metadata schemas and filters that define which memories are used in which flows.
  - Any cold-start strategies for new clinicians (e.g., default style presets before enough memory accumulates).

### Open Questions

- How aggressively should PHI be de-identified or minimized before sending content to Hindsight in production?
- Do we want per-institution or per-team “shared memory” in addition to per-clinician banks (e.g., for team-wide phrase trends)?
- What governance model and UI do we need for clinicians to view and manage “what the system thinks it knows about them”?
- Where in the existing codebase are the best technical seam points to centralize AI and Hindsight calls (e.g., one service layer vs. per-component wiring)?

### Next Steps

→ Use this document as the guiding roadmap.  
→ For implementation, derive concrete tasks phase-by-phase (starting with Phase 0 and Phase 1) and wire Hindsight into existing AI helper flows via the thin TypeScript client.

