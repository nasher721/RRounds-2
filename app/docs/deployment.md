# Deployment — Round Robin Notes

How production and preview environments stay in sync: **Supabase** (DB + edge functions) and **Vercel** (frontend).

## Pre-push release checklist (local verification must match CI)

Before pushing to `main`, run the same gates CI runs — including **Deno formatting**, which is the step local runs most often skip:

```bash
npm run verify:local
```

`verify:local` runs, in CI order: ESLint → TypeScript → unit tests → edge JWT config → migration order → production audit (`npm audit --omit=dev --omit=optional`) → `edge:verify` (**`deno fmt --check`** + lint + frozen-lock typecheck + Deno tests) → Clinical MCP typecheck/tests/build.

Toolchain is pinned: Node **22.x** (`.nvmrc`, `engines`) and npm **10.x** (`packageManager: npm@10.9.8`). Regenerate `package-lock.json` only with this toolchain — a lock written by npm 11+ breaks `npm ci` on CI and Vercel.

## When this workflow runs

| Trigger | What deploys |
|---------|----------------|
| Successful CI for a push to live `main` | [Deploy Supabase](../.github/workflows/deploy-supabase.yml): hosted-auth baseline → migrations → edge functions → **healthcheck smoke test** → required Vercel hook → exact frontend release verification |

Automatic Vercel deployment from `main` is disabled in `vercel.json`. The
workflow is the only production path so the frontend cannot race ahead of its
database and Edge dependencies.

---

## Recommended order (client + edge changes)

1. **Merge one CI-verified release**
   Once CI succeeds for the live `main` SHA, `Deploy Supabase` revalidates that
   exact revision before any production mutation.

2. **Backend, then frontend**
   The workflow pushes migrations and functions, verifies health, triggers the
   production Vercel hook, and polls the canonical app URL until its embedded
   `app-version` matches the workflow SHA. A missing hook, missing production
   URL, failed Vercel build, or stale live release fails the deployment.

3. **Exception — frontend-only**  
   If the edge API shape and secrets are unchanged, a normal Vercel deploy is enough.

4. **Exception — breaking edge API**  
   If the app must call a new function or body shape, **never** ship the frontend before the matching functions are live.

---

## GitHub Actions runtime configuration

Configure in **Repository → Settings → Secrets and variables → Actions**.
CI production builds are intentionally independent of local `.env` files.

### Required repository variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `VITE_SUPABASE_URL` | CI builds | Public Supabase project URL required by the browser runtime |
| `PRODUCTION_CONTACT_EMAIL` | CI builds (required before market launch) | Public operator/contact address; prelaunch omission hides contact CTAs, while configured values are validated |
| `PRODUCTION_PRIVACY_NOTICE_URL` | CI builds (required before market launch) | Operator- and counsel-approved HTTPS privacy notice; prelaunch omission shows explicit setup guidance |
| `PRODUCTION_APP_URL` | CI builds + deploy + monitor | Canonical HTTPS production origin mapped to `VITE_PUBLIC_APP_URL`, release verification, and synthetic monitoring |
| `PRODUCTION_SESSION_IDLE_TIMEOUT_SECONDS` | CI builds + deploy | Required whole-second inactivity timeout from 300–3600; deploy applies the same value to hosted Auth and the browser session boundary |
| `VITE_APPROVED_OAUTH_PROVIDERS` | CI builds (optional) | Comma-separated `google`, `apple`, or both; absent means password-only sign-in |
| `PRODUCTION_SENTRY_DSN` | CI builds + monitor (one sink required) | Hosted Sentry DSN permitted by the production CSP |
| `PRODUCTION_TELEMETRY_INGEST_URL` | CI builds + monitor (one sink required) | Bundled endpoint: `https://<SUPABASE_PROJECT_ID>.supabase.co/functions/v1/telemetry` after operator approval |

### Required for healthcheck (do this first)

1. **Create** `SUPABASE_ANON_KEY`  
   - Value = **exactly** the same string as **`VITE_SUPABASE_PUBLISHABLE_KEY`** in your Vercel env (or in local `.env`).  
   - Source: Supabase Dashboard → **Project Settings → API** → **anon** / **public** key (`eyJ...`).  
2. **Create** `HEALTHCHECK_TOKEN` with at least 32 random characters (for
   example, `openssl rand -hex 32`). The deploy syncs it to the Edge runtime;
   the same GitHub secret authorizes deployment and scheduled uptime probes.
3. If either secret is missing, the **Deploy Supabase** workflow fails closed.

