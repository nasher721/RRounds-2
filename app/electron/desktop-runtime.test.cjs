const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  isAllowedNavigation,
  isExternalNavigation,
  resolveDesktopAsset,
} = require("./desktop-runtime.cjs");

test("allows loopback navigation and rejects non-loopback navigation", () => {
  assert.equal(isAllowedNavigation("http://127.0.0.1:43123/patients"), true);
  assert.equal(isAllowedNavigation("http://localhost:8080/"), true);
  assert.equal(isAllowedNavigation("https://example.com/"), false);
  assert.equal(isAllowedNavigation("file:///tmp/secret"), false);
});

test("identifies only external HTTP(S) links for system-browser handling", () => {
  assert.equal(isExternalNavigation("https://example.com/help"), true);
  assert.equal(isExternalNavigation("http://127.0.0.1:43123/help"), false);
  assert.equal(isExternalNavigation("mailto:support@example.com"), false);
  assert.equal(isExternalNavigation("javascript:alert(1)"), false);
});

test("resolves the packaged macOS icon inside the project", () => {
  const iconPath = resolveDesktopAsset("public/icons/rolling-rounds.icns");
  assert.equal(path.basename(iconPath), "rolling-rounds.icns");
  assert.equal(fs.existsSync(iconPath), true);
});

