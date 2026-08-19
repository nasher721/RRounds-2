-- Create table to track field change history
CREATE TABLE public.patient_field_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying by patient and field
CREATE INDEX idx_patient_field_history_patient ON public.patient_field_history(patient_id);
CREATE INDEX idx_patient_field_history_field ON public.patient_field_history(patient_id, field_name);
CREATE INDEX idx_patient_field_history_time ON public.patient_field_history(changed_at DESC);

-- Enable Row Level Security
ALTER TABLE public.patient_field_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own field history" 
ON public.patient_field_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own field history" 
ON public.patient_field_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own field history" 
ON public.patient_field_history 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add comment for clarity
COMMENT ON TABLE public.patient_field_history IS 'Tracks change history for patient fields to support revision viewing';