| Secret | Used by | Purpose |
|--------|---------|---------|
| `SUPABASE_ACCESS_TOKEN` | Deploy Supabase | Supabase CLI auth |
| `SUPABASE_PROJECT_ID` | Deploy Supabase | Project ref (same as `project_id` in `supabase/config.toml`) |
| `SUPABASE_ANON_KEY` | Deploy Supabase | Post-deploy `healthcheck` smoke test (`Authorization` + `apikey`) — **required** |
| `HEALTHCHECK_TOKEN` | Deploy Supabase + Production monitor | Dedicated secret for non-user health probes; synced to the Edge runtime during deploy — **required** |
| `E2E_TEST_EMAIL` | CI browser suite | Dedicated seeded test account; required for main-branch release CI |
| `E2E_TEST_PASSWORD` | CI browser suite | Password for the dedicated seeded test account |
| `VERCEL_DEPLOY_HOOK_URL` | Deploy Supabase (**required**) | `POST` after successful backend deploy to trigger the matching Vercel production build |

Configure repository variable `PRODUCTION_APP_URL` to the canonical HTTPS
Vercel/custom-domain URL. The hourly Production monitor fails closed without
it, probes Edge/database health and the configured first-party telemetry ingest,
then performs a reversible save/reload/restore
against the dedicated `E2E Alpha` fixture. Monitor failures open or update the
single `Production monitor failure` issue and a successful recovery closes it.

Set `VITE_PUBLIC_APP_URL` in Vercel to the same canonical origin. Production
builds inject it into the canonical, Open Graph, and social-image metadata and
fail closed when it is missing, non-HTTPS, credential-bearing, private,
placeholder, or includes a port, path, query, or fragment. CI maps
`PRODUCTION_APP_URL` into this same build variable. The build also generates
`robots.txt` and `sitemap.xml` from this origin; only the public landing and
approved Security surface are crawlable. Authenticated, callback, unknown, and
placeholder Privacy routes are explicitly marked `noindex`.

Before market launch, set Vercel `VITE_CONTACT_EMAIL` to the same real public
address as the GitHub `PRODUCTION_CONTACT_EMAIL` variable. An explicit prelaunch
deployment may omit it; contact CTAs are then hidden. Configured values still
fail validation when malformed or when they use a reserved example domain.

Before market launch, set Vercel `VITE_PRIVACY_NOTICE_URL` to the same real
notice as the GitHub `PRODUCTION_PRIVACY_NOTICE_URL` variable. An explicit
prelaunch deployment may omit it; `/privacy` then remains honest setup guidance.
When configured, it must be a public HTTPS URL for the deployment operator's
reviewed notice. Credentials, URL fragments, localhost/IP destinations,
reserved example hosts, and the app's own development `/privacy` placeholder
are rejected.

OAuth is fail-closed. Password sign-in is always available for provisioned
accounts, while Google and Apple controls are hidden unless
`VITE_APPROVED_OAUTH_PROVIDERS` explicitly lists them. Before adding a provider,
enable and fully configure the matching provider in Supabase Auth, validate its
redirect allowlist, then set the same comma-separated value in the GitHub
repository variable and Vercel production environment. Supported values are
`google` and `apple`; malformed or unsupported values block production builds.
Leaving the value unset is the supported password-only deployment.

Clinical AI is **key-based**: it is available whenever at least one provider credential (`GEMINI_API_KEY`, `OPENAI_API_KEY`, or `GROQ_API_KEY`) exists in Supabase Edge Function secrets. Requests resolve Gemini-first and automatically fail over to other configured providers on rate limits (429) and server errors (5xx). Client-supplied model names are still validated against a server-side allowlist, and outbound prompts are de-identified before dispatch. Set the repository variable `CLINICAL_AI_DISABLED=true` under **Actions → Variables** to deploy with the clinical-AI kill switch engaged; the workflow writes it to Edge Function secrets and AI endpoints return 503 until it is re-enabled.

The core roster workflow does not depend on that approval: **Import Patient
List** opens the client-side CSV/spreadsheet mapper by default. CSV upload,
paste, validation, preview, and import stay inside the browser until the
validated patient rows are written to Supabase. Only the separate
**Document / image** tab invokes clinical AI.

The anon key is the same **public** key as `VITE_SUPABASE_PUBLISHABLE_KEY` / dashboard **Project API → anon public**.

If you change **`project_id`** in [`supabase/config.toml`](../supabase/config.toml), set **`SUPABASE_PROJECT_ID`** in GitHub to the **same** ref and run **`supabase link --project-ref <ref>`** locally so CLI and CI target one project.

---

## Hosted Auth security baseline

The production deploy uses the Supabase Management API to enforce and verify:

- public enrollment disabled (`disable_signup: true`); and
- leaked-password protection enabled (`password_hibp_enabled: true`).

Leaked-password protection uses the HaveIBeenPwned Pwned Passwords service and
requires Supabase Pro or above. The deployment fails before migrations when the
project plan does not support the control, the access token lacks Auth config
write privileges, or the returned hosted configuration does not confirm both
values. For fine-grained Management API tokens, grant `auth_config_write` and
`project_admin_write`.

