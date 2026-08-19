import assert from "node:assert/strict";
import test from "node:test";
import { lookupDemoContent } from "./content.js";

test("labels matched content as unsynchronized and unsuitable for clinical use", () => {
    const result = lookupDemoContent("  DKA management  ");

    assert.equal(result.structuredContent.requested_topic, "DKA management");
    assert.equal(result.structuredContent.matched_category, "DKA");
    assert.equal(result.structuredContent.status, "unverified_demo_content");
    assert.equal(result.structuredContent.clinical_use, "not_for_clinical_decision_making");
    assert.equal(result.structuredContent.last_verified_at, null);
    assert.match(result.text, /not synchronized/i);
    assert.match(result.text, /must not be used for clinical decision-making/i);
    assert.doesNotMatch(result.text, /up-to-date/i);
});

test("unknown topics remain demo-only and do not claim authoritative coverage", () => {
    const result = lookupDemoContent("toxicology");
    const ambiguousPartial = lookupDemoContent("d");

    assert.equal(result.structuredContent.matched_category, null);
    assert.match(result.structuredContent.content, /No bundled demo outline matched/);
    assert.equal(result.structuredContent.source, "Bundled demo content (not synchronized)");
    assert.equal(ambiguousPartial.structuredContent.matched_category, null);
});

test("rejects an empty topic", () => {
    assert.throws(() => lookupDemoContent("   "), /Topic cannot be empty/);
});
