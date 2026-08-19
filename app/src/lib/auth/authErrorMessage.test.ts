import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAuthError, getSafeAuthErrorMessage } from './authErrorMessage';

test('known authentication failures use an approved user-facing message', () => {
  assert.equal(
    getSafeAuthErrorMessage(new Error('Invalid login credentials')),
    'Invalid email or password. Please try again.',
  );
});

test('sensitive upstream authentication errors use a generic fallback', () => {
  const sensitiveError = Object.assign(
    new Error('database timeout for patient@example.com; token=super-secret'),
    { code: 'unexpected_provider_failure' },
  );
  const message = getSafeAuthErrorMessage(sensitiveError);

  assert.equal(
    message,
    'Could not sign in. Please try again or contact your administrator.',
  );
  assert.doesNotMatch(message, /patient@example\.com|super-secret|database timeout/i);
});

test('OAuth failures never echo provider error details', () => {
  const message = getSafeAuthErrorMessage(
    new Error('redirect_uri contains tenant-secret-123'),
    { providerLabel: 'Google' },
  );

  assert.equal(message, 'Could not sign in with Google. Please try again or contact your administrator.');
  assert.doesNotMatch(message, /tenant-secret-123|redirect_uri/);
});

test('authentication failures map to a fixed telemetry-safe category', () => {
  assert.equal(
    classifyAuthError(Object.assign(new Error('ignored'), { code: 'invalid_credentials' })),
    'invalid_credentials',
  );
  assert.equal(
    classifyAuthError(Object.assign(new Error('ignored'), { code: 'email_not_confirmed' })),
    'email_not_confirmed',
  );
  assert.equal(classifyAuthError(new Error('Too many requests')), 'rate_limited');
  assert.equal(
    classifyAuthError(new Error('Authentication is not configured.')),
    'unavailable',
  );
  assert.equal(
    classifyAuthError(new Error('database timeout for patient@example.com; token=secret')),
    'provider_error',
  );
});
