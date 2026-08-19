import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('print and export parsers sanitize clinical HTML before assigning innerHTML', () => {
  for (const file of [
    'src/components/print/PrintDocument.tsx',
    'src/components/print/ExportHandlers.ts',
  ]) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      source,
      /\.innerHTML\s*=\s*html\s*;/,
      `${file} must not parse raw patient HTML`,
    );
  }
});
