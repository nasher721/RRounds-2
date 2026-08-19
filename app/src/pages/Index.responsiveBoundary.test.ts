import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('workspace does not choose a desktop shell while the viewport is unresolved', () => {
  const source = readFileSync('src/pages/Index.tsx', 'utf8');

  assert.match(
    source,
    /if \(\s*authLoading\s*\|\|\s*patientsLoading\s*\|\|\s*patientVerification === "loading"\s*\|\|\s*isMobile === undefined/,
  );
  assert.match(source, /patientIds\.length > 0 && todosVerification === "loading"/);
  assert.match(
    source,
    /patientVerification === "stale"\s*\|\|\s*todosVerification === "stale"/,
  );
  assert.match(source, /if \(isMobile !== false\) return;/);
  assert.match(source, /if \(isMobile === undefined\) return undefined;/);
});
