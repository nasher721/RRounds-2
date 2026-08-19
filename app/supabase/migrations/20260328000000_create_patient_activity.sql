-- Create patient_activity table for tracking per-patient activity events.
-- This provides a lightweight activity feed showing: created, updated, assigned, exported, AI used events.
-- NOTE: Does NOT store PHI content - only summary information.

CREATE TABLE IF NOT EXISTS public.patient_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'assigned', 'exported', 'ai_used')),
  field_name text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Index for efficient queries by patient
CREATE INDEX IF NOT EXISTS idx_patient_activity_patient_id ON public.patient_activity(patient_id DESC);

-- Index for efficient queries by user
CREATE INDEX IF NOT EXISTS idx_patient_activity_user_id ON public.patient_activity(user_id);

-- Index for efficient queries by action
CREATE INDEX IF NOT EXISTS idx_patient_activity_action ON public.patient_activity(action);

-- Enable RLS
ALTER TABLE public.patient_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policy: users can only view their own patients' activity
CREATE POLICY "Users can view activity for their own patients"
  ON public.patient_activity FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: users can insert their own activity
CREATE POLICY "Users can insert activity for their own patients"
  ON public.patient_activity FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE user_id = auth.uid()
    )
  );

-- Column documentation
COMMENT ON TABLE public.patient_activity IS 'Per-patient activity feed tracking created, updates, assignments, exports, and AI usage';
COMMENT ON COLUMN public.patient_activity.patient_id IS 'Reference to the patient this activity belongs to';
COMMENT ON COLUMN public.patient_activity.user_id IS 'User who performed the action (nullable for system actions)';
COMMENT ON COLUMN public.patient_activity.action IS 'Type of action: created, updated, assigned, exported, ai_used';
COMMENT ON COLUMN public.patient_activity.field_name IS 'Optional field name for update events (e.g., clinicalSummary, systems.neuro)';
COMMENT ON COLUMN public.patient_activity.summary IS 'Optional brief summary (e.g., "5 fields updated", "PDF exported") - NO PHI content';
COMMENT ON COLUMN public.patient_activity.created_at IS 'Timestamp of when the action occurred';

-- Ensure PostgREST picks up the new table immediately.
NOTIFY pgrst, 'reload schema';
