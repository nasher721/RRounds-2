import { supabase } from '@/integrations/supabase/client';
import { TimeoutError, withTimeout } from '@/lib/requestTimeout';
import { recordTelemetryEvent } from '@/lib/observability/telemetry';

const HEALTH_CHECK_TIMEOUT_MS = 8_000;
const HEALTH_CACHE_TTL_MS = 60_000;
const PROBE_ATTEMPTS = 3;
/** Delay before retry attempt `n` (1-based second try): 200ms, 400ms, capped at 800ms. */
const probeRetryDelayMs = (attemptIndex: number): number =>
  Math.min(800, 200 * 2 ** Math.max(0, attemptIndex - 1));

type Cached = { expiresAt: number; result: 'healthy' | 'unhealthy' };

let cache: Cached | null = null;

export function invalidateEdgeHealthCache(): void {
  cache = null;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type SingleProbeOutcome =
  | { kind: 'healthy' }
  | { kind: 'unhealthy'; reason: 'invoke_error' | 'unexpected_body' }
  | { kind: 'unknown'; reason: 'timeout' | 'exception' };

async function runSingleProbe(): Promise<SingleProbeOutcome> {
  try {
    const result = await withTimeout(
      supabase.functions.invoke<{ status?: string }>('healthcheck', {
        method: 'GET',
      }),
      HEALTH_CHECK_TIMEOUT_MS,
      'healthcheck',
    );

    if (result.error) {
      return { kind: 'unhealthy', reason: 'invoke_error' };
    }

    const data: unknown = result.data;
    const status = data && typeof data === 'object' ? (data as { status?: string }).status : undefined;
    if (status === 'healthy') {
      return { kind: 'healthy' };
    }

    return { kind: 'unhealthy', reason: 'unexpected_body' };
  } catch (e) {
    const reason = e instanceof TimeoutError ? 'timeout' : 'exception';
    return { kind: 'unknown', reason };
  }
}

/**
 * Calls `healthcheck` edge function with a short timeout.
 * Results are cached for HEALTH_CACHE_TTL_MS (healthy/unhealthy only; unknown is not cached).
 * Retries a few times on unhealthy/unknown to avoid a sticky banner from cold starts or flaky networks.
 */
export async function probeEdgeHealth(options?: { force?: boolean }): Promise<'healthy' | 'unhealthy' | 'unknown'> {
  if (!options?.force && cache && Date.now() < cache.expiresAt) {
    return cache.result;
  }

  let lastOutcome: SingleProbeOutcome = { kind: 'unknown', reason: 'exception' };

  for (let attempt = 0; attempt < PROBE_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await delay(probeRetryDelayMs(attempt));
    }
    const outcome = await runSingleProbe();
    if (outcome.kind === 'healthy') {
      cache = { expiresAt: Date.now() + HEALTH_CACHE_TTL_MS, result: 'healthy' };
      return 'healthy';
    }
    lastOutcome = outcome;
  }

  recordTelemetryEvent('network_error', 'edge_health_probe_exhausted', {
    attempts: PROBE_ATTEMPTS,
    outcome: lastOutcome.kind,
    reason: lastOutcome.reason,
  });

  if (lastOutcome.kind === 'unhealthy') {
    cache = { expiresAt: Date.now() + HEALTH_CACHE_TTL_MS, result: 'unhealthy' };
    return 'unhealthy';
  }
  return 'unknown';
}
