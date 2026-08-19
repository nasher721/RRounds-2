// Rolling Rounds — Electron preload.
// Exposes a minimal, read-only "desktop" bridge so the renderer can detect the
// desktop shell (e.g. to hide browser-only UI). No Node APIs are leaked.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
