-- Revoke all privileges from anon role on sensitive tables containing PHI
REVOKE ALL ON public.patients FROM anon;
REVOKE ALL ON public.patient_todos FROM anon;
REVOKE ALL ON public.autotexts FROM anon;
REVOKE ALL ON public.templates FROM anon;
REVOKE ALL ON public.user_dictionary FROM anon;

-- Grant access only to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_todos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autotexts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_dictionary TO authenticated;