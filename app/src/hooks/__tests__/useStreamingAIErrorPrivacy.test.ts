import assert from 'node:assert/strict';
import test from 'node:test';
import { createStreamingResponseError } from '@/hooks/useStreamingAI';
import { getUserFacingErrorMessage } from '@/lib/userFacingErrors';

for (const [status, expected] of [
  [429, /too many requests/i],
  [503, /temporarily unavailable/i],
] as const) {
  test(`streaming AI preserves safe ${status} recovery guidance without reading response body`, () => {
    const response = new Response('provider diagnostic for Jane Doe sk-live-secret', { status });
    const error = createStreamingResponseError(response);
    const message = getUserFacingErrorMessage(error, 'fallback');

    assert.match(message, expected);
    assert.doesNotMatch(message, /Jane Doe|sk-live-secret|provider diagnostic/i);
    assert.equal(response.bodyUsed, false);
  });
}
