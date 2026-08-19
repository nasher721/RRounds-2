export const DEFAULT_SESSION_IDLE_TIMEOUT_SECONDS = 30 * 60;
export const MIN_SESSION_IDLE_TIMEOUT_SECONDS = 5 * 60;
export const MAX_SESSION_IDLE_TIMEOUT_SECONDS = 60 * 60;

/**
 * Browser and hosted Auth inactivity controls share this value. Production
 * supplies it explicitly; development uses a conservative 30-minute default.
 */
export function parseSessionIdleTimeoutSeconds(value: string | undefined): number {
  const normalized = value?.trim();
  if (!normalized) return DEFAULT_SESSION_IDLE_TIMEOUT_SECONDS;
  if (!/^\d+$/.test(normalized)) {
    throw new Error('Session inactivity timeout must be a whole number of seconds.');
  }

  const seconds = Number(normalized);
  if (
    !Number.isSafeInteger(seconds)
    || seconds < MIN_SESSION_IDLE_TIMEOUT_SECONDS
    || seconds > MAX_SESSION_IDLE_TIMEOUT_SECONDS
  ) {
    throw new Error('Session inactivity timeout must be between 300 and 3600 seconds.');
  }
  return seconds;
}

export const SESSION_IDLE_TIMEOUT_SECONDS = parseSessionIdleTimeoutSeconds(
  (import.meta as { env?: { VITE_SESSION_IDLE_TIMEOUT_SECONDS?: string } })
    .env?.VITE_SESSION_IDLE_TIMEOUT_SECONDS,
);

export const SESSION_IDLE_WARNING_SECONDS = Math.min(
  60,
  Math.max(30, Math.floor(SESSION_IDLE_TIMEOUT_SECONDS / 5)),
);
