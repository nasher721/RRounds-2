import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const surfacePaths = [
  'src/lib/cache/queryClientConfig.ts',
  'src/components/ImagePasteEditor.tsx',
  'src/components/medications/OpenFDAChecker.tsx',
  'src/components/AutotextManager.tsx',
  'src/components/mobile/CameraScanner.tsx',
  'src/hooks/useStreamingAI.ts',
  'src/hooks/useDictation.ts',
] as const;

test('user-facing failure surfaces classify errors instead of exposing raw messages', async () => {
  const sources = await Promise.all(
    surfacePaths.map(async (path) => [path, await readFile(path, 'utf8')] as const),
  );

  for (const [path, source] of sources) {
    assert.match(source, /getUserFacingErrorMessage/, `${path} must use the shared classifier`);
    assert.doesNotMatch(
      source,
      /(?:error|err) instanceof Error \? (?:error|err)\.message/,
      `${path} must not display arbitrary exception messages`,
    );
    assert.doesNotMatch(
      source,
      /(?:setError|description\s*:|toast\.error)[^\n]{0,120}\b(?:error|err)(?:\?|)\.message/,
      `${path} must not send raw messages to UI sinks`,
    );
    assert.doesNotMatch(
      source,
      /console\.(?:error|warn)\([^\n]*,\s*(?:error|err)\s*\)/,
      `${path} must not log raw exception objects`,
    );
  }

  const streamingSource = sources.find(([path]) => path === 'src/hooks/useStreamingAI.ts')?.[1] ?? '';
  assert.doesNotMatch(streamingSource, /response\.text\(\)/, 'Edge error bodies must not reach UI state');
  assert.doesNotMatch(
    streamingSource,
    /First bytes:/,
    'malformed stream payload fragments must not be embedded in errors',
  );
});
