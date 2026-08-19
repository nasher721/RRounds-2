/**
 * Input Validation & Payload Security for Edge Functions
 *
 * Provides request body validation, payload size limits,
 * and schema checking to prevent abuse and malformed input.
 */

import { errorResponse } from "./cors.ts";

// ─── Size Limits ──────────────────────────────────────────────
const MAX_JSON_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5 MB for standard JSON
const MAX_MEDIA_PAYLOAD_BYTES = 25 * 1024 * 1024; // 25 MB for audio/images
const MAX_STRING_FIELD_BYTES = 100_000; // 100 KB of UTF-8 text per field
const MAX_NAME_BYTES = 500;
const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 18 * 1024 * 1024;

const textEncoder = new TextEncoder();

/** Return the encoded UTF-8 size used by HTTP and provider payloads. */
export function utf8ByteLength(value: string): number {
  return textEncoder.encode(value).byteLength;
}

function truncateToUtf8Bytes(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  if (utf8ByteLength(value) <= maxBytes) return value;

  let result = "";
  let size = 0;
  for (const character of value) {
    const characterBytes = utf8ByteLength(character);
    if (size + characterBytes > maxBytes) break;
    result += character;
    size += characterBytes;
  }
  return result;
}

async function readUtf8BodyWithLimit(
  req: Request,
  maxBytes: number,
): Promise<{ tooLarge: true } | { tooLarge: false; text: string }> {
  if (!req.body) return { tooLarge: false, text: "" };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("Request payload too large").catch(() => undefined);
        return { tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    tooLarge: false,
    text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  };
}

export type ValidationResult<T = unknown> =
  | { valid: true; data: T }
  | { valid: false; response: Response };

/**
 * Parse and validate the request body with size limits.
 * Returns the parsed JSON body or an error Response.
 */
export async function parseAndValidateBody<T = Record<string, unknown>>(
  req: Request,
  options?: { maxBytes?: number },
): Promise<ValidationResult<T>> {
  const maxBytes = options?.maxBytes ?? MAX_JSON_PAYLOAD_BYTES;

  // Check Content-Length header first (fast reject)
  const contentLength = req.headers.get("content-length");
  const declaredLength = contentLength === null ? null : Number(contentLength);
  if (
    declaredLength !== null &&
    Number.isFinite(declaredLength) &&
    declaredLength >= 0 &&
    declaredLength > maxBytes
  ) {
    return {
      valid: false,
      response: errorResponse(req, "Request payload too large", 413),
    };
  }

  try {
    // Stop reading as soon as the encoded payload exceeds the cap. This keeps
    // a missing or dishonest Content-Length header from forcing an unbounded
    // allocation before validation can reject the request.
    const body = await readUtf8BodyWithLimit(req, maxBytes);
    if (body.tooLarge) {
      return {
        valid: false,
        response: errorResponse(req, "Request payload too large", 413),
      };
    }
    const bodyText = body.text;

    if (!bodyText.trim()) {
      return {
        valid: false,
        response: errorResponse(req, "Request body is empty", 400),
      };
    }

    const data = JSON.parse(bodyText) as T;
    return { valid: true, data };
  } catch (_err) {
    return {
      valid: false,
      response: errorResponse(req, "Invalid JSON in request body", 400),
    };
  }
}

// ─── Field Validators ─────────────────────────────────────────

/** Validate a required string field exists and is within length limits */
export function requireString(
  value: unknown,
  fieldName: string,
  maxBytes = MAX_STRING_FIELD_BYTES,
): string | { error: string } {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { error: `Missing required field: ${fieldName}` };
  }
  if (utf8ByteLength(value) > maxBytes) {
    return {
      error:
        `Field '${fieldName}' exceeds maximum size of ${maxBytes} UTF-8 bytes`,
    };
  }
  return value;
}

/** Validate an optional string field is within length limits */
export function optionalString(
  value: unknown,
  maxBytes = MAX_STRING_FIELD_BYTES,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return undefined;
  return truncateToUtf8Bytes(value, maxBytes);
}

/** Validate a string is one of allowed values */
export function requireEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowed: readonly T[],
): T | { error: string } {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return {
      error: `Invalid ${fieldName}. Must be one of: ${allowed.join(", ")}`,
    };
  }
  return value as T;
}

