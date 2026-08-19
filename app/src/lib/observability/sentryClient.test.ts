import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSentryOperationalEvent,
  sanitizeSentryEvent,
} from './sentryClient';

test('Sentry operational events expose only fixed PHI-safe tags', () => {
  const event = createSentryOperationalEvent('info', 'marketing.landing_view', {
    feature: 'public_funnel',
    type: 'product_analytics',
    email: 'clinician@hospital.org',
    patientName: 'Jane Doe',
  });

  assert.ok(event);
  assert.equal(event.message, 'client_observability');
  assert.deepEqual(event.fingerprint, [
    'rr-operational',
    'marketing.landing_view',
    'none',
    'none',
  ]);
  assert.deepEqual(event.tags, {
    'rr.event': 'marketing.landing_view',
    'rr.feature': 'public_funnel',
    'rr.level': 'info',
    'rr.type': 'product_analytics',
  });
  assert.equal(event.extra, undefined);
  assert.equal(event.contexts, undefined);
  assert.doesNotMatch(JSON.stringify(event), /clinician|Jane|hospital\.org/i);
});

test('Sentry operational metrics retain bounded numeric measurements and classifications', () => {
  const event = createSentryOperationalEvent('info', 'metric', {
    metricName: 'auth.sign_in.duration_ms',
    metricValue: 187,
    metricUnit: 'ms',
    operation: 'sign_in',
    outcome: 'success',
    provider: 'password',
    requestId: 'must-not-cross-this-boundary',
  });

  assert.ok(event);
  assert.deepEqual(event.measurements, {
    rr_value: { value: 187, unit: 'millisecond' },
  });
  assert.equal(event.tags?.['rr.metric_name'], 'auth.sign_in.duration_ms');
  assert.equal(event.tags?.['rr.outcome'], 'success');
  assert.equal(event.tags?.['rr.provider'], 'password');
  assert.doesNotMatch(JSON.stringify(event), /requestId|must-not-cross/i);
});

test('Sentry retains the offline cache fallback as an allowlisted metric', () => {
  const event = createSentryOperationalEvent('info', 'metric', {
    metricName: 'patients.fetch.cache_fallback',
    metricValue: 1,
    metricUnit: 'count',
    outcome: 'unavailable',
    type: 'metric',
  });

  assert.ok(event);
  assert.equal(event.tags?.['rr.metric_name'], 'patients.fetch.cache_fallback');
  assert.equal(event.measurements?.rr_value?.value, 1);
});

test('Sentry retains a scalar Core Web Vital without browser entry metadata', () => {
  const event = createSentryOperationalEvent('info', 'metric', {
    metricName: 'web.vital.lcp_ms',
    metricValue: 341,
    metricUnit: 'ms',
    element: 'patient-name',
    url: 'https://rounds.hospital.org/patients/MRN123',
  });

  assert.ok(event);
  assert.equal(event.tags?.['rr.metric_name'], 'web.vital.lcp_ms');
  assert.deepEqual(event.measurements, {
    rr_value: { value: 341, unit: 'millisecond' },
  });
  assert.doesNotMatch(JSON.stringify(event), /patient-name|MRN123|hospital\.org/i);
});

test('Sentry operational forwarding ignores routine informational logs', () => {
  assert.equal(
    createSentryOperationalEvent('info', 'client_initialized', {}),
    null,
  );
});

test('Sentry operational forwarding rejects identifier-like metric classifications', () => {
  assert.equal(
    createSentryOperationalEvent('info', 'metric', {
      metricName: 'MRN123',
      metricValue: 1,
      metricUnit: 'count',
      outcome: 'JaneDoe',
    }),
    null,
  );
});

test('Sentry warning events use a generic vocabulary and discard arbitrary context', () => {
  const event = createSentryOperationalEvent('warn', 'MRN123', {
    feature: 'JaneDoe',
    operation: 'Bed12',
    outcome: 'RoomICU4',
    provider: 'clinician@hospital.org',
  });

  assert.ok(event);
  assert.deepEqual(event.fingerprint, [
    'rr-operational',
    'client_warning',
    'none',
    'none',
  ]);
  assert.deepEqual(event.tags, {
    'rr.event': 'client_warning',
    'rr.level': 'warn',
  });
  assert.doesNotMatch(JSON.stringify(event), /MRN123|JaneDoe|Bed12|RoomICU4|clinician/i);
});

test('Sentry operational forwarding ignores unknown marketing event names', () => {
  assert.equal(
    createSentryOperationalEvent('info', 'marketing.MRN123', {
      feature: 'public_funnel',
      type: 'product_analytics',
    }),
    null,
  );
});

test('Sentry operational sanitization removes page URLs and rebuilds fixed fingerprints', () => {
  const event = sanitizeSentryEvent({
    type: undefined,
    message: 'MRN123',
    fingerprint: ['rr-operational', 'MRN123', 'JaneDoe', 'RoomICU4'],
    tags: {
      'rr.event': 'marketing.landing_view',
      'rr.level': 'info',
      'rr.feature': 'public_funnel',
      'rr.type': 'product_analytics',
      patientName: 'Jane Doe',
    },
    request: {
      url: 'https://rounds.hospital.org/patients/MRN123?name=JaneDoe',
      data: { note: 'secret' },
    },
  });

  assert.equal(event.message, 'client_observability');
  assert.equal(event.request, undefined);
  assert.deepEqual(event.fingerprint, [
    'rr-operational',
    'marketing.landing_view',
    'none',
    'none',
  ]);
  assert.doesNotMatch(JSON.stringify(event), /MRN123|JaneDoe|Jane Doe|secret/i);
});
