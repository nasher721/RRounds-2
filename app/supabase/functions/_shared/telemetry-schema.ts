/**
 * Strict, content-free schema for browser observability ingestion.
 *
 * The browser logger already replaces free-form messages and allowlists scalar
 * context. This boundary validates the payload again and projects it into
 * fixed database columns. Raw context, session identifiers, URLs, user agents,
 * patient identifiers, and arbitrary strings are never returned for storage.
 */

export const MAX_TELEMETRY_BATCH_SIZE = 50;
export const MAX_TELEMETRY_PAYLOAD_BYTES = 64 * 1024;

const LEVELS = new Set(["debug", "info", "warn", "error"]);
const ENVIRONMENTS = new Set(["production", "development", "test", "unknown"]);
const EVENT_NAMES = new Set([
  "cache.warming.completed",
  "client_log",
  "edge_fetch_retry",
  "edge_invoke_failed",
  "marketing.contact.email",
  "marketing.features.explore",
  "marketing.landing_view",
  "marketing.pricing.contact",
  "marketing.security_guidance.open",
  "marketing.sign_in.header",
  "marketing.sign_in.hero",
  "marketing.workspace.footer",
  "metric",
  "monitor.ingest_probe",
  "patient.activity.fetch_failed",
  "patient.activity.insert_failed",
  "patient.add.failed",
  "patient.clear_all.failed",
  "patient.collapse_all.failed",
  "patient.conflict_refresh.failed",
  "patient.duplicate.failed",
  "patient.field_history.delete_failed",
  "patient.field_history.failed",
  "patient.field_history.fetch_failed",
  "patient.field_history.insert_failed",
  "patient.remove.failed",
  "patient.update.failed",
  "telemetry.ai_error",
  "telemetry.api_error",
  "telemetry.custom",
  "telemetry.handled_error",
  "telemetry.network_error",
  "telemetry.render_error",
  "telemetry.sync_error",
  "telemetry.unhandled_error",
  "telemetry.unhandled_rejection",
  "telemetry.validation_error",
]);
const METRIC_NAMES = new Set([
  "auth.sign_in.duration_ms",
  "auth.sign_in.total",
  "offline.sync.completed",
  "offline.sync.conflicts",
  "offline.sync.duration_ms",
  "offline.sync.failed",
  "offline.sync.oldest_age_ms",
  "offline.sync.queue_length",
  "patients.fetch.cache_fallback",
  "patients.fetch.duration_ms",
  "patients.fetch.error",
  "patients.fetch.success",
  "patients.mutation.duration_ms",
  "patients.mutation.total",
  "web.vital.cls",
  "web.vital.fcp_ms",
  "web.vital.inp_ms",
  "web.vital.lcp_ms",
  "web.vital.ttfb_ms",
]);
const METRIC_UNITS = new Set(["count", "ms", "s"]);
const OPERATIONS = new Set([
  "add",
  "clear_all",
  "collapse_all",
  "create",
  "delete",
  "duplicate",
  "handleError",
  "remove",
  "round_hydrate",
  "round_outbox_entry",
  "sign_in",
  "update",
]);
const OUTCOMES = new Set([
  "cleared",
  "completed",
  "conflict",
  "email_not_confirmed",
  "enqueued",
  "error",
  "idle",
  "invalid_credentials",
  "invalid_input",
  "partial",
  "provider_error",
  "queued",
  "rate_limited",
  "redirect_started",
  "saved",
  "success",
  "sync_complete",
  "sync_error",
  "sync_start",
  "unavailable",
  "unexpected_error",
  "unhealthy",
  "unknown",
]);
const PROVIDERS = new Set([
  "apple",
  "gemini",
  "google",
  "grok",
  "openai",
  "password",
]);
const EVENT_TYPES = new Set(["metric", "product_analytics"]);
const FEATURES = new Set([
  "assessment_plan",
  "clinical_summary",
  "daily-summary",
  "daily_summary",
  "date_organizer",
  "differential_diagnosis",
  "documentation_check",
  "interval_events",
  "interval_events_generator",
  "medical_correction",
  "medications",
  "neuro_icu_hpi",
  "patient_course",
  "problem_list",
  "public_funnel",
  "round-sync",
  "smart_draft",
  "smart_expand",
  "soap_format",
  "system_based_rounds",
  "text_transform",
  "todos",
  "transcription",
]);
const ALLOWED_CONTEXT_KEYS = new Set([
  "attempt",
  "attempts",
  "category",
  "circuitState",
  "code",
  "correlationId",
  "count",
  "durationMs",
  "entity",
  "errorType",
  "feature",
  "function",
  "functionName",
  "hasSession",
  "maxAttempts",
  "metricName",
  "metricUnit",
  "metricValue",
  "model",
  "operation",
  "outcome",
  "provider",
  "requestId",
  "status",
  "statusCode",
  "type",
]);
const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "app",
  "context",
  "env",
  "level",
  "message",
  "sessionId",
  "timestamp",
]);
const SAFE_TOKEN = /^[A-Za-z0-9_.:/-]{1,128}$/;
const SAFE_SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_CLOCK_SKEW_FUTURE_MS = 24 * 60 * 60 * 1000;
const MAX_EVENT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ABSOLUTE_METRIC = 1_000_000_000_000;

type TelemetryLevel = "debug" | "info" | "warn" | "error";

export interface TelemetryInsertRow {
  occurred_at: string;
  level: TelemetryLevel;
  event_name: string;
  environment: string;
  metric_name: string | null;
  metric_value: number | null;
  metric_unit: string | null;
  operation: string | null;
  outcome: string | null;
  feature: string | null;
  provider: string | null;
  event_type: string | null;
  event_count: number | null;
  duration_ms: number | null;
  status_code: number | null;
}

