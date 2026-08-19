import { push as collect } from './collector';
import { safeSessionStorage } from '@/utils/safeStorage';
import { captureOperationalSignalToSentry } from '@/lib/observability/sentryClient';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

const APP_NAME = 'round-robin-notes';
const SESSION_STORAGE_KEY = 'observability.sessionId';
const REMOTE_CONTEXT_KEYS = new Set([
  'attempt',
  'attempts',
  'category',
  'circuitState',
  'code',
  'correlationId',
  'count',
  'durationMs',
  'entity',
  'errorType',
  'feature',
  'function',
  'functionName',
  'hasSession',
  'maxAttempts',
  'metricName',
  'metricUnit',
  'metricValue',
  'model',
  'operation',
  'outcome',
  'provider',
  'requestId',
  'status',
  'statusCode',
  'type',
]);
const SAFE_REMOTE_TOKEN = /^[a-zA-Z0-9_.:/-]{1,128}$/;

function getSessionId(): string {
  if (typeof window === 'undefined') {
    return 'server';
  }

  try {
    const existing = safeSessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;

    const generated = globalThis.crypto?.randomUUID?.() ?? `session_${Date.now()}`;
    safeSessionStorage.setItem(SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `session_${Date.now()}`;
  }
}

/** Generate a request/correlation ID for tracing a single operation across logs. */
export function generateRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function basePayload() {
  return {
    app: APP_NAME,
    env: import.meta.env?.MODE ?? 'unknown',
    sessionId: getSessionId(),
  };
}

function remoteEventName(message: string): string {
  const telemetryCategory = /^\[Telemetry\] ([a-z_]+):/.exec(message)?.[1];
  if (telemetryCategory) return `telemetry.${telemetryCategory}`;
  return SAFE_REMOTE_TOKEN.test(message) ? message : 'client_log';
}

function sanitizeRemoteContext(context: LogContext): LogContext {
  const sanitized: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (!REMOTE_CONTEXT_KEYS.has(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) sanitized[key] = value;
    else if (typeof value === 'boolean' || value === null) sanitized[key] = value;
    else if (typeof value === 'string' && SAFE_REMOTE_TOKEN.test(value)) sanitized[key] = value;
  }
  return sanitized;
}

export function createRemoteLogPayload(
  level: LogLevel,
  message: string,
  context: LogContext = {},
): LogContext {
  return {
    timestamp: new Date().toISOString(),
    level,
    message: remoteEventName(message),
    ...basePayload(),
    context: sanitizeRemoteContext(context),
  };
}

function emitLog(level: LogLevel, message: string, context: LogContext = {}) {
  // Console output is an external observability boundary too: browser devtools,
  // managed-device agents, and support captures may retain it. Apply the same
  // allowlist used for remote collection before writing either destination.
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message: remoteEventName(message),
    ...basePayload(),
    context: sanitizeRemoteContext(context),
  };

  const line = JSON.stringify(payload);

  switch (level) {
    case 'warn':
      console.warn(line);
      break;
    case 'error':
      console.error(line);
      break;
    default:
      console.log(line);
  }

  try {
    collect(createRemoteLogPayload(level, message, context));
  } catch {
    // Collector optional; never break logging
  }

  try {
    captureOperationalSignalToSentry(level, payload.message, payload.context);
  } catch {
    // Central monitoring must never alter the user workflow.
  }
}

export function logInfo(message: string, context?: LogContext) {
  emitLog('info', message, context);
}

export function logWarn(message: string, context?: LogContext) {
  emitLog('warn', message, context);
}

export function logError(message: string, context?: LogContext) {
  emitLog('error', message, context);
}

export function logMetric(
  name: string,
  value: number,
  unit: string,
  context: LogContext = {}
) {
  emitLog('info', 'metric', {
    // Keep the measurement flat so each field crosses the same scalar-only,
    // PHI-safe allowlist as ordinary log context. Nested metric objects were
    // previously discarded wholesale by sanitizeRemoteContext().
    metricName: name,
    metricValue: value,
    metricUnit: unit,
    ...context,
    type: 'metric',
  });
}
