-- Enforce Edge Function quotas across all isolates with one atomic database row.
-- Keys are HMAC-SHA-256 digests; raw user IDs and client IPs are never persisted.

CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  rate_key text PRIMARY KEY
    CHECK (char_length(rate_key) BETWEEN 1 AND 96),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.edge_rate_limits FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_updated_at
  ON public.edge_rate_limits (updated_at);

CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
  p_key text,
  p_window_ms bigint,
  p_max_requests integer
)
RETURNS TABLE (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_window_started_at timestamptz;
  v_now timestamptz := clock_timestamp();
  v_window interval;
BEGIN
  IF p_key IS NULL OR char_length(p_key) NOT BETWEEN 1 AND 96 THEN
    RAISE EXCEPTION 'Invalid rate-limit key' USING ERRCODE = '22023';
  END IF;
  IF p_window_ms IS NULL OR p_window_ms < 1000 OR p_window_ms > 86400000 THEN
    RAISE EXCEPTION 'Invalid rate-limit window' USING ERRCODE = '22023';
  END IF;
  IF p_max_requests IS NULL OR p_max_requests < 1 OR p_max_requests > 10000 THEN
    RAISE EXCEPTION 'Invalid rate-limit maximum' USING ERRCODE = '22023';
  END IF;

  v_window := p_window_ms * interval '1 millisecond';

  INSERT INTO public.edge_rate_limits AS current_limit (
    rate_key,
    window_started_at,
    request_count,
    updated_at
  )
  VALUES (p_key, v_now, 1, v_now)
  ON CONFLICT (rate_key) DO UPDATE
  SET
    window_started_at = CASE
      WHEN current_limit.window_started_at + v_window <= v_now
        THEN v_now
      ELSE current_limit.window_started_at
    END,
    request_count = CASE
      WHEN current_limit.window_started_at + v_window <= v_now
        THEN 1
      ELSE LEAST(current_limit.request_count + 1, p_max_requests + 1)
    END,
    updated_at = v_now
  RETURNING
    current_limit.request_count,
    current_limit.window_started_at
  INTO v_count, v_window_started_at;

  -- Bound stale public-healthcheck identities without adding cleanup work to
  -- every request. The indexed batch is deliberately small.
  IF random() < 0.01 THEN
    WITH expired AS (
      SELECT rate_key
      FROM public.edge_rate_limits
      WHERE updated_at < v_now - interval '1 day'
      ORDER BY updated_at
      LIMIT 100
    )
    DELETE FROM public.edge_rate_limits AS stale
    USING expired
    WHERE stale.rate_key = expired.rate_key;
  END IF;

  RETURN QUERY SELECT
    v_count <= p_max_requests,
    GREATEST(p_max_requests - v_count, 0),
    v_window_started_at + v_window;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_edge_rate_limit(text, bigint, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_edge_rate_limit(text, bigint, integer)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(text, bigint, integer)
  TO service_role;
