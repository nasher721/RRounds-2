import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { decideDataOwnerAction } from './database';

test('same authenticated owner preserves persisted offline work on reload', () => {
  assert.equal(decideDataOwnerAction('user-a', 'user-a'), 'preserve');
});

test('a changed identity clears before claiming persisted offline work', () => {
  assert.equal(decideDataOwnerAction('user-a', 'user-b'), 'clear-and-claim');
  assert.equal(decideDataOwnerAction(null, 'user-b'), 'clear-and-claim');
});

test('sign-out clears the persisted owner and all owned records', () => {
  assert.equal(decideDataOwnerAction('user-a', null), 'clear');
});

test('offline storage does not expose a bulk PHI backup import or export API', async () => {
  const source = await readFile(fileURLToPath(new URL('./database.ts', import.meta.url)), 'utf8');
  assert.doesNotMatch(source, /export\s+async\s+function\s+importDatabase\b/);
  assert.doesNotMatch(source, /export\s+async\s+function\s+exportDatabase\b/);
});

test('auth transitions retain only PHI-free ambiguous import retry identities', async () => {
  const source = await readFile(fileURLToPath(new URL('./database.ts', import.meta.url)), 'utf8');
  const ownerTables = source.slice(
    source.indexOf('const ownerBoundDataTables'),
    source.indexOf('const allDataTables'),
  );
  const transition = source.slice(
    source.indexOf('export async function transitionDatabaseOwner'),
    source.indexOf('export async function getDatabaseOwner'),
  );

  assert.doesNotMatch(ownerTables, /patientImportAttempts/);
  assert.match(source, /const allDataTables = \(\) => \[[\s\S]*db\.patientImportAttempts/);
  assert.match(source, /clearAllTables[\s\S]*db\.patientImportAttempts\.clear\(\)/);
  assert.match(transition, /clearOwnerBoundData\(\)/);
  assert.doesNotMatch(transition, /clearAllTables\(\)/);
});
