import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { cacheHydration, createOptimizedQueryClient } from './queryClientConfig';

test('clinical query cache is never persisted or hydrated across users', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

  try {
    window.localStorage.setItem('rq-cache', JSON.stringify([
      { queryKey: ['patient', 'legacy'], data: { name: 'Prior User' }, dataUpdatedAt: Date.now() },
    ]));
    window.localStorage.setItem('last-sync-time', Date.now().toString());

    cacheHydration.clear();
    const sourceClient = createOptimizedQueryClient();
    sourceClient.setQueryData(['patient', 'patient-1'], { name: 'Test Patient' });
    assert.doesNotThrow(() => cacheHydration.persist(sourceClient));

    const restoredClient = new QueryClient();
    assert.doesNotThrow(() => cacheHydration.hydrate(restoredClient));
    assert.equal(restoredClient.getQueryData(['patient', 'patient-1']), undefined);
    assert.equal(restoredClient.getQueryData(['patient', 'legacy']), undefined);
    assert.equal(window.localStorage.getItem('rq-cache'), null);
    assert.equal(window.localStorage.getItem('last-sync-time'), null);

    assert.doesNotThrow(() => cacheHydration.clear());
    sourceClient.clear();
    restoredClient.clear();
  } finally {
    cacheHydration.clear();
    if (originalDescriptor) Object.defineProperty(window, 'localStorage', originalDescriptor);
  }
});
