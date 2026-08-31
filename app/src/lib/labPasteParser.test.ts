import assert from "node:assert/strict";
import test from "node:test";
import { formatParsedLabs, parseLabText } from "./labPasteParser";

test("lab paste parser extracts supported values without clinical inference", () => {
  const values = parseLabText("Na 138, K=4.2, Cr 1.1, WBC 8.4, Hgb 10.2, INR 1.2");

  assert.deepEqual(
    values.map(({ key, value }) => [key, value]),
    [["na", "138"], ["k", "4.2"], ["cr", "1.1"], ["wbc", "8.4"], ["hgb", "10.2"], ["inr", "1.2"]],
  );
  assert.equal(values.some((value) => "status" in value || "interpretation" in value), false);
});

test("lab paste formatter groups reviewed values without ranges or flags", () => {
  const formatted = formatParsedLabs(parseLabText("Na 138 K 4.2 WBC 8.4 INR 1.2"));

  assert.equal(formatted, "BMP: Na 138 mmol/L, K 4.2 mmol/L\nCBC: WBC 8.4 K/uL\nCoagulation: INR 1.2");
  assert.doesNotMatch(formatted, /critical|abnormal|normal|interpret/i);
});

test("lab paste parser ignores unsupported prose instead of fabricating values", () => {
  assert.deepEqual(parseLabText("labs reviewed; no numeric values supplied"), []);
});
