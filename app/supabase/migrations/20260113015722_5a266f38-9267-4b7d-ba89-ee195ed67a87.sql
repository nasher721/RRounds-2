-- Add imaging and labs columns to patients table
ALTER TABLE public.patients 
ADD COLUMN imaging TEXT NOT NULL DEFAULT '';

ALTER TABLE public.patients 
ADD COLUMN labs TEXT NOT NULL DEFAULT '';