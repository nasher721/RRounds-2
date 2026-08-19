import { recordTelemetryEvent } from "@/lib/observability/telemetry";
import { getCircuitBreaker, CircuitOpenError, type CircuitState } from "@/lib/circuitBreaker";
import { logError, logInfo, generateRequestId } from "@/lib/observability/logger";
import { captureEdgeFetchFailureToSentry } from "@/lib/observability/sentryClient";
import { isBrowserKnownOffline } from "@/lib/networkConnectivity";

export class ApiError extends Error {
  readonly status?: number;
  readonly url?: string;
  readonly cause?: unknown;

  constructor(message: string, options: { status?: number; url?: string; cause?: unknown } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.url = options.url;
    this.cause = options.cause;
  }
}

class CallerCancelledError extends ApiError {
  constructor(url: string, cause?: unknown) {
    super('Request cancelled', { url, cause });
    this.name = 'CallerCancelledError';
  }
}

class KnownOfflineError extends ApiError {
  constructor(url: string, cause?: unknown) {
    super('Network unavailable while offline', { url, cause });
    this.name = 'KnownOfflineError';
  }
}

export type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
  dedupe?: boolean;
};

const DEFAULT_TIMEOUT_MS = 10000;
const EDGE_FUNCTION_TIMEOUT_MS = 300000; // 5 minutes for edge functions (AI/OCR can take minutes)
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 300;

/** Initial attempt + 3 retries = 4 total tries for transient edge failures. */
const EDGE_RETRY_COUNT = 3;
/** Fixed delay between edge retries (no exponential backoff). */
const EDGE_RETRY_DELAY_MS = 1000;

const normalizeError = (error: unknown, url?: string, status?: number): ApiError => {
  if (error instanceof ApiError) {
    if ((url === undefined || url === error.url) &&
      (status === undefined || status === error.status)) {
      return error;
    }
    return new ApiError(error.message, {
      status: status ?? error.status,
      url: url ?? error.url,
      cause: error.cause,
    });
  }

  const message = error instanceof Error ? error.message : "Network request failed";
  return new ApiError(message, {
    status,
    url,
    cause: error,
  });
};

const createRequestKey = (url: string, init?: RequestInit): string => {
  const method = init?.method ?? "GET";
  const headers = Array.from(new Headers(init?.headers).entries())
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify([method.toUpperCase(), url, headers]);
};

const hasCredentialHeaders = (headers?: HeadersInit): boolean => {
  const normalized = new Headers(headers);
  return normalized.has('authorization') ||
    normalized.has('apikey') ||
    normalized.has('cookie') ||
    normalized.has('proxy-authorization');
};

const abortableDelay = (
  ms: number,
  signal: AbortSignal | null | undefined,
  url: string,
): Promise<void> => {
  if (signal?.aborted) {
    return Promise.reject(new CallerCancelledError(url, signal.reason));
  }
  return new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', cancelDelay);
      resolve();
    }, ms);
    const cancelDelay = () => {
      globalThis.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', cancelDelay);
      reject(new CallerCancelledError(url, signal?.reason));
    };
    signal?.addEventListener('abort', cancelDelay, { once: true });
  });
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function edgeFunctionNameFromUrl(url: string): string {
  if (url.includes('/functions/v1/')) {
    return url.split('/functions/v1/')[1]?.split('?')[0] ?? 'edge';
  }
  return 'edge';
}

/** Derive a circuit breaker name from a URL (group by host + path prefix). */
function circuitNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (url.includes('/functions/v1/')) {
      const fnName = url.split('/functions/v1/')[1]?.split('?')[0] ?? 'edge';
      return `edge:${fnName}`;
    }
    return `api:${parsed.host}`;
  } catch {
    return 'api:unknown';
  }
}

function isTimedOutMessage(message: string): boolean {
  return message.toLowerCase().includes('timed out');
}

/** Retry edge calls on network failures and 5xx — not on 4xx or timeouts. */
function isEdgeFailureRetriable(err: ApiError): boolean {
  if (isTimedOutMessage(err.message)) return false;
  if (err.status != null && err.status > 0 && err.status < 500) return false;
  return true;
}

function logEdgeStructured(
  event: 'edge_fetch_retry' | 'edge_invoke_failed',
  fields: {
    functionName: string;
    correlationId: string;
    attempt: number;
    maxAttempts: number;
    status?: number;
    message?: string;
    circuitState?: CircuitState;
    durationMs?: number;
  },
): void {
  const payload = { event, ...fields };
  if (event === 'edge_fetch_retry') {
    logInfo('edge_fetch_retry', payload);
  } else {
    logError('edge_invoke_failed', payload);
  }
  recordTelemetryEvent('api_error', event, payload as Record<string, unknown>);
}

