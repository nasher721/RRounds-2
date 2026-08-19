-- Add fields used by RxDB replication.
--
-- This migration predates the migration that creates public.patients. Fresh
-- database replays therefore defer the table-specific work to the later
-- catch-up migration instead of failing before the base schema is created.

CREATE OR REPLACE FUNCTION public.update_modified_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW._modified := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  RETURN NEW;
END;
$$;

DO $migration$
BEGIN
  IF to_regclass('public.patients') IS NULL THEN
    RAISE NOTICE 'Deferring RxDB patient replication fields until public.patients exists';
    RETURN;
  END IF;

  ALTER TABLE public.patients
    ADD COLUMN IF NOT EXISTS _modified bigint
      DEFAULT FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint,
    ADD COLUMN IF NOT EXISTS _deleted boolean DEFAULT false;

  CREATE INDEX IF NOT EXISTS idx_patients_modified
    ON public.patients (_modified);

  CREATE INDEX IF NOT EXISTS idx_patients_user_modified
    ON public.patients (user_id, _modified);

  DROP TRIGGER IF EXISTS trigger_patients_modified ON public.patients;
  CREATE TRIGGER trigger_patients_modified
    BEFORE INSERT OR UPDATE ON public.patients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_timestamp();

  ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Users can view own patients" ON public.patients;
  CREATE POLICY "Users can view own patients" ON public.patients
    FOR SELECT USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can insert own patients" ON public.patients;
  CREATE POLICY "Users can insert own patients" ON public.patients
    FOR INSERT WITH CHECK (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can update own patients" ON public.patients;
  CREATE POLICY "Users can update own patients" ON public.patients
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can delete own patients" ON public.patients;
  CREATE POLICY "Users can delete own patients" ON public.patients
    FOR DELETE USING (auth.uid() = user_id);
END;
$migration$;

-- Realtime publication membership remains an environment-level choice. Enable
-- it through the Supabase dashboard or a deployment-specific migration.
