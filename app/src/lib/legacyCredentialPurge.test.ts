import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('migration removes historically persisted provider credentials from every user settings row', async () => {
  const migration = await readFile(
    'supabase/migrations/20260711220000_purge_legacy_ai_credentials.sql',
    'utf8',
  )

  assert.match(migration, /UPDATE public\.user_settings/i)
  assert.match(migration, /app_preferences\s*=\s*app_preferences\s*-\s*'aiCredentials'/i)
  assert.match(migration, /jsonb_typeof\(app_preferences\)\s*=\s*'object'/i)
  assert.match(migration, /app_preferences\s*\?\s*'aiCredentials'/i)
})
