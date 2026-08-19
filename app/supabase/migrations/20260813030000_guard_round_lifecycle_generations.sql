-- Keep terminal Round history immutable across delayed multi-device outbox writes.
-- A write may update only its own Round id; it must never overwrite a newer
-- active generation selected solely because it belongs to the same user.

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
  active_state public.round_state;
  target_state public.round_state;
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

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text, 0)
  );

  SELECT *
  INTO active_state
  FROM public.round_state
  WHERE user_id = auth.uid()
    AND status = 'active'
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  SELECT *
  INTO target_state
  FROM public.round_state
  WHERE user_id = auth.uid()
    AND id = p_round_id
  FOR UPDATE;

  -- Never reopen a terminal Round. A new Round must use a new id.
  IF target_state.id IS NOT NULL
     AND target_state.status = 'completed'
     AND p_status = 'active' THEN
    RETURN target_state;
  END IF;

  -- A competing/stale active generation cannot overwrite the current one.
  -- Returning the authoritative id lets the client retain the rejected write
  -- for retry/reconciliation instead of falsely acknowledging it.
  IF active_state.id IS NOT NULL
     AND active_state.id <> p_round_id
     AND p_status = 'active' THEN
    RETURN active_state;
  END IF;

  IF target_state.id IS NULL THEN
    INSERT INTO public.round_state (
      id, user_id, status, state, position_updated_at,
      expanded_updated_at, device_id, updated_at
    )
    VALUES (
      p_round_id, auth.uid(), p_status, p_state, p_position_updated_at,
      p_expanded_updated_at, p_device_id, p_updated_at
    )
    RETURNING * INTO target_state;
  ELSIF p_updated_at >= target_state.updated_at THEN
    UPDATE public.round_state
    SET
      status = p_status,
      state = p_state,
      position_updated_at = GREATEST(target_state.position_updated_at, p_position_updated_at),
      expanded_updated_at = GREATEST(target_state.expanded_updated_at, p_expanded_updated_at),
      device_id = p_device_id,
      updated_at = GREATEST(target_state.updated_at, p_updated_at)
    WHERE user_id = auth.uid()
      AND id = p_round_id
    RETURNING * INTO target_state;
  END IF;

  RETURN target_state;
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
) IS 'Persists only the addressed authenticated Round generation and rejects stale active overwrites.';

NOTIFY pgrst, 'reload schema';
