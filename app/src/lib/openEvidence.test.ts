import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_EVIDENCE_QUERY_LENGTH,
  buildOpenEvidenceSearchUrl,
  isSearchableEvidenceQuery,
  sanitizeEvidenceQuery,
} from "@/lib/openEvidence";

test("sanitizeEvidenceQuery trims and collapses whitespace", () => {
  assert.equal(sanitizeEvidenceQuery("  DOAC   vs warfarin \n in AFib  "), "DOAC vs warfarin in AFib");
});

test("sanitizeEvidenceQuery collapses newlines from a multi-block selection", () => {
  assert.equal(sanitizeEvidenceQuery("tranexamic acid\n\ntrauma bleeding"), "tranexamic acid trauma bleeding");
});

test("sanitizeEvidenceQuery caps overlong input without throwing", () => {
  const raw = "a".repeat(MAX_EVIDENCE_QUERY_LENGTH + 50);
  const sanitized = sanitizeEvidenceQuery(raw);
  assert.equal(sanitized.length, MAX_EVIDENCE_QUERY_LENGTH);
});

test("sanitizeEvidenceQuery on empty/whitespace-only input returns empty string", () => {
  assert.equal(sanitizeEvidenceQuery("   \n\t  "), "");
});

test("buildOpenEvidenceSearchUrl encodes the sanitized query", () => {
  const url = buildOpenEvidenceSearchUrl("DVT prophylaxis & renal failure");
  assert.equal(url, "https://www.openevidence.com/search?q=DVT+prophylaxis+%26+renal+failure");
});

test("buildOpenEvidenceSearchUrl sanitizes before encoding", () => {
  const url = buildOpenEvidenceSearchUrl("  early goal  \n directed therapy  ");
  assert.equal(url, "https://www.openevidence.com/search?q=early+goal+directed+therapy");
});

test("isSearchableEvidenceQuery is false for blank input, true otherwise", () => {
  assert.equal(isSearchableEvidenceQuery("   "), false);
  assert.equal(isSearchableEvidenceQuery(""), false);
  assert.equal(isSearchableEvidenceQuery("sepsis"), true);
});