/** Validate an array of strings (e.g., medication lists) */
export function validateStringArray(
  value: unknown,
  fieldName: string,
  maxItems = 100,
  maxItemBytes = 1000,
): string[] | { error: string } {
  if (!Array.isArray(value)) {
    return { error: `Field '${fieldName}' must be an array` };
  }
  if (value.length > maxItems) {
    return {
      error: `Field '${fieldName}' exceeds maximum of ${maxItems} items`,
    };
  }
  for (const item of value) {
    if (typeof item !== "string") {
      return { error: `All items in '${fieldName}' must be strings` };
    }
    if (utf8ByteLength(item) > maxItemBytes) {
      return {
        error:
          `Item in '${fieldName}' exceeds maximum size of ${maxItemBytes} UTF-8 bytes`,
      };
    }
  }
  return value as string[];
}

type ImageValidationError = { error: string; status: 400 | 413 };

function decodedBase64ByteLength(value: string): number | null {
  if (value.length === 0 || value.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;

  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

/** Validate bounded raster images represented as base64 data URIs. */
export function validateImageArray(
  value: unknown,
  maxImages = MAX_IMAGES,
  maxImageBytes = MAX_IMAGE_BYTES,
  maxTotalBytes = MAX_TOTAL_IMAGE_BYTES,
): string[] | ImageValidationError {
  if (!Array.isArray(value)) {
    return { error: "Images must be an array", status: 400 };
  }
  if (value.length > maxImages) {
    return {
      error: `Maximum ${maxImages} images allowed`,
      status: 413,
    };
  }

  let totalBytes = 0;
  for (const item of value) {
    if (typeof item !== "string") {
      return {
        error: "Each image must be a base64 data URI",
        status: 400,
      };
    }

    const match = item.match(
      /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/,
    );
    if (!match) {
      return {
        error: "Images must be PNG, JPEG, or WebP base64 data URIs",
        status: 400,
      };
    }

    const decodedBytes = decodedBase64ByteLength(match[1]);
    if (decodedBytes === null) {
      return { error: "Image data is not valid base64", status: 400 };
    }
    if (decodedBytes > maxImageBytes) {
      return { error: "An image exceeds the size limit", status: 413 };
    }

    totalBytes += decodedBytes;
    if (totalBytes > maxTotalBytes) {
      return {
        error: "Combined image data exceeds the size limit",
        status: 413,
      };
    }
  }
  return value as string[];
}

// ─── Schema Definitions for Each Edge Function ────────────────

/** Allowed transform types for transform-text */
export const ALLOWED_TRANSFORM_TYPES = [
  "comma-list",
  "medical-shorthand",
  "custom",
] as const;

/** Allowed section values for generate-todos */
export const ALLOWED_TODO_SECTIONS = [
  "all",
  "clinical_summary",
  "interval_events",
  "imaging",
  "labs",
  "cv",
  "resp",
  "neuro",
  "gi",
  "renalGU",
  "heme",
  "infectious",
  "endo",
  "skinLines",
  "dispo",
] as const;

// ─── Sanitize Error Messages ──────────────────────────────────

/**
 * Create a safe error message that doesn't leak internal details.
 * Use in catch blocks instead of passing error.message directly.
 */
export function safeErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred",
): string {
  if (error instanceof Error) {
    // Only pass through known safe error patterns
    const safePatterns = [
      "Rate limit exceeded",
      "not configured",
      "No audio data",
      "Missing required",
      "Invalid",
      "too large",
      "AI service",
      "Payment required",
      "credits",
    ];
    const envVarPatterns = ["API_KEY", "SECRET", "PASSWORD", "TOKEN"];
    for (const env of envVarPatterns) {
      if (error.message.includes(env)) {
        return fallback;
      }
    }
    for (const pattern of safePatterns) {
      if (error.message.includes(pattern)) {
        return error.message;
      }
    }
  }

  // Don't leak internal error details
  return fallback;
}

// ─── Convenience: Method Check ────────────────────────────────

/** Validate that request uses an allowed HTTP method */
export function requireMethod(
  req: Request,
  allowed: string | string[] = "POST",
): Response | null {
  const methods = Array.isArray(allowed) ? allowed : [allowed];
  if (!methods.includes(req.method)) {
    return errorResponse(req, `Method ${req.method} not allowed`, 405);
  }
  return null;
}

export {
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
  MAX_JSON_PAYLOAD_BYTES,
  MAX_MEDIA_PAYLOAD_BYTES,
  MAX_NAME_BYTES,
  MAX_STRING_FIELD_BYTES,
  MAX_TOTAL_IMAGE_BYTES,
};
