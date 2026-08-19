import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { createScopedPrintStorage } from "@/lib/print/preferences";
import { getDefaultLayout } from "./layoutDesigner/defaultLayouts";
import { useLayoutDesigner } from "./layoutDesigner/useLayoutDesigner";
import { usePrintStateForOwner } from "./usePrintState";
import type { SavedLayout } from "@/types/layoutDesigner";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

test("layout designer reloads owner B without persisting owner A's custom layout", async () => {
  const accountAStorage = createScopedPrintStorage("user-a");
  const accountBStorage = createScopedPrintStorage("user-b");
  const config = {
    ...getDefaultLayout(),
    id: "saved-a",
    name: "A private layout",
    isBuiltIn: false,
  };
  const savedLayout: SavedLayout = {
    id: config.id,
    name: config.name,
    config,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  accountAStorage.setItem("layoutDesigner_savedLayouts", JSON.stringify([savedLayout]));
  accountAStorage.setItem("layoutDesigner_currentLayoutId", savedLayout.id);

  const { result, rerender } = renderHook(
    ({ ownerId }: { ownerId: string }) => useLayoutDesigner({ storageOwnerId: ownerId }),
    { initialProps: { ownerId: "user-a" } },
  );

  assert.equal(result.current.currentLayout.name, "A private layout");
  rerender({ ownerId: "user-b" });

  await waitFor(() => assert.equal(result.current.savedLayouts.length, 0));
  assert.notEqual(result.current.currentLayout.name, "A private layout");
  assert.doesNotMatch(accountBStorage.getItem("layoutDesigner_savedLayouts") ?? "[]", /A private layout/);
});

test("legacy print state resets to owner B and never copies owner A's free-form values", async () => {
  const accountAStorage = createScopedPrintStorage("user-a");
  const accountBStorage = createScopedPrintStorage("user-b");
  accountAStorage.setItem("printPhysicianName", "Dr A Private");
  localStorage.setItem("printPhysicianName", "Unattributed Legacy Name");

  const { result, rerender } = renderHook(
    ({ ownerId }: { ownerId: string }) => usePrintStateForOwner(ownerId),
    { initialProps: { ownerId: "user-a" } },
  );

  assert.equal(result.current.physicianName, "Dr A Private");
  rerender({ ownerId: "user-b" });

  await waitFor(() => assert.equal(result.current.physicianName, ""));
  assert.equal(accountBStorage.getItem("printPhysicianName"), "");
  assert.equal(localStorage.getItem("printPhysicianName"), null);
});
