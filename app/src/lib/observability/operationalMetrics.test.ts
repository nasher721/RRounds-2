import assert from 'node:assert/strict';
import test from 'node:test';

import {
  flushPatientMutationMetrics,
  flushOfflineQueueHealthMetrics,
  recordOfflineQueueHealth,
  recordOfflineSyncMetrics,
  recordPatientMutationMetrics,
} from './operationalMetrics';

function captureMetricPayloads(run: () => void): Array<Record<string, unknown>> {
  const originalConsoleLog = console.log;
  const lines: string[] = [];
  console.log = (...values: unknown[]) => {
    lines.push(values.map(String).join(' '));
  };

  try {
    run();
  } finally {
    console.log = originalConsoleLog;
  }

  return lines
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((payload) => payload.message === 'metric');
}

test('patient mutation metrics expose only fixed operation and outcome dimensions', () => {
  const payloads = captureMetricPayloads(() => {
    recordPatientMutationMetrics({
      operation: 'update',
      outcome: 'queued',
      durationMs: 42.4,
    });
    flushPatientMutationMetrics();
  });

  assert.deepEqual(
    payloads.map((payload) => payload.context),
    [
      {
        metricName: 'patients.mutation.duration_ms',
        metricValue: 42,
        metricUnit: 'ms',
        operation: 'update',
        outcome: 'queued',
        count: 1,
        type: 'metric',
      },
      {
        metricName: 'patients.mutation.total',
        metricValue: 1,
        metricUnit: 'count',
        operation: 'update',
        outcome: 'queued',
        type: 'metric',
      },
    ],
  );
});

test('successful per-input writes coalesce before collection', () => {
  const payloads = captureMetricPayloads(() => {
    recordPatientMutationMetrics({ operation: 'update', outcome: 'saved', durationMs: 20 });
    recordPatientMutationMetrics({ operation: 'update', outcome: 'saved', durationMs: 40 });
    flushPatientMutationMetrics();
  });

  assert.deepEqual(
    payloads.map((payload) => payload.context),
    [
      {
        metricName: 'patients.mutation.duration_ms',
        metricValue: 30,
        metricUnit: 'ms',
        operation: 'update',
        outcome: 'saved',
        count: 2,
        type: 'metric',
      },
      {
        metricName: 'patients.mutation.total',
        metricValue: 2,
        metricUnit: 'count',
        operation: 'update',
        outcome: 'saved',
        type: 'metric',
      },
    ],
  );
});

test('offline metrics report queue age, growth, and sync results without queue contents', () => {
  const payloads = captureMetricPayloads(() => {
    recordOfflineQueueHealth({
      queueLength: 3,
      oldestAgeMs: 90_500,
      outcome: 'enqueued',
    });
    flushOfflineQueueHealthMetrics();
    recordOfflineSyncMetrics({
      durationMs: 250.2,
      completed: 2,
      failed: 1,
      conflicts: 1,
      outcome: 'partial',
    });
  });

  const contexts = payloads.map((payload) => payload.context as Record<string, unknown>);
  assert.deepEqual(
    contexts.map((context) => [context.metricName, context.metricValue, context.metricUnit]),
    [
      ['offline.sync.queue_length', 3, 'count'],
      ['offline.sync.oldest_age_ms', 90_500, 'ms'],
      ['offline.sync.duration_ms', 250, 'ms'],
      ['offline.sync.completed', 2, 'count'],
      ['offline.sync.failed', 1, 'count'],
      ['offline.sync.conflicts', 1, 'count'],
    ],
  );
  assert.ok(contexts.every((context) => context.outcome));
  assert.ok(contexts.every((context) => (
    !Object.prototype.hasOwnProperty.call(context, 'payload')
    && !Object.prototype.hasOwnProperty.call(context, 'patientId')
    && !Object.prototype.hasOwnProperty.call(context, 'clinicalSummary')
  )));
});

test('rapid offline enqueues publish only the latest aggregate queue pressure', () => {
  const payloads = captureMetricPayloads(() => {
    recordOfflineQueueHealth({ queueLength: 1, oldestAgeMs: 10, outcome: 'enqueued' });
    recordOfflineQueueHealth({ queueLength: 2, oldestAgeMs: 20, outcome: 'enqueued' });
    recordOfflineQueueHealth({ queueLength: 3, oldestAgeMs: 30, outcome: 'enqueued' });
    flushOfflineQueueHealthMetrics();
  });

  assert.deepEqual(
    payloads.map((payload) => payload.context),
    [
      {
        metricName: 'offline.sync.queue_length',
        metricValue: 3,
        metricUnit: 'count',
        outcome: 'enqueued',
        type: 'metric',
      },
      {
        metricName: 'offline.sync.oldest_age_ms',
        metricValue: 30,
        metricUnit: 'ms',
        outcome: 'enqueued',
        type: 'metric',
      },
    ],
  );
});
