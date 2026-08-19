-- Patch one nested patient JSON field inside PostgreSQL so overlapping browser
-- requests cannot overwrite siblings with an older full-object snapshot.

CREATE OR REPLACE FUNCTION public.update_owned_patient_json_field(
  p_patient_id uuid,
  p_parent_field text,
  p_child_field text,
  p_value jsonb,
  p_last_modified timestamp with time zone,
  p_field_timestamp timestamp with time zone DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_value IS NULL THEN
    RAISE EXCEPTION 'Invalid patient JSON field' USING ERRCODE = '22023';
  END IF;

  IF p_last_modified IS NULL THEN
    RAISE EXCEPTION 'Invalid modification timestamp' USING ERRCODE = '22023';
  END IF;

  IF p_parent_field = 'systems' THEN
    IF p_child_field NOT IN (
      'neuro', 'cv', 'resp', 'renalGU', 'gi', 'endo', 'heme',
      'infectious', 'skinLines', 'dispo'
    ) OR jsonb_typeof(p_value) <> 'string' THEN
      RAISE EXCEPTION 'Invalid patient JSON field' USING ERRCODE = '22023';
    END IF;
  ELSIF p_parent_field = 'medications' THEN
    IF p_child_field NOT IN ('infusions', 'scheduled', 'prn', 'rawText') THEN
      RAISE EXCEPTION 'Invalid patient JSON field' USING ERRCODE = '22023';
    ELSIF p_child_field = 'rawText' THEN
      IF jsonb_typeof(p_value) <> 'string' THEN
        RAISE EXCEPTION 'Invalid patient JSON field' USING ERRCODE = '22023';
      END IF;
    ELSE
      IF jsonb_typeof(p_value) <> 'array' THEN
        RAISE EXCEPTION 'Invalid patient JSON field' USING ERRCODE = '22023';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_value) AS element(value)
        WHERE pg_catalog.jsonb_typeof(element.value) <> 'string'
      ) THEN
        RAISE EXCEPTION 'Invalid patient JSON field' USING ERRCODE = '22023';
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid patient JSON field' USING ERRCODE = '22023';
  END IF;

  UPDATE public.patients
  SET
    systems = CASE
      WHEN p_parent_field = 'systems'
        THEN jsonb_set(COALESCE(systems, '{}'::jsonb), ARRAY[p_child_field], p_value, true)
      ELSE systems
    END,
    medications = CASE
      WHEN p_parent_field = 'medications'
        THEN jsonb_set(COALESCE(medications, '{}'::jsonb), ARRAY[p_child_field], p_value, true)
      ELSE medications
    END,
    field_timestamps = CASE
      WHEN p_field_timestamp IS NULL THEN field_timestamps
      ELSE jsonb_set(
        COALESCE(field_timestamps, '{}'::jsonb),
        ARRAY[p_parent_field || '.' || p_child_field],
        to_jsonb(p_field_timestamp::text),
        true
      )
    END,
    last_modified = p_last_modified
  WHERE id = p_patient_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_owned_patient_json_field(
  uuid,
  text,
  text,
  jsonb,
  timestamp with time zone,
  timestamp with time zone
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_owned_patient_json_field(
  uuid,
  text,
  text,
  jsonb,
  timestamp with time zone,
  timestamp with time zone
) TO authenticated;

COMMENT ON FUNCTION public.update_owned_patient_json_field(
  uuid,
  text,
  text,
  jsonb,
  timestamp with time zone,
  timestamp with time zone
) IS 'Atomically patches an allowlisted nested JSON field for a patient owned by auth.uid().';
