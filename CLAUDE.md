# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this repo is

**Rolling Rounds** — a recreation of the *Round Robin Notes* clinical rounding
workspace for ICU teams. Two independent layers live side by side:

| Layer | Location | What it is |
|---|---|---|
| Design prototype | repo root (`index.html`, `landing.html`, `login.html`, `workspace.html`, `assets/`) | Self-contained static HTML/CSS/vanilla-JS mockup. No build step, no backend. |
| Application | `app/` | The real React 18 + TypeScript + Vite + Supabase app, plus an Electron desktop shell. |

Changes to one layer do **not** propagate to the other. Decide which layer a
request targets before editing; if it's ambiguous, ask.

Key docs: `NOTES.md` (repo overview), `app/README.md`, `app/ARCHITECTURE.md`
(layering), `app/AGENTS.md` (learned preferences/facts), `app/COMPLETION_PLAN.md`
(status, blockers, ordered remaining work), `app/DESKTOP.md`, `app/docs/`.

## Design prototype (repo root)

- Plain HTML files sharing `assets/app.css`; page logic is an inline `<script>`
  block at the bottom of the page (see `workspace.html`).
- Everything is mocked — auth, Supabase, AI. Clinical content is de-identified
  sample data; keep it that way.
- Open the files directly in a browser to verify; there is nothing to build.
- Don't reintroduce smooth `scrollIntoView` into embedded preview paths here.

## Application (`app/`)

Run everything from `app/`.

```sh
npm install                 # NODE_ENV must not be "production", or devDependencies are skipped
cp .env.example .env        # VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                 # Vite dev server on http://localhost:8080
npm run build               # production build (fails closed without production env)
npm run build:dev           # build without production env validation
npm run desktop:dev         # Vite + Electron window (see DESKTOP.md)
```

### Verification gate

`npm run verify:local` is the full local gate and must pass before committing:
`lint` → `typecheck` → `test` → `security:check-auth-config` →
`edge:check-jwt-config` → `verify:migrations` → `audit:prod` → `edge:verify`
(Deno) → `clinical:*` (the MCP server in `clinical-mcp-server/`).

Narrower loops while iterating:

```sh
npm run lint
npm run typecheck           # app + node + e2e tsconfigs
npm test                    # Node test runner over src/**/*.test.ts(x)
npm run test:e2e            # Playwright Chromium — needs a real Supabase + E2E_TEST_* creds
```

E2E and anything touching a live database require credentials this repo does not
carry; if they're missing, say the suite was skipped rather than working around it.

### Architecture (see `ARCHITECTURE.md` for detail)

Five layers, strictly one-directional:

1. **UI components** — `src/components/{ui,dashboard,mobile,phrases,print}/`.
   Props/context in, callbacks out, local UI state only. No Supabase calls, no
   data fetching.
2. **Feature hooks** — `src/hooks/` (e.g. `hooks/patients/`, composed by
   `usePatients`). Own React Query and feature orchestration.
3. **Domain services & mappers** — `src/services/`, `src/lib/mappers/`. Pure
   transformation between DB records and domain types.
4. **API & integrations** — `src/api/`, `src/integrations/supabase/`,
   `src/integrations/fhir/`, and edge functions in `supabase/functions/`.
   Retries, timeouts, error shapes live here.
5. **Global contexts** — `src/contexts/`, wired in `src/App.tsx`.

New patient-facing feature → helper in `services/`/`lib/mappers/` → hook in
`src/hooks/` → consumed by a `dashboard/` or `mobile/` component.

Tests sit next to their subject (`Foo.test.ts` beside `Foo.ts`, plus
`__tests__/` directories); follow the local pattern when adding one.

## Conventions and gotchas

- **Product goal:** a simple, low-note-burden UI for ICU attendings, residents,
  and fellows documenting during rounds. Prefer removing friction over adding
  features.
- **Never** prefix a provider credential with `VITE_*` — those are browser-public.
  AI/provider keys live only in Supabase Edge secrets.
- Radix `SelectItem` must not use `value=""` (empty string clears the selection);
  use an explicit sentinel value for placeholder options.
- `App.tsx` imports `Auth`, `FHIRCallback`, and `PrintExportTest` statically on
  purpose — lazy chunks can fail to resolve (stale service worker, headless
  browsers) and strand Suspense on the fallback. Keep them static.
- Patient import is **extract → parse → organize** in `src/lib/import/`
  (`extractImportContent`, `patientListImportSafety`, `organizeImportedPatient`).
  The entry point is labeled **Import Patient List** — not Epic-specific. Word,
  Excel/CSV/TSV, HTML, JSON, RTF, images (OCR), and plain text are supported;
  client-side PDF import stays blocked.
- LLM import parsing goes through the `parse-handoff` edge function, Gemini-first
  with failover on provider 429s; parses can take 1–2 minutes (client timeout
  ~180s).
- Edge rate limiting uses `edge_rate_limits` / `consume_edge_rate_limit`.
- Mobile: reset scroll when opening a patient, mount only the active section
  (don't stack screens), ≥44×44px touch targets, strong dark-theme contrast.
- Clinical data is PHI-shaped. Don't add sample data with real identifiers, and
  don't route roster content to a new external service without being asked.

## Git

- Stage only intentional source changes; leave `.DS_Store` and unrelated
  untracked paths alone.
- Commit messages follow Conventional Commits (`fix(build): …`, `test(e2e): …`).
- Production does not deploy from a bare `main` push — GitHub Actions enforces
  CI → `Deploy Supabase` → Vercel hook. See `app/README.md` and
  `app/docs/deployment.md`.
