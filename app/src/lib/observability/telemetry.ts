/**
 * Telemetry Service
 *
 * Persistent, structured error and event telemetry that goes beyond console logging.
 *
 * Features:
 * - Persists error events to IndexedDB for post-mortem analysis
 * - Captures unhandled errors and promise rejections globally
 * - Tracks error frequency to detect recurring issues
 * - Provides exportable error reports for debugging
 * - PHI-safe: never captures patient data in telemetry
 */

import { logError, logWarn, logInfo, type LogContext } from "@/lib/observability/logger";
import { getBreadcrumbTrail } from "@/lib/observability/breadcrumbs";
import { safeSessionStorage } from "@/utils/safeStorage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TelemetryEvent {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  category: TelemetryCategory;
  message: string;
  stack?: string;
  context: Record<string, unknown>;
  sessionId: string;
  url: string;
  userAgent: string;
  /** Fingerprint for deduplication (hash of message + stack first line) */
  fingerprint: string;
}

export type TelemetryCategory =
  | 'unhandled_error'
  | 'unhandled_rejection'
  | 'render_error'
  | 'api_error'
  | 'ai_error'
  | 'sync_error'
  | 'validation_error'
  | 'network_error'
  | 'handled_error'
  | 'custom';

interface ErrorFrequency {
  fingerprint: string;
  message: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_NAME = 'rr_telemetry';
const DB_VERSION = 1;
const STORE_NAME = 'events';
const MAX_EVENTS = 500;
const MAX_EXPORT_EVENTS = 200;

// ---------------------------------------------------------------------------
// Session ID (reuse from logger if available)
// ---------------------------------------------------------------------------

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = safeSessionStorage.getItem('observability.sessionId');
    if (existing) return existing;
    const generated = globalThis.crypto?.randomUUID?.() ?? `session_${Date.now()}`;
    safeSessionStorage.setItem('observability.sessionId', generated);
    return generated;
  } catch {
    return `session_${Date.now()}`;
  }
}

// ---------------------------------------------------------------------------
// Fingerprinting
// ---------------------------------------------------------------------------

/**
 * Turn thrown values, API errors, and rejection reasons into a useful telemetry string.
 * Avoids `[object Object]` from String(plainObject) and handles circular structures.
 */
function classifyTelemetryError(error: unknown, category: TelemetryCategory): string {
  if (error instanceof Error && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(error.name)) {
    return error.name;
  }
  if (typeof error === 'string') {
    if (error === 'edge_health_probe_exhausted') return 'HealthCheckError';
    if (/storage.+not allowed|storage.+unavailable/i.test(error)) return 'StorageAccessError';
    if (category === 'network_error') return 'NetworkFailure';
    return 'StringError';
  }
  if (error === null) return 'NullError';
  return `${typeof error}Error`;
}

function fingerprint(message: string, stack?: string): string {
  const firstLine = stack?.split('\n')[1]?.trim() ?? '';
  const input = `${message}::${firstLine}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash = hash & hash;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('fingerprint', 'fingerprint', { unique: false });
        store.createIndex('level', 'level', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

async function storeEvent(event: TelemetryEvent): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(event);

    // Evict old events if over limit
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result > MAX_EVENTS) {
        const deleteCount = countReq.result - MAX_EVENTS;
        const cursor = store.index('timestamp').openCursor();
        let deleted = 0;
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (c && deleted < deleteCount) {
            c.delete();
            deleted++;
            c.continue();
          }
        };
      }
    };
  } catch {
    // Silently fail — telemetry should never break the app
  }
}

// ---------------------------------------------------------------------------
// In-memory buffer for frequency tracking
// ---------------------------------------------------------------------------

const frequencyMap = new Map<string, ErrorFrequency>();

function trackFrequency(event: TelemetryEvent): void {
  const existing = frequencyMap.get(event.fingerprint);
  if (existing) {
    existing.count++;
    existing.lastSeen = event.timestamp;
  } else {
    frequencyMap.set(event.fingerprint, {
      fingerprint: event.fingerprint,
      message: event.message.slice(0, 200),
      count: 1,
      firstSeen: event.timestamp,
      lastSeen: event.timestamp,
    });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a telemetry event. Persists to IndexedDB and logs to console.
 */
export function recordTelemetryEvent(
  category: TelemetryCategory,
  error: Error | string | unknown,
  context: Record<string, unknown> = {},
): TelemetryEvent {
  const errorType = classifyTelemetryError(error, category);
  const message = `${category}:${errorType}`;

  const event: TelemetryEvent = {
    id: globalThis.crypto?.randomUUID?.() ?? `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    level: category.includes('error') || category === 'render_error' ? 'error' : 'warning',
    category,
    message: message.slice(0, 1000),
    context: sanitizeContext({ ...context, errorType }),
    sessionId: getSessionId(),
    url: '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    fingerprint: fingerprint(message),
  };

  trackFrequency(event);
  storeEvent(event);

  // Expected connectivity/handled failures remain available to the collector
  // and local diagnostics without flooding production consoles.
  const shouldWriteConsole = category !== 'network_error' && category !== 'handled_error';
  if (shouldWriteConsole && event.level === 'error') {
    logError(`[Telemetry] ${category}: ${errorType}`, event.context as LogContext);
  } else if (shouldWriteConsole) {
    logWarn(`[Telemetry] ${category}: ${errorType}`, event.context as LogContext);
  }

  return event;
}

