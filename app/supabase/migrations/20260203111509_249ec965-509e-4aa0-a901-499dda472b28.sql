-- Add app_preferences and print_settings columns to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS app_preferences jsonb DEFAULT '{}' ::jsonb,
ADD COLUMN IF NOT EXISTS print_settings jsonb DEFAULT '{}' ::jsonb;