export class MissingAPIKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingAPIKeyError";
  }
}

export class LLMProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMProviderError";
  }
}

export class InvalidLLMModelError extends Error {
  constructor(message = "Requested model is not allowed") {
    super(message);
    this.name = "InvalidLLMModelError";
  }
}

export interface LLMConfig {
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  provider: "openai" | "gemini" | "anthropic" | "grok" | "glm";
}

export type ClinicalLLMProvider = "openai" | "gemini" | "grok";

export type ClinicalProviderPolicyResult =
  | { valid: true; provider: ClinicalLLMProvider; model: string }
  | { valid: false; error: string };

/**
 * Provider preference order for clinical requests. Gemini is preferred for
 * long-context patient-list parsing; OpenAI and Groq serve as automatic
 * failovers when they are configured.
 */
export const CLINICAL_PROVIDER_PRIORITY: readonly ClinicalLLMProvider[] = [
  "gemini",
  "openai",
  "grok",
];

/** Preferred production model per provider (all on the allowlist below). */
export const CLINICAL_DEFAULT_MODELS: Record<ClinicalLLMProvider, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  grok: "llama3-70b-8192",
};

function hasConfiguredProviderKey(
  provider: ClinicalLLMProvider,
  getEnvironmentValue: (name: string) => string | undefined,
): boolean {
  switch (provider) {
    case "openai": {
      const key = getEnvironmentValue("OPENAI_API_KEY");
      return Boolean(key && key.length > 10 && !key.includes("placeholder"));
    }
    case "gemini": {
      const key = getEnvironmentValue("GEMINI_API_KEY");
      return Boolean(key && key.length > 10);
    }
    case "grok": {
      const key = getEnvironmentValue("GROQ_API_KEY") ||
        getEnvironmentValue("GROK_API_KEY");
      return Boolean(key && key.length > 10);
    }
  }
}

/** Operational kill switch: CLINICAL_AI_DISABLED=true turns clinical AI off. */
export function isClinicalAIDisabled(
  getEnvironmentValue: (name: string) => string | undefined = Deno.env.get,
): boolean {
  return getEnvironmentValue("CLINICAL_AI_DISABLED")?.trim().toLowerCase() ===
    "true";
}

/** Configured clinical providers in preference order. */
export function listConfiguredClinicalProviders(
  getEnvironmentValue: (name: string) => string | undefined = Deno.env.get,
): ClinicalLLMProvider[] {
  return CLINICAL_PROVIDER_PRIORITY.filter((provider) =>
    hasConfiguredProviderKey(provider, getEnvironmentValue)
  );
}

/**
 * Resolve the provider and model for a clinical request.
 *
 * Clinical AI is available whenever at least one provider credential is
 * configured; an explicit `CLINICAL_AI_DISABLED=true` kill switch overrides
 * everything. A client-requested allowlisted model is honored when its
 * provider is configured, otherwise resolution falls back to the preferred
 * configured provider. Model allowlist validation still happens through
 * `resolveRequestedModel`, so arbitrary model identifiers never reach a
 * provider.
 */
export function resolveClinicalProvider(
  requestedModel?: string,
  getEnvironmentValue: (name: string) => string | undefined = Deno.env.get,
): ClinicalProviderPolicyResult {
  if (isClinicalAIDisabled(getEnvironmentValue)) {
    return {
      valid: false,
      error: "Clinical AI is disabled for this deployment",
    };
  }

  const configured = listConfiguredClinicalProviders(getEnvironmentValue);
  if (configured.length === 0) {
    return {
      valid: false,
      error: "Clinical AI is not configured for this deployment",
    };
  }

  const requestedProvider = providerForModel(requestedModel);
  if (
    requestedModel && requestedProvider &&
    configured.includes(requestedProvider)
  ) {
    return { valid: true, provider: requestedProvider, model: requestedModel };
  }

  const provider = configured[0];
  return { valid: true, provider, model: CLINICAL_DEFAULT_MODELS[provider] };
}