/**
 * Get error frequency data — useful for identifying recurring issues.
 */
export function getErrorFrequencies(): ErrorFrequency[] {
  return Array.from(frequencyMap.values())
    .sort((a, b) => b.count - a.count);
}

/**
 * Get recent telemetry events from IndexedDB.
 */
export async function getRecentEvents(
  count = 50,
  filter?: { category?: TelemetryCategory; level?: 'error' | 'warning' | 'info' },
): Promise<TelemetryEvent[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const events: TelemetryEvent[] = [];

      const cursor = store.index('timestamp').openCursor(null, 'prev');
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (c && events.length < count) {
          const event = c.value as TelemetryEvent;
          if (
            (!filter?.category || event.category === filter.category) &&
            (!filter?.level || event.level === filter.level)
          ) {
            events.push(event);
          }
          c.continue();
        } else {
          resolve(events);
        }
      };
      cursor.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Export a debugging report of recent errors.
 */
export async function exportErrorReport(): Promise<string> {
  const events = await getRecentEvents(MAX_EXPORT_EVENTS, { level: 'error' });
  const frequencies = getErrorFrequencies();

  const report = {
    generatedAt: new Date().toISOString(),
    sessionId: getSessionId(),
    summary: {
      totalErrors: events.length,
      uniqueErrors: frequencies.filter(f => f.count > 0).length,
      topRecurring: frequencies.slice(0, 10),
    },
    events: events.map(e => ({
      timestamp: e.timestamp,
      category: e.category,
      message: e.message,
      fingerprint: e.fingerprint,
      context: e.context,
    })),
  };

  return JSON.stringify(report, null, 2);
}

/**
 * Full diagnostics bundle for support or local debugging: errors with stack previews,
 * fingerprints for deduplication, navigation breadcrumbs, and session metadata.
 * Safe to share for engineering triage — still avoid posting publicly (may contain paths, user agent).
 */
export async function exportDiagnosticsReport(): Promise<string> {
  const events = await getRecentEvents(100, { level: 'error' });
  const frequencies = getErrorFrequencies();
  const breadcrumbs = getBreadcrumbTrail(35);

  const body = {
    kind: 'round-robin-notes-diagnostics',
    version: 1,
    generatedAt: new Date().toISOString(),
    sessionId: getSessionId(),
    build: {
      mode: import.meta.env.MODE,
    },
    url: typeof window !== 'undefined' ? window.location.pathname : '',
    userAgentPreview:
      typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : '',
    recentBreadcrumbs: breadcrumbs,
    summary: {
      errorEventsSampled: events.length,
      uniqueFingerprints: frequencies.filter((f) => f.count > 0).length,
      topRecurring: frequencies.slice(0, 15),
    },
    events: events.map((e) => ({
      timestamp: e.timestamp,
      category: e.category,
      fingerprint: e.fingerprint,
      message: e.message,
      stackPreview: e.stack
        ? e.stack.split('\n').slice(0, 8).join('\n')
        : undefined,
      context: e.context,
    })),
    fixHints: frequencies.slice(0, 5).map((f) => ({
      fingerprint: f.fingerprint,
      occurrences: f.count,
      grepMessage: f.message.slice(0, 80),
    })),
  };

  return JSON.stringify(body, null, 2);
}

/**
 * Explicitly record a handled error (try/catch) for the same pipeline as global errors.
 */
export function captureHandledError(
  error: Error,
  extra: Record<string, unknown> = {},
): TelemetryEvent {
  return recordTelemetryEvent('handled_error', error, { ...extra, handled: true });
}

/**
 * Clear all telemetry data.
 */
export async function clearTelemetry(): Promise<void> {
  frequencyMap.clear();
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  } catch {
    // Silently fail
  }
}

// ---------------------------------------------------------------------------
// Global error handlers
// ---------------------------------------------------------------------------

let initialized = false;

/**
 * Install global error handlers to capture unhandled errors and rejections.
 * Safe to call multiple times — only installs once.
 */
export function initGlobalErrorCapture(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('error', (event) => {
    recordTelemetryEvent('unhandled_error', event.error ?? event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    recordTelemetryEvent(
      'unhandled_rejection',
      event.reason !== undefined ? event.reason : new Error('Unknown rejection'),
    );
  });

  logInfo('[Telemetry] Global error capture initialized');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Remove any potentially sensitive data from context before storing. */
function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const allowedKeys = new Set([
    'attempt',
    'attempts',
    'boundary',
    'category',
    'durationMs',
    'errorType',
    'failureCount',
    'feature',
    'function',
    'handled',
    'lineno',
    'colno',
    'operation',
    'outcome',
    'panelTitle',
    'sectionName',
    'status',
    'statusCode',
    'timeoutMs',
  ]);
  const safeToken = /^[a-zA-Z0-9_.:/ -]{1,128}$/;

  for (const [key, value] of Object.entries(context)) {
    if (!allowedKeys.has(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) sanitized[key] = value;
    else if (typeof value === 'boolean' || value === null) sanitized[key] = value;
    else if (typeof value === 'string' && safeToken.test(value)) sanitized[key] = value;
  }

  return sanitized;
}
