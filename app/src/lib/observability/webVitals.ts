import { flush as flushTelemetry } from './collector';
import { logMetric } from './logger';

export interface WebVitalEntry {
  name?: string;
  startTime: number;
  duration?: number;
  interactionId?: number;
  value?: number;
  hadRecentInput?: boolean;
  responseStart?: number;
  [key: string]: unknown;
}

export interface WebVitalsRuntime {
  getEntriesByType: (type: string) => WebVitalEntry[];
  observe: (
    type: string,
    callback: (entries: WebVitalEntry[]) => void,
  ) => (() => void) | null;
  onFinalize: (callback: () => void) => () => void;
}

type MetricEmitter = (name: string, value: number, unit: string) => void;

const roundedMilliseconds = (value: number): number => Math.round(value);
const roundedScore = (value: number): number => Number(value.toFixed(4));
const isNonNegativeFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Collect only scalar Core Web Vital values. PerformanceEntry metadata such as
 * element selectors, URLs, interaction names, and navigation details never
 * crosses this boundary.
 */
export function createWebVitalsMonitor(
  runtime: WebVitalsRuntime,
  emitMetric: MetricEmitter = logMetric,
  flush: () => void = () => {
    void flushTelemetry();
  },
) {
  const cleanups: Array<() => void> = [];
  const emitted = new Set<string>();
  let started = false;
  let finalized = false;
  let maximumLayoutShiftWindow = 0;
  let currentLayoutShiftWindow = 0;
  let layoutShiftWindowStart: number | null = null;
  let previousLayoutShift: number | null = null;
  let layoutShiftSupported = false;
  let largestContentfulPaint: number | null = null;
  const interactionLatencies = new Map<number, number>();

  const emitOnce = (name: string, value: number, unit: string): void => {
    if (emitted.has(name) || !isNonNegativeFinite(value)) return;
    emitted.add(name);
    emitMetric(name, value, unit);
  };

  const recordPaint = (entries: WebVitalEntry[]): void => {
    const firstContentfulPaint = entries.find(
      (entry) => entry.name === 'first-contentful-paint' && isNonNegativeFinite(entry.startTime),
    );
    if (firstContentfulPaint) {
      emitOnce('web.vital.fcp_ms', roundedMilliseconds(firstContentfulPaint.startTime), 'ms');
    }
  };

  const recordLargestContentfulPaint = (entries: WebVitalEntry[]): void => {
    for (const entry of entries) {
      if (!isNonNegativeFinite(entry.startTime)) continue;
      largestContentfulPaint = Math.max(largestContentfulPaint ?? 0, entry.startTime);
    }
  };

  const recordLayoutShift = (entries: WebVitalEntry[]): void => {
    for (const entry of entries) {
      if (
        entry.hadRecentInput
        || !isNonNegativeFinite(entry.value)
        || !isNonNegativeFinite(entry.startTime)
      ) continue;
      const continuesWindow = layoutShiftWindowStart !== null
        && previousLayoutShift !== null
        && entry.startTime - previousLayoutShift < 1_000
        && entry.startTime - layoutShiftWindowStart < 5_000;
      if (continuesWindow) {
        currentLayoutShiftWindow += entry.value;
      } else {
        layoutShiftWindowStart = entry.startTime;
        currentLayoutShiftWindow = entry.value;
      }
      previousLayoutShift = entry.startTime;
      maximumLayoutShiftWindow = Math.max(
        maximumLayoutShiftWindow,
        currentLayoutShiftWindow,
      );
    }
  };

  const recordInteraction = (entries: WebVitalEntry[]): void => {
    for (const entry of entries) {
      if (
        !isNonNegativeFinite(entry.duration)
        || !isNonNegativeFinite(entry.interactionId)
        || entry.interactionId === 0
      ) continue;
      interactionLatencies.set(
        entry.interactionId,
        Math.max(interactionLatencies.get(entry.interactionId) ?? 0, entry.duration),
      );
    }
  };

  const finalize = (): void => {
    if (finalized) return;
    finalized = true;
    if (largestContentfulPaint !== null) {
      emitOnce('web.vital.lcp_ms', roundedMilliseconds(largestContentfulPaint), 'ms');
    }
    if (layoutShiftSupported) {
      emitOnce('web.vital.cls', roundedScore(maximumLayoutShiftWindow), 'count');
    }
    const orderedInteractionLatencies = [...interactionLatencies.values()]
      .sort((left, right) => right - left);
    if (orderedInteractionLatencies.length > 0) {
      const percentileIndex = Math.min(
        orderedInteractionLatencies.length - 1,
        Math.floor(orderedInteractionLatencies.length / 50),
      );
      emitOnce(
        'web.vital.inp_ms',
        roundedMilliseconds(orderedInteractionLatencies[percentileIndex] ?? 0),
        'ms',
      );
    }
    cleanups.splice(0).forEach((cleanup) => cleanup());
    flush();
  };

  const start = (): void => {
    if (started) return;
    started = true;

    const navigationEntry = runtime.getEntriesByType('navigation')[0];
    if (
      navigationEntry
      && isNonNegativeFinite(navigationEntry.responseStart)
      && isNonNegativeFinite(navigationEntry.startTime)
    ) {
      emitOnce(
        'web.vital.ttfb_ms',
        roundedMilliseconds(navigationEntry.responseStart - navigationEntry.startTime),
        'ms',
      );
    }

    recordPaint(runtime.getEntriesByType('paint'));
    const observers: Array<[string, (entries: WebVitalEntry[]) => void]> = [
      ['paint', recordPaint],
      ['largest-contentful-paint', recordLargestContentfulPaint],
      ['layout-shift', recordLayoutShift],
      ['event', recordInteraction],
    ];
    for (const [type, callback] of observers) {
      const cleanup = runtime.observe(type, callback);
      if (!cleanup) continue;
      if (type === 'layout-shift') layoutShiftSupported = true;
      cleanups.push(cleanup);
    }
    const finalizeCleanup = runtime.onFinalize(finalize);
    if (finalized) finalizeCleanup();
    else cleanups.push(finalizeCleanup);
  };

  return { start, finalize };
}

