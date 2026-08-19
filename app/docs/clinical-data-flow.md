# Clinical data-flow release gate

This application can contain PHI. Production approval requires deployment-specific legal, privacy, security, and clinical-safety review. Code controls do not establish HIPAA compliance by themselves.

## Allowed browser egress

- Supabase HTTPS and WebSocket endpoints for authentication, database, storage, and Edge Functions.
- Optional Sentry ingestion only when `VITE_SENTRY_DSN` is configured. Client scrubbers remove user, request bodies, query strings, breadcrumbs, context, and error text.
- No direct browser connection to OpenAI, Anthropic, Google, xAI, BigModel, or Hugging Face. Production CSP blocks these domains. Clinical AI traffic must use authenticated Supabase Edge Functions so provider policy and audit controls stay server-side.

## AI and import gate

Before enabling any clinical AI or import workflow, deployment owner must record:

- approved provider and model allowlist;
- executed BAA/DPA and permitted PHI use;
- retention and deletion settings;
- provider training-use setting;
- server-side key ownership and rotation;
- payload minimization/redaction rules;
- audit-log fields that exclude note text and identifiers;
- clinician review and correction process for parsing/generation errors.

Clinical AI is key-based: the server enables it whenever at least one provider
credential (`GEMINI_API_KEY`, `OPENAI_API_KEY`, or `GROQ_API_KEY`) is present
in Edge Function secrets, and the `CLINICAL_AI_DISABLED=true` secret suspends
it without removing keys. The server validates browser model selection against
an allowlist, redacts direct identifiers before dispatch, and fails over
across configured providers on rate limits and server errors.

The browser never accepts provider credentials and never connects directly to
an AI vendor. The deployment workflow also verifies which provider
credentials exist before deploying the Edge functions.

Smart Patient Import shows this uncertainty before clipboard access or parsing, requires explicit confirmation, then requires field-by-field preview before import.

## Recovery exports

Recovery JSON is generated locally after explicit user action and contains PHI.
It is never uploaded by the export helper. Organization storage and
transmission policy still applies.

The shared Offline indicator exposes the pending queue on every dashboard
breakpoint. Before queued clinical work can be discarded, the user must
download the exact current queue. The destructive confirmation remains disabled
until that download occurs; cross-tab queue changes invalidate the confirmation,
and deletion atomically re-checks the exported queue signature before removing
any owner-scoped mutation. A mismatch preserves the entire queue and requires a
fresh recovery copy.
The artifact retains mutation and patient identifiers plus local payloads for
authorized support or manual clinical recovery. It is intentionally not an
automatic import format because replay must respect the authenticated owner,
server revisions, and conflict resolution.

## Release evidence

Release owner must attach provider contracts, configured allowlist, retention screenshots, key-rotation evidence, telemetry redaction test results, access-control test results, and clinical validation sign-off. Missing evidence blocks clinical production release.