export const createApiClient = (fetchImpl: typeof fetch = fetch) => {
  // Keep deduplication local to a client instance so responses can never cross
  // fetch implementations, auth owners, or test/runtime boundaries.
  const inflightRequests = new Map<string, Promise<Response>>();

  const apiFetch = async (url: URL | RequestInfo, init: ApiFetchOptions = {}): Promise<Response> => {
    const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
    const sourceRequest = typeof Request !== 'undefined' && url instanceof Request ? url : undefined;
    const isEdgeFunction = urlString.includes('/functions/v1/');
    const requestedMethod = init.method ?? sourceRequest?.method ?? 'GET';
    const isIdempotentMethod = ['GET', 'HEAD', 'OPTIONS'].includes(requestedMethod.toUpperCase());
    const {
      timeoutMs = isEdgeFunction ? EDGE_FUNCTION_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
      retryCount = isEdgeFunction
        ? EDGE_RETRY_COUNT
        : isIdempotentMethod ? DEFAULT_RETRY_COUNT : 0,
      retryDelayMs = DEFAULT_RETRY_DELAY_MS,
      dedupe = false,
      ...requestInit
    } = init;

    const effectiveMethod = requestedMethod;
    const effectiveHeaders = requestInit.headers ?? sourceRequest?.headers;
    const effectiveCredentials = requestInit.credentials ?? sourceRequest?.credentials;
    const callerSignal = requestInit.signal ?? sourceRequest?.signal;
    const canDedupe = dedupe &&
      !isEdgeFunction &&
      (effectiveMethod.toUpperCase() === 'GET' || effectiveMethod.toUpperCase() === 'HEAD') &&
      !callerSignal &&
      !hasCredentialHeaders(effectiveHeaders) &&
      effectiveCredentials !== 'include';

    const effectiveEdgeDelay = isEdgeFunction ? EDGE_RETRY_DELAY_MS : retryDelayMs;

    if (callerSignal?.aborted) {
      throw new CallerCancelledError(urlString, callerSignal.reason);
    }

    // Browser offline state is authoritative enough to avoid guaranteed-failure
    // network attempts. Fail before retry/circuit accounting so an offline round
    // cannot create an auth-request storm or mark a healthy backend unavailable.
    if (isBrowserKnownOffline()) {
      throw new KnownOfflineError(urlString);
    }

    const cbName = circuitNameFromUrl(urlString);
    const cb = getCircuitBreaker(cbName, {
      failureThreshold: isEdgeFunction ? 3 : 5,
      resetTimeoutMs: isEdgeFunction ? 60_000 : 30_000,
    });

    if (!cb.canExecute()) {
      throw normalizeError(
        new CircuitOpenError(cbName, cb.remainingCooldownMs()),
        urlString,
      );
    }

    const requestKey = createRequestKey(urlString, {
      ...requestInit,
      method: effectiveMethod,
      headers: effectiveHeaders,
    });
    if (canDedupe && inflightRequests.has(requestKey)) {
      const inflight = inflightRequests.get(requestKey);
      if (inflight) {
        return inflight.then((response) => response.clone());
      }
    }

    const executeFetch = async (): Promise<Response> => {
      if (isBrowserKnownOffline()) {
        throw new KnownOfflineError(urlString);
      }

      const controller = new AbortController();
      let abortSource: 'caller' | 'timeout' | null = null;
      const abortFromCaller = () => {
        if (controller.signal.aborted) return;
        abortSource = 'caller';
        controller.abort(callerSignal?.reason);
      };

      if (callerSignal?.aborted) {
        throw new CallerCancelledError(urlString, callerSignal.reason);
      }
      callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
      const timeoutId = globalThis.setTimeout(() => {
        if (controller.signal.aborted) return;
        abortSource = 'timeout';
        controller.abort();
      }, timeoutMs);

      try {
        const response = await fetchImpl(url, { ...requestInit, signal: controller.signal });
        return response;
      } catch (error) {
        if (abortSource === 'caller' && (isAbortError(error) || controller.signal.aborted)) {
          throw new CallerCancelledError(urlString, error);
        }
        if (abortSource === 'timeout' && (isAbortError(error) || controller.signal.aborted)) {
          throw normalizeError(new Error("Request timed out"), urlString);
        }
        if (isBrowserKnownOffline()) {
          throw new KnownOfflineError(urlString, error);
        }
        throw normalizeError(error, urlString);
      } finally {
        globalThis.clearTimeout(timeoutId);
        callerSignal?.removeEventListener('abort', abortFromCaller);
      }
    };

    const requestPromise = cb.execute(async () => {
      const correlationId = generateRequestId();
      const functionName = isEdgeFunction ? edgeFunctionNameFromUrl(urlString) : cbName;
      let attempt = 0;
      let lastError: ApiError | null = null;
      const startedAt = performance.now();

      while (attempt <= retryCount) {
        try {
          const response = await executeFetch();

          if (isEdgeFunction && response.status >= 500 && response.status <= 599) {
            lastError = normalizeError(
              new Error(`HTTP ${response.status}`),
              urlString,
              response.status,
            );
            if (attempt >= retryCount) {
              const durationMs = Math.round(performance.now() - startedAt);
              logEdgeStructured('edge_invoke_failed', {
                functionName,
                correlationId,
                attempt: attempt + 1,
                maxAttempts: retryCount + 1,
                status: response.status,
                message: lastError.message,
                circuitState: cb.getState(),
                durationMs,
              });
              captureEdgeFetchFailureToSentry({
                functionName,
                correlationId,
                status: response.status,
                attempts: attempt + 1,
                circuitState: cb.getState(),
              });
              return response;
            }
            logEdgeStructured('edge_fetch_retry', {
              functionName,
              correlationId,
              attempt: attempt + 1,
              maxAttempts: retryCount + 1,
              status: response.status,
              message: `HTTP ${response.status}`,
              circuitState: cb.getState(),
            });
            await abortableDelay(effectiveEdgeDelay, callerSignal, urlString);
            attempt += 1;
            continue;
          }

          return response;
        } catch (error) {
          lastError = normalizeError(error, urlString);
          if (lastError instanceof CallerCancelledError || lastError instanceof KnownOfflineError) {
            throw lastError;
          }
          if (attempt >= retryCount) {
            const category = lastError.message.includes('timed out') ? 'network_error' : 'api_error';
            recordTelemetryEvent(category, lastError.message, {
              url: urlString,
              status: lastError.status,
              attempts: attempt + 1,
            });
            if (isEdgeFunction) {
              const durationMs = Math.round(performance.now() - startedAt);
              logEdgeStructured('edge_invoke_failed', {
                functionName,
                correlationId,
                attempt: attempt + 1,
                maxAttempts: retryCount + 1,
                status: lastError.status,
                message: lastError.message,
                circuitState: cb.getState(),
                durationMs,
              });
              captureEdgeFetchFailureToSentry({
                functionName,
                correlationId,
                status: lastError.status,
                attempts: attempt + 1,
                circuitState: cb.getState(),
              });
            }
            throw lastError;
          }

          if (isEdgeFunction) {
            if (!isEdgeFailureRetriable(lastError)) {
              recordTelemetryEvent('api_error', lastError.message, {
                url: urlString,
                status: lastError.status,
                attempts: attempt + 1,
              });
              throw lastError;
            }
            logEdgeStructured('edge_fetch_retry', {
              functionName,
              correlationId,
              attempt: attempt + 1,
              maxAttempts: retryCount + 1,
              status: lastError.status,
              message: lastError.message,
              circuitState: cb.getState(),
            });
            await abortableDelay(effectiveEdgeDelay, callerSignal, urlString);
            attempt += 1;
            continue;
          }

          const backoff = retryDelayMs * Math.pow(2, attempt);
          const jitter = Math.floor(Math.random() * retryDelayMs);
          await abortableDelay(backoff + jitter, callerSignal, urlString);
          attempt += 1;
        }
      }
      throw lastError ?? normalizeError(new Error("Request failed"), urlString);
    }, {
      shouldCountFailure: (error) => (
        !(error instanceof CallerCancelledError) && !(error instanceof KnownOfflineError)
      ),
    });

    if (canDedupe) {
      inflightRequests.set(requestKey, requestPromise);
      const clearInflight = () => {
        inflightRequests.delete(requestKey);
      };
      void requestPromise.then(clearInflight, clearInflight);
    }

    return requestPromise;
  };

  return { apiFetch };
};

const client = createApiClient();
export const apiFetch = client.apiFetch;
