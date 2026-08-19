import type { ApiError } from '@/api/apiClient';
import { CircuitOpenError } from '@/lib/circuitBreaker';
import { TimeoutError } from '@/lib/requestTimeout';

const isApiError = (e: unknown): e is ApiError =>
  typeof e === 'object' && e !== null && (e as ApiError).name === 'ApiError';

/**
 * Marks a message as deliberately authored for display to an end user.
 * Arbitrary provider/runtime errors must never be wrapped in this type.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

/** Supabase / fetch-style errors that expose HTTP status */
function getErrorStatus(e: unknown): number | undefined {
  if (isApiError(e) && typeof e.status === 'number') {
    return e.status;
  }
  if (typeof e === 'object' && e !== null && 'context' in e) {
    const ctx = (e as { context?: Response }).context;
    if (ctx && typeof ctx.status === 'number') {
      return ctx.status;
    }
  }
  return undefined;
}

function circuitMessageFromRemainingMs(ms: number): string {
  const secs = Math.max(1, Math.ceil(ms / 1000));
  return `Service is temporarily busy. Try again in ${secs}s.`;
}

function resolveCircuitOpen(e: unknown): string | null {
  if (e instanceof CircuitOpenError) {
    return circuitMessageFromRemainingMs(e.remainingMs);
  }
  if (isApiError(e) && e.cause instanceof CircuitOpenError) {
    return circuitMessageFromRemainingMs(e.cause.remainingMs);
  }
  return null;
}

/**
 * Normalize technical/runtime errors into user-actionable messages.
 */
export function getUserFacingErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const circuitMsg = resolveCircuitOpen(error);
  if (circuitMsg) {
    return circuitMsg;
  }

  const status = getErrorStatus(error);
  if (status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  if (status === 503) {
    return 'Service is temporarily unavailable. Try again in a few minutes.';
  }
  if (status === 401 || status === 403) {
    return 'You do not have permission to perform this action.';
  }

  if (error instanceof TimeoutError) {
    return 'This request is taking longer than expected. Please try again.';
  }

  if (error instanceof UserFacingError) {
    return error.message;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('circuit breaker')) {
      return 'Service is temporarily busy. Please try again in a few seconds.';
    }

    if (
      message.includes('failed to fetch') ||
      message.includes('network') ||
      message.includes('load failed') ||
      message.includes('access control') ||
      message.includes('cors')
    ) {
      return 'Network error. Check your connection and try again.';
    }

    if (message.includes('permission') || message.includes('unauthorized')) {
      return 'You do not have permission to perform this action.';
    }

  }

  // Provider, API, and runtime messages can contain identifiers, request
  // payload fragments, or secrets. Only the classifications above and
  // explicitly constructed UserFacingError instances may cross into the UI.
  return fallback;
}
