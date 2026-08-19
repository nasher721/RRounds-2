-- Monotonic patient revisions let clients reject stale writes atomically.
-- This closes the read-then-write race between browser tabs and devices.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.bump_patient_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.revision = OLD.revision + 1;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS bump_patient_revision ON public.patients;
CREATE TRIGGER bump_patient_revision
BEFORE UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.bump_patient_revision();

COMMENT ON COLUMN public.patients.revision IS
  'Monotonic optimistic-concurrency revision; stale client writes must match before update.';
