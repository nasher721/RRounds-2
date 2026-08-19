/**
 * Optional PHI-safe observability collector.
 *
 * When VITE_TELEMETRY_INGEST_URL is configured, sanitized log and metric
 * payloads are sent in bounded batches. Delivery failures never affect the app:
 * non-2xx and network failures are retained for a later retry, concurrent
 * flushes are serialized, and retained memory is capped.
 */

import { isBrowserKnownOffline } from '@/lib/networkConnectivity';

const MAX_BATCH_SIZE = 50;
const MAX_RETAINED_EVENTS = 200;
const FLUSH_DEBOUNCE_MS = 5_000;
const RETRY_BACKOFF_MAX_MS = 5 * 60_000;

type LogPayload = Record<string, unknown>;
type TimerHandle = unknown;

interface IngestResponse {
  ok: boolean;
}

export interface CollectorRuntimeOptions {
  getIngestUrl: () => string | undefined;
  getRequestHeaders?: () => Record<string, string>;
  fetchImpl: (url: string, init: RequestInit) => Promise<IngestResponse>;
  setTimer: (handler: () => void, delayMs: number) => TimerHandle;
  clearTimer: (handle: TimerHandle) => void;
  isOffline?: () => boolean;
  maxBatchSize?: number;
  maxRetainedEvents?: number;
  flushDebounceMs?: number;
  retryBackoffMaxMs?: number;
}

export interface CollectorRuntime {
  push: (payload: LogPayload) => void;
  flush: () => Promise<void>;
  getBufferSize: () => number;
}

export function createCollectorRuntime(
  options: CollectorRuntimeOptions,
): CollectorRuntime {
  const maxBatchSize = options.maxBatchSize ?? MAX_BATCH_SIZE;
  const maxRetainedEvents = options.maxRetainedEvents ?? MAX_RETAINED_EVENTS;
  const flushDebounceMs = options.flushDebounceMs ?? FLUSH_DEBOUNCE_MS;
  const retryBackoffMaxMs = options.retryBackoffMaxMs ?? RETRY_BACKOFF_MAX_MS;
  const buffer: LogPayload[] = [];
  let flushTimer: TimerHandle | null = null;
  let flushInFlight: Promise<boolean> | null = null;
  let consecutiveFailures = 0;

  const retainMostRecent = (): void => {
    const excess = buffer.length - maxRetainedEvents;
    if (excess > 0) buffer.splice(0, excess);
  };

  const scheduleFlush = (delayMs = flushDebounceMs): void => {
    if (
      options.isOffline?.()
      || !options.getIngestUrl()
      || buffer.length === 0
      || flushTimer !== null
    ) return;
    flushTimer = options.setTimer(() => {
      flushTimer = null;
      void flush();
    }, delayMs);
  };

  const sendBatch = async (url: string, batch: LogPayload[]): Promise<boolean> => {
    try {
      const response = await options.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.getRequestHeaders?.(),
        },
        body: JSON.stringify(batch),
        keepalive: true,
      });
      if (!response.ok) throw new Error('Telemetry ingest rejected the batch');
      consecutiveFailures = 0;
      return true;
    } catch {
      buffer.unshift(...batch);
      retainMostRecent();
      consecutiveFailures += 1;
      scheduleFlush(Math.min(
        flushDebounceMs * (2 ** consecutiveFailures),
        retryBackoffMaxMs,
      ));
      return false;
    }
  };

  const flush = async (): Promise<void> => {
    if (options.isOffline?.()) return;
    if (flushInFlight) {
      const succeeded = await flushInFlight;
      if (succeeded && buffer.length > 0) await flush();
      return;
    }

    const url = options.getIngestUrl();
    if (!url || buffer.length === 0) return;
    if (flushTimer !== null) {
      options.clearTimer(flushTimer);
      flushTimer = null;
    }

    const batch = buffer.splice(0, maxBatchSize);
    const currentFlush = sendBatch(url, batch);
    flushInFlight = currentFlush;
    let succeeded = false;
    try {
      succeeded = await currentFlush;
    } finally {
      if (flushInFlight === currentFlush) flushInFlight = null;
    }

    if (succeeded && buffer.length > 0) await flush();
  };

  const push = (payload: LogPayload): void => {
    if (!options.getIngestUrl()) return;
    buffer.push(payload);
    retainMostRecent();
    if (buffer.length >= maxBatchSize) {
      if (flushTimer !== null) {
        options.clearTimer(flushTimer);
        flushTimer = null;
      }
      void flush();
    } else {
      scheduleFlush();
    }
  };

  return {
    push,
    flush,
    getBufferSize: () => buffer.length,
  };
}

function getConfiguredIngestUrl(): string | undefined {
  try {
    const value = import.meta.env.VITE_TELEMETRY_INGEST_URL;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function getConfiguredRequestHeaders(): Record<string, string> {
  try {
    const ingestUrl = getConfiguredIngestUrl();
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (
      !ingestUrl
      || typeof publishableKey !== 'string'
      || publishableKey.length === 0
      || !new URL(ingestUrl).hostname.endsWith('.supabase.co')
    ) return {};
    // Supabase publishable/anon keys are intentionally public browser
    // credentials. The telemetry function still performs its own distributed
    // rate limiting and fixed-schema validation before any service-role write.
    return { apikey: publishableKey };
  } catch {
    return {};
  }
}

const defaultCollector = createCollectorRuntime({
  getIngestUrl: getConfiguredIngestUrl,
  getRequestHeaders: getConfiguredRequestHeaders,
  fetchImpl: (url, init) => fetch(url, init),
  setTimer: (handler, delayMs) => setTimeout(handler, delayMs),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  isOffline: isBrowserKnownOffline,
});

export const push = defaultCollector.push;
export const flush = defaultCollector.flush;
export const getBufferSize = defaultCollector.getBufferSize;

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flush();
  });
  window.addEventListener('pagehide', () => {
    void flush();
  });
}
