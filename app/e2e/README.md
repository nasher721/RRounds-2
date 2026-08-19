# E2E tests (Playwright)

First-time setup: install Playwright browsers (once per machine):

```bash
npx playwright install
```

Run the full Chromium E2E suite:

```bash
npm run test:e2e
```

Or with UI: `npm run test:e2e:ui`.

Run the public compatibility suite in both Chromium and WebKit. The nine
checks per browser cover the login and cached-auth bootstrap paths, public
metadata/contact surfaces, signed-out FHIR recovery, keyboard and responsive
accessibility, flash-free saved/system theme startup, the visible update prompt,
and a real three-release service worker upgrade with exact old-chunk recovery:

```bash
npm run test:e2e:public
```

Run the full WebKit suite with `npm run test:e2e:webkit`, or select one scenario
with `npm run test:e2e:webkit -- --grep "<scenario>"`. Main-branch CI serializes
the complete Chromium and WebKit runs against the dedicated seeded account so
both browser engines must pass the same release scenarios without overlap.

CI builds once and sets `E2E_USE_PREVIEW=1`, so all browser release checks run
against the production bundle instead of Vite's development module loader. To
reproduce that mode locally, run `npm run build` first and then prefix the E2E
command with `E2E_USE_PREVIEW=1`.

Prefer the one-command equivalent, which also resets the E2E user's Round
continuity first (see below):

```bash
npm run test:e2e:preview                 # full Chromium suite, release mode
npm run test:e2e:preview -- --grep "Round runner"   # forward any Playwright args
```

Three specs are mode-sensitive and require the production bundle rather than
the dev server: `auth-dashboard` reads build-emitted crawl assets
(`robots.txt`, `sitemap.xml`, `llms.txt`) and hashed lazy chunks
(`ibccContent-*`), `data-integrity` waits on the registered service worker,
and `round-runner` asserts the lazy `PrintExportModal` chunk. They fail or hang
against `npm run dev` by design; run them via `npm run test:e2e:preview`.

The credential-gated round-runner walk path also assumes the E2E user's
`round_state` starts fresh: a round resumed at the last patient leaves Next
disabled and the walk cannot advance. `test:e2e:preview` deletes that user's
own `round_state` row over PostgREST before building (owner-scoped RLS), so
every run starts at Round 1/N. If you run preview mode manually, reset it by
hand first.

The scheduled production monitor runs only its reversible canary against an
external HTTPS deployment:

```bash
E2E_REQUIRE_SYNTHETIC=1 \
E2E_BASE_URL=https://your-production.example \
npm run test:e2e:synthetic
```

It targets the dedicated `E2E Alpha` fixture, verifies a real save after cold
reload, and restores the original summary. Never point this command at a
clinical account or a production patient roster. CI and the scheduled monitor
share the `e2e-shared-account` concurrency group so their mutations cannot
overlap.

The test runner starts its own app server and fails fast if the configured port
is already occupied. Use a free port when needed:

```bash
E2E_PORT=8173 npm run test:e2e
```

To deliberately test an app server you already started on that port, opt in to
reuse explicitly:

```bash
E2E_PORT=8173 E2E_REUSE_SERVER=1 npm run test:e2e
```

## Login flow (real Supabase)

The **login → dashboard**, **print/export**, **roster sort**, and **Round runner** tests require a real Supabase project and test user. Set:

- `E2E_TEST_EMAIL` – test user email
- `E2E_TEST_PASSWORD` – test user password

Prefer putting them in gitignored `.env.local` (loaded by `playwright.config.ts`). Shell exports still override.

If these are not set, authenticated tests are skipped. The ten `@public`
scenarios always run in each configured browser.

Main-branch CI sets `E2E_REQUIRE_FULL_SUITE=1` for both 32-test browser suites. In
that mode missing credentials, an undersized seeded roster, or any skipped
Playwright scenario fails the job. Setup and teardown reset the clinical
summaries for exactly one `E2E Alpha`, `E2E Bravo`, and `E2E Charlie` row plus
that user's Round continuity, so this account must remain dedicated to
synthetic test data. The reset is owner-scoped and does not run for partial
local specs or the production save canary. Pull requests run the public
auth-page smoke in both browsers without receiving production test credentials.

Example:

```bash
# one-shot
E2E_TEST_EMAIL=test@example.com E2E_TEST_PASSWORD=secret123 npm run test:e2e

# or after writing .env.local
npm run test:e2e -- --grep "Round runner"
```

Ensure the app is configured with valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`) so auth works.

The Round walk path skips unless that user has **≥3 patients** (RLS-scoped).
Release-grade runs require all three seeded fixture patients and fail instead of
skipping when the fixture is incomplete.

## Round runner (Focus-first)

Credential-gated specs live in `e2e/round-runner.e2e.spec.ts`. They assert:

- Tools + roster in primary chrome; demoted utilities only via Tools sheet
- Roster overlay open/close
- next/prev/done walk (≥3 seeded patients) → End Round print
- offline Todo → blocked completion with End review/Print available → reconnect unlock
- Import Patient List on Round Home

Component-level coverage (no credentials) lives under `src/components/round/__tests__/`.
