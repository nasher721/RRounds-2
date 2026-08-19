import {
  buildClinicalProviderAttempts,
  DEFAULT_LLM_OUTPUT_TOKENS,
  getLLMConfig,
  InvalidLLMModelError,
  isRetryableProviderStatus,
  listConfiguredClinicalProviders,
  type LLMConfig,
  MAX_LLM_OUTPUT_TOKENS,
  normalizeOutputTokenLimit,
  providerForModel,
  resolveClinicalProvider,
  resolveRequestedModel,
  sanitizeOutboundLLMPrompts,
  selectModelForConfig,
} from "./llm-client.ts";

Deno.test("clinical AI resolves the preferred configured provider without a gate", () => {
  const missing = resolveClinicalProvider(undefined, () => undefined);
  if (missing.valid) {
    throw new Error(
      "Expected clinical AI without provider keys to be unavailable",
    );
  }

  const geminiOnly = (key: string) =>
    key === "GEMINI_API_KEY" ? "gemini-test-key-long-enough" : undefined;
  const resolved = resolveClinicalProvider(undefined, geminiOnly);
  if (
    !resolved.valid || resolved.provider !== "gemini" ||
    resolved.model !== "gemini-2.5-flash"
  ) {
    throw new Error("Expected the configured Gemini provider to be selected");
  }
});

Deno.test("clinical AI honors the explicit deployment kill switch", () => {
  const disabled = resolveClinicalProvider(
    undefined,
    (key) => {
      if (key === "CLINICAL_AI_DISABLED") return "true";
      if (key === "GEMINI_API_KEY") return "gemini-test-key-long-enough";
      return undefined;
    },
  );
  if (disabled.valid) {
    throw new Error(
      "Expected the kill switch to reject requests even with keys",
    );
  }
});

Deno.test("clinical AI honors an allowlisted client model when its provider is configured", () => {
  const environment = (key: string) =>
    key === "OPENAI_API_KEY" ? "openai-test-key-long-enough" : undefined;
  const result = resolveClinicalProvider("gpt-4o-mini", environment);
  if (
    !result.valid || result.provider !== "openai" ||
    result.model !== "gpt-4o-mini"
  ) {
    throw new Error(
      "Expected the requested configured-provider model to be used",
    );
  }
});

Deno.test("clinical AI falls back to a configured provider for cross-provider requests", () => {
  const geminiOnly = (key: string) =>
    key === "GEMINI_API_KEY" ? "gemini-test-key-long-enough" : undefined;
  const result = resolveClinicalProvider("gpt-4o-mini", geminiOnly);
  if (!result.valid || result.provider !== "gemini") {
    throw new Error("Expected an unconfigured requested provider to fail over");
  }
});

Deno.test("clinical provider attempts order the resolved provider first, then failovers", () => {
  const environment = (key: string) => {
    if (key === "GEMINI_API_KEY") return "gemini-test-key-long-enough";
    if (key === "OPENAI_API_KEY") return "openai-test-key-long-enough";
    return undefined;
  };

  const attempts = buildClinicalProviderAttempts(undefined, environment);
  if (attempts.length !== 2) {
    throw new Error("Expected one attempt per configured provider");
  }
  if (
    attempts[0].config.provider !== "gemini" ||
    attempts[0].model !== "gemini-2.5-flash"
  ) {
    throw new Error(
      "Expected Gemini-first ordering with the Gemini default model",
    );
  }
  if (
    attempts[1].config.provider !== "openai" ||
    attempts[1].model !== "gpt-4o-mini"
  ) {
    throw new Error(
      "Expected the OpenAI failover attempt with its default model",
    );
  }

  const requested = buildClinicalProviderAttempts("gpt-4o", environment);
  if (
    requested[0]?.config.provider !== "openai" ||
    requested[0]?.model !== "gpt-4o"
  ) {
    throw new Error("Expected the requested configured-provider model to lead");
  }

  const none = buildClinicalProviderAttempts(undefined, () => undefined);
  if (none.length !== 0) {
    throw new Error("Expected no attempts without configured provider keys");
  }

  const killed = listConfiguredClinicalProviders((key) =>
    key === "GEMINI_API_KEY" ? "gemini-test-key-long-enough" : undefined
  );
  if (killed.length !== 1 || killed[0] !== "gemini") {
    throw new Error("Expected configured provider enumeration to track keys");
  }
});

