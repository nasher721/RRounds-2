import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("Index resets the selected patient when the authenticated owner changes", () => {
  const source = readFileSync(path.join(process.cwd(), "src/pages/Index.tsx"), "utf8");

  assert.match(
    source,
    /selectedPatientState && selectedPatientState\.ownerId === user\?\.id/,
  );
  assert.match(
    source,
    /setSelectedPatientState\(patient && user \? \{ ownerId: user\.id, patient \} : null\)/,
  );
  assert.match(
    source,
    /React\.useEffect\(\(\) => \{\s*setSelectedPatientState\(null\);\s*}, \[user\?\.id\]\);/,
  );
});
