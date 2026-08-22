const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  DESKTOP_COMMANDS,
  createApplicationMenuTemplate,
} = require("./desktop-menu.cjs");

function findMenuItem(template, label) {
  for (const menu of template) {
    for (const item of menu.submenu ?? []) {
      if (item.label === label) return item;
    }
  }
  return undefined;
}

test("desktop menu exposes a native privacy curtain command", () => {
  const commands = [];
  const template = createApplicationMenuTemplate({
    appName: "Rolling Rounds",
    platform: "darwin",
    onCommand: (command) => commands.push(command),
  });

  assert.equal(template[0].label, "Rolling Rounds");

  const privacyItem = findMenuItem(template, "Show Privacy Curtain");
  assert.ok(privacyItem);
  assert.equal(privacyItem.accelerator, "CmdOrCtrl+Shift+L");
  privacyItem.click();
  assert.deepEqual(commands, [DESKTOP_COMMANDS.TOGGLE_PRIVACY_CURTAIN]);
});

test("desktop menu keeps standard macOS editing and window roles", () => {
  const template = createApplicationMenuTemplate({
    appName: "Rolling Rounds",
    platform: "darwin",
    onCommand: () => undefined,
  });

  const editMenu = template.find((item) => item.label === "Edit");
  const windowMenu = template.find((item) => item.label === "Window");

  assert.ok(editMenu?.submenu.some((item) => item.role === "undo"));
  assert.ok(editMenu?.submenu.some((item) => item.role === "paste"));
  assert.ok(windowMenu?.submenu.some((item) => item.role === "minimize"));
  assert.ok(windowMenu?.submenu.some((item) => item.role === "front"));
});

test("sandboxed preload does not require neighboring application modules", () => {
  const preloadSource = fs.readFileSync(path.join(__dirname, "preload.cjs"), "utf8");
  assert.doesNotMatch(preloadSource, /require\(["']\.\//);
  assert.match(preloadSource, /toggle-privacy-curtain/);
});
