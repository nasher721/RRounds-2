export interface ProductionObservabilityConfig {
  publicOrigin: string;
  sentryDsn?: string;
  telemetryIngestUrl?: string;
}

export interface ValidatedObservabilityConfig {
  sentryDsn: string;
  telemetryIngestUrl: string;
}

const parseAbsoluteUrl = (value: string, label: string): URL => {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute HTTPS URL.`);
  }
};

const normalizeSentryDsn = (rawValue: string | undefined): string => {
  const value = rawValue?.trim();
  if (!value) return '';

  const url = parseAbsoluteUrl(value, 'Sentry DSN');
  const hostedSentry = /^[^.]+\.ingest(?:\.us)?\.sentry\.io$/i.test(url.hostname);
  if (
    url.protocol !== 'https:'
    || !hostedSentry
    || !/^[A-Za-z0-9]+$/.test(url.username)
    || url.password.length > 0
    || url.port.length > 0
    || !/^\/\d+$/.test(url.pathname)
    || url.search.length > 0
    || url.hash.length > 0
  ) {
    throw new Error('Sentry DSN must be a hosted HTTPS ingest DSN permitted by the production CSP.');
  }

  return url.href;
};

const normalizeTelemetryIngestUrl = (
  rawValue: string | undefined,
  publicOrigin: string,
): string => {
  const value = rawValue?.trim();
  if (!value) return '';

  const url = parseAbsoluteUrl(value, 'Telemetry ingest URL');
  const appOrigin = parseAbsoluteUrl(publicOrigin, 'Public application origin');
  const cspCompatible = url.origin === appOrigin.origin
    || (url.hostname.endsWith('.supabase.co') && url.port.length === 0);
  if (
    url.protocol !== 'https:'
    || !cspCompatible
    || url.username.length > 0
    || url.password.length > 0
    || url.search.length > 0
    || url.hash.length > 0
  ) {
    throw new Error(
      'Telemetry ingest URL must use credential-free HTTPS on the app origin or an approved Supabase origin.',
    );
  }

  return url.href;
};

/**
 * Production must have one centrally queryable, CSP-compatible observability
 * sink. Both configured values are validated so a stale unsafe value cannot be
 * silently ignored merely because the other sink is usable.
 */
export function validateProductionObservabilityConfig({
  publicOrigin,
  sentryDsn,
  telemetryIngestUrl,
}: ProductionObservabilityConfig): ValidatedObservabilityConfig {
  const normalizedSentryDsn = normalizeSentryDsn(sentryDsn);
  const normalizedTelemetryIngestUrl = normalizeTelemetryIngestUrl(
    telemetryIngestUrl,
    publicOrigin,
  );

  if (!normalizedSentryDsn && !normalizedTelemetryIngestUrl) {
    throw new Error(
      'A central observability sink is required: configure VITE_SENTRY_DSN or VITE_TELEMETRY_INGEST_URL.',
    );
  }

  return {
    sentryDsn: normalizedSentryDsn,
    telemetryIngestUrl: normalizedTelemetryIngestUrl,
  };
}
