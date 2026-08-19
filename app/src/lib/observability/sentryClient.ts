/**
 * Optional Sentry client — no-ops when VITE_SENTRY_DSN is unset.
 * beforeSend scrubs URLs and avoids shipping request bodies (PHI-safe defaults).
 */

import type * as SentryTypes from '@sentry/react';

type CaptureExceptionContext = Parameters<typeof SentryTypes.captureException>[1];
type OperationalLevel = 'debug' | 'info' | 'warn' | 'error';

const OPERATIONAL_TAGS = {
  feature: 'rr.feature',
  metricName: 'rr.metric_name',
  metricUnit: 'rr.metric_unit',
  operation: 'rr.operation',
  outcome: 'rr.outcome',
  provider: 'rr.provider',
  type: 'rr.type',
} as const;
const MARKETING_EVENT_NAMES = new Set([
  'marketing.landing_view',
  'marketing.sign_in.header',
  'marketing.sign_in.hero',
  'marketing.features.explore',
  'marketing.security_guidance.open',
  'marketing.pricing.contact',
  'marketing.contact.email',
  'marketing.workspace.footer',
]);
const METRIC_NAMES = new Set([
  'auth.sign_in.duration_ms',
  'auth.sign_in.total',
  'offline.sync.completed',
  'offline.sync.conflicts',
  'offline.sync.duration_ms',
  'offline.sync.failed',
  'offline.sync.oldest_age_ms',
  'offline.sync.queue_length',
  'patients.fetch.cache_fallback',
  'patients.fetch.duration_ms',
  'patients.fetch.error',
  'patients.fetch.success',
  'patients.mutation.duration_ms',
  'patients.mutation.total',
  'web.vital.cls',
  'web.vital.fcp_ms',
  'web.vital.inp_ms',
  'web.vital.lcp_ms',
  'web.vital.ttfb_ms',
]);
const ALLOWED_TAG_VALUES: Readonly<Record<string, ReadonlySet<string>>> = {
  'rr.event': new Set([
    ...MARKETING_EVENT_NAMES,
    'client_error',
    'client_warning',
    'metric',
  ]),
  'rr.feature': new Set(['public_funnel']),
  'rr.level': new Set(['debug', 'error', 'info', 'warn']),
  'rr.metric_name': METRIC_NAMES,
  'rr.metric_unit': new Set(['count', 'ms', 's']),
  'rr.operation': new Set([
    'add',
    'clear_all',
    'collapse_all',
    'duplicate',
    'remove',
    'sign_in',
    'update',
  ]),
  'rr.outcome': new Set([
    'cleared',
    'completed',
    'conflict',
    'email_not_confirmed',
    'enqueued',
    'error',
    'idle',
    'invalid_credentials',
    'invalid_input',
    'partial',
    'provider_error',
    'queued',
    'rate_limited',
    'redirect_started',
    'saved',
    'success',
    'sync_complete',
    'sync_error',
    'sync_start',
    'unavailable',
    'unexpected_error',
  ]),
  'rr.provider': new Set(['apple', 'google', 'password']),
  'rr.type': new Set(['metric', 'product_analytics']),
};
const ALLOWED_SENTRY_TAGS = new Set([
  'rr.event',
  'rr.level',
  ...Object.values(OPERATIONAL_TAGS),
]);

let initialized = false;
let sentryPromise: Promise<typeof SentryTypes> | null = null;

const loadSentry = () => {
  sentryPromise ??= import('@sentry/react');
  return sentryPromise;
};

function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return '[redacted]';
  }
}

const isOperationalEvent = (event: SentryTypes.Event): boolean =>
  event.fingerprint?.[0] === 'rr-operational';

