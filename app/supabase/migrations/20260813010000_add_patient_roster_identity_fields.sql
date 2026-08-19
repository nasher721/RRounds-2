-- Preserve structured identity fields already offered by CSV/EHR import.
-- These values must not be flattened into free-text clinical notes.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS admission_date timestamptz;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_gender_valid'
      AND conrelid = 'public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_gender_valid
      CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'unknown'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_date_of_birth_valid'
      AND conrelid = 'public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_date_of_birth_valid
      CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE)
      NOT VALID;
  END IF;
END;
$constraints$;

COMMENT ON COLUMN public.patients.date_of_birth IS
  'Patient date of birth supplied by an approved roster/EHR source; never inferred from notes.';
COMMENT ON COLUMN public.patients.gender IS
  'Normalized administrative sex/gender value supplied by an approved roster/EHR source.';
COMMENT ON COLUMN public.patients.admission_date IS
  'Timestamp for the current admission when supplied by the source roster.';

NOTIFY pgrst, 'reload schema';
