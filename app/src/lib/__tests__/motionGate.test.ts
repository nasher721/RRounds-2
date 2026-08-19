import test from "node:test";
import assert from "node:assert/strict";
import { shouldRunAnime } from "@/lib/anime/motionGate";

test("shouldRunAnime is false when user prefers reduced motion", () => {
  assert.equal(shouldRunAnime(true), false);
});

test("shouldRunAnime is true when user does not prefer reduced motion", () => {
  assert.equal(shouldRunAnime(false), true);
});
