import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function readSource(relativePath: string) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("clear all patients affordance", () => {
  it("exposes a dedicated clear-all control on the desktop roster rail", () => {
    const source = readSource("src/components/dashboard/PatientRosterRail.tsx");
    assert.match(source, /data-testid="clear-all-patients"/);
    assert.match(source, /aria-label="Clear all patients"/);
    assert.match(source, /onClick=\{onRequestClearAll\}/);
  });

  it("exposes a dedicated clear-all control on the mobile rounds header", () => {
    const source = readSource("src/components/dashboard/MobileDashboard.tsx");
    assert.match(source, /data-testid="clear-all-patients"/);
    assert.match(source, /aria-label="Clear all patients"/);
    assert.match(source, /onClick=\{handleClearAll\}/);
  });
});
