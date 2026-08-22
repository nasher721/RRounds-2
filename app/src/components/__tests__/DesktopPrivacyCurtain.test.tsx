import * as React from "react";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DesktopPrivacyCurtain } from "@/components/DesktopPrivacyCurtain";

afterEach(() => {
  cleanup();
  setDesktopBridge(undefined);
  const root = document.getElementById("root");
  root?.removeAttribute("aria-hidden");
  root?.removeAttribute("inert");
  if (root) root.innerHTML = "";
});

function setDesktopBridge(value: Window["desktop"] | undefined) {
  Object.defineProperty(window, "desktop", {
    configurable: true,
    value,
  });
}

function renderInAppRoot(ui: React.ReactElement) {
  let root = document.getElementById("root");
  if (!root) {
    root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
  }
  return render(ui, { container: root });
}

test("masks authenticated desktop content with the privacy shortcut and requires deliberate reveal", () => {
  setDesktopBridge({
    isDesktop: true,
    platform: "darwin",
    versions: { electron: "33", chrome: "130", node: "22" },
    onCommand: () => () => undefined,
  });

  renderInAppRoot(
    <>
      <button type="button">Patient workspace</button>
      <DesktopPrivacyCurtain enabled />
    </>,
  );

  const workspaceButton = screen.getByRole("button", { name: "Patient workspace" });
  workspaceButton.focus();

  fireEvent.keyDown(document, { key: "l", metaKey: true, shiftKey: true });

  assert.ok(screen.getByRole("dialog", { name: "Workspace hidden" }));
  const workspace = document.getElementById("root");
  assert.ok(workspace);
  assert.equal(workspace.getAttribute("aria-hidden"), "true");
  assert.equal(workspace.hasAttribute("inert"), true);

  fireEvent.keyDown(document, { key: "Escape" });
  assert.ok(screen.getByRole("dialog", { name: "Workspace hidden" }));

  fireEvent.click(screen.getByRole("button", { name: "Reveal workspace" }));
  assert.equal(screen.queryByRole("dialog", { name: "Workspace hidden" }), null);
  assert.equal(document.activeElement, workspaceButton);
});

test("responds to the native macOS menu command", () => {
  let commandHandler: ((command: DesktopCommand) => void) | undefined;
  let unsubscribed = false;
  setDesktopBridge({
    isDesktop: true,
    platform: "darwin",
    versions: { electron: "33", chrome: "130", node: "22" },
    onCommand: (handler) => {
      commandHandler = handler;
      return () => {
        unsubscribed = true;
      };
    },
  });

  const rendered = renderInAppRoot(
    <>
      <div>Rounds</div>
      <DesktopPrivacyCurtain enabled />
    </>,
  );

  act(() => commandHandler?.("toggle-privacy-curtain"));
  assert.ok(screen.getByRole("dialog", { name: "Workspace hidden" }));

  rendered.unmount();
  assert.equal(unsubscribed, true);
});

test("removes the shield and inert state when the authenticated session ends", () => {
  setDesktopBridge({
    isDesktop: true,
    platform: "darwin",
    versions: { electron: "33", chrome: "130", node: "22" },
    onCommand: () => () => undefined,
  });

  const rendered = renderInAppRoot(
    <DesktopPrivacyCurtain enabled />,
  );
  fireEvent.keyDown(document, { key: "l", metaKey: true, shiftKey: true });
  assert.ok(screen.getByRole("dialog", { name: "Workspace hidden" }));

  rendered.rerender(<DesktopPrivacyCurtain enabled={false} />);

  assert.equal(screen.queryByRole("dialog", { name: "Workspace hidden" }), null);
  const workspace = document.getElementById("root");
  assert.ok(workspace);
  assert.equal(workspace.hasAttribute("inert"), false);
  assert.equal(workspace.hasAttribute("aria-hidden"), false);
});

test("does not install the privacy shortcut in the browser build", () => {
  renderInAppRoot(
    <>
      <div>Public web content</div>
      <DesktopPrivacyCurtain enabled />
    </>,
  );

  fireEvent.keyDown(document, { key: "l", metaKey: true, shiftKey: true });
  assert.equal(screen.queryByRole("dialog", { name: "Workspace hidden" }), null);
});
