import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePrivacyNoticeUrl } from './legalPolicy';

test('privacy notice URL is optional outside production and canonical when configured', () => {
  assert.equal(parsePrivacyNoticeUrl(undefined), '');
  assert.equal(parsePrivacyNoticeUrl('  '), '');
  assert.equal(
    parsePrivacyNoticeUrl('https://privacy.hospital.org/rolling-rounds'),
    'https://privacy.hospital.org/rolling-rounds',
  );
});

test('privacy notice URL rejects unsafe or placeholder destinations', () => {
  const invalidValues = [
    'http://hospital.org/privacy',
    'https://example.com/privacy',
    'https://privacy.yourhospital.org/notice',
    'https://localhost/privacy',
    'https://user:password@hospital.org/privacy',
    'https://hospital.org/privacy#draft',
    '/privacy',
    'not-a-url',
  ];

  for (const value of invalidValues) {
    assert.throws(() => parsePrivacyNoticeUrl(value), /privacy notice URL/i, value);
  }
});
