import assert from 'node:assert/strict';
import test from 'node:test';

import { recordTelemetryEvent } from './telemetry';

test('telemetry persists classified errors without raw clinical content', () => {
  const event = recordTelemetryEvent(
    'ai_error',
    new Error('Patient Jane Doe had a seizure'),
    {
      feature: 'daily-summary',
      patientName: 'Jane Doe',
      responseBody: 'clinical narrative',
      statusCode: 500,
    },
  );

  assert.equal(event.message, 'ai_error:Error');
  assert.equal(event.stack, undefined);
  assert.deepEqual(event.context, {
    feature: 'daily-summary',
    statusCode: 500,
    errorType: 'Error',
  });
  assert.equal(JSON.stringify(event).includes('Jane Doe'), false);
  assert.equal(JSON.stringify(event).includes('clinical narrative'), false);
});

test('expected network failures get useful classification without noisy console output', () => {
  const originalWarn = console.warn;
  const originalError = console.error;
  const writes: unknown[][] = [];
  console.warn = (...args: unknown[]) => writes.push(args);
  console.error = (...args: unknown[]) => writes.push(args);

  try {
    const event = recordTelemetryEvent('network_error', 'edge_health_probe_exhausted', {
      attempts: 3,
      outcome: 'unhealthy',
    });
    recordTelemetryEvent('network_error', 'edge_health_probe_exhausted', {
      attempts: 3,
      outcome: 'unhealthy',
    });

    assert.equal(event.message, 'network_error:HealthCheckError');
    assert.equal(event.context.errorType, 'HealthCheckError');
    assert.equal(writes.length, 0);
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }
});
