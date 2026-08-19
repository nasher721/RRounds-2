import assert from 'node:assert/strict';
import test from 'node:test';

import { parseApprovedOAuthProviders } from './authProviderPolicy';

test('OAuth providers are disabled unless explicitly approved', () => {
  assert.deepEqual(parseApprovedOAuthProviders(undefined), []);
  assert.deepEqual(parseApprovedOAuthProviders(''), []);
  assert.deepEqual(parseApprovedOAuthProviders('  '), []);
});

test('OAuth provider configuration accepts only unique canonical providers', () => {
  assert.deepEqual(parseApprovedOAuthProviders('google'), ['google']);
  assert.deepEqual(parseApprovedOAuthProviders('apple,google'), ['apple', 'google']);
  assert.deepEqual(parseApprovedOAuthProviders(' google, apple,google '), ['google', 'apple']);
});

test('OAuth provider configuration fails closed on unsupported or malformed values', () => {
  assert.throws(() => parseApprovedOAuthProviders('github'), /unsupported OAuth provider/i);
  assert.throws(() => parseApprovedOAuthProviders('Google'), /unsupported OAuth provider/i);
  assert.throws(() => parseApprovedOAuthProviders('google,,apple'), /unsupported OAuth provider/i);
});
