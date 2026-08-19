-- Add medications column to patients table
ALTER TABLE public.patients 
ADD COLUMN medications jsonb DEFAULT '{"infusions": [], "scheduled": [], "prn": [], "rawText": ""}'::jsonb;