/**
 * Provider statuses that justify an automatic failover attempt: rejected
 * credentials (401/403 — a configured key can be expired or revoked), rate
 * limits (429), and server errors (5xx). A 400 is a malformed request that
 * would fail identically on every provider, so it never fails over.
 */
export function isRetryableProviderStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 429 || status >= 500;
}

export interface ClinicalProviderAttempt {
  config: LLMConfig;
  model: string;
}

/**
 * Ordered provider attempts for a clinical request: the resolved provider
 * first, then every other configured provider as a failover target. Empty
 * when clinical AI is disabled or no provider credential is configured.
 */
export function buildClinicalProviderAttempts(
  requestedModel?: string,
  getEnvironmentValue: (name: string) => string | undefined = Deno.env.get,
): ClinicalProviderAttempt[] {
  const policy = resolveClinicalProvider(requestedModel, getEnvironmentValue);
  if (!policy.valid) return [];

  const orderedProviders = [
    policy.provider,
    ...listConfiguredClinicalProviders(getEnvironmentValue).filter((provider) =>
      provider !== policy.provider
    ),
  ];

  const attempts: ClinicalProviderAttempt[] = [];
  for (const provider of orderedProviders) {
    const config = getLLMConfig(provider, getEnvironmentValue);
    if (!config.apiKey) continue;
    const model = provider === policy.provider
      ? selectModelForConfig(policy.model, config)
      : CLINICAL_DEFAULT_MODELS[provider];
    attempts.push({ config, model });
  }
  return attempts;
}

export const DEFAULT_LLM_OUTPUT_TOKENS = 4_000;
export const MAX_LLM_OUTPUT_TOKENS = 8_000;

const ALLOWED_MODEL_ALIASES: Readonly<Record<string, string>> = {
  "gpt-4o": "gpt-4o",
  "gpt-4o-mini": "gpt-4o-mini",
  "gemini-1.5-flash": "gemini-1.5-flash",
  "gemini-2.0-flash": "gemini-2.0-flash",
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini-2.5-pro": "gemini-2.5-pro",
  "grok-2": "llama3-70b-8192",
  "grok-2-mini": "llama3-70b-8192",
  "llama3-70b-8192": "llama3-70b-8192",
};

export type RequestedModelResult =
  | { valid: true; model: string | undefined }
  | { valid: false; error: string };

/** Validate and canonicalize every client-selectable completion model. */
export function resolveRequestedModel(value: unknown): RequestedModelResult {
  if (value === undefined || value === null || value === "") {
    return { valid: true, model: undefined };
  }
  if (typeof value !== "string") {
    return { valid: false, error: "Model must be a string" };
  }

  const model = ALLOWED_MODEL_ALIASES[value.trim()];
  if (!model) {
    return { valid: false, error: "Requested model is not allowed" };
  }
  return { valid: true, model };
}

export function providerForModel(
  model?: string,
): "openai" | "gemini" | "grok" | undefined {
  if (!model) return undefined;
  if (model.startsWith("gpt")) return "openai";
  if (model.startsWith("gemini")) return "gemini";
  if (model.startsWith("llama") || model.startsWith("mixtral")) return "grok";
  return undefined;
}

/** Never send a provider a model identifier from another provider family. */
export function selectModelForConfig(
  requestedModel: string | undefined,
  config: LLMConfig,
  preferredDefault?: string,
): string {
  const candidate = requestedModel || preferredDefault || config.defaultModel;
  const resolved = resolveRequestedModel(candidate);
  if (!resolved.valid || !resolved.model) {
    throw new InvalidLLMModelError(resolved.valid ? undefined : resolved.error);
  }
  if (providerForModel(resolved.model) !== config.provider) {
    throw new InvalidLLMModelError(
      "Requested model does not belong to the selected provider",
    );
  }
  return resolved.model;
}

export function normalizeOutputTokenLimit(value?: number): number {
  if (value === undefined) return DEFAULT_LLM_OUTPUT_TOKENS;
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_LLM_OUTPUT_TOKENS;
  }
  return Math.min(Math.floor(value), MAX_LLM_OUTPUT_TOKENS);
}

