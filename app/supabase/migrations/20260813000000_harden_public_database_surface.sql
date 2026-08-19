-- The browser application has no anonymous clinical-data use and does not use
-- Supabase GraphQL. Remove those unused API surfaces, keep the public
-- healthcheck on a purpose-built RPC, and make owner policies skip anonymous
-- requests before evaluating auth.uid().

DROP EXTENSION IF EXISTS pg_graphql;

-- Existing Supabase projects may have inherited broad anon grants from older
-- platform defaults. Auth endpoints live outside public, so the signed-out web
-- app does not need table, sequence, or routine access in this schema.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon;
-- PostgreSQL's built-in function default grants EXECUTE to PUBLIC globally;
-- a schema-scoped default ACL cannot override that global default.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON ROUTINES FROM anon;

CREATE OR REPLACE FUNCTION public.healthcheck_database()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT true;
$function$;

REVOKE ALL ON FUNCTION public.healthcheck_database() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.healthcheck_database() TO anon;

COMMENT ON FUNCTION public.healthcheck_database()
IS 'Least-privileged database connectivity probe for the protected Edge healthcheck.';

-- Policies without a TO clause apply to PUBLIC. Every app-owned table is
-- private to a signed-in user, so restrict only legacy PUBLIC-scoped policies;
-- policies already assigned to a narrower role remain unchanged.
DO $policy_roles$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND roles = ARRAY['public']::name[]
      AND tablename IN (
        'patients',
        'patient_todos',
        'patient_field_history',
        'patient_activity',
        'autotexts',
        'templates',
        'user_settings',
        'user_dictionary',
        'phrase_folders',
        'clinical_phrases',
        'phrase_fields',
        'phrase_versions',
        'phrase_usage_log',
        'phrase_teams',
        'phrase_team_members',
        'learned_phrases',
        'round_state'
      )
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO authenticated',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$policy_roles$;

-- Some production environments contain this legacy advisor helper even
-- though it is absent from the repository history. Preserve the helper for
-- operator use, but remove all browser-role execution from every overload.
DO $legacy_helper$
DECLARE
  function_record record;
BEGIN
  FOR function_record IN
    SELECT
      namespace.nspname AS schema_name,
      procedure.proname AS function_name,
      pg_catalog.pg_get_function_identity_arguments(procedure.oid) AS identity_arguments
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'rls_auto_enable'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      function_record.schema_name,
      function_record.function_name,
      function_record.identity_arguments
    );
  END LOOP;
END;
$legacy_helper$;

NOTIFY pgrst, 'reload schema';
