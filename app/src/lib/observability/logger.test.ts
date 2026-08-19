import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRemoteLogPayload, logError, logMetric } from './logger';

test('remote log payload excludes raw errors and non-allowlisted clinical context', () => {
  const payload = createRemoteLogPayload(
    'error',
    '[Telemetry] ai_error: Patient Jane Doe had a seizure',
    {
      feature: 'daily-summary',
      patientName: 'Jane Doe',
      responseBody: 'clinical narrative',
      statusCode: 500,
      errorType: 'ProviderError',
      unsafeErrorType: 'Patient Jane Doe',
    },
  );

  assert.equal(payload.message, 'telemetry.ai_error');
  assert.deepEqual(payload.context, {
    feature: 'daily-summary',
    statusCode: 500,
    errorType: 'ProviderError',
  });
  assert.equal(JSON.stringify(payload).includes('Jane Doe'), false);
  assert.equal(JSON.stringify(payload).includes('clinical narrative'), false);
});

test('console logging applies the same PHI-safe boundary as remote logging', () => {
  const originalConsoleError = console.error;
  const lines: string[] = [];
  console.error = (...values: unknown[]) => {
    lines.push(values.map(String).join(' '));
  };

  try {
    logError('Patient Jane Doe failed to save', {
      patientId: 'patient-secret-123',
      responseBody: 'clinical narrative',
      statusCode: 500,
      feature: 'round-sync',
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.includes('Jane Doe'), false);
  assert.equal(lines[0]?.includes('patient-secret-123'), false);
  assert.equal(lines[0]?.includes('clinical narrative'), false);
  assert.match(lines[0] ?? '', /client_log/);
  assert.match(lines[0] ?? '', /round-sync/);
});

test('metric logging preserves its fixed measurement contract without leaking context', () => {
  const originalConsoleLog = console.log;
  const lines: string[] = [];
  console.log = (...values: unknown[]) => {
    lines.push(values.map(String).join(' '));
  };

  try {
    logMetric('patients.mutation.duration_ms', 42, 'ms', {
      operation: 'update',
      outcome: 'saved',
      patientId: 'patient-secret-123',
      clinicalSummary: 'sensitive narrative',
    });
  } finally {
    console.log = originalConsoleLog;
  }

  assert.equal(lines.length, 1);
  const payload = JSON.parse(lines[0] ?? '{}') as {
    message?: string;
    context?: Record<string, unknown>;
  };
  assert.equal(payload.message, 'metric');
  assert.deepEqual(payload.context, {
    metricName: 'patients.mutation.duration_ms',
    metricValue: 42,
    metricUnit: 'ms',
    operation: 'update',
    outcome: 'saved',
    type: 'metric',
  });
  assert.equal(lines[0]?.includes('patient-secret-123'), false);
  assert.equal(lines[0]?.includes('sensitive narrative'), false);
});