function normalizeTemperature(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) return 0.3;
  return Math.min(1, Math.max(0, value));
}

export function getLLMConfig(
  preferredProvider: "openai" | "gemini" | "grok" | "glm",
  getEnvironmentValue: (name: string) => string | undefined = Deno.env.get,
): LLMConfig {
  // Helper to check OpenAI
  const getOpenAI = (): LLMConfig | null => {
    const key = getEnvironmentValue("OPENAI_API_KEY");
    if (key && key.length > 10 && !key.includes("placeholder")) {
      return {
        apiKey: key,
        baseURL: "https://api.openai.com/v1",
        defaultModel: "gpt-4o-mini",
        provider: "openai",
      };
    }
    return null;
  };

  // Helper to check Gemini
  const getGemini = (): LLMConfig | null => {
    const key = getEnvironmentValue("GEMINI_API_KEY");
    if (key && key.length > 10) {
      return {
        apiKey: key,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
        defaultModel: "gemini-1.5-flash",
        provider: "gemini",
      };
    }
    return null;
  };

  // Helper to check Grok
  const getGrok = (): LLMConfig | null => {
    const key = getEnvironmentValue("GROQ_API_KEY") ||
      getEnvironmentValue("GROK_API_KEY");
    if (key && key.length > 10) {
      return {
        apiKey: key,
        baseURL: "https://api.groq.com/openai/v1",
        defaultModel: "llama3-70b-8192",
        provider: "grok",
      };
    }
    return null;
  };

  // A model-selected provider is a privacy boundary. If its key is missing,
  // return an unconfigured entry for that provider instead of sending the
  // prompt to another vendor.
  if (preferredProvider) {
    if (preferredProvider === "openai") {
      const config = getOpenAI();
      if (config) return config;
    }
    if (preferredProvider === "gemini") {
      const config = getGemini();
      if (config) return config;
    }
    if (preferredProvider === "grok") {
      const config = getGrok();
      if (config) return config;
    }
    logLLMEvent("warn", "Preferred LLM provider unavailable", {
      provider: preferredProvider,
    });
    return emptyConfigForProvider(preferredProvider);
  }

  return emptyConfigForProvider(preferredProvider);
}

function emptyConfigForProvider(
  provider: "openai" | "gemini" | "grok" | "glm",
): LLMConfig {
  switch (provider) {
    case "gemini":
      return {
        apiKey: "",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
        defaultModel: "gemini-1.5-flash",
        provider,
      };
    case "grok":
      return {
        apiKey: "",
        baseURL: "https://api.groq.com/openai/v1",
        defaultModel: "llama3-70b-8192",
        provider,
      };
    case "glm":
      return {
        apiKey: "",
        baseURL: "https://open.bigmodel.cn/api/paas/v4",
        defaultModel: "glm-4-flash",
        provider,
      };
    case "openai":
      return {
        apiKey: "",
        baseURL: "https://api.openai.com/v1",
        defaultModel: "gpt-4o-mini",
        provider,
      };
  }
}

export interface SanitizedLLMPrompts {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Remove direct identifiers at the final outbound boundary while retaining
 * diagnoses, findings, medications, and other clinically useful text.
 */
export function sanitizeOutboundLLMPrompts(
  systemPrompt: string,
  userPrompt: string,
): SanitizedLLMPrompts {
  const names = extractLabeledPatientNames(`${systemPrompt}\n${userPrompt}`);
  return {
    systemPrompt: sanitizeOutboundPrompt(systemPrompt, names),
    userPrompt: sanitizeOutboundPrompt(userPrompt, names),
  };
}

function extractLabeledPatientNames(text: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /\bpatient(?:[\s_-]*name)?\s*[:=]\s*["']?([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3}?)(?=["']?(?:\s+(?:as|is|has|with)\b|[.,;|\n]|$))/gi,
    /\bgenerate\s+a\s+comprehensive\s+daily\s+summary\s+for\s+([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3})(?=\s*:)/gi,
    /\bgenerate\s+a\s+chronological\s+hospital\s+course\s+for\s+([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3})(?=\s+from\b)/gi,
    /<patient_name>\s*([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3})\s*<\/patient_name>/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const candidate = match[1]?.trim().replace(/[.,;:]+$/, "");
      if (candidate && !/^(?:patient|this patient|unknown)$/i.test(candidate)) {
        names.add(candidate);
      }
    }
  }
  return [...names];
}

