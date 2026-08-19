/**
 * Circuit Breaker
 *
 * Prevents cascading failures by short-circuiting requests to failing services.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered (allows one probe request)
 *
 * Transitions:
 * - CLOSED → OPEN: When failure count exceeds threshold within the window
 * - OPEN → HALF_OPEN: After the reset timeout expires
 * - HALF_OPEN → CLOSED: If the probe request succeeds
 * - HALF_OPEN → OPEN: If the probe request fails
 */

import { recordTelemetryEvent } from '@/lib/observability/telemetry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time window in ms for counting failures (default: 60_000) */
  failureWindowMs?: number;
  /** How long to stay open before trying a probe (default: 30_000) */
  resetTimeoutMs?: number;
  /** Called when state changes */
  onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;
}

export interface CircuitExecutionOptions {
  /** Ignore failures caused by caller behavior rather than service health. */
  shouldCountFailure?: (error: unknown) => boolean;
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number[];
  lastFailure: number;
  openedAt: number;
}

// ---------------------------------------------------------------------------
// Circuit Breaker class
// ---------------------------------------------------------------------------

export class CircuitBreaker {
  readonly name: string;
  private opts: Required<CircuitBreakerOptions>;
  private circuit: CircuitBreakerState;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.opts = {
      failureThreshold: options.failureThreshold ?? 5,
      failureWindowMs: options.failureWindowMs ?? 60_000,
      resetTimeoutMs: options.resetTimeoutMs ?? 30_000,
      onStateChange: options.onStateChange ?? (() => {}),
    };
    this.circuit = {
      state: 'CLOSED',
      failures: [],
      lastFailure: 0,
      openedAt: 0,
    };
  }

  /**
   * Execute an async function through the circuit breaker.
   * Throws CircuitOpenError if the circuit is open.
   */
  async execute<T>(
    fn: () => Promise<T>,
    options: CircuitExecutionOptions = {},
  ): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitOpenError(this.name, this.remainingCooldownMs());
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      if (options.shouldCountFailure?.(error) ?? true) {
        this.onFailure();
      }
      throw error;
    }
  }

  /**
   * Check if a request can pass through.
   */
  canExecute(): boolean {
    switch (this.circuit.state) {
      case 'CLOSED':
        return true;

      case 'OPEN': {
        const elapsed = Date.now() - this.circuit.openedAt;
        if (elapsed >= this.opts.resetTimeoutMs) {
          this.transition('HALF_OPEN');
          return true;
        }
        return false;
      }

      case 'HALF_OPEN':
        // Allow one probe request
        return true;

      default:
        return true;
    }
  }

  /** Current circuit state */
  getState(): CircuitState {
    return this.circuit.state;
  }

  /** Time remaining before the circuit tries to recover (0 if not open) */
  remainingCooldownMs(): number {
    if (this.circuit.state !== 'OPEN') return 0;
    const elapsed = Date.now() - this.circuit.openedAt;
    return Math.max(0, this.opts.resetTimeoutMs - elapsed);
  }

  /** Recent failure count within the window */
  getFailureCount(): number {
    this.pruneOldFailures();
    return this.circuit.failures.length;
  }

  /** Reset to closed state */
  reset(): void {
    this.circuit = {
      state: 'CLOSED',
      failures: [],
      lastFailure: 0,
      openedAt: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private onSuccess(): void {
    if (this.circuit.state === 'HALF_OPEN') {
      this.transition('CLOSED');
      this.circuit.failures = [];
    }
  }

  private onFailure(): void {
    const now = Date.now();
    this.circuit.failures.push(now);
    this.circuit.lastFailure = now;

    this.pruneOldFailures();

    if (this.circuit.state === 'HALF_OPEN') {
      this.transition('OPEN');
      return;
    }

    if (this.circuit.state === 'CLOSED' && this.circuit.failures.length >= this.opts.failureThreshold) {
      this.transition('OPEN');
    }
  }

  private transition(to: CircuitState): void {
    const from = this.circuit.state;
    if (from === to) return;

    this.circuit.state = to;

    if (to === 'OPEN') {
      this.circuit.openedAt = Date.now();
      recordTelemetryEvent('api_error', `Circuit breaker "${this.name}" opened after ${this.circuit.failures.length} failures`, {
        circuitBreaker: this.name,
        failureCount: this.circuit.failures.length,
        resetTimeoutMs: this.opts.resetTimeoutMs,
      });
    }

    this.opts.onStateChange(this.name, from, to);
  }

  private pruneOldFailures(): void {
    const cutoff = Date.now() - this.opts.failureWindowMs;
    this.circuit.failures = this.circuit.failures.filter(t => t > cutoff);
  }
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class CircuitOpenError extends Error {
  readonly circuitName: string;
  readonly remainingMs: number;

  constructor(name: string, remainingMs: number) {
    super(`Circuit breaker "${name}" is open. Retry in ${Math.ceil(remainingMs / 1000)}s.`);
    this.name = 'CircuitOpenError';
    this.circuitName = name;
    this.remainingMs = remainingMs;
  }
}

// ---------------------------------------------------------------------------
// Registry — shared circuit breakers by service name
// ---------------------------------------------------------------------------

const registry = new Map<string, CircuitBreaker>();

/**
 * Get or create a named circuit breaker.
 * Shared instances ensure a single circuit state per service.
 */
export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  let cb = registry.get(name);
  if (!cb) {
    cb = new CircuitBreaker(name, options);
    registry.set(name, cb);
  }
  return cb;
}

/**
 * Get the state of all registered circuit breakers.
 */
export function getAllCircuitStates(): Record<string, { state: CircuitState; failures: number; cooldownMs: number }> {
  const states: Record<string, { state: CircuitState; failures: number; cooldownMs: number }> = {};
  for (const [name, cb] of registry) {
    states[name] = {
      state: cb.getState(),
      failures: cb.getFailureCount(),
      cooldownMs: cb.remainingCooldownMs(),
    };
  }
  return states;
}

/**
 * Reset every registered breaker. Called when the browser regains
 * connectivity: OPEN circuits caused by an outage should allow traffic
 * immediately instead of serving CircuitOpenError through the cooldown.
 */
export function resetAllCircuitBreakers(): void {
  for (const cb of registry.values()) {
    cb.reset();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", resetAllCircuitBreakers);
}
