// Rolling Rounds — Electron main process.
// Dev (not packaged): loads the Vite dev server on http://localhost:8080.
// Packaged (or ELECTRON_SERVE_DIST=1): serves ./dist over a local loopback
// origin and loads it. Serving over http://127.0.0.1 keeps a real origin so
// Supabase auth, browser routing, and the service worker behave like the web.
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const {
  isAllowedNavigation,
  isExternalNavigation,
  resolveDesktopAsset,
} = require("./desktop-runtime.cjs");

const DIST_DIR = path.join(__dirname, "..", "dist");
const DEV_URL = "http://localhost:8080";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

function contentType(file) {
  return MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      } catch {
        res.writeHead(400);
        res.end("Bad request");
        return;
      }
      if (pathname === "/") pathname = "/index.html";

      let file = path.normalize(path.join(DIST_DIR, pathname));
      if (file !== DIST_DIR && !file.startsWith(`${DIST_DIR}${path.sep}`)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        // SPA fallback: unknown routes serve the app shell.
        file = path.join(DIST_DIR, "index.html");
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": contentType(file) });
        res.end(data);
      });
    });

    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

let mainWindow = null;

async function createWindow() {
  const serveDist = app.isPackaged || process.env.ELECTRON_SERVE_DIST === "1";
  const loadUrl = serveDist ? `http://127.0.0.1:${await startServer()}` : DEV_URL;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Rolling Rounds",
    backgroundColor: "#f5f7f3",
    ...(process.platform === "darwin"
      ? {}
      : { icon: resolveDesktopAsset("public/icons/icon-512.png") }),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) {
      console.error(`[Rolling Rounds] Renderer failed to load (${errorCode}): ${errorDescription} ${validatedURL}`);
    }
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error(`[Rolling Rounds] Renderer exited: ${details.reason}`);
  });
  if (process.env.ELECTRON_DEBUG === "1") {
    mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      console.error(`[Rolling Rounds] renderer console level=${level} ${sourceId}:${line} ${message}`);
    });
  }
  await mainWindow.loadURL(loadUrl).catch((error) => {
    console.error("[Rolling Rounds] Unable to load the application shell", error);
  });

  // Open external HTTP(S) links in the system browser; keep app navigation on
  // the loopback origin so auth, routing, and service workers remain intact.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalNavigation(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: isAllowedNavigation(url) ? "allow" : "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isExternalNavigation(url)) {
      event.preventDefault();
      shell.openExternal(url);
    } else if (!isAllowedNavigation(url)) {
      event.preventDefault();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
