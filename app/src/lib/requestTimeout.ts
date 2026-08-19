/**
 * Request Timeout Utilities
 *
 * Provides configurable timeout wrappers for async operations,
 * especially Supabase RPC/function calls that don't have built-in timeout.
 */

import { recordTelemetryEvent } from '@/lib/observability/telemetry';

// ---------------------------------------------------------------------------
// Configurable timeout defaults by operation type
// ---------------------------------------------------------------------------

export const TIMEOUT_DEFAULTS = {
  /** Standard database queries (patients, todos, phrases) */
  query: 10_000,
  /** Database mutations (insert, update, delete) */
  mutation: 15_000,
  /** AI edge function calls (can be slow) */
  aiEdgeFunction: 120_000,
  /**
   * Patient-list / handoff parsing: large docs + provider failover routinely
   * take 60–90s (observed ~67s successful parse).
   */
  documentParse: 180_000,
  /** Text transformation calls */
  textTransform: 30_000,
  /** Audio transcription */
  transcription: 180_000,
  /** Batch operations (multi-patient export, bulk import) */
  batch: 60_000,
} as const;

export type TimeoutCategory = keyof typeof TIMEOUT_DEFAULTS;

// ---------------------------------------------------------------------------
// Timeout wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within
 * the specified duration, it rejects with a TimeoutError.
 *
 * @param promise - The async operation to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param label - A human-readable label for the operation (used in error messages)
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = 'Operation',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new TimeoutError(label, timeoutMs);
      recordTelemetryEvent('network_error', err, {
        operation: label,
        timeoutMs,
      });
      reject(err);
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Convenience wrapper that uses predefined timeout categories.
 */
export function withCategoryTimeout<T>(
  promise: Promise<T>,
  category: TimeoutCategory,
  label?: string,
): Promise<T> {
  return withTimeout(promise, TIMEOUT_DEFAULTS[category], label ?? category);
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class TimeoutError extends Error {
  readonly timeoutMs: number;
  readonly operation: string;

  constructor(operation: string, timeoutMs: number) {
    super(`${operation} timed out after ${(timeoutMs / 1000).toFixed(1)}s`);
    this.name = 'TimeoutError';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

// ---------------------------------------------------------------------------
// AbortController with timeout
// ---------------------------------------------------------------------------

/**
 * Create an AbortController that automatically aborts after the given timeout.
 * Useful for passing to fetch/Supabase calls.
 */
export function createTimeoutController(
  timeoutMs: number,
  existingSignal?: AbortSignal,
): { controller: AbortController; clear: () => void } {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort(new TimeoutError('Request', timeoutMs));
  }, timeoutMs);

  // If an existing signal is provided, chain its abort to our controller
  if (existingSignal) {
    if (existingSignal.aborted) {
      clearTimeout(timer);
      controller.abort(existingSignal.reason);
    } else {
      existingSignal.addEventListener('abort', () => {
        clearTimeout(timer);
        controller.abort(existingSignal.reason);
      }, { once: true });
    }
  }

  return {
    controller,
    clear: () => clearTimeout(timer),
  };
}
