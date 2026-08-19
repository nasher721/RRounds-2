-- Supabase Postgres optimizations (query performance, schema FK indexes, RLS)
-- Refs: query-missing-indexes, schema-foreign-key-indexes, security-rls-performance

-- This migration was timestamped before the migrations that create the tables
-- below. On a fresh replay, defer the complete optimization batch so a partial
-- schema cannot receive only some of the indexes or policies. The latest
-- catch-up migration reapplies this batch after all dependencies exist.
DO $migration$
BEGIN
  IF to_regclass('public.patients') IS NULL
    OR to_regclass('public.patient_todos') IS NULL
    OR to_regclass('public.autotexts') IS NULL
    OR to_regclass('public.templates') IS NULL
    OR to_regclass('public.phrase_folders') IS NULL
    OR to_regclass('public.phrase_teams') IS NULL
    OR to_regclass('public.phrase_team_members') IS NULL
    OR to_regclass('public.phrase_usage_log') IS NULL
    OR to_regclass('public.patient_field_history') IS NULL
    OR to_regclass('public.user_settings') IS NULL
    OR to_regclass('public.user_dictionary') IS NULL
  THEN
    RAISE NOTICE 'Deferring index and RLS optimization batch until all referenced tables exist';
    RETURN;
  END IF;

-- =============================================================================
-- 1. Missing indexes on foreign keys and RLS columns
--    (speeds up JOINs, CASCADE, and policy checks)
-- =============================================================================

-- patient_todos: FK patient_id + RLS user_id
CREATE INDEX IF NOT EXISTS idx_patient_todos_patient_id ON public.patient_todos(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_todos_user_id ON public.patient_todos(user_id);

-- autotexts: RLS and FK user_id
CREATE INDEX IF NOT EXISTS idx_autotexts_user_id ON public.autotexts(user_id);

-- templates: RLS and FK user_id
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON public.templates(user_id);

-- phrase_folders: FK user_id, parent_id, team_id (JOINs and RLS)
CREATE INDEX IF NOT EXISTS idx_phrase_folders_user_id ON public.phrase_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_phrase_folders_parent_id ON public.phrase_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_phrase_folders_team_id ON public.phrase_folders(team_id) WHERE team_id IS NOT NULL;

-- phrase_teams: FK owner_id (RLS and lookups)
CREATE INDEX IF NOT EXISTS idx_phrase_teams_owner_id ON public.phrase_teams(owner_id);

-- phrase_team_members: FK team_id, user_id (membership lookups)
CREATE INDEX IF NOT EXISTS idx_phrase_team_members_team_id ON public.phrase_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_phrase_team_members_user_id ON public.phrase_team_members(user_id);

-- phrase_usage_log: FK phrase_id, patient_id (analytics and filters)
CREATE INDEX IF NOT EXISTS idx_phrase_usage_log_phrase_id ON public.phrase_usage_log(phrase_id);
CREATE INDEX IF NOT EXISTS idx_phrase_usage_log_patient_id ON public.phrase_usage_log(patient_id) WHERE patient_id IS NOT NULL;

-- patient_field_history: RLS user_id
CREATE INDEX IF NOT EXISTS idx_patient_field_history_user_id ON public.patient_field_history(user_id);

-- =============================================================================
-- 2. RLS policy optimization: (select auth.uid()) instead of auth.uid()
--    (auth.uid() evaluated once per query instead of per row)
-- =============================================================================

-- patients (drop both naming variants from earlier migrations)
DROP POLICY IF EXISTS "Users can view own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can view their own patients" ON public.patients;
CREATE POLICY "Users can view their own patients" ON public.patients FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can create their own patients" ON public.patients;

CREATE POLICY "Users can create their own patients" ON public.patients FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can update their own patients" ON public.patients;
CREATE POLICY "Users can update their own patients" ON public.patients FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can delete their own patients" ON public.patients;
CREATE POLICY "Users can delete their own patients" ON public.patients FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- patient_todos
DROP POLICY IF EXISTS "Users can view their own todos" ON public.patient_todos;
CREATE POLICY "Users can view their own todos" ON public.patient_todos FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own todos" ON public.patient_todos;
CREATE POLICY "Users can create their own todos" ON public.patient_todos FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own todos" ON public.patient_todos;
CREATE POLICY "Users can update their own todos" ON public.patient_todos FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own todos" ON public.patient_todos;
CREATE POLICY "Users can delete their own todos" ON public.patient_todos FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- autotexts
DROP POLICY IF EXISTS "Users can view their own autotexts" ON public.autotexts;
CREATE POLICY "Users can view their own autotexts" ON public.autotexts FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own autotexts" ON public.autotexts;
CREATE POLICY "Users can create their own autotexts" ON public.autotexts FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own autotexts" ON public.autotexts;
CREATE POLICY "Users can update their own autotexts" ON public.autotexts FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own autotexts" ON public.autotexts;
CREATE POLICY "Users can delete their own autotexts" ON public.autotexts FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- templates
DROP POLICY IF EXISTS "Users can view their own templates" ON public.templates;
CREATE POLICY "Users can view their own templates" ON public.templates FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own templates" ON public.templates;
CREATE POLICY "Users can create their own templates" ON public.templates FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own templates" ON public.templates;
CREATE POLICY "Users can update their own templates" ON public.templates FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own templates" ON public.templates;
CREATE POLICY "Users can delete their own templates" ON public.templates FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- user_settings
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
CREATE POLICY "Users can view their own settings" ON public.user_settings FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own settings" ON public.user_settings;
CREATE POLICY "Users can create their own settings" ON public.user_settings FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
CREATE POLICY "Users can update their own settings" ON public.user_settings FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

-- user_dictionary
DROP POLICY IF EXISTS "Users can view their own dictionary entries" ON public.user_dictionary;
CREATE POLICY "Users can view their own dictionary entries" ON public.user_dictionary FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own dictionary entries" ON public.user_dictionary;
CREATE POLICY "Users can create their own dictionary entries" ON public.user_dictionary FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own dictionary entries" ON public.user_dictionary;
CREATE POLICY "Users can update their own dictionary entries" ON public.user_dictionary FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own dictionary entries" ON public.user_dictionary;
CREATE POLICY "Users can delete their own dictionary entries" ON public.user_dictionary FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- patient_field_history
DROP POLICY IF EXISTS "Users can view their own field history" ON public.patient_field_history;
CREATE POLICY "Users can view their own field history" ON public.patient_field_history FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own field history" ON public.patient_field_history;
CREATE POLICY "Users can create their own field history" ON public.patient_field_history FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own field history" ON public.patient_field_history;
CREATE POLICY "Users can delete their own field history" ON public.patient_field_history FOR DELETE
  USING ((SELECT auth.uid()) = user_id);
END;
$migration$;
