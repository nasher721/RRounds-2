-- Phase 2: Add clinical patient fields for enhanced rounding workflow.
-- These fields support service line tracking, physician assignment, acuity scoring,
-- code status documentation, clinical alerts, and vitals capture.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS service_line TEXT,
  ADD COLUMN IF NOT EXISTS attending_physician TEXT,
  ADD COLUMN IF NOT EXISTS consulting_team TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS acuity TEXT CHECK (acuity IS NULL OR acuity IN ('low', 'moderate', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS code_status TEXT CHECK (code_status IS NULL OR code_status IN ('full', 'dnr', 'dni', 'comfort')),
  ADD COLUMN IF NOT EXISTS alerts TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vitals JSONB DEFAULT '{"lastRecorded":null,"temp":null,"hr":null,"bp":null,"rr":null,"spo2":null}';

-- Column documentation for developer reference
COMMENT ON COLUMN public.patients.service_line IS 'Hospital service line or unit (e.g., ICU, MICU, SICU, Cardiology, Medicine)';
COMMENT ON COLUMN public.patients.attending_physician IS 'Primary attending physician name or identifier';
COMMENT ON COLUMN public.patients.consulting_team IS 'Array of consulting team names or services';
COMMENT ON COLUMN public.patients.acuity IS 'Patient acuity level: low, moderate, high, or critical';
COMMENT ON COLUMN public.patients.code_status IS 'Code status: full (full code), dnr (do not resuscitate), dni (do not intubate), comfort (comfort care)';
COMMENT ON COLUMN public.patients.alerts IS 'Clinical alerts array (e.g., allergies, isolation precautions, fall risk)';
COMMENT ON COLUMN public.patients.vitals IS 'Structured vitals object: {lastRecorded, temp, hr, bp, rr, spo2}';

-- Ensure PostgREST picks up the new columns immediately.
NOTIFY pgrst, 'reload schema';
