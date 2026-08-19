# Rolling Rounds — Desktop (Electron)

The app runs as a desktop application via Electron, in addition to the web build on Vercel.

## How it works

- `electron/main.cjs` — creates the window and decides what to load:
  - **Dev** (not packaged): loads the Vite dev server at `http://localhost:8080`.
  - **Packaged** (or `ELECTRON_SERVE_DIST=1`): starts a tiny loopback static server over
    `./dist` and loads `http://127.0.0.1:<port>`.
- `electron/preload.cjs` — exposes a read-only `window.desktop` bridge
  (`{ isDesktop, platform, versions }`) with `contextIsolation` on and `nodeIntegration` off.

Serving `dist/` over a real `http://127.0.0.1` origin (rather than `file://`) keeps
Supabase auth, `BrowserRouter`, and the service worker working exactly as they do on the web.

## Commands

```sh
npm run desktop:dev       # Vite dev server + Electron (hot reload)
npm run desktop:preview   # npm run build:dev, then Electron over the built dist
npm run desktop:dist      # npm run build + electron-builder → installers in ./release
```

## Packaging

`desktop:dist` uses electron-builder (config under the `build` key in `package.json`):

- macOS → `.dmg`
- Windows → NSIS installer
- Linux → AppImage

Before distributing, provide proper app icons (an `.icns` for macOS / `.ico` for Windows);
the config currently points at `public/icons/icon-512.png` as a placeholder.

## Supabase origin note

The desktop app's origin is `http://127.0.0.1:<port>`. If you use OAuth (Google/Apple),
add that origin to Supabase's allowed redirect URLs, or use password sign-in which is
unaffected. For production packaged builds, a fixed port may be preferable — set one by
passing `PORT` in `main.cjs`'s `server.listen`.