`npm run security:check-auth-config` keeps this fail-closed contract in CI. Do
not replace the post-PATCH verification with an unchecked dashboard setting.

---

## Edge Functions and gateway JWT (ES256)

**Do not turn on Supabase’s gateway `verify_jwt` for app functions in this repo.**

- Access tokens from Supabase Auth may be **ES256** (asymmetric). The Edge **gateway** still validates some tokens with the **legacy HS256** path, which yields **“Invalid JWT”** before your handler runs.
- [`supabase/config.toml`](../supabase/config.toml) sets **`verify_jwt = false`** for every function. **Authentication** is enforced in code with [`authenticateRequest()`](../supabase/functions/_shared/auth.ts). [`healthcheck`](../supabase/functions/healthcheck/index.ts) accepts either a validated user token or the dedicated monitor secret. [`telemetry`](../supabase/functions/telemetry/index.ts) is the only content-free public ingest: it uses a distributed IP quota, a fixed schema, and a service-role-only table with 30-day retention because landing events occur before sign-in.
- **`supabase functions deploy`** (CI and local) reads `config.toml` and applies these flags — keep them in sync when adding a new function.
- **MCP / manual API deploys:** the payload must set **`verify_jwt` to match `config.toml`**. The repo script [`scripts/build-mcp-edge-bundle.mjs`](../scripts/build-mcp-edge-bundle.mjs) reads `[functions.<slug>]` so redeploys do not accidentally re-enable gateway JWT. Override **`SUPABASE_PROJECT_REF`** if the target project differs from `project_id` in `config.toml`.
- **`npm run edge:check-jwt-config`** fails if any `[functions.*]` sets `verify_jwt = true` (also runs in **Deploy Supabase** before `functions deploy`).

---

## Clinical AI provider configuration

Clinical AI requests can contain names, MRNs, notes, page images, medications,
or audio. Outbound prompts are de-identified at the Edge boundary (names, MRNs,
DOBs, contact details, and similar direct identifiers are redacted) before any
provider sees them, and every request stays behind the authenticated Edge
gateway with per-user rate limiting.

Clinical AI is key-based: configuring a provider credential enables it.

1. Complete the required BAA/DPA, retention, training-use, and security review for each provider you intend to enable.
2. Store the API key in Supabase Edge Function secrets (`GEMINI_API_KEY`, `OPENAI_API_KEY`, and/or `GROQ_API_KEY`).
3. Deploy through the Supabase workflow. It verifies which provider credentials exist, records the `CLINICAL_AI_DISABLED` kill-switch state from the repository variable, and warns when no provider key is configured (AI endpoints then report "not configured" instead of failing the deployment).

Requests resolve Gemini-first and fail over automatically across configured
providers on rate limits and server errors. The browser does not accept
provider credentials; client model selections are validated against a
server-side allowlist before use. Dictation additionally requires
`OPENAI_API_KEY` because its transcription step uses Whisper. Set
`CLINICAL_AI_DISABLED=true` to suspend clinical AI without removing keys.
Record the executed agreements and enabled providers in the release sign-off
packet.

---

## CORS and new frontend URLs

Edge functions use an origin allowlist: [`supabase/functions/_shared/cors.ts`](../supabase/functions/_shared/cors.ts).

- **Defaults** include localhost (any port on `localhost` / `127.0.0.1`), the main Vercel production hostname, and regexes for common **Vercel preview** URL shapes tied to this repo.
- **Custom domain** (e.g. `https://app.hospital.org`): add it to Supabase **Edge Function secrets** as `ALLOWED_ORIGINS` (comma-separated). Values are **merged** with code defaults, so you usually only append new origins.
- **`RELAX_VERCEL_CORS`** (optional Edge Function secret): set to `true` or `1` to allow **any** `https://*.vercel.app` origin. **Default is off** so arbitrary Vercel-hosted sites are not trusted for every function. Turn it on if you rely on many unpredictable preview URLs and accept the wider cross-origin surface; otherwise add specific preview bases to `ALLOWED_ORIGINS`.
- After changing secrets, redeploy functions so workers pick them up.

If the browser shows CORS errors right after a new URL goes live, check allowlist + preview regex + `RELAX_VERCEL_CORS` before debugging app code.

---

## Browser security policy

[`vercel.json`](../vercel.json) applies the production Content Security Policy and transport headers. The default policy permits this app, Supabase, bundled provider defaults, Google Fonts, and Sentry ingestion. The telemetry policy accepts only same-origin or Supabase-hosted custom collectors, which already fit that allowlist. Before enabling SMART-on-FHIR or a custom Hugging Face endpoint, add each exact HTTPS FHIR/API origin to `connect-src`; do not replace the allowlist with a wildcard.

