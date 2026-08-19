import assert from 'node:assert/strict';
import test from 'node:test';

import { recallMemories, reflectOnMemories, retainMemory } from './hindsightClient';

test('browser Hindsight integration remains network-disabled', async () => {
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('Hindsight must not be called from the browser');
  };

  try {
    await retainMemory({ bankId: 'patient-1', content: 'clinical text' });
    assert.equal(
      await recallMemories({ bankId: 'patient-1', query: 'clinical text' }),
      null,
    );
    assert.equal(
      await reflectOnMemories({ bankId: 'patient-1', query: 'clinical text' }),
      null,
    );
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
