-- Provider credentials are memory-only. Remove values written by older clients
-- without disturbing unrelated preferences or non-object legacy rows.
UPDATE public.user_settings
SET app_preferences = app_preferences - 'aiCredentials'
WHERE jsonb_typeof(app_preferences) = 'object'
  AND app_preferences ? 'aiCredentials';
