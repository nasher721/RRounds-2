ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS app_preferences JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS print_settings JSONB DEFAULT '{}'::jsonb;
