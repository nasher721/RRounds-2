import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrationPath = path.join(
  repositoryRoot,
  'supabase/migrations/20260711180000_harden_phrase_team_access.sql',
);

test('access-control migration replaces shared phrase reads with owner-only policies', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  assert.equal(
    [...sql.matchAll(/END;\s*\$policy_reset\$;/g)].length,
    3,
    'each policy-reset block must terminate as valid PL/pgSQL',
  );

  for (const table of ['phrase_folders', 'clinical_phrases', 'phrase_fields', 'phrase_versions']) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'));
  }

  assert.match(sql, /tablename IN \([\s\S]*?'phrase_folders'[\s\S]*?'clinical_phrases'[\s\S]*?'phrase_fields'[\s\S]*?'phrase_versions'[\s\S]*?\)[\s\S]*?cmd IN \('SELECT', 'ALL'\)/i);
  assert.doesNotMatch(sql, /\bis_shared\s*=\s*true\b/i);
  assert.match(sql, /Owners can view phrase folders[\s\S]*?TO authenticated[\s\S]*?user_id = auth\.uid\(\)/i);
  assert.match(sql, /Owners can view clinical phrases[\s\S]*?TO authenticated[\s\S]*?user_id = auth\.uid\(\)/i);
  assert.match(sql, /Owners can view phrase fields[\s\S]*?phrase\.user_id = auth\.uid\(\)/i);
  assert.match(sql, /Owners can view phrase versions[\s\S]*?phrase\.user_id = auth\.uid\(\)/i);
});

test('team RLS uses fixed-search-path security-definer helpers with tight grants', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  for (const helper of ['is_phrase_team_member', 'can_manage_phrase_team']) {
    assert.match(
      sql,
      new RegExp(
        `FUNCTION private\\.${helper}\\(target_team_id uuid\\)[\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path = ''`,
        'i',
      ),
    );
    assert.match(
      sql,
      new RegExp(`REVOKE ALL ON FUNCTION private\\.${helper}\\(uuid\\) FROM PUBLIC, anon, authenticated`, 'i'),
    );
    assert.match(
      sql,
      new RegExp(`GRANT EXECUTE ON FUNCTION private\\.${helper}\\(uuid\\) TO authenticated`, 'i'),
    );
  }

  assert.match(sql, /tablename IN \('phrase_teams', 'phrase_team_members'\)/i);
  assert.match(sql, /Members can view their phrase teams[\s\S]*?private\.is_phrase_team_member\(id\)/i);
  assert.match(sql, /Members can view phrase team membership[\s\S]*?private\.is_phrase_team_member\(team_id\)/i);
  assert.match(sql, /Team managers can add phrase team members[\s\S]*?private\.can_manage_phrase_team\(team_id\)/i);
});

test('patient activity inserts require caller attribution and owned patients', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  assert.match(sql, /patient_activity[\s\S]*?ALTER COLUMN user_id SET DEFAULT auth\.uid\(\)/i);
  assert.match(sql, /tablename = 'patient_activity'[\s\S]*?cmd IN \('INSERT', 'ALL'\)/i);
  assert.match(
    sql,
    /Users can insert attributed activity for their own patients[\s\S]*?user_id = auth\.uid\(\)[\s\S]*?patient\.user_id = auth\.uid\(\)/i,
  );
});

test('collaboration hooks cannot open public Realtime presence or broadcast channels', async () => {
  const [presenceSource, phrasePresenceSource, teamSource, crdtSource] = await Promise.all([
    readFile(path.join(repositoryRoot, 'src/hooks/usePresence.ts'), 'utf8'),
    readFile(path.join(repositoryRoot, 'src/hooks/usePhrasePresence.ts'), 'utf8'),
    readFile(path.join(repositoryRoot, 'src/contexts/TeamContext.tsx'), 'utf8'),
    readFile(path.join(repositoryRoot, 'src/hooks/useCRDT.ts'), 'utf8'),
  ]);

  for (const source of [presenceSource, phrasePresenceSource, teamSource, crdtSource]) {
    assert.doesNotMatch(source, /supabase\.channel\s*\(/);
    assert.doesNotMatch(source, /\.track\s*\(/);
    assert.doesNotMatch(source, /\.on\s*\(\s*['"]presence['"]/);
    assert.doesNotMatch(source, /\.on\s*\(\s*['"]broadcast['"]/);
    assert.doesNotMatch(source, /\.send\s*\(\s*\{[\s\S]*?type:\s*['"]broadcast['"]/);
  }

  assert.match(crdtSource, /new IndexeddbPersistence\(/);
  assert.match(crdtSource, /supabase[\s\S]*?\.from\(tableName\)[\s\S]*?\.select\(/);
  assert.match(crdtSource, /supabase[\s\S]*?\.from\(tableName\)[\s\S]*?\.update\(/);
});
