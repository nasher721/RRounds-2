import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('landing call-to-action names match their visible labels', () => {
  const landing = readFileSync('src/pages/Landing.tsx', 'utf8');

  assert.doesNotMatch(landing, /aria-label="Sign in to open the workspace"/);
  assert.doesNotMatch(landing, /aria-label="Explore Rolling Rounds features"/);
});

test('landing exposes a focusable target for the global skip link', () => {
  const landing = readFileSync('src/pages/Landing.tsx', 'utf8');

  assert.match(landing, /<main id="main-content" tabIndex=\{-1\}>/);
});

test('small landing labels use the contrast-safe accent token on white', () => {
  const highlights = readFileSync('src/components/landing/FeatureHighlights.tsx', 'utf8');

  assert.match(highlights, /Functional by default<\/p>/);
  assert.match(highlights, /Contact<\/p>/);
  assert.equal(
    (highlights.match(/text-sm font-semibold text-sky-700/g) ?? []).length,
    2,
  );
});
