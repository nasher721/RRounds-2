import { logMetric } from '@/lib/observability/logger';

export type AuthMethod = 'password' | 'google' | 'apple';

export type AuthOutcome =
  | 'success'
  | 'redirect_started'
  | 'invalid_input'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'rate_limited'
  | 'unavailable'
  | 'provider_error'
  | 'unexpected_error';

interface AuthAttemptMeasurement {
  method: AuthMethod;
  outcome: AuthOutcome;
  durationMs: number;
}

const MAX_AUTH_DURATION_MS = 5 * 60 * 1_000;

function normalizeDuration(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_AUTH_DURATION_MS, Math.max(0, Math.round(value)));
}

/**
 * Emit only fixed authentication classifications. Callers cannot attach an
 * email address, account id, credential, redirect URL, or provider message.
 */
export function recordAuthAttempt({
  method,
  outcome,
  durationMs,
}: AuthAttemptMeasurement): void {
  const context = {
    operation: 'sign_in',
    provider: method,
    outcome,
  } as const;

  logMetric(
    'auth.sign_in.duration_ms',
    normalizeDuration(durationMs),
    'ms',
    context,
  );
  logMetric('auth.sign_in.total', 1, 'count', context);
}