const sanitizeOperationalTags = (
  tags: SentryTypes.Event['tags'],
): SentryTypes.Event['tags'] => {
  const sanitized: NonNullable<SentryTypes.Event['tags']> = {};
  for (const [key, value] of Object.entries(tags ?? {})) {
    if (!ALLOWED_SENTRY_TAGS.has(key)) continue;
    if (typeof value === 'string' && ALLOWED_TAG_VALUES[key]?.has(value)) {
      sanitized[key] = value;
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const sanitizeOperationalMeasurements = (
  measurements: SentryTypes.Event['measurements'],
): SentryTypes.Event['measurements'] => {
  const measurement = measurements?.rr_value;
  if (!measurement || !Number.isFinite(measurement.value)) return undefined;
  if (!['millisecond', 'second', 'none'].includes(String(measurement.unit))) return undefined;
  return {
    rr_value: {
      value: Math.max(-1_000_000_000_000, Math.min(1_000_000_000_000, measurement.value)),
      unit: measurement.unit,
    },
  };
};

const sentryMeasurementUnit = (unit: unknown): 'millisecond' | 'second' | 'none' => {
  if (unit === 'ms') return 'millisecond';
  if (unit === 's') return 'second';
  return 'none';
};

export function createSentryOperationalEvent(
  level: OperationalLevel,
  message: string,
  context: Record<string, unknown>,
): SentryTypes.Event | null {
  const metricName = typeof context.metricName === 'string'
    && METRIC_NAMES.has(context.metricName)
    ? context.metricName
    : null;
  const isMarketingEvent = MARKETING_EVENT_NAMES.has(message);
  const isMetric = message === 'metric' && metricName !== null;
  const eventName = isMarketingEvent
    ? message
    : isMetric
      ? 'metric'
      : level === 'error'
        ? 'client_error'
        : level === 'warn'
          ? 'client_warning'
          : null;
  if (!eventName) return null;

  const tags: NonNullable<SentryTypes.Event['tags']> = {
    'rr.event': eventName,
    'rr.level': level,
  };
  if (isMarketingEvent || isMetric) {
    for (const [contextKey, tagKey] of Object.entries(OPERATIONAL_TAGS)) {
      const value = context[contextKey];
      if (typeof value === 'string' && ALLOWED_TAG_VALUES[tagKey]?.has(value)) {
        tags[tagKey] = value;
      }
    }
  }

  const metricValue = context.metricValue;
  const measurements = eventName === 'metric'
    && typeof metricValue === 'number'
    && Number.isFinite(metricValue)
    ? {
        rr_value: {
          value: Math.max(-1_000_000_000_000, Math.min(1_000_000_000_000, metricValue)),
          unit: sentryMeasurementUnit(context.metricUnit),
        },
      }
    : undefined;

  return {
    message: 'client_observability',
    level: level === 'warn' ? 'warning' : level,
    fingerprint: [
      'rr-operational',
      eventName,
      metricName ?? 'none',
      typeof tags['rr.outcome'] === 'string' ? tags['rr.outcome'] : 'none',
    ],
    tags,
    measurements,
  };
}

export function sanitizeSentryEvent(event: SentryTypes.ErrorEvent): SentryTypes.ErrorEvent {
  const operationalEvent = isOperationalEvent(event);
  event.message = event.message
    ? operationalEvent ? 'client_observability' : 'client_error'
    : undefined;
  event.user = undefined;
  event.extra = undefined;
  event.tags = operationalEvent ? sanitizeOperationalTags(event.tags) : undefined;
  if (operationalEvent) {
    event.fingerprint = [
      'rr-operational',
      typeof event.tags?.['rr.event'] === 'string'
        ? event.tags['rr.event']
        : 'client_error',
      typeof event.tags?.['rr.metric_name'] === 'string'
        ? event.tags['rr.metric_name']
        : 'none',
      typeof event.tags?.['rr.outcome'] === 'string'
        ? event.tags['rr.outcome']
        : 'none',
    ];
  }
  event.contexts = undefined;
  event.measurements = operationalEvent
    ? sanitizeOperationalMeasurements(event.measurements)
    : undefined;
  if (operationalEvent) {
    event.request = undefined;
  } else if (event.request) {
    event.request.url = scrubUrl(event.request.url);
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.env;
    delete event.request.query_string;
  }
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      ex.value = 'client_error';
      if (ex.stacktrace?.frames) {
        for (const frame of ex.stacktrace.frames) {
          frame.vars = undefined;
        }
      }
    }
  }
  if (event.breadcrumbs) {
    for (const breadcrumb of event.breadcrumbs) {
      breadcrumb.message = undefined;
      breadcrumb.data = undefined;
    }
  }
  return event;
}

/**
 * Call once from main.tsx after env is available.
 */
function configureSentry(Sentry: typeof SentryTypes): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || initialized) return;

  initialized = true;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION as string | undefined,
    // Performance spans can capture request URLs containing clinical record
    // identifiers. Keep tracing disabled until every transaction/span surface
    // has a tested scrubber; error events still pass through beforeSend below.
    integrations: [],
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: sanitizeSentryEvent,
  });
}

export function initAppSentry(): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  void loadSentry().then(configureSentry);
}

export function captureExceptionToSentry(error: unknown, captureContext?: CaptureExceptionContext): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  void loadSentry().then((Sentry) => {
    configureSentry(Sentry);
    Sentry.captureException(error, captureContext);
  });
}

/** Non-PII metadata only — function name, HTTP status, attempts (no URLs with query, no bodies). */
export function captureEdgeFetchFailureToSentry(extra: Record<string, unknown>): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  void loadSentry().then((Sentry) => {
    configureSentry(Sentry);
    Sentry.captureMessage('edge_fetch_failed', {
      level: 'error',
      extra,
    });
  });
}

export function captureOperationalSignalToSentry(
  level: OperationalLevel,
  message: string,
  context: Record<string, unknown>,
): void {
  if (!import.meta.env?.VITE_SENTRY_DSN) return;
  const event = createSentryOperationalEvent(level, message, context);
  if (!event) return;
  void loadSentry().then((Sentry) => {
    configureSentry(Sentry);
    Sentry.captureEvent(event);
  });
}
