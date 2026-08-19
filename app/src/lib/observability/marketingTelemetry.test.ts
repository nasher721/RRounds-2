import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  MARKETING_EVENTS,
  createMarketingEventName,
  recordMarketingEvent,
} from "./marketingTelemetry";

test("public funnel telemetry exposes only fixed PHI-safe event names", () => {
  assert.deepEqual(Object.keys(MARKETING_EVENTS), [
    "landingView",
    "headerSignIn",
    "heroSignIn",
    "featureExplore",
    "securityGuidance",
    "pricingContact",
    "contactEmail",
    "footerWorkspace",
  ]);

  for (const event of Object.keys(MARKETING_EVENTS) as Array<keyof typeof MARKETING_EVENTS>) {
    assert.match(createMarketingEventName(event), /^marketing\.[a-z0-9_.-]+$/);
  }
});

test("public funnel telemetry emits one classified event without dynamic content", () => {
  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (...args: unknown[]) => writes.push(args.join(" "));

  try {
    recordMarketingEvent("contactEmail");
  } finally {
    console.log = originalLog;
  }

  assert.equal(writes.length, 1);
  const payload = JSON.parse(writes[0]!) as {
    message: string;
    context: Record<string, unknown>;
  };
  assert.equal(payload.message, "marketing.contact.email");
  assert.deepEqual(payload.context, {
    feature: "public_funnel",
    type: "product_analytics",
  });
});

test("landing conversion actions use the fixed marketing telemetry boundary", () => {
  const landing = readFileSync("src/pages/Landing.tsx", "utf8");
  const highlights = readFileSync("src/components/landing/FeatureHighlights.tsx", "utf8");
  const surface = `${landing}\n${highlights}`;

  for (const event of Object.keys(MARKETING_EVENTS)) {
    assert.match(surface, new RegExp(`recordMarketingEvent\\(\\"${event}\\"\\)`));
  }
  assert.doesNotMatch(surface, /recordMarketingEvent\([^"']/);
});
