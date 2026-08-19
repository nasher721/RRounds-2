-- Add field_timestamps column to track when each field was last modified
ALTER TABLE public.patients 
ADD COLUMN field_timestamps JSONB DEFAULT '{}'::jsonb;

-- Add a comment for clarity
COMMENT ON COLUMN public.patients.field_timestamps IS 'Tracks last modification time for each field (clinicalSummary, intervalEvents, imaging, labs, systems.*)';
