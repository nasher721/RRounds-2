-- Bind patient- and phrase-related child records to parents owned by the
-- authenticated user. Checking only the submitted child user_id allows a
-- caller who learns another tenant's parent UUID to create cross-tenant
-- references even though the parent row itself is protected by RLS.

ALTER TABLE public.patient_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_field_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phrase_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phrase_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_phrases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.patient_todos
  ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.patient_field_history
  ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.phrase_usage_log
  ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.phrase_folders
  ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.clinical_phrases
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Remove all permissive variants first. PostgreSQL combines permissive
-- policies with OR, so leaving one historical policy in place would bypass
-- the parent-ownership checks below.
DO $policy_reset$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'patient_todos',
        'patient_field_history',
        'phrase_usage_log',
        'phrase_folders',
        'clinical_phrases'
      )
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

-- A phrase folder policy cannot query phrase_folders directly without causing
-- recursive RLS evaluation. Keep the ownership lookup in the private schema
-- with a fixed search path, following the team-policy helper pattern.
CREATE OR REPLACE FUNCTION private.is_owned_phrase_folder(target_folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.phrase_folders AS folder
      WHERE folder.id = target_folder_id
        AND folder.user_id = auth.uid()
    );
$function$;

REVOKE ALL ON FUNCTION private.is_owned_phrase_folder(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_owned_phrase_folder(uuid) TO authenticated;

CREATE POLICY "Owners can view phrase folders"
ON public.phrase_folders
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Owners can create nested phrase folders"
ON public.phrase_folders
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    parent_id IS NULL
    OR private.is_owned_phrase_folder(parent_id)
  )
  AND (
    team_id IS NULL
    OR private.can_manage_phrase_team(team_id)
  )
);

CREATE POLICY "Owners can update nested phrase folders"
ON public.phrase_folders
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND (
    parent_id IS NULL
    OR private.is_owned_phrase_folder(parent_id)
  )
  AND (
    team_id IS NULL
    OR private.can_manage_phrase_team(team_id)
  )
);

CREATE POLICY "Owners can delete phrase folders"
ON public.phrase_folders
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Owners can view clinical phrases"
ON public.clinical_phrases
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Owners can create phrases in owned folders"
ON public.clinical_phrases
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    folder_id IS NULL
    OR private.is_owned_phrase_folder(folder_id)
  )
);

CREATE POLICY "Owners can update phrases in owned folders"
ON public.clinical_phrases
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND (
    folder_id IS NULL
    OR private.is_owned_phrase_folder(folder_id)
  )
);

CREATE POLICY "Owners can delete clinical phrases"
ON public.clinical_phrases
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Owners can view todos for owned patients"
ON public.patient_todos
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.patients AS patient
    WHERE patient.id = patient_id
      AND patient.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can create todos for owned patients"
ON public.patient_todos
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.patients AS patient
    WHERE patient.id = patient_id
      AND patient.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can update todos for owned patients"
ON public.patient_todos
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.patients AS patient
    WHERE patient.id = patient_id
      AND patient.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.patients AS patient
    WHERE patient.id = patient_id
      AND patient.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete todos for owned patients"
ON public.patient_todos
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.patients AS patient
    WHERE patient.id = patient_id
      AND patient.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can view field history for owned patients"
ON public.patient_field_history
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.patients AS patient
    WHERE patient.id = patient_id
      AND patient.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can create field history for owned patients"
ON public.patient_field_history
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.patients AS patient
    WHERE patient.id = patient_id
      AND patient.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete field history for owned patients"
ON public.patient_field_history
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.patients AS patient
    WHERE patient.id = patient_id
      AND patient.user_id = auth.uid()
  )
);

-- Phrase analytics needs only the phrase, target field, and timestamp. Keep
-- the historical payload columns nullable for compatibility, but reject raw
-- expanded content and form values on all new or modified records. NOT VALID
-- avoids an irreversible purge of legacy rows during deployment while still
-- enforcing the constraint for future writes.
ALTER TABLE public.phrase_usage_log
  DROP CONSTRAINT IF EXISTS phrase_usage_log_metadata_only;
ALTER TABLE public.phrase_usage_log
  ADD CONSTRAINT phrase_usage_log_metadata_only
  CHECK (input_values IS NULL AND inserted_content IS NULL)
  NOT VALID;

-- Legacy deployments may already contain payload values. Do not destroy them
-- in an automatic schema migration, but make them unreachable to browser
-- roles and limit all future browser inserts to metadata columns.
REVOKE ALL ON TABLE public.phrase_usage_log FROM anon;
REVOKE SELECT, INSERT ON TABLE public.phrase_usage_log FROM authenticated;
GRANT SELECT (
  id,
  user_id,
  phrase_id,
  patient_id,
  target_field,
  created_at
) ON TABLE public.phrase_usage_log TO authenticated;
GRANT INSERT (
  user_id,
  phrase_id,
  patient_id,
  target_field
) ON TABLE public.phrase_usage_log TO authenticated;

CREATE POLICY "Owners can view their phrase usage metadata"
ON public.phrase_usage_log
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Owners can create usage metadata for owned phrases"
ON public.phrase_usage_log
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.clinical_phrases AS phrase
    WHERE phrase.id = phrase_id
      AND phrase.user_id = auth.uid()
  )
  AND (
    patient_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.patients AS patient
      WHERE patient.id = patient_id
        AND patient.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Owners can delete their phrase usage metadata"
ON public.phrase_usage_log
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
