# Rolling Rounds — Recreated Prototype + Underlying Code

Recreation of the **Round Robin Notes** clinical rounding workspace (source: `nasher721/remix-of-remix-of-round-robin-notes`).

Two layers live here:

1. **Design prototype** (repo root) — a self-contained responsive HTML mockup.
2. **Underlying code** (`app/`) — the real React 18 + TypeScript + Vite + Supabase codebase, now with an **Electron** desktop shell.

## Underlying code — `app/`

The full application source is laid down in `app/`, cleaned of agent-config and junk dirs, with Electron desktop support added.

### Run (web)

```sh
cd app
npm install            # installs deps; ensure NODE_ENV is not "production" so devDependencies install
cp .env.example .env   # add VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev            # Vite dev server on http://localhost:8080
npm run build          # production build (fails closed without production env)
npm run build:dev      # build without production env validation
```

### Run (desktop — Electron)

```sh
cd app
npm install
npm run desktop:dev      # Vite dev server + Electron window
npm run desktop:preview  # build:dev, then Electron serving ./dist over a loopback origin
npm run desktop:dist     # production build + electron-builder installer (needs production env)
```

Electron serves `dist/` over `http://127.0.0.1:<port>` so Supabase auth, routing, and the
service worker behave like the web (a real origin, not `file://`). See `app/DESKTOP.md`.

### Verification performed (all green)

- `npm run verify:local` — the project's full local gate passes end-to-end:
  - `lint` (eslint) — clean
  - `typecheck` — `tsc` passes (app + node configs)
  - `test` — **730/730** unit tests pass
  - `security:check-auth-config` — restricted signup, leaked-password protection, inactivity termination
  - `edge:check-jwt-config` — 11 authenticated handlers, least-privilege public policies
  - `verify:migrations` — 55 migrations (order, RLS/anon isolation, GraphQL disabled)
  - `audit:prod` — **0 vulnerabilities**
  - `edge:verify` (deno) — fmt + lint + check + **36/36** tests
  - `clinical:*` — MCP server typecheck + **12/12** tests + build
- `npm run build` (production, minified) — succeeds with valid env; every chunk under
  `scripts/check-bundle-size.mjs` budget (initial JS 623 KB / 750 KB, Supabase 209 KB / 230 KB, …).
- `security:check-bundle-reachability` — no optional-native/Expo markers in the bundle.

> Note: in this sandbox `NODE_ENV=production` is exported, which makes `npm install`
> skip `devDependencies` (so `vite`/`electron`/`tsc` were initially absent). On a normal
> machine `npm install` installs devDependencies by default.

### Handoff to Cursor

`app/COMPLETION_PLAN.md` is the takeover plan: current status, blockers, environment,
codebase map, conventions, and the ordered remaining work (release-hold items → readiness
Phases 3–8 → feature backlog). Give Cursor the `app/` directory and that file.

### Remaining to go live (infra — requires your credentials, not code)

- Supabase project + `VITE_SUPABASE_*` / `PRODUCTION_*` GitHub secrets and vars
- GitHub Actions CI + `Deploy Supabase` + Vercel hook (workflows already in `.github/workflows`)
- `npm run test:e2e` (Playwright) — needs a real Supabase project + `E2E_TEST_*` account
- Electron installers (`desktop:dist`) need a real `.icns` / `.ico` app icon set

## Design prototype (repo root)

| File | Screen | Fidelity |
|---|---|---|
| `index.html` | Prototype overview / launcher | new |
| `landing.html` | Marketing page | faithful |
| `login.html` | Sign in (validation + Google SSO) | faithful |
| `workspace.html` | Two-pane rounding workspace | high |

The prototype implements the workspace UX without a backend: roster rail (search/filter/
sort/view mode/doc-progress segments), patient chart header, 5-tab documentation navigator,
10-system review, infusions/scheduled/PRN meds, tasks, sign-off, quick reference (⌘K), AI
assistant, lab parser, dose calculators, interaction checker, export, and light/dark +
mobile layouts. Auth/Supabase/AI are mocked; clinical data is de-identified sample content.
