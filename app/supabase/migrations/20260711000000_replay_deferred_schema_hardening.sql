-- Apply schema hardening that was deferred by migrations timestamped before
-- their table dependencies. This migration is intentionally idempotent so it
-- is also safe for environments where the historical migrations were applied
-- after the base schema had already been created.

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

-- Foreign-key and RLS lookup indexes.
CREATE INDEX IF NOT EXISTS idx_patient_todos_patient_id
  ON public.patient_todos (patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_todos_user_id
  ON public.patient_todos (user_id);
CREATE INDEX IF NOT EXISTS idx_autotexts_user_id
  ON public.autotexts (user_id);
CREATE INDEX IF NOT EXISTS idx_templates_user_id
  ON public.templates (user_id);
CREATE INDEX IF NOT EXISTS idx_phrase_folders_user_id
  ON public.phrase_folders (user_id);
CREATE INDEX IF NOT EXISTS idx_phrase_folders_parent_id
  ON public.phrase_folders (parent_id);
CREATE INDEX IF NOT EXISTS idx_phrase_folders_team_id
  ON public.phrase_folders (team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_phrase_teams_owner_id
  ON public.phrase_teams (owner_id);
CREATE INDEX IF NOT EXISTS idx_phrase_team_members_team_id
  ON public.phrase_team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_phrase_team_members_user_id
  ON public.phrase_team_members (user_id);
CREATE INDEX IF NOT EXISTS idx_phrase_usage_log_phrase_id
  ON public.phrase_usage_log (phrase_id);
CREATE INDEX IF NOT EXISTS idx_phrase_usage_log_patient_id
  ON public.phrase_usage_log (patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patient_field_history_user_id
  ON public.patient_field_history (user_id);

-- Make RLS state explicit before replacing the known policy variants.
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autotexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_field_history ENABLE ROW LEVEL SECURITY;

-- patients
DROP POLICY IF EXISTS "Users can view own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can view their own patients" ON public.patients;
CREATE POLICY "Users can view their own patients" ON public.patients
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can create their own patients" ON public.patients;
CREATE POLICY "Users can create their own patients" ON public.patients
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can update their own patients" ON public.patients;
CREATE POLICY "Users can update their own patients" ON public.patients
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can delete their own patients" ON public.patients;
CREATE POLICY "Users can delete their own patients" ON public.patients
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- patient_todos
DROP POLICY IF EXISTS "Users can view their own todos" ON public.patient_todos;
CREATE POLICY "Users can view their own todos" ON public.patient_todos
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own todos" ON public.patient_todos;
CREATE POLICY "Users can create their own todos" ON public.patient_todos
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own todos" ON public.patient_todos;
CREATE POLICY "Users can update their own todos" ON public.patient_todos
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own todos" ON public.patient_todos;
CREATE POLICY "Users can delete their own todos" ON public.patient_todos
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- autotexts
DROP POLICY IF EXISTS "Users can view their own autotexts" ON public.autotexts;
CREATE POLICY "Users can view their own autotexts" ON public.autotexts
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own autotexts" ON public.autotexts;
CREATE POLICY "Users can create their own autotexts" ON public.autotexts
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own autotexts" ON public.autotexts;
CREATE POLICY "Users can update their own autotexts" ON public.autotexts
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own autotexts" ON public.autotexts;
CREATE POLICY "Users can delete their own autotexts" ON public.autotexts
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- templates
DROP POLICY IF EXISTS "Users can view their own templates" ON public.templates;
CREATE POLICY "Users can view their own templates" ON public.templates
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own templates" ON public.templates;
CREATE POLICY "Users can create their own templates" ON public.templates
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own templates" ON public.templates;
CREATE POLICY "Users can update their own templates" ON public.templates
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own templates" ON public.templates;
CREATE POLICY "Users can delete their own templates" ON public.templates
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- user_settings
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
CREATE POLICY "Users can view their own settings" ON public.user_settings
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own settings" ON public.user_settings;
CREATE POLICY "Users can create their own settings" ON public.user_settings
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
CREATE POLICY "Users can update their own settings" ON public.user_settings
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- user_dictionary
DROP POLICY IF EXISTS "Users can view their own dictionary entries" ON public.user_dictionary;
CREATE POLICY "Users can view their own dictionary entries" ON public.user_dictionary
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own dictionary entries" ON public.user_dictionary;
CREATE POLICY "Users can create their own dictionary entries" ON public.user_dictionary
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own dictionary entries" ON public.user_dictionary;
CREATE POLICY "Users can update their own dictionary entries" ON public.user_dictionary
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own dictionary entries" ON public.user_dictionary;
CREATE POLICY "Users can delete their own dictionary entries" ON public.user_dictionary
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- patient_field_history
DROP POLICY IF EXISTS "Users can view their own field history" ON public.patient_field_history;
CREATE POLICY "Users can view their own field history" ON public.patient_field_history
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own field history" ON public.patient_field_history;
CREATE POLICY "Users can create their own field history" ON public.patient_field_history
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own field history" ON public.patient_field_history;
CREATE POLICY "Users can delete their own field history" ON public.patient_field_history
  FOR DELETE USING ((SELECT auth.uid()) = user_id);
