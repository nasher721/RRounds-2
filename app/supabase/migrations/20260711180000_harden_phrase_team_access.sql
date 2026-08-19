-- Close permissive phrase-library reads and repair recursive team RLS.
-- Shared phrase content remains owner-only until an explicit team/content
-- relationship is available for authorization.

ALTER TABLE public.phrase_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phrase_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phrase_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phrase_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phrase_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_activity ENABLE ROW LEVEL SECURITY;

-- PostgreSQL combines permissive policies with OR. Remove every prior SELECT
-- policy on phrase content so a stale is_shared policy cannot keep anonymous
-- or cross-tenant reads open alongside the owner-only policies below.
DO $policy_reset$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'phrase_folders',
        'clinical_phrases',
        'phrase_fields',
        'phrase_versions'
      )
      AND cmd IN ('SELECT', 'ALL')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$policy_reset$;

CREATE POLICY "Owners can view phrase folders"
ON public.phrase_folders
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Owners can view clinical phrases"
ON public.clinical_phrases
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Owners can view phrase fields"
ON public.phrase_fields
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.clinical_phrases AS phrase
    WHERE phrase.id = phrase_id
      AND phrase.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can view phrase versions"
ON public.phrase_versions
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.clinical_phrases AS phrase
    WHERE phrase.id = phrase_id
      AND phrase.user_id = auth.uid()
  )
);

-- Keep helper functions outside the API-exposed public schema. SECURITY
-- DEFINER avoids RLS recursion, while the empty search_path and qualified
-- relation names prevent object-shadowing attacks.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
REVOKE CREATE ON SCHEMA private FROM authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_phrase_team_member(target_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.phrase_team_members AS membership
      WHERE membership.team_id = target_team_id
        AND membership.user_id = auth.uid()
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_manage_phrase_team(target_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.phrase_teams AS team
        WHERE team.id = target_team_id
          AND team.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.phrase_team_members AS membership
        WHERE membership.team_id = target_team_id
          AND membership.user_id = auth.uid()
          AND membership.role = 'admin'
      )
    );
$function$;

REVOKE ALL ON FUNCTION private.is_phrase_team_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_manage_phrase_team(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_phrase_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_phrase_team(uuid) TO authenticated;

-- Replace mutually recursive team policies with helper-backed policies.
DO $policy_reset$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('phrase_teams', 'phrase_team_members')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$policy_reset$;

CREATE POLICY "Members can view their phrase teams"
ON public.phrase_teams
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    owner_id = auth.uid()
    OR private.is_phrase_team_member(id)
  )
);

CREATE POLICY "Users can create owned phrase teams"
ON public.phrase_teams
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Owners can update phrase teams"
ON public.phrase_teams
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND owner_id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Owners can delete phrase teams"
ON public.phrase_teams
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Members can view phrase team membership"
ON public.phrase_team_members
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    private.is_phrase_team_member(team_id)
    OR private.can_manage_phrase_team(team_id)
  )
);

CREATE POLICY "Team managers can add phrase team members"
ON public.phrase_team_members
FOR INSERT
TO authenticated
WITH CHECK (private.can_manage_phrase_team(team_id));

CREATE POLICY "Team managers can update phrase team members"
ON public.phrase_team_members
FOR UPDATE
TO authenticated
USING (private.can_manage_phrase_team(team_id))
WITH CHECK (private.can_manage_phrase_team(team_id));

CREATE POLICY "Members or managers can remove phrase team members"
ON public.phrase_team_members
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR private.can_manage_phrase_team(team_id)
);

-- Patient activity written by an authenticated client must be attributed to
-- that client. Trusted service-role jobs continue to bypass RLS when writing
-- system activity.
ALTER TABLE public.patient_activity
  ALTER COLUMN user_id SET DEFAULT auth.uid();

DO $policy_reset$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'patient_activity'
      AND cmd IN ('INSERT', 'ALL')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$policy_reset$;

CREATE POLICY "Users can insert attributed activity for their own patients"
ON public.patient_activity
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.patients AS patient
    WHERE patient.id = patient_id
      AND patient.user_id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';
