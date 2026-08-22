const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

function parseHttpUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function isAllowedNavigation(value) {
  const url = parseHttpUrl(value);
  return url !== null && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
}

function isExternalNavigation(value) {
  return parseHttpUrl(value) !== null && !isAllowedNavigation(value);
}

function resolveDesktopAsset(relativePath) {
  const assetPath = path.resolve(PROJECT_ROOT, relativePath);
  if (assetPath !== PROJECT_ROOT && !assetPath.startsWith(`${PROJECT_ROOT}${path.sep}`)) {
    throw new Error("Desktop asset must remain inside the project");
  }
  return assetPath;
}

module.exports = {
  isAllowedNavigation,
  isExternalNavigation,
  resolveDesktopAsset,
};

