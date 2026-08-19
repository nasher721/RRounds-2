import assert from 'node:assert/strict';
import test from 'node:test';

import { validateProductionObservabilityConfig } from './observabilityPolicy';

const PUBLIC_ORIGIN = 'https://rounds.hospital.org';

test('production observability requires at least one approved central sink', () => {
  assert.throws(
    () => validateProductionObservabilityConfig({ publicOrigin: PUBLIC_ORIGIN }),
    /central observability sink/i,
  );
});

test('production observability accepts supported Sentry and CSP-compatible telemetry sinks', () => {
  assert.deepEqual(
    validateProductionObservabilityConfig({
      publicOrigin: PUBLIC_ORIGIN,
      sentryDsn: 'https://publickey@o123.ingest.sentry.io/456',
    }),
    {
      sentryDsn: 'https://publickey@o123.ingest.sentry.io/456',
      telemetryIngestUrl: '',
    },
  );

  assert.deepEqual(
    validateProductionObservabilityConfig({
      publicOrigin: PUBLIC_ORIGIN,
      telemetryIngestUrl: 'https://rounds.hospital.org/api/telemetry',
    }),
    {
      sentryDsn: '',
      telemetryIngestUrl: 'https://rounds.hospital.org/api/telemetry',
    },
  );

  assert.deepEqual(
    validateProductionObservabilityConfig({
      publicOrigin: PUBLIC_ORIGIN,
      telemetryIngestUrl: 'https://project.supabase.co/functions/v1/telemetry',
    }),
    {
      sentryDsn: '',
      telemetryIngestUrl: 'https://project.supabase.co/functions/v1/telemetry',
    },
  );
});

test('production observability rejects unsafe, placeholder, or CSP-blocked sinks', () => {
  const invalidConfigs = [
    { sentryDsn: 'http://publickey@o123.ingest.sentry.io/456' },
    { sentryDsn: 'https://publickey@example.com/456' },
    { sentryDsn: 'https://publickey:secret@o123.ingest.sentry.io/456' },
    { sentryDsn: 'https://publickey@o123.ingest.sentry.io/not-a-project' },
    { telemetryIngestUrl: 'http://rounds.hospital.org/api/telemetry' },
    { telemetryIngestUrl: 'https://telemetry.vendor.example/ingest' },
    { telemetryIngestUrl: 'https://user:secret@project.supabase.co/ingest' },
    { telemetryIngestUrl: 'https://project.supabase.co/ingest?token=secret' },
  ];

  for (const config of invalidConfigs) {
    assert.throws(
      () => validateProductionObservabilityConfig({
        publicOrigin: PUBLIC_ORIGIN,
        ...config,
      }),
      /observability|Sentry|telemetry/i,
      JSON.stringify(config),
    );
  }
});