Production source maps are disabled in [`vite.config.ts`](../vite.config.ts). If operators later need symbolicated client traces, upload hidden maps directly to the approved error service during CI and remove them before publishing `dist/`.

---

## Smoke tests (telemetry and healthcheck)

After `supabase functions deploy`, CI first posts one fixed
`monitor.ingest_probe` event to:

`POST https://<SUPABASE_PROJECT_ID>.supabase.co/functions/v1/telemetry`

The request uses the public browser key, must return `202` with
`{"accepted":1}`, and exercises rate limiting, schema validation, retention,
and the service-role-only insert. CI then calls:

`GET https://<SUPABASE_PROJECT_ID>.supabase.co/functions/v1/healthcheck`

with anon key headers. **200** and healthy body = pass; **non-200** fails the workflow.

[`healthcheck`](../supabase/functions/healthcheck/index.ts) calls the purpose-built
`healthcheck_database()` RPC. The anonymous role has no access to application
tables, sequences, or other public-schema routines; the probe only proves that
Edge Functions, PostgREST, and Postgres are reachable. Requests must carry
either a validated user access token or the dedicated monitor secret.
`verify_jwt = false` in [`config.toml`](../supabase/config.toml) because the
handler performs ES256-compatible user validation itself.

Local manual check:

```bash
export SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export ANON_KEY="your-anon-key"
export HEALTHCHECK_TOKEN="your-dedicated-monitor-secret"
curl -sS "$SUPABASE_URL/functions/v1/healthcheck" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "apikey: $ANON_KEY" \
  -H "x-healthcheck-token: $HEALTHCHECK_TOKEN"
```

---

## Required: Vercel deploy hook

1. Vercel → Project → **Settings → Git → Deploy Hooks** → create hook for **Production**.
2. Add the URL to `VERCEL_DEPLOY_HOOK_URL`.

Also set repository variable `PRODUCTION_APP_URL` to the canonical HTTPS
origin. The deploy fails closed if either value is unset. After triggering the
hook, it waits up to ten minutes for that origin to expose the exact release
version derived from the CI-verified SHA and the matching canonical link. A
Vercel build with stale or mismatched `VITE_PUBLIC_APP_URL` cannot pass release
verification.

---

## Observability

Production builds require at least one centrally queryable sink:
`VITE_SENTRY_DSN` or `VITE_TELEMETRY_INGEST_URL`. CI maps these from
`PRODUCTION_SENTRY_DSN` and `PRODUCTION_TELEMETRY_INGEST_URL`; configure the
same value in Vercel. Hosted Sentry DSNs must match the CSP-allowed ingest
domains. Custom collectors must be credential-free HTTPS on the application
origin or an approved Supabase origin. Query-string tokens are rejected. This
repository ships a first-party collector at
`https://<SUPABASE_PROJECT_ID>.supabase.co/functions/v1/telemetry`; select that
URL unless the deployment owner has approved hosted Sentry instead.

When Sentry is selected, the app sends scrubbed exceptions plus bounded
operational events. Marketing events and metrics retain only fixed event,
operation, outcome, provider, feature, unit, and numeric measurement fields.
Patient, account, contact, form, URL, request, and session content cannot be
attached through this bridge. The first-party collector validates the same
fixed vocabulary again, persists only projected scalar columns, grants no
browser-role table access, and purges records after 30 days. The deploy and
hourly monitor workflows send a content-free probe and fail on rejected ingest.

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SENTRY_DSN` | Local `.env`, Vercel env (Production + Preview) | Hosted Sentry project DSN (public; safe in the bundle). |
| `VITE_TELEMETRY_INGEST_URL` | Local `.env`, Vercel env | Bundled Supabase telemetry function URL; alternative to Sentry. |
| `VITE_APP_VERSION` | Optional | Overrides Sentry **release** string. If omitted, the build uses `package.json` `version`, and on Vercel appends `+` short git SHA (`VERCEL_GIT_COMMIT_SHA`). |

Match **release** in Sentry to any hidden source maps uploaded during CI. Never serve those maps from the production asset directory. See [`src/lib/observability/sentryClient.ts`](../src/lib/observability/sentryClient.ts) (`beforeSend` scrubs query strings and payload-like breadcrumbs).

---

## Legacy provider credentials

Migration `20260711220000_purge_legacy_ai_credentials.sql` removes provider API
keys persisted by older clients. Operators should treat any previously stored
provider key as exposed to database backups and rotate it after this migration
is deployed. Current clients contain no browser provider adapters, credential
setter, or model-selection hook. Clinical provider credentials and the exact
approved model exist only in the Edge deployment environment.

---

## Related

- Resilience plan: [plans/2026-03-19-edge-functions-resilience-plan.md](plans/2026-03-19-edge-functions-resilience-plan.md)
- Supabase workflow: [.github/workflows/deploy-supabase.yml](../.github/workflows/deploy-supabase.yml)
