import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@/components/theme-provider';
import { DEFAULT_SYSTEMS, useSystemsConfig } from '@/hooks/useSystemsConfig';
import { useMotionPreference } from '@/hooks/useReducedMotion';
import { createSafeSessionStorage, createSafeStorage, readStoredJson } from './safeStorage';
import type { StorageLike } from './safeStorage';

afterEach(() => {
  cleanup();
});

type DescriptorTarget = Window | typeof globalThis;

const LOCAL_STORAGE_ACCESS_PATTERN =
  /\b(?:window\.)?localStorage\.(?:getItem|setItem|removeItem)\s*\(/;

const MIGRATED_STORAGE_MODULES = [
  'src/lib/dashboardPrefs.ts',
  'src/components/theme-provider.tsx',
  'src/hooks/useReducedMotion.tsx',
  'src/hooks/useSystemsConfig.ts',
];

async function withMockLocalStorage<T>(
  storage: StorageLike,
  run: () => Promise<T> | T,
): Promise<T> {
  const targets: Array<{
    target: DescriptorTarget;
    descriptor: PropertyDescriptor | undefined;
  }> = [
    { target: window, descriptor: Object.getOwnPropertyDescriptor(window, 'localStorage') },
    { target: globalThis, descriptor: Object.getOwnPropertyDescriptor(globalThis, 'localStorage') },
  ];

  for (const { target } of targets) {
    Object.defineProperty(target, 'localStorage', {
      configurable: true,
      get: () => storage,
    });
  }

  try {
    return await run();
  } finally {
    for (const { target, descriptor } of targets) {
      if (descriptor) {
        Object.defineProperty(target, 'localStorage', descriptor);
      } else {
        delete (target as { localStorage?: Storage }).localStorage;
      }
    }
  }
}

async function withMatchMedia<T>(
  run: () => Promise<T> | T,
  matches = false,
): Promise<T> {
  const targets: Array<{
    target: DescriptorTarget;
    descriptor: PropertyDescriptor | undefined;
  }> = [
    { target: window, descriptor: Object.getOwnPropertyDescriptor(window, 'matchMedia') },
    { target: globalThis, descriptor: Object.getOwnPropertyDescriptor(globalThis, 'matchMedia') },
  ];

  const stub = (query: string): MediaQueryList =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;

  for (const { target } of targets) {
    Object.defineProperty(target, 'matchMedia', {
      configurable: true,
      value: stub,
    });
  }

  try {
    return await run();
  } finally {
    for (const { target, descriptor } of targets) {
      if (descriptor) {
        Object.defineProperty(target, 'matchMedia', descriptor);
        continue;
      }
      // Never leave matchMedia deleted — later dashboard harness suites need it.
      Object.defineProperty(target, 'matchMedia', {
        configurable: true,
        writable: true,
        value: stub,
      });
    }
  }
}

function withFakeLocalStorage(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  run: () => void,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get: () => storage,
  });
  try {
    run();
  } finally {
    if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
  }
}

test('failed browser writes remain authoritative over stale browser values', () => {
  let browserValue: string | null = 'old-value';
  withFakeLocalStorage({
    getItem: () => browserValue,
    setItem: () => { throw new Error('quota exceeded'); },
    removeItem: () => { browserValue = null; },
  }, () => {
    const storage = createSafeStorage();
    storage.setItem('key', 'new-value');
    assert.equal(storage.getItem('key'), 'new-value');
  });
});

test('failed browser removals retain a tombstone over stale browser values', () => {
  withFakeLocalStorage({
    getItem: () => 'sensitive-old-value',
    setItem: () => undefined,
    removeItem: () => { throw new Error('storage blocked'); },
  }, () => {
    const storage = createSafeStorage();
    storage.removeItem('key');
    assert.equal(storage.getItem('key'), null);
  });
});

test('a later successful write replaces a removal tombstone', () => {
  let value: string | null = 'old-value';
  let removalBlocked = true;
  withFakeLocalStorage({
    getItem: () => value,
    setItem: (_key, nextValue) => { value = nextValue; },
    removeItem: () => {
      if (removalBlocked) throw new Error('storage blocked');
      value = null;
    },
  }, () => {
    const storage = createSafeStorage();
    storage.removeItem('key');
    assert.equal(storage.getItem('key'), null);

    removalBlocked = false;
    storage.setItem('key', 'replacement');
    assert.equal(storage.getItem('key'), 'replacement');
  });
});

