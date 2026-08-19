export { authenticateRequest, type AuthResult, logAuthEvent } from "./auth.ts";

export {
  errorResponse,
  getCorsHeaders,
  handleOptions,
  jsonResponse,
  STANDARD_HEADERS,
} from "./cors.ts";

export { getCorsHeaders as corsHeaders } from "./cors.ts";
export { errorResponse as createErrorResponse } from "./cors.ts";
export { handleOptions as createCorsResponse } from "./cors.ts";

export { LLMProviderError, MissingAPIKeyError } from "./llm-client.ts";

/**
 * Emit a structured operational event without clinical or user content.
 *
 * Event names must be static labels. Metadata is allowlisted so a future caller
 * cannot accidentally persist request text, model output, identifiers, or PHI.
 */
export function safeLog(
  level: "info" | "warn" | "error",
  event: string,
  data?: Record<string, unknown>,
): void {
  const sanitizedData = data ? sanitizeForLogging(data) : undefined;
  console.log(JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...(sanitizedData && Object.keys(sanitizedData).length > 0 &&
      { data: sanitizedData }),
  }));
}

function sanitizeForLogging(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const allowedKeys = new Set([
    "audioBytes",
    "durationMs",
    "enhancementRequested",
    "errorType",
    "feature",
    "function",
    "hasContext",
    "hasText",
    "imageCount",
    "inputChars",
    "interactionCount",
    "medicationCount",
    "mimeCategory",
    "model",
    "outputChars",
    "parsedWith",
    "patientCount",
    "provider",
    "requestId",
    "sectionCount",
    "stage",
    "status",
    "statusCode",
    "streaming",
    "todoCount",
    "uniquePatientCount",
  ]);
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (!allowedKeys.has(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      sanitized[key] = value;
    } else {
      sanitized[key] = "[REDACTED]";
    }
  }

  return sanitized;
}

export {
  checkRateLimit,
  RATE_LIMITS,
  type RateLimitConfig,
  type RateLimitConsumer,
  type RateLimitDecision,
  type RateLimitResult,
  withRateLimit,
} from "./rate-limit.ts";

export {
  ALLOWED_TODO_SECTIONS,
  ALLOWED_TRANSFORM_TYPES,
  MAX_JSON_PAYLOAD_BYTES,
  MAX_MEDIA_PAYLOAD_BYTES,
  MAX_NAME_BYTES,
  MAX_STRING_FIELD_BYTES,
  optionalString,
  parseAndValidateBody,
  requireEnum,
  requireMethod,
  requireString,
  safeErrorMessage,
  utf8ByteLength,
  validateImageArray,
  validateStringArray,
  type ValidationResult,
} from "./input-validation.ts";
