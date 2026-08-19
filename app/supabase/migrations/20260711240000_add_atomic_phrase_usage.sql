-- Keep phrase counters and usage metadata consistent. A PostgreSQL function
-- invocation is one transaction, so a failed metadata insert also rolls back
-- the counter update.

CREATE OR REPLACE FUNCTION public.record_owned_phrase_usage(
  p_phrase_id uuid,
  p_patient_id uuid DEFAULT NULL,
  p_target_field text DEFAULT NULL
)
RETURNS TABLE (
  usage_count integer,
  last_used_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Authentication required';
  END IF;

  IF p_phrase_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Phrase identifier is required';
  END IF;

  IF p_target_field IS NOT NULL AND (
    char_length(p_target_field) > 128
    OR p_target_field !~ '^[A-Za-z][A-Za-z0-9_.-]{0,127}$'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Target field is invalid';
  END IF;

  IF p_patient_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.patients AS patient
    WHERE patient.id = p_patient_id
      AND patient.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Patient is not available';
  END IF;

  UPDATE public.clinical_phrases AS phrase
  SET
    usage_count = COALESCE(phrase.usage_count, 0) + 1,
    last_used_at = statement_timestamp()
  WHERE phrase.id = p_phrase_id
    AND phrase.user_id = current_user_id
  RETURNING phrase.usage_count, phrase.last_used_at
  INTO usage_count, last_used_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Phrase is not available';
  END IF;

  INSERT INTO public.phrase_usage_log (
    user_id,
    phrase_id,
    patient_id,
    target_field
  )
  VALUES (
    current_user_id,
    p_phrase_id,
    p_patient_id,
    p_target_field
  );

  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_owned_phrase_usage(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_owned_phrase_usage(uuid, uuid, text)
TO authenticated;

NOTIFY pgrst, 'reload schema';
