-- Backend contract hardening for the Focus-first Round runner.
-- Keep patient ordering tenant-scoped, persist fields already exposed by the UI,
-- and serialize the one-active-round write path inside Postgres.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS service_line text,
  ADD COLUMN IF NOT EXISTS attending_physician text,
  ADD COLUMN IF NOT EXISTS consulting_team text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS acuity text,
  ADD COLUMN IF NOT EXISTS code_status text,
  ADD COLUMN IF NOT EXISTS alerts text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vitals jsonb NOT NULL DEFAULT '{"lastRecorded":null,"temp":null,"hr":null,"bp":null,"rr":null,"spo2":null}'::jsonb,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_age_valid'
      AND conrelid = 'public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_age_valid
      CHECK (age IS NULL OR age BETWEEN 0 AND 150)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_acuity_valid'
      AND conrelid = 'public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_acuity_valid
      CHECK (acuity IS NULL OR acuity IN ('low', 'moderate', 'high', 'critical'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_code_status_valid'
      AND conrelid = 'public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_code_status_valid
      CHECK (code_status IS NULL OR code_status IN ('full', 'dnr', 'dni', 'comfort'))
      NOT VALID;
  END IF;
END;
$constraints$;

-- Room/order numbers are display-local identifiers, not globally unique IDs.
-- This index also supports the authenticated roster query and concurrent import
-- retry path without creating cross-tenant collisions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_user_patient_number
  ON public.patients (user_id, patient_number);

CREATE INDEX IF NOT EXISTS idx_patients_user_patient_number_order
  ON public.patients (user_id, patient_number ASC, id);

CREATE INDEX IF NOT EXISTS idx_patients_assigned_to
  ON public.patients (assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_todos_user_patient_created
  ON public.patient_todos (user_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_field_history_user_patient_changed
  ON public.patient_field_history (user_id, patient_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_activity_patient_created
  ON public.patient_activity (patient_id, created_at DESC);

DO $round_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'round_state_payload_object'
      AND conrelid = 'public.round_state'::regclass
  ) THEN
    ALTER TABLE public.round_state
      ADD CONSTRAINT round_state_payload_object
      CHECK (jsonb_typeof(state) = 'object') NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'round_state_payload_bounded'
      AND conrelid = 'public.round_state'::regclass
  ) THEN
    ALTER TABLE public.round_state
      ADD CONSTRAINT round_state_payload_bounded
      CHECK (pg_column_size(state) <= 262144) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'round_state_device_id_bounded'
      AND conrelid = 'public.round_state'::regclass
  ) THEN
    ALTER TABLE public.round_state
      ADD CONSTRAINT round_state_device_id_bounded
      CHECK (char_length(device_id) BETWEEN 1 AND 128) NOT VALID;
  END IF;
END;
$round_constraints$;

CREATE OR REPLACE FUNCTION public.upsert_owned_round_state(
  p_round_id uuid,
  p_status text,
  p_state jsonb,
  p_position_updated_at timestamptz,
  p_expanded_updated_at timestamptz,
  p_device_id text,
  p_updated_at timestamptz
)
RETURNS public.round_state
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  current_state public.round_state;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_round_id IS NULL OR p_status NOT IN ('active', 'completed') THEN
    RAISE EXCEPTION 'Invalid Round state' USING ERRCODE = '22023';
  END IF;
  IF p_state IS NULL OR jsonb_typeof(p_state) <> 'object'
     OR pg_column_size(p_state) > 262144 THEN
    RAISE EXCEPTION 'Round payload is invalid or too large' USING ERRCODE = '22023';
  END IF;
  IF p_position_updated_at IS NULL OR p_expanded_updated_at IS NULL
     OR p_updated_at IS NULL THEN
    RAISE EXCEPTION 'Round timestamps are required' USING ERRCODE = '22023';
  END IF;
  IF p_device_id IS NULL OR char_length(p_device_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Round device identifier is invalid' USING ERRCODE = '22023';
  END IF;

  -- RLS protects the row; this short-lived advisory lock serializes two tabs
  -- that try to create the first active row at the same time.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text, 0)
  );

  SELECT *
  INTO current_state
  FROM public.round_state
  WHERE user_id = auth.uid()
    AND status = 'active'
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF current_state.id IS NULL AND p_status = 'completed' THEN
    SELECT *
    INTO current_state
    FROM public.round_state
    WHERE user_id = auth.uid()
      AND id = p_round_id
    FOR UPDATE;
  END IF;

  IF current_state.id IS NULL THEN
    INSERT INTO public.round_state (
      id, user_id, status, state, position_updated_at,
      expanded_updated_at, device_id, updated_at
    )
    VALUES (
      p_round_id, auth.uid(), p_status, p_state, p_position_updated_at,
      p_expanded_updated_at, p_device_id, p_updated_at
    )
    RETURNING * INTO current_state;
  ELSIF p_updated_at >= current_state.updated_at THEN
    UPDATE public.round_state
    SET
      status = p_status,
      state = p_state,
      position_updated_at = GREATEST(current_state.position_updated_at, p_position_updated_at),
      expanded_updated_at = GREATEST(current_state.expanded_updated_at, p_expanded_updated_at),
      device_id = p_device_id,
      updated_at = GREATEST(current_state.updated_at, p_updated_at)
    WHERE id = current_state.id
    RETURNING * INTO current_state;
  END IF;

  RETURN current_state;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_owned_round_state(
  uuid, text, jsonb, timestamptz, timestamptz, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_owned_round_state(
  uuid, text, jsonb, timestamptz, timestamptz, text, timestamptz
) TO authenticated;

COMMENT ON FUNCTION public.upsert_owned_round_state(
  uuid, text, jsonb, timestamptz, timestamptz, text, timestamptz
) IS 'Atomically persists one authenticated user''s active Round state.';

NOTIFY pgrst, 'reload schema';