export type TelemetryBatchResult =
  | { valid: true; rows: TelemetryInsertRow[] }
  | { valid: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeOptionalString(
  value: unknown,
  allowed?: ReadonlySet<string>,
): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !SAFE_TOKEN.test(value)) return undefined;
  if (allowed && !allowed.has(value)) return undefined;
  return value;
}

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null | undefined {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    return undefined;
  }
  return value;
}

function boundedDuration(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 86_400_000
  ) return undefined;
  return Math.round(value);
}

function validateContext(context: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(context)) {
    if (!ALLOWED_CONTEXT_KEYS.has(key)) {
      return `Unsupported context field: ${key}`;
    }
    if (typeof value === "string" && SAFE_TOKEN.test(value)) continue;
    if (typeof value === "number" && Number.isFinite(value)) continue;
    if (typeof value === "boolean" || value === null) continue;
    return `Invalid context value: ${key}`;
  }
  return null;
}

function parseEvent(
  value: unknown,
  nowMs: number,
): TelemetryInsertRow | string {
  if (!isRecord(value)) return "Each telemetry event must be an object";
  for (const key of Object.keys(value)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      return `Unsupported telemetry field: ${key}`;
    }
  }

  if (value.app !== "round-robin-notes") return "Invalid telemetry application";
  if (typeof value.level !== "string" || !LEVELS.has(value.level)) {
    return "Invalid telemetry level";
  }
  if (typeof value.env !== "string" || !ENVIRONMENTS.has(value.env)) {
    return "Invalid telemetry environment";
  }
  if (typeof value.message !== "string" || !EVENT_NAMES.has(value.message)) {
    return "Unsupported telemetry event";
  }
  if (
    typeof value.sessionId !== "string" ||
    !SAFE_SESSION_ID.test(value.sessionId)
  ) {
    return "Invalid telemetry session";
  }
  if (typeof value.timestamp !== "string") return "Invalid telemetry timestamp";
  const occurredAtMs = Date.parse(value.timestamp);
  if (
    !Number.isFinite(occurredAtMs) ||
    occurredAtMs < nowMs - MAX_EVENT_AGE_MS ||
    occurredAtMs > nowMs + MAX_CLOCK_SKEW_FUTURE_MS
  ) {
    return "Telemetry timestamp is outside the accepted window";
  }
  if (!isRecord(value.context)) return "Telemetry context must be an object";
  const contextError = validateContext(value.context);
  if (contextError) return contextError;

  const metricName = safeOptionalString(value.context.metricName, METRIC_NAMES);
  const metricUnit = safeOptionalString(value.context.metricUnit, METRIC_UNITS);
  const operation = safeOptionalString(value.context.operation, OPERATIONS);
  const outcome = safeOptionalString(value.context.outcome, OUTCOMES);
  const feature = safeOptionalString(value.context.feature, FEATURES);
  const provider = safeOptionalString(value.context.provider, PROVIDERS);
  const eventType = safeOptionalString(value.context.type, EVENT_TYPES);
  const eventCount = boundedInteger(value.context.count, 0, 1_000_000);
  const durationMs = boundedDuration(value.context.durationMs);
  const statusCode = boundedInteger(value.context.statusCode, 100, 599);

  if (
    metricName === undefined ||
    metricUnit === undefined ||
    operation === undefined ||
    outcome === undefined ||
    feature === undefined ||
    provider === undefined ||
    eventType === undefined ||
    eventCount === undefined ||
    durationMs === undefined ||
    statusCode === undefined
  ) {
    return "Telemetry context contains an unsupported dimension";
  }

  let metricValue: number | null = null;
  if (
    value.context.metricValue !== undefined &&
    value.context.metricValue !== null
  ) {
    if (
      typeof value.context.metricValue !== "number" ||
      !Number.isFinite(value.context.metricValue) ||
      Math.abs(value.context.metricValue) > MAX_ABSOLUTE_METRIC
    ) {
      return "Invalid telemetry metric value";
    }
    metricValue = value.context.metricValue;
  }

  if (value.message === "metric") {
    if (
      !metricName || metricValue === null || !metricUnit ||
      eventType !== "metric"
    ) {
      return "Metric telemetry requires an allowlisted name, value, unit, and type";
    }
  } else if (metricName || metricValue !== null || metricUnit) {
    return "Non-metric telemetry cannot include metric fields";
  }

  return {
    occurred_at: new Date(occurredAtMs).toISOString(),
    level: value.level as TelemetryLevel,
    event_name: value.message,
    environment: value.env,
    metric_name: metricName,
    metric_value: metricValue,
    metric_unit: metricUnit,
    operation,
    outcome,
    feature,
    provider,
    event_type: eventType,
    event_count: eventCount,
    duration_ms: durationMs,
    status_code: statusCode,
  };
}

export function parseTelemetryBatch(
  value: unknown,
  nowMs = Date.now(),
): TelemetryBatchResult {
  if (!Array.isArray(value) || value.length === 0) {
    return { valid: false, error: "Telemetry body must be a non-empty array" };
  }
  if (value.length > MAX_TELEMETRY_BATCH_SIZE) {
    return {
      valid: false,
      error: `Telemetry batch exceeds ${MAX_TELEMETRY_BATCH_SIZE} events`,
    };
  }

  const rows: TelemetryInsertRow[] = [];
  for (const event of value) {
    const parsed = parseEvent(event, nowMs);
    if (typeof parsed === "string") return { valid: false, error: parsed };
    rows.push(parsed);
  }
  return { valid: true, rows };
}
