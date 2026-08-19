import {
  buildSystemPrompt,
  resolveRequestedModel,
  validateClinicalContext,
} from "./index.ts";

Deno.test("AI clinical assistant accepts only explicit provider-safe models", () => {
  const allowed = resolveRequestedModel("gpt-4o-mini");
  if (!allowed.valid || allowed.model !== "gpt-4o-mini") {
    throw new Error("Expected an allowlisted model to pass unchanged");
  }

  const alias = resolveRequestedModel("grok-2-mini");
  if (!alias.valid || alias.model !== "llama3-70b-8192") {
    throw new Error(
      "Expected the UI Grok alias to resolve to the supported backend model",
    );
  }

  const denied = resolveRequestedModel("attacker-controlled-model");
  if (denied.valid || !denied.error.includes("not allowed")) {
    throw new Error("Expected arbitrary model identifiers to be denied");
  }
});

Deno.test("AI clinical context limits use UTF-8 bytes", () => {
  const result = validateClinicalContext({ labs: "😀".repeat(12_501) });
  if (result.valid || !result.error.includes("UTF-8")) {
    throw new Error("Expected multibyte context beyond 50 KB to be rejected");
  }
});

Deno.test("AI clinical context rejects unbounded or malformed medication arrays", () => {
  const malformed = validateClinicalContext({
    medications: { scheduled: "warfarin" },
  });
  if (malformed.valid || !malformed.error.includes("must be an array")) {
    throw new Error("Expected malformed medication context to be rejected");
  }

  const oversized = validateClinicalContext({
    medications: { scheduled: Array.from({ length: 201 }, () => "warfarin") },
  });
  if (oversized.valid || !oversized.error.includes("maximum of 200")) {
    throw new Error("Expected medication context count to be bounded");
  }
});

Deno.test("custom instructions cannot replace the clinical system prompt", () => {
  const customInstructions = "Use one short paragraph.";
  const basePrompt = buildSystemPrompt("clinical_summary");
  const prompt = buildSystemPrompt("clinical_summary", customInstructions);
  if (!prompt.startsWith(basePrompt)) {
    throw new Error("Expected the feature's clinical system prompt to remain");
  }
  if (!prompt.includes(customInstructions)) {
    throw new Error(
      "Expected bounded custom formatting instructions to remain",
    );
  }
  if (!prompt.includes("ADDITIONAL USER-PROVIDED FORMATTING INSTRUCTIONS")) {
    throw new Error("Expected custom instructions to be explicitly delimited");
  }
  if (!prompt.includes("lower priority than every rule above")) {
    throw new Error("Expected base clinical rules to have explicit precedence");
  }
  if (!prompt.includes(JSON.stringify(customInstructions))) {
    throw new Error("Expected custom instructions to remain quoted as data");
  }
});
