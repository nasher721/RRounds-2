import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhraseUsageStats,
  ESTIMATED_SECONDS_SAVED_PER_USE,
} from "@/lib/clinicalPhraseAnalytics";

test("phrase analytics derives deterministic usage counts from recorded events", () => {
  const phrases = [
    { id: "alpha", shortcut: "a", name: "Alpha" },
    { id: "beta", shortcut: null, name: "Beta" },
    { id: "unused", shortcut: "u", name: "Unused" },
  ];
  const logs = [
    { phrase_id: "alpha", created_at: "2026-07-01T10:00:00.000Z" },
    { phrase_id: "beta", created_at: "2026-07-02T10:00:00.000Z" },
    { phrase_id: "alpha", created_at: "2026-07-03T10:00:00.000Z" },
  ];

  assert.deepEqual(buildPhraseUsageStats(phrases, logs), [
    {
      phraseId: "alpha",
      phraseShortcut: "a",
      phraseTitle: "Alpha",
      usageCount: 2,
      lastUsed: "2026-07-03T10:00:00.000Z",
    },
    {
      phraseId: "beta",
      phraseShortcut: "No shortcut",
      phraseTitle: "Beta",
      usageCount: 1,
      lastUsed: "2026-07-02T10:00:00.000Z",
    },
  ]);
  assert.equal(ESTIMATED_SECONDS_SAVED_PER_USE, 45);
});
