import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWebVitalsMonitor,
  type WebVitalEntry,
  type WebVitalsRuntime,
} from './webVitals';

function createRuntime(initialEntries: Partial<Record<string, WebVitalEntry[]>> = {}) {
  const observers = new Map<string, (entries: WebVitalEntry[]) => void>();
  let finalize: (() => void) | undefined;
  const runtime: WebVitalsRuntime = {
    getEntriesByType: (type) => initialEntries[type] ?? [],
    observe: (type, callback) => {
      observers.set(type, callback);
      return () => observers.delete(type);
    },
    onFinalize: (callback) => {
      finalize = callback;
      return () => {
        finalize = undefined;
      };
    },
  };

  return {
    runtime,
    emit(type: string, entries: WebVitalEntry[]) {
      observers.get(type)?.(entries);
    },
    finalize() {
      finalize?.();
    },
  };
}

test('web vitals report fixed numeric metrics without entry metadata', () => {
  const source = createRuntime({
    navigation: [{ startTime: 0, responseStart: 85.4 }],
    paint: [{ name: 'first-contentful-paint', startTime: 112.7 }],
  });
  const emitted: Array<[string, number, string]> = [];
  let flushes = 0;
  const monitor = createWebVitalsMonitor(
    source.runtime,
    (name, value, unit) => emitted.push([name, value, unit]),
    () => {
      flushes += 1;
    },
  );

  monitor.start();
  source.emit('largest-contentful-paint', [
    { startTime: 280.2 },
    { startTime: 340.8, url: 'https://private.example/patient-image' },
  ]);
  source.emit('layout-shift', [
    { startTime: 400, value: 0.08, hadRecentInput: false },
    { startTime: 450, value: 0.5, hadRecentInput: true },
    { startTime: 500, value: 0.015, hadRecentInput: false },
  ]);
  source.emit('event', [
    { startTime: 600, duration: 42, interactionId: 1, name: 'click' },
    { startTime: 700, duration: 91.6, interactionId: 2, name: 'keydown' },
  ]);
  source.finalize();

  assert.deepEqual(emitted, [
    ['web.vital.ttfb_ms', 85, 'ms'],
    ['web.vital.fcp_ms', 113, 'ms'],
    ['web.vital.lcp_ms', 341, 'ms'],
    ['web.vital.cls', 0.095, 'count'],
    ['web.vital.inp_ms', 92, 'ms'],
  ]);
  assert.equal(JSON.stringify(emitted).includes('private.example'), false);
  assert.equal(JSON.stringify(emitted).includes('click'), false);
  assert.equal(flushes, 1);
});

test('web vitals finalize once and omit measurements without observations', () => {
  const source = createRuntime();
  const emitted: Array<[string, number, string]> = [];
  let flushes = 0;
  const monitor = createWebVitalsMonitor(
    source.runtime,
    (name, value, unit) => emitted.push([name, value, unit]),
    () => {
      flushes += 1;
    },
  );

  monitor.start();
  source.emit('layout-shift', [
    { startTime: 10, value: -1, hadRecentInput: false },
    { startTime: 20, value: Number.NaN, hadRecentInput: false },
  ]);
  source.finalize();
  source.finalize();

  assert.deepEqual(emitted, [['web.vital.cls', 0, 'count']]);
  assert.equal(flushes, 1);
});

test('web vitals do not report a false zero when an observer type is unsupported', () => {
  const emitted: Array<[string, number, string]> = [];
  const runtime: WebVitalsRuntime = {
    getEntriesByType: () => [],
    observe: () => null,
    onFinalize: (callback) => {
      callback();
      return () => {};
    },
  };

  createWebVitalsMonitor(
    runtime,
    (name, value, unit) => emitted.push([name, value, unit]),
    () => {},
  ).start();

  assert.deepEqual(emitted, []);
});

test('web vitals use CLS session windows and the p98 interaction latency', () => {
  const source = createRuntime();
  const emitted: Array<[string, number, string]> = [];
  const monitor = createWebVitalsMonitor(
    source.runtime,
    (name, value, unit) => emitted.push([name, value, unit]),
    () => {},
  );

  monitor.start();
  source.emit('layout-shift', [
    { startTime: 100, value: 0.08, hadRecentInput: false },
    { startTime: 300, value: 0.02, hadRecentInput: false },
    { startTime: 2_000, value: 0.07, hadRecentInput: false },
  ]);
  source.emit('event', Array.from({ length: 51 }, (_, index) => ({
    startTime: 3_000 + index,
    duration: 100 - index,
    interactionId: index + 1,
  })));
  source.finalize();

  assert.deepEqual(emitted, [
    ['web.vital.cls', 0.1, 'count'],
    ['web.vital.inp_ms', 99, 'ms'],
  ]);
});