Deno.test("LLM model selection accepts only canonical allowlisted models", () => {
  const allowed = resolveRequestedModel("gpt-4o-mini");
  if (!allowed.valid || allowed.model !== "gpt-4o-mini") {
    throw new Error("Expected allowlisted completion model to pass");
  }

  const alias = resolveRequestedModel("grok-2-mini");
  if (!alias.valid || alias.model !== "llama3-70b-8192") {
    throw new Error("Expected supported UI alias to canonicalize");
  }

  const denied = resolveRequestedModel("attacker-selected-expensive-model");
  if (denied.valid) {
    throw new Error("Expected arbitrary model selection to fail closed");
  }
});

Deno.test("LLM model selection fails closed across provider families", () => {
  const geminiConfig: LLMConfig = {
    apiKey: "test-key",
    baseURL: "https://example.test",
    defaultModel: "gemini-1.5-flash",
    provider: "gemini",
  };

  try {
    selectModelForConfig("gpt-4o", geminiConfig);
    throw new Error("Expected cross-provider model selection to fail");
  } catch (error) {
    if (!(error instanceof InvalidLLMModelError)) {
      throw error;
    }
  }
});

Deno.test("provider configuration never auto-discovers another vendor", () => {
  const environment = (key: string) =>
    key === "OPENAI_API_KEY" ? "openai-test-key-long-enough" : undefined;

  const explicitGemini = getLLMConfig("gemini", environment);
  if (explicitGemini.provider !== "gemini" || explicitGemini.apiKey !== "") {
    throw new Error(
      "Expected unavailable explicit Gemini selection to fail closed",
    );
  }

  const explicitOpenAI = getLLMConfig("openai", environment);
  if (explicitOpenAI.provider !== "openai" || !explicitOpenAI.apiKey) {
    throw new Error(
      "Expected an explicitly selected configured provider to resolve",
    );
  }
});

Deno.test("outbound LLM prompts remove direct identifiers but retain clinical facts", () => {
  const sanitized = sanitizeOutboundLLMPrompts(
    "Use PATIENT: Jane Doe as the subject. DOB: 01/02/1980.",
    "Jane Doe has MRN #A123456 and email jane@example.com. Diagnosis: SAH.",
  );
  const outbound = `${sanitized.systemPrompt}\n${sanitized.userPrompt}`;

  if (/Jane Doe|01\/02\/1980|A123456|jane@example\.com/i.test(outbound)) {
    throw new Error(
      "Expected direct identifiers to be removed before dispatch",
    );
  }
  if (!/Diagnosis: SAH/.test(outbound)) {
    throw new Error("Expected clinical facts to remain in the outbound prompt");
  }
});

Deno.test("outbound de-identification preserves words that match name parts", () => {
  const sanitized = sanitizeOutboundLLMPrompts(
    "PATIENT: May Will.",
    "May Will may improve and we will monitor closely.",
  );
  const outbound = `${sanitized.systemPrompt}\n${sanitized.userPrompt}`;

  if (/May Will/.test(outbound)) {
    throw new Error("Expected the full patient name to be removed");
  }
  if (!/may improve and we will monitor closely/i.test(outbound)) {
    throw new Error("Expected clinical language matching name parts to remain");
  }
});

Deno.test("LLM model selection maps allowlisted identifiers to provider families", () => {
  if (providerForModel("gpt-4o-mini") !== "openai") {
    throw new Error("Expected GPT model to select OpenAI");
  }
  if (providerForModel("gemini-2.5-flash") !== "gemini") {
    throw new Error("Expected Gemini model to select Gemini");
  }
  if (providerForModel("llama3-70b-8192") !== "grok") {
    throw new Error("Expected canonical Groq model to select Groq");
  }
});

Deno.test("LLM output token limits are always finite and bounded", () => {
  if (normalizeOutputTokenLimit() !== DEFAULT_LLM_OUTPUT_TOKENS) {
    throw new Error("Expected a safe default token limit");
  }
  if (
    normalizeOutputTokenLimit(Number.POSITIVE_INFINITY) !==
      DEFAULT_LLM_OUTPUT_TOKENS
  ) {
    throw new Error("Expected non-finite token limits to be rejected");
  }
  if (
    normalizeOutputTokenLimit(MAX_LLM_OUTPUT_TOKENS * 2) !==
      MAX_LLM_OUTPUT_TOKENS
  ) {
    throw new Error("Expected oversized output limits to be capped");
  }
});

Deno.test("provider failover covers rejected keys, rate limits, and server errors", () => {
  for (const status of [401, 403, 429, 500, 503]) {
    if (!isRetryableProviderStatus(status)) {
      throw new Error(`Expected status ${status} to fail over`);
    }
  }
  for (const status of [400, 404, 422]) {
    if (isRetryableProviderStatus(status)) {
      throw new Error(
        `Expected status ${status} to stay on the active provider`,
      );
    }
  }
});
