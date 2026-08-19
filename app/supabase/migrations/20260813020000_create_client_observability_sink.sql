-- First-party central observability for fixed, PHI-free browser signals.
-- The public Edge endpoint validates and projects each event; browser roles
-- receive no direct table or routine privileges.

CREATE TABLE public.client_observability_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  occurred_at timestamptz NOT NULL,
  level text NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  event_name text NOT NULL CHECK (
    char_length(event_name) BETWEEN 1 AND 128
    AND event_name ~ '^[A-Za-z0-9_.-]+$'
  ),
  environment text NOT NULL CHECK (
    environment IN ('production', 'development', 'test', 'unknown')
  ),
  metric_name text CHECK (
    metric_name IS NULL OR (
      char_length(metric_name) BETWEEN 1 AND 128
      AND metric_name ~ '^[A-Za-z0-9_.-]+$'
    )
  ),
  metric_value double precision CHECK (
    metric_value IS NULL
    OR metric_value BETWEEN -1000000000000 AND 1000000000000
  ),
  metric_unit text CHECK (metric_unit IS NULL OR metric_unit IN ('count', 'ms', 's')),
  operation text CHECK (
    operation IS NULL OR operation IN (
      'add', 'clear_all', 'collapse_all', 'create', 'delete', 'duplicate',
      'handleError', 'remove', 'round_hydrate', 'round_outbox_entry',
      'sign_in', 'update'
    )
  ),
  outcome text CHECK (
    outcome IS NULL OR outcome IN (
      'cleared', 'completed', 'conflict', 'email_not_confirmed', 'enqueued',
      'error', 'idle', 'invalid_credentials', 'invalid_input', 'partial',
      'provider_error', 'queued', 'rate_limited', 'redirect_started', 'saved',
      'success', 'sync_complete', 'sync_error', 'sync_start', 'unavailable',
      'unexpected_error', 'unhealthy', 'unknown'
    )
  ),
  feature text CHECK (
    feature IS NULL OR feature IN (
      'assessment_plan', 'clinical_summary', 'daily-summary', 'daily_summary',
      'date_organizer', 'differential_diagnosis', 'documentation_check',
      'interval_events', 'interval_events_generator', 'medical_correction',
      'medications', 'neuro_icu_hpi', 'patient_course', 'problem_list',
      'public_funnel', 'round-sync', 'smart_draft', 'smart_expand',
      'soap_format', 'system_based_rounds', 'text_transform', 'todos',
      'transcription'
    )
  ),
  provider text CHECK (
    provider IS NULL OR provider IN (
      'apple', 'gemini', 'google', 'grok', 'openai', 'password'
    )
  ),
  event_type text CHECK (
    event_type IS NULL OR event_type IN ('metric', 'product_analytics')
  ),
  event_count integer CHECK (
    event_count IS NULL OR event_count BETWEEN 0 AND 1000000
  ),
  duration_ms integer CHECK (
    duration_ms IS NULL OR duration_ms BETWEEN 0 AND 86400000
  ),
  status_code integer CHECK (
    status_code IS NULL OR status_code BETWEEN 100 AND 599
  ),
  CHECK (
    (event_name = 'metric'
      AND metric_name IS NOT NULL
      AND metric_value IS NOT NULL
      AND metric_unit IS NOT NULL
      AND event_type = 'metric')
    OR
    (event_name <> 'metric'
      AND metric_name IS NULL
      AND metric_value IS NULL
      AND metric_unit IS NULL)
  )
);

ALTER TABLE public.client_observability_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_observability_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.client_observability_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.client_observability_events
  TO service_role;

CREATE INDEX idx_client_observability_received_at
  ON public.client_observability_events (received_at DESC);
CREATE INDEX idx_client_observability_event_received_at
  ON public.client_observability_events (event_name, received_at DESC);
CREATE INDEX idx_client_observability_metric_received_at
  ON public.client_observability_events (metric_name, received_at DESC)
  WHERE metric_name IS NOT NULL;

COMMENT ON TABLE public.client_observability_events IS
  '30-day fixed-vocabulary operational events only. Never store clinical content, identifiers, URLs, user agents, raw context, or browser session IDs.';

CREATE OR REPLACE FUNCTION public.purge_expired_client_observability_events()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM public.client_observability_events
  WHERE received_at < clock_timestamp() - interval '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.purge_expired_client_observability_events()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_client_observability_events()
  TO service_role;

COMMENT ON FUNCTION public.purge_expired_client_observability_events() IS
  'Service-role-only retention boundary for PHI-free browser observability.';

NOTIFY pgrst, 'reload schema';