test('session storage adapter falls back to memory when access throws', () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    get() {
      throw new Error('Access to storage is not allowed from this context');
    },
  });

  const warnMessages: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnMessages.push(args);
  };

  try {
    const storage = createSafeSessionStorage();
    assert.equal(storage.isDegraded(), false);
    storage.setItem('session-key', 'session-value');
    assert.equal(storage.getItem('session-key'), 'session-value');
    assert.equal(storage.isDegraded(), true);
    assert.equal(warnMessages.length, 0);
  } finally {
    console.warn = originalWarn;
    if (descriptor) Object.defineProperty(window, 'sessionStorage', descriptor);
  }
});

test('readStoredJson distinguishes missing and corrupt payloads', () => {
  const storage: StorageLike = {
    getItem: (key) => {
      if (key === 'missing') return null;
      if (key === 'corrupt') return '{not-json';
      return '{"ok":true}';
    },
    setItem: () => undefined,
    removeItem: () => undefined,
  };

  assert.deepEqual(readStoredJson(storage, 'missing'), { status: 'missing' });
  assert.deepEqual(readStoredJson(storage, 'corrupt'), {
    status: 'corrupt',
    raw: '{not-json',
  });
  assert.deepEqual(readStoredJson<{ ok: boolean }>(storage, 'valid'), {
    status: 'ok',
    value: { ok: true },
  });
});

test('remaining preference modules do not bypass safe storage helpers', () => {
  for (const path of MIGRATED_STORAGE_MODULES) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(
      source,
      LOCAL_STORAGE_ACCESS_PATTERN,
      `${path} must route browser persistence through safe storage`,
    );
  }
});

test('theme provider falls back to defaults and in-memory updates when storage methods throw', async () => {
  const storage: StorageLike = {
    getItem: () => {
      throw new Error('Storage unavailable');
    },
    setItem: () => {
      throw new Error('Storage unavailable');
    },
    removeItem: () => {
      throw new Error('Storage unavailable');
    },
  };

  const themeColor = document.createElement('meta');
  themeColor.name = 'theme-color';
  document.head.append(themeColor);

  try {
    await withMockLocalStorage(storage, async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, { defaultTheme: 'light', children });

      const { result } = renderHook(() => useTheme(), { wrapper });

      assert.equal(result.current.theme, 'light');
      assert.equal(result.current.highContrast, false);
      assert.equal(document.documentElement.classList.contains('light'), true);
      assert.equal(document.documentElement.style.colorScheme, 'light');
      assert.equal(themeColor.content, '#f5f7f3');

      assert.doesNotThrow(() => {
        act(() => result.current.setTheme('dark'));
      });
      assert.equal(result.current.theme, 'dark');
      assert.equal(document.documentElement.classList.contains('dark'), true);
      assert.equal(document.documentElement.style.colorScheme, 'dark');
      assert.equal(themeColor.content, '#0a0b0a');

      assert.doesNotThrow(() => {
        act(() => result.current.setHighContrast(true));
      });
      assert.equal(result.current.highContrast, true);
    });
  } finally {
    themeColor.remove();
    document.documentElement.classList.remove('light', 'dark', 'high-contrast');
    document.documentElement.style.removeProperty('color-scheme');
  }
});

test('motion preference hook tolerates storage failures for reads and writes', async () => {
  const storage: StorageLike = {
    getItem: () => {
      throw new Error('Storage unavailable');
    },
    setItem: () => {
      throw new Error('Storage unavailable');
    },
    removeItem: () => {
      throw new Error('Storage unavailable');
    },
  };

  await withMatchMedia(async () => {
    await withMockLocalStorage(storage, async () => {
      const { result } = renderHook(() => useMotionPreference());

      await waitFor(() => {
        assert.equal(result.current.prefersReducedMotion, false);
      });

      assert.doesNotThrow(() => {
        act(() => result.current.setPreference('reduced'));
      });

      await waitFor(() => {
        assert.equal(result.current.prefersReducedMotion, true);
      });

      assert.doesNotThrow(() => {
        act(() => result.current.setPreference('system'));
      });

      await waitFor(() => {
        assert.equal(result.current.prefersReducedMotion, false);
      });
    });
  });
});

test('systems config keeps defaults and updates when storage throws', async () => {
  const storage: StorageLike = {
    getItem: () => {
      throw new Error('Storage unavailable');
    },
    setItem: () => {
      throw new Error('Storage unavailable');
    },
    removeItem: () => {
      throw new Error('Storage unavailable');
    },
  };

  await withMockLocalStorage(storage, async () => {
    const { result } = renderHook(() => useSystemsConfig());

    assert.equal(result.current.systems.length, DEFAULT_SYSTEMS.length);
    assert.equal(result.current.enabledSystems.length, DEFAULT_SYSTEMS.length);

    assert.doesNotThrow(() => {
      act(() => result.current.toggleSystem('neuro'));
    });

    await waitFor(() => {
      const neuro = result.current.systems.find((system) => system.key === 'neuro');
      assert.equal(neuro?.enabled, false);
    });
  });
});
