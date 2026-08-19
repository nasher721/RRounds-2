import { logMetric } from '@/lib/observability/logger';
import { flush as flushCollector } from '@/lib/observability/collector';

export type PatientMutationOperation =
  | 'add'
  | 'update'
  | 'remove'
  | 'duplicate'
  | 'collapse_all'
  | 'clear_all';

export type PatientMutationOutcome = 'saved' | 'queued' | 'conflict' | 'error';

export type OfflineQueueMetricOutcome =
  | 'enqueued'
  | 'cleared'
  | 'sync_start'
  | 'sync_complete'
  | 'sync_error';

export type OfflineSyncOutcome = 'idle' | 'completed' | 'partial' | 'error';

const PATIENT_MUTATION_FLUSH_MS = 5_000;

interface PatientMutationBucket {
  operation: PatientMutationOperation;
  outcome: PatientMutationOutcome;
  count: number;
  totalDurationMs: number;
}

const patientMutationBuckets = new Map<string, PatientMutationBucket>();
let patientMutationFlushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingOfflineQueueHealth: {
  queueLength: number;
  oldestAgeMs: number;
  outcome: OfflineQueueMetricOutcome;
} | null = null;
let offlineQueueFlushTimer: ReturnType<typeof setTimeout> | null = null;

function boundedMetricValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

/**
 * Emit fixed-vocabulary patient-write measurements. Callers can classify the
 * operation and result, but cannot attach patient identifiers or chart data.
 */
export function recordPatientMutationMetrics(input: {
  operation: PatientMutationOperation;
  outcome: PatientMutationOutcome;
  durationMs: number;
}): void {
  const key = `${input.operation}:${input.outcome}`;
  const existing = patientMutationBuckets.get(key);
  if (existing) {
    existing.count += 1;
    existing.totalDurationMs += boundedMetricValue(input.durationMs);
  } else {
    patientMutationBuckets.set(key, {
      operation: input.operation,
      outcome: input.outcome,
      count: 1,
      totalDurationMs: boundedMetricValue(input.durationMs),
    });
  }

  // Conflicts and hard errors remain immediate for alerting. Successful and
  // offline-queued per-input writes coalesce into a small five-second aggregate
  // instead of producing telemetry traffic for every character typed.
  if (input.outcome === 'conflict' || input.outcome === 'error') {
    flushPatientMutationMetrics();
    return;
  }

  if (patientMutationFlushTimer === null) {
    patientMutationFlushTimer = setTimeout(
      flushPatientMutationMetrics,
      PATIENT_MUTATION_FLUSH_MS,
    );
    (patientMutationFlushTimer as ReturnType<typeof setTimeout> & {
      unref?: () => void;
    }).unref?.();
  }
}

/** Flush pending aggregate write metrics, including during page lifecycle exit. */
export function flushPatientMutationMetrics(): void {
  if (patientMutationFlushTimer !== null) {
    clearTimeout(patientMutationFlushTimer);
    patientMutationFlushTimer = null;
  }

  const buckets = Array.from(patientMutationBuckets.values());
  patientMutationBuckets.clear();
  for (const bucket of buckets) {
    const context = {
      operation: bucket.operation,
      outcome: bucket.outcome,
    };
    logMetric(
      'patients.mutation.duration_ms',
      boundedMetricValue(bucket.totalDurationMs / bucket.count),
      'ms',
      { ...context, count: bucket.count },
    );
    logMetric('patients.mutation.total', bucket.count, 'count', context);
  }
}

/*
 * The collector installs its own pagehide handler before this module. Flush it
 * again after materializing the final aggregate so the last edits are included.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    flushPatientMutationMetrics();
    flushOfflineQueueHealthMetrics();
    void flushCollector();
  });
}

/** Emit only aggregate offline queue health, never queued mutation contents. */
export function recordOfflineQueueHealth(input: {
  queueLength: number;
  oldestAgeMs: number;
  outcome: OfflineQueueMetricOutcome;
}): void {
  const normalized = {
    queueLength: boundedMetricValue(input.queueLength),
    oldestAgeMs: boundedMetricValue(input.oldestAgeMs),
    outcome: input.outcome,
  };

  if (input.outcome === 'enqueued') {
    pendingOfflineQueueHealth = normalized;
    if (offlineQueueFlushTimer === null) {
      offlineQueueFlushTimer = setTimeout(
        flushOfflineQueueHealthMetrics,
        PATIENT_MUTATION_FLUSH_MS,
      );
      (offlineQueueFlushTimer as ReturnType<typeof setTimeout> & {
        unref?: () => void;
      }).unref?.();
    }
    return;
  }

  if (offlineQueueFlushTimer !== null) {
    clearTimeout(offlineQueueFlushTimer);
    offlineQueueFlushTimer = null;
  }
  pendingOfflineQueueHealth = null;
  emitOfflineQueueHealth(normalized);
}

function emitOfflineQueueHealth(input: {
  queueLength: number;
  oldestAgeMs: number;
  outcome: OfflineQueueMetricOutcome;
}): void {
  const context = { outcome: input.outcome };
  logMetric(
    'offline.sync.queue_length',
    input.queueLength,
    'count',
    context,
  );
  logMetric(
    'offline.sync.oldest_age_ms',
    input.oldestAgeMs,
    'ms',
    context,
  );
}

/** Flush the latest aggregate queue pressure after rapid offline edits. */
export function flushOfflineQueueHealthMetrics(): void {
  if (offlineQueueFlushTimer !== null) {
    clearTimeout(offlineQueueFlushTimer);
    offlineQueueFlushTimer = null;
  }
  const pending = pendingOfflineQueueHealth;
  pendingOfflineQueueHealth = null;
  if (pending) emitOfflineQueueHealth(pending);
}

/** Emit RED-style aggregate results for one offline replay attempt. */
export function recordOfflineSyncMetrics(input: {
  durationMs: number;
  completed: number;
  failed: number;
  conflicts: number;
  outcome: OfflineSyncOutcome;
}): void {
  const context = { outcome: input.outcome };
  logMetric(
    'offline.sync.duration_ms',
    boundedMetricValue(input.durationMs),
    'ms',
    context,
  );
  logMetric(
    'offline.sync.completed',
    boundedMetricValue(input.completed),
    'count',
    context,
  );
  logMetric(
    'offline.sync.failed',
    boundedMetricValue(input.failed),
    'count',
    context,
  );
  logMetric(
    'offline.sync.conflicts',
    boundedMetricValue(input.conflicts),
    'count',
    context,
  );
}
