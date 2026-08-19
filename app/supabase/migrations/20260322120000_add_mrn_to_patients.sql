-- Optional medical record number for patient identification and handoffs
alter table public.patients
  add column if not exists mrn text not null default '';

comment on column public.patients.mrn is 'Medical record number or hospital ID (optional; empty string when unknown)';
