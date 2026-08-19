-- Create table for custom dictionary entries
CREATE TABLE public.user_dictionary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  misspelling TEXT NOT NULL,
  correction TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, misspelling)
);

-- Enable Row Level Security
ALTER TABLE public.user_dictionary ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own dictionary entries"
ON public.user_dictionary
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dictionary entries"
ON public.user_dictionary
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dictionary entries"
ON public.user_dictionary
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dictionary entries"
ON public.user_dictionary
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_dictionary_user_id ON public.user_dictionary(user_id);
CREATE INDEX idx_user_dictionary_misspelling ON public.user_dictionary(misspelling);