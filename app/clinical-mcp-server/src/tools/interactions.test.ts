import assert from "node:assert/strict";
import test from "node:test";
import { checkPlaceholderInteractions } from "./interactions.js";

test("an unmatched placeholder lookup is explicitly inconclusive", () => {
    const result = checkPlaceholderInteractions(["warfarin", "acetaminophen"]);

    assert.equal(result.structuredContent.authoritative_check_completed, false);
    assert.equal(result.structuredContent.coverage, "limited_placeholder_examples");
    assert.equal(result.structuredContent.interactions_found, 0);
    assert.match(result.text, /inconclusive result, not a negative interaction check/i);
    assert.match(result.text, /cannot establish that a combination is safe/i);
    assert.doesNotMatch(result.text, /no known interactions/i);
});

test("severity_threshold filters placeholder matches without implying safety", () => {
    const result = checkPlaceholderInteractions(
        ["lisinopril", "potassium chloride"],
        "contraindicated"
    );

    assert.equal(result.structuredContent.severity_threshold, "contraindicated");
    assert.equal(result.structuredContent.interactions_detected_in_placeholder, 1);
    assert.equal(result.structuredContent.interactions_found, 0);
    assert.match(result.text, /none meet the contraindicated threshold/i);
    assert.match(result.text, /current authoritative interaction resource/i);
});

test("returns matching examples at or above the selected threshold", () => {
    const result = checkPlaceholderInteractions(
        ["  Omeprazole ", "Clopidogrel"],
        "major"
    );

    assert.deepEqual(result.structuredContent.checked_drugs, ["Omeprazole", "Clopidogrel"]);
    assert.equal(result.structuredContent.interactions_found, 1);
    assert.equal(result.structuredContent.interactions[0].severity, "major");
});

test("rejects empty or duplicate-only drug lists", () => {
    assert.throws(
        () => checkPlaceholderInteractions(["lisinopril", " "]),
        /two non-empty drug names/
    );
    assert.throws(
        () => checkPlaceholderInteractions(["lisinopril", " LISINOPRIL "]),
        /two distinct drug names/
    );
});
