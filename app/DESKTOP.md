# Rolling Rounds — Desktop (Electron)

The app runs as a desktop application via Electron, in addition to the web build on Vercel.

## How it works

- `electron/main.cjs` — creates the window and decides what to load:
  - **Dev** (not packaged): loads the Vite dev server at `http://localhost:8080`.
  - **Packaged** (or `ELECTRON_SERVE_DIST=1`): starts a tiny loopback static server over
    `./dist` and loads `http://127.0.0.1:<port>`.
- `electron/preload.cjs` — exposes a narrow `window.desktop` bridge for platform
  metadata and validated main-process commands; `contextIsolation` stays on and
  `nodeIntegration` stays off.

Serving `dist/` over a real `http://127.0.0.1` origin (rather than `file://`) keeps
Supabase auth, `BrowserRouter`, and the service worker working exactly as they do on the web.

## Commands

```sh
npm ci                    # install the pinned desktop toolchain
npm run desktop:test      # test the Electron runtime policy
npm run desktop:dev       # Vite dev server + Electron (hot reload)
npm run desktop:preview   # npm run build:dev, then Electron over the built dist
npm run desktop:dist:win:local # unsigned Windows x64 NSIS installer for local use
npm run desktop:dist:mac:local # unsigned macOS DMG for local use (run on macOS)
npm run desktop:dist      # npm run build + electron-builder → installers in ./release
```

The Codex Run action and shell-first debug entrypoint are also available:

```sh
./script/build_and_run.sh             # build and launch
./script/build_and_run.sh --verify    # build, launch, and verify the process
./script/build_and_run.sh --debug     # launch with Electron logging
```

## macOS desktop controls

The desktop build installs a native macOS menu with standard Edit, View, and
Window behavior. The **Privacy** menu includes **Show Privacy Curtain**
(`⌘⇧L`). It places an opaque shield over the authenticated workspace and makes
the underlying interface inert until the clinician deliberately reveals it.
The same shortcut reveals the workspace again. This is a visual privacy aid,
not a replacement for signing out or the configured inactivity timeout.

Before sign-in, copy `.env.example` to `.env.local` and provide
`VITE_SUPABASE_URL` plus `VITE_SUPABASE_PUBLISHABLE_KEY`. The app now shows an
explicit setup screen when these public values are absent instead of opening a
blank window. Never put a Supabase service-role key in this file.

## Packaging

`desktop:dist` uses electron-builder (config under the `build` key in `package.json`):

- macOS Intel + Apple Silicon → one universal `.dmg` using
  `public/icons/rolling-rounds.icns`
- Windows x64 → assisted NSIS installer using `public/icons/rolling-rounds.ico`, with
  selectable install location plus Start Menu and desktop shortcuts
- Linux → AppImage

Local installers are intentionally unsigned. Windows may show a SmartScreen warning,
and macOS may require opening the app from Finder's context menu. Public distribution
requires an Authenticode certificate on Windows and an Apple Developer ID application
certificate plus notarization on macOS.

The manual `Desktop installers` GitHub Actions workflow builds both operating-system
artifacts on native runners and uploads them separately. It uses the development build
configuration and never embeds a service-role key. For a connected production build,
provide the public Vite/Supabase values through the normal build environment.

## Supabase origin note

The desktop app's origin is `http://127.0.0.1:<port>`. If you use OAuth (Google/Apple),
add that origin to Supabase's allowed redirect URLs, or use password sign-in which is
unaffected. For production packaged builds, a fixed port may be preferable — set one by
passing `PORT` in `main.cjs`'s `server.listen`.