function createBrowserRuntime(): WebVitalsRuntime | null {
  if (
    typeof window === 'undefined'
    || typeof document === 'undefined'
    || typeof performance === 'undefined'
  ) return null;

  return {
    getEntriesByType: (type) =>
      performance.getEntriesByType(type) as unknown as WebVitalEntry[],
    observe: (type, callback) => {
      if (typeof PerformanceObserver === 'undefined') return null;
      try {
        const observer = new PerformanceObserver((list) => {
          callback(list.getEntries() as unknown as WebVitalEntry[]);
        });
        const options = type === 'event'
          ? { type, buffered: true, durationThreshold: 40 }
          : { type, buffered: true };
        observer.observe(options as PerformanceObserverInit);
        return () => observer.disconnect();
      } catch {
        // Older WebViews may not support every entry type. Missing metrics are
        // preferable to changing application behavior or logging raw entries.
        return null;
      }
    },
    onFinalize: (callback) => {
      const onVisibilityChange = (): void => {
        if (document.visibilityState === 'hidden') callback();
      };
      document.addEventListener('visibilitychange', onVisibilityChange, true);
      window.addEventListener('pagehide', callback, true);
      return () => {
        document.removeEventListener('visibilitychange', onVisibilityChange, true);
        window.removeEventListener('pagehide', callback, true);
      };
    },
  };
}

let initialized = false;

/** Start one production browser monitor for the current navigation. */
export function initWebVitals(): void {
  if (initialized) return;
  const runtime = createBrowserRuntime();
  if (!runtime) return;
  initialized = true;
  createWebVitalsMonitor(runtime).start();
}
