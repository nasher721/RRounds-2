import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function readSource(relativePath: string) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("application motion policy", () => {
  it("reduces component motion globally and keeps only loading spinners moving", () => {
    const app = readSource("src/App.tsx");
    const styles = readSource("src/index.css");

    assert.match(app, /<MotionConfig reducedMotion="always">/);
    assert.match(styles, /body \*:not\(\.animate-spin\)/);
    assert.match(styles, /animation-duration: 0\.01ms !important/);
    assert.match(styles, /transition-duration: 0\.01ms !important/);
  });
});
