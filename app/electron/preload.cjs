// Rolling Rounds — Electron preload.
// Exposes a minimal inbound-only desktop bridge for platform metadata and
// validated main-process commands. No Node APIs are leaked.
const { contextBridge, ipcRenderer } = require("electron");

// Sandboxed preload scripts may only require Electron and a constrained set of
// built-ins. Keep this inbound allowlist local instead of importing app files.
const allowedCommands = new Set(["toggle-privacy-curtain"]);

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  onCommand(callback) {
    if (typeof callback !== "function") return () => undefined;
    const listener = (_event, command) => {
      if (allowedCommands.has(command)) callback(command);
    };
    ipcRenderer.on("desktop-command", listener);
    return () => ipcRenderer.removeListener("desktop-command", listener);
  },
});
