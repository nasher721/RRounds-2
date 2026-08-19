-- Create a trigger function that sets updated_at instead of last_modified
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Drop the old trigger on user_settings that uses the wrong function
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;

-- Create new trigger using the correct function
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();