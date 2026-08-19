-- Today’s Round session continuity (position, filters, expanded system, walk state).
-- One active Round per user in v1; chart drafts continue to live on patients.

CREATE TABLE IF NOT EXISTS public.round_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  position_updated_at timestamptz NOT NULL DEFAULT NOW(),
  expanded_updated_at timestamptz NOT NULL DEFAULT NOW(),
  device_id text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_round_state_one_active_per_user
  ON public.round_state (user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_round_state_user_updated
  ON public.round_state (user_id, updated_at DESC);

ALTER TABLE public.round_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own round state"
  ON public.round_state FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own round state"
  ON public.round_state FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own round state"
  ON public.round_state FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own round state"
  ON public.round_state FOR DELETE
  USING (user_id = auth.uid());

COMMENT ON TABLE public.round_state IS 'Today''s Round session continuity for Focus-first runner (position, filters, expanded system)';
COMMENT ON COLUMN public.round_state.state IS 'Serialized Round session JSON (patients walk flags, filters, section, etc.)';
COMMENT ON COLUMN public.round_state.position_updated_at IS 'Newest device navigation wins on merge';
COMMENT ON COLUMN public.round_state.expanded_updated_at IS 'Last-focused expanded system wins on merge';

NOTIFY pgrst, 'reload schema';
