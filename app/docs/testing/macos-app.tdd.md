# macOS app TDD evidence

Source plan: none. User journeys were derived during this TDD run from the request to make the existing Rolling Rounds project runnable as a full macOS app.

## User journeys

- As a clinician, I want the desktop app to keep its authenticated workspace on a loopback HTTP origin so routing, Supabase auth, and service-worker behavior remain intact.
- As a clinician, I want external help and documentation links to open in the system browser without allowing unsafe renderer navigation.
- As a maintainer, I want a reproducible install and a local arm64 DMG command so I can build and launch the app on macOS.

## RED / GREEN report

| Stage | Command | Result |
|---|---|---|
| RED | `node --test electron/desktop-runtime.test.cjs` | FAIL: missing `electron/desktop-runtime.cjs` (intended missing implementation) |
| GREEN | `node --test electron/desktop-runtime.test.cjs` | 3/3 passed |
| Install | `npm ci --ignore-scripts --no-audit --no-fund` | Clean install succeeded after lockfile refresh |
| Unit | `npm test` | 730/730 passed |
| Typecheck | `npm run typecheck` | Passed |
| Lint | `npm run lint` | Passed |
| Desktop coverage | `node --test --experimental-test-coverage electron/desktop-runtime.test.cjs` | 89.19% lines, 84.62% branches, 100% functions |
| Preview smoke | `npm run desktop:preview` + loopback `curl` | Electron launched; root and SPA fallback returned HTTP 200 |
| Packaged smoke | `open -n "release/mac-arm64/Rolling Rounds.app"` + loopback `curl` | Actual arm64 `.app` launched; root and SPA fallback returned HTTP 200 |
| DMG | `npm run desktop:dist:mac:local` | `release/Rolling Rounds-1.0.0-arm64.dmg` built; `hdiutil imageinfo` reported `UDZO` |

## Guarantees

| # | What is guaranteed | Test or evidence | Type | Result |
|---|---|---|---|---|
| 1 | Only localhost/127.0.0.1 HTTP(S) navigation is allowed inside the desktop renderer. | `electron/desktop-runtime.test.cjs` | Unit | PASS |
| 2 | External HTTP(S) links are identified for system-browser handling; non-HTTP schemes are denied. | `electron/desktop-runtime.test.cjs` | Unit | PASS |
| 3 | The packaged app serves `/` and unknown client routes from the built SPA shell. | Packaged loopback smoke | Integration | PASS |
| 4 | electron-builder uses a real Rolling Rounds `.icns` asset and produces an arm64 DMG. | `package.json`, `public/icons/rolling-rounds.icns`, DMG inspection | Packaging | PASS |
| 5 | Existing clinical, security, and UI behavior remains green across the repository suite. | `npm test` | Regression | PASS |

## Known gaps and release notes

- The production build remains intentionally fail-closed until the required Supabase, public-origin, session, privacy, and observability environment variables are supplied. Use `desktop:dist:mac:local` for a local development DMG; use `desktop:dist:mac` for a release build.
- The generated DMG is unsigned in this environment because no Developer ID Application identity is installed. Sign and notarize before external distribution.
- `npm run verify:lockfile` still reports the existing guard’s Expo/React-Native optional-dependency policy under the available npm 11 runtime, even though `npm ci --ignore-scripts` resolves cleanly. Re-run the guard with the repository-pinned Node 22/npm 10.9.8 toolchain before release.
- Credential-gated Playwright E2E and clinical release gates were not claimed; they require the configured deployment and test account described in the project release docs.

