import assert from 'node:assert/strict';
import test from 'node:test';

import { recordAuthAttempt } from './authTelemetry';

test('authentication telemetry emits fixed metrics without credentials or identifiers', () => {
  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (...args: unknown[]) => writes.push(args.join(' '));

  try {
    recordAuthAttempt({
      method: 'password',
      outcome: 'invalid_credentials',
      durationMs: 42.8,
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(writes.length, 2);
  const payloads = writes.map((write) => JSON.parse(write) as {
    message: string;
    context: Record<string, unknown>;
  });
  assert.deepEqual(
    payloads.map(({ context }) => context.metricName),
    ['auth.sign_in.duration_ms', 'auth.sign_in.total'],
  );
  assert.deepEqual(payloads[0]?.context, {
    metricName: 'auth.sign_in.duration_ms',
    metricValue: 43,
    metricUnit: 'ms',
    operation: 'sign_in',
    provider: 'password',
    outcome: 'invalid_credentials',
    type: 'metric',
  });
  assert.deepEqual(payloads[1]?.context, {
    metricName: 'auth.sign_in.total',
    metricValue: 1,
    metricUnit: 'count',
    operation: 'sign_in',
    provider: 'password',
    outcome: 'invalid_credentials',
    type: 'metric',
  });
  assert.doesNotMatch(writes.join('\n'), /@|token=|patient|secret/i);
});

test('authentication telemetry clamps invalid durations at the logging boundary', () => {
  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (...args: unknown[]) => writes.push(args.join(' '));

  try {
    recordAuthAttempt({
      method: 'google',
      outcome: 'redirect_started',
      durationMs: Number.POSITIVE_INFINITY,
    });
  } finally {
    console.log = originalLog;
  }

  const duration = JSON.parse(writes[0]!) as { context: { metricValue: number } };
  assert.equal(duration.context.metricValue, 0);
});
