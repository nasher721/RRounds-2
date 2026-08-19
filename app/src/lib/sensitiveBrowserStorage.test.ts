import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const sensitiveModules = [
  'src/components/sync/SyncHistoryPanel.tsx',
  'src/hooks/useTextTransform.ts',
  'src/hooks/useWritingStyleProfile.ts',
  'src/lib/cache/performanceMonitor.ts',
];

test('potentially identifying clinical metadata is not persisted in Web Storage', () => {
  for (const path of sensitiveModules) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(
      source,
      /\b(?:window\.)?(?:localStorage|sessionStorage)\.(?:getItem|setItem)\s*\(/,
      `${path} must not read or write sensitive data through unscoped Web Storage`,
    );
  }
});

test('sensitive modules delete browser data left by older builds', () => {
  const expectedLegacyKeys: Record<string, string> = {
    'src/components/sync/SyncHistoryPanel.tsx': 'sync-history',
    'src/hooks/useTextTransform.ts': 'ai-custom-prompts',
    'src/hooks/useWritingStyleProfile.ts': 'writing-style-profile',
    'src/lib/cache/performanceMonitor.ts': 'cache-performance-metrics',
  };

  for (const [path, key] of Object.entries(expectedLegacyKeys)) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, new RegExp(`safeLocalStorage\\.removeItem\\([^)]*${key}`));
  }
});

test('raw AI prompts and responses are not cached in browser IndexedDB', () => {
  assert.equal(existsSync('src/lib/offline/aiCache.ts'), false);

  const databaseSource = readFileSync('src/lib/offline/database.ts', 'utf8');
  assert.match(databaseSource, /version\(3\)\.stores\(\{\s*aiCache:\s*null/);
  assert.doesNotMatch(databaseSource, /interface\s+AICacheEntry|aiCache!:/);
});
