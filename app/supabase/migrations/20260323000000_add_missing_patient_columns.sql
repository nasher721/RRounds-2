-- Add columns that exist in application code but were never migrated to the database.
-- These missing columns cause all patient insert operations (add patient, import patient)
-- to fail with a PostgreSQL "column does not exist" error.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS mrn TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS imaging TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS labs TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS medications JSONB DEFAULT '{"infusions":[],"scheduled":[],"prn":[],"rawText":""}',
  ADD COLUMN IF NOT EXISTS field_timestamps JSONB DEFAULT '{}';

-- Ensure PostgREST picks up the new columns immediately.
NOTIFY pgrst, 'reload schema';
