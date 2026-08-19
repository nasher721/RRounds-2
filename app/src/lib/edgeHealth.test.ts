import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { invalidateEdgeHealthCache, probeEdgeHealth } from './edgeHealth';

type FunctionsMockGlobal = {
  __SUPABASE_FUNCTIONS_INVOKE_MOCK__?: (
    name: string,
    options?: { method?: string },
  ) => Promise<{ data: unknown; error: unknown }>;
};

const testGlobal = globalThis as unknown as FunctionsMockGlobal;

afterEach(() => {
  delete testGlobal.__SUPABASE_FUNCTIONS_INVOKE_MOCK__;
  invalidateEdgeHealthCache();
});

test('edge health uses the authenticated SDK GET contract without retrying a healthy response', async () => {
  const calls: Array<{ name: string; method: string | undefined }> = [];
  testGlobal.__SUPABASE_FUNCTIONS_INVOKE_MOCK__ = async (name, options) => {
    calls.push({ name, method: options?.method });
    return { data: { status: 'healthy' }, error: null };
  };

  invalidateEdgeHealthCache();
  assert.equal(await probeEdgeHealth({ force: true }), 'healthy');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, 'GET');
  assert.equal(calls[0]?.name, 'healthcheck');
});