function sanitizeOutboundPrompt(text: string, names: string[]): string {
  let sanitized = redactLabeledPatientNames(text);

  for (const name of names.sort((a, b) => b.length - a.length)) {
    // A single-token name can also be ordinary clinical prose (for example,
    // "May" or "Will"). Redact it at labeled locations only.
    if (!/\s/.test(name)) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    sanitized = sanitized.replace(
      new RegExp(`\\b${escaped}\\b`, "gi"),
      "[Patient]",
    );
  }

  const replacements: Array<[RegExp, string]> = [
    [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL REDACTED]"],
    [/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN REDACTED]"],
    [
      /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      "[PHONE REDACTED]",
    ],
    [
      /\b(?:MRN|Medical Record(?:\s+Number)?)\s*[:#=]?\s*[A-Z0-9][A-Z0-9-]{3,31}\b/gi,
      "[MRN REDACTED]",
    ],
    [
      /\b(?:DOB|Date of Birth|D\.O\.B\.?)\s*[:#=]?\s*(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\b/gi,
      "[DOB REDACTED]",
    ],
    [
      /\b(?:Insurance|Policy|Member)\s*(?:ID|#|Number)\s*[:#=]?\s*[A-Z0-9-]{6,32}\b/gi,
      "[INSURANCE REDACTED]",
    ],
    [
      /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane|Ct|Court|Way|Pl|Place)\.?\b/gi,
      "[ADDRESS REDACTED]",
    ],
  ];

  for (const [pattern, replacement] of replacements) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

function redactLabeledPatientNames(text: string): string {
  return text
    .replace(
      /(\bpatient(?:[\s_-]*name)?\s*[:=]\s*["']?)([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3}?)(?=["']?(?:\s+(?:as|is|has|with)\b|[.,;|\n]|$))/gi,
      "$1[Patient]",
    )
    .replace(
      /(\bgenerate\s+a\s+comprehensive\s+daily\s+summary\s+for\s+)([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3})(?=\s*:)/gi,
      "$1[Patient]",
    )
    .replace(
      /(\bgenerate\s+a\s+chronological\s+hospital\s+course\s+for\s+)([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3})(?=\s+from\b)/gi,
      "$1[Patient]",
    )
    .replace(
      /(<patient_name>\s*)([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3})(\s*<\/patient_name>)/gi,
      "$1[Patient]$3",
    );
}

interface LLMRequestBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: {
    model?: string;
    jsonMode?: boolean;
    temperature?: number;
    maxTokens?: number;
  } = {},
) {
  const requestedModel = resolveRequestedModel(options.model);
  if (!requestedModel.valid) {
    throw new InvalidLLMModelError(requestedModel.error);
  }
  const policy = resolveClinicalProvider(requestedModel.model);
  if (!policy.valid) {
    throw new MissingAPIKeyError(policy.error);
  }

  const attempts = buildClinicalProviderAttempts(requestedModel.model);
  if (attempts.length === 0) {
    throw new MissingAPIKeyError(
      "No LLM API key configured. Add GEMINI_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY to your Supabase project secrets.",
    );
  }

  const sanitizedPrompts = sanitizeOutboundLLMPrompts(systemPrompt, userPrompt);
  const messages = [
    { role: "system", content: sanitizedPrompts.systemPrompt },
    { role: "user", content: sanitizedPrompts.userPrompt },
  ];

  let lastError: LLMProviderError | null = null;
  for (const attempt of attempts) {
    const body: LLMRequestBody = {
      model: attempt.model,
      messages,
      temperature: normalizeTemperature(options.temperature),
      max_tokens: normalizeOutputTokenLimit(options.maxTokens),
    };

    if (options.jsonMode && attempt.config.provider === "openai") {
      body.response_format = { type: "json_object" };
    }
    // Note: Gemini/Groq JSON mode might vary, but standard OpenAI compat usually supports response_format or just prompt engineering.

    let response: Response;
    try {
      response = await fetch(`${attempt.config.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${attempt.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      // Network-level failure: fail over to the next configured provider.
      logLLMEvent("error", "LLM provider request failed", {
        provider: attempt.config.provider,
      });
      lastError = new LLMProviderError(
        `LLM provider request failed (${attempt.config.provider})`,
      );
      continue;
    }

    if (!response.ok) {
      logLLMEvent("error", "LLM provider request failed", {
        provider: attempt.config.provider,
        statusCode: response.status,
      });
      lastError = new LLMProviderError(
        `LLM provider request failed (${attempt.config.provider}, status ${response.status})`,
      );
      if (isRetryableProviderStatus(response.status)) continue;
      throw lastError;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    return content;
  }

  throw lastError ??
    new LLMProviderError("All configured LLM providers failed");
}

export interface StreamOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  onToken?: (token: string) => void;
}

export async function* streamLLM(
  systemPrompt: string,
  userPrompt: string,
  options: StreamOptions = {},
): AsyncGenerator<string, void, unknown> {
  const requestedModel = resolveRequestedModel(options.model);
  if (!requestedModel.valid) {
    throw new InvalidLLMModelError(requestedModel.error);
  }
  const policy = resolveClinicalProvider(requestedModel.model);
  if (!policy.valid) {
    throw new MissingAPIKeyError(policy.error);
  }

  const attempts = buildClinicalProviderAttempts(requestedModel.model);
  if (attempts.length === 0) {
    throw new MissingAPIKeyError("No LLM API key configured.");
  }

  const sanitizedPrompts = sanitizeOutboundLLMPrompts(systemPrompt, userPrompt);

  // Failover is only possible before a stream starts; once tokens flow, an
  // interrupted stream surfaces to the caller instead of silently switching
  // providers mid-response.
  let response: Response | null = null;
  let lastError: LLMProviderError | null = null;
  for (const attempt of attempts) {
    const body = {
      model: attempt.model,
      messages: [
        { role: "system", content: sanitizedPrompts.systemPrompt },
        { role: "user", content: sanitizedPrompts.userPrompt },
      ],
      temperature: normalizeTemperature(options.temperature),
      max_tokens: normalizeOutputTokenLimit(options.maxTokens),
      stream: true,
    };

    let candidate: Response;
    try {
      candidate = await fetch(`${attempt.config.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${attempt.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      logLLMEvent("error", "LLM streaming request failed", {
        provider: attempt.config.provider,
      });
      lastError = new LLMProviderError(
        `LLM streaming request failed (${attempt.config.provider})`,
      );
      continue;
    }

    if (!candidate.ok) {
      logLLMEvent("error", "LLM streaming request failed", {
        provider: attempt.config.provider,
        statusCode: candidate.status,
      });
      lastError = new LLMProviderError(
        `LLM streaming request failed (${attempt.config.provider}, status ${candidate.status})`,
      );
      if (isRetryableProviderStatus(candidate.status)) continue;
      throw lastError;
    }

    response = candidate;
    break;
  }

  if (!response) {
    throw lastError ??
      new LLMProviderError("All configured LLM providers failed");
  }

  if (!response.body) {
    throw new LLMProviderError("No response body for streaming");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          options.onToken?.(content);
          yield content;
        }
      } catch {
        // Skip malformed JSON chunks
      }
    }
  }
}

function logLLMEvent(
  level: "warn" | "error",
  event: string,
  data: { provider?: string; statusCode?: number },
): void {
  console.log(JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    data,
  }));
}

export async function streamLLMToString(
  systemPrompt: string,
  userPrompt: string,
  options: StreamOptions = {},
): Promise<string> {
  let result = "";
  for await (const chunk of streamLLM(systemPrompt, userPrompt, options)) {
    result += chunk;
  }
  return result;
}
