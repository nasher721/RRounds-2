import assert from 'node:assert/strict';
import test from 'node:test';

import { parseProductionPublicOrigin } from './publicOriginPolicy';

test('production public origin accepts an explicit public HTTPS origin', () => {
  assert.equal(
    parseProductionPublicOrigin('https://rounds.hospital.org/'),
    'https://rounds.hospital.org',
  );
  assert.equal(
    parseProductionPublicOrigin('https://remix-of-remix-of-round-robin-notes.vercel.app'),
    'https://remix-of-remix-of-round-robin-notes.vercel.app',
  );
});

test('production public origin is required and rejects placeholder or private hosts', () => {
  for (const value of [
    undefined,
    '',
    'https://example.com',
    'https://rounds.example.com',
    'https://rounds.yourhospital.org',
    'https://rounds.local',
    'https://localhost',
    'https://127.0.0.1',
    'https://rounds.hospital.test',
  ]) {
    assert.throws(
      () => parseProductionPublicOrigin(value),
      /public app URL/i,
      String(value),
    );
  }
});

test('production public origin rejects ambiguous or credential-bearing URLs', () => {
  for (const value of [
    'http://rounds.hospital.org',
    'https://user:secret@rounds.hospital.org',
    'https://rounds.hospital.org/app',
    'https://rounds.hospital.org/?tenant=icu',
    'https://rounds.hospital.org/#launch',
    'https://rounds.hospital.org:8443',
  ]) {
    assert.throws(
      () => parseProductionPublicOrigin(value),
      /public app URL/i,
      value,
    );
  }
});
