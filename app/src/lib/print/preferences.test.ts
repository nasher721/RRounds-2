import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createScopedPrintStorage,
  getAuthenticatedPrintPayload,
  quarantineLegacyPrintPreferences,
} from "./preferences";
import type { StorageLike } from "@/utils/safeStorage";

const createMemoryStorage = (): StorageLike & { has(key: string): boolean } => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    has: (key) => values.has(key),
  };
};

test("print and layout preferences remain isolated across an A-to-B account switch", () => {
  const storage = createMemoryStorage();
  const accountA = createScopedPrintStorage("user-a", storage);
  const accountB = createScopedPrintStorage("user-b", storage);

  accountA.setItem("printTemplatePresets", JSON.stringify([{ name: "A private preset" }]));
  accountA.setItem("layoutDesigner_savedLayouts", JSON.stringify([{ name: "A private layout" }]));

  assert.equal(accountB.getItem("printTemplatePresets"), null);
  assert.equal(accountB.getItem("layoutDesigner_savedLayouts"), null);

  accountB.setItem("printTemplatePresets", JSON.stringify([{ name: "B preset" }]));
  assert.match(accountA.getItem("printTemplatePresets") ?? "", /A private preset/);
  assert.match(accountB.getItem("printTemplatePresets") ?? "", /B preset/);
});

test("an authenticated account with no DB settings starts from defaults, never unattributed local data", () => {
  const storage = createMemoryStorage();
  const defaults = { selectedTemplateId: "standard", templatePresets: [] as string[] };
  const unattributed = { selectedTemplateId: "custom", templatePresets: ["A private preset"] };

  storage.setItem("printSelectedTemplateId", unattributed.selectedTemplateId);
  storage.setItem("printTemplatePresets", JSON.stringify(unattributed.templatePresets));

  const decision = getAuthenticatedPrintPayload(undefined, defaults);

  assert.deepEqual(decision.payload, defaults);
  assert.equal(decision.shouldInitializeDatabase, true);
  assert.notDeepEqual(decision.payload, unattributed);

  quarantineLegacyPrintPreferences(storage);
  assert.equal(storage.has("printSelectedTemplateId"), false);
  assert.equal(storage.has("printTemplatePresets"), false);
});

test("existing DB settings remain authoritative", () => {
  const defaults = { selectedTemplateId: "standard" };
  const database = { selectedTemplateId: "compact" };

  const decision = getAuthenticatedPrintPayload(database, defaults);

  assert.equal(decision.payload, database);
  assert.equal(decision.shouldInitializeDatabase, false);
});

test("print modal and layout designer do not bypass scoped preference storage", () => {
  const sources = [
    readFileSync("src/components/PrintExportModalFull.tsx", "utf8"),
    readFileSync("src/components/print/layoutDesigner/useLayoutDesigner.ts", "utf8"),
    readFileSync("src/components/print/usePrintState.ts", "utf8"),
  ];

  for (const source of sources) {
    assert.doesNotMatch(source, /\blocalStorage\.(?:getItem|setItem)\s*\(/);
  }

  assert.match(sources[0], /initialSyncOwnerId\.current !== user\.id/);
  assert.doesNotMatch(sources[0], /initialSyncDone/);
});
