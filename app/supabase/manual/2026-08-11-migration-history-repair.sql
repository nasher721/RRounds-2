-- Phase 2 prerequisite: reconcile supabase_migrations.schema_migrations with reality.
-- All versions below are ALREADY reflected in the production schema (verified
-- 2026-08-11 via information_schema / pg_trigger / pg_extension probes) but were
-- never recorded because past deploys ran through out-of-band tooling.
-- Metadata-only repair; ON CONFLICT protects against double-insert.

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20240101000000', 'add_rxdb_replication_fields'),
  ('20250315120000', 'optimize_postgres_indexes_rls'),
  ('20260107095735', 'remix_migration_from_pg_dump'),
  ('20260107095956', 'ca39473a-8f89-4042-9a47-8141695d5620'),
  ('20260113015722', '5a266f38-9267-4b7d-ba89-ee195ed67a87'),
  ('20260113020405', 'cb7df904-51d7-47ec-b234-25d574d6cc6f'),
  ('20260114114831', '2b045aa2-ed52-409c-a878-02de1fcf15dc'),
  ('20260114215452', '6c7b4ac5-427f-448c-bd7d-da4612292ca2'),
  ('20260116015022', '8f9db65c-9058-4230-90ba-b5aed25460e2'),
  ('20260116123558', '56e47781-f22e-478b-9f3b-400ca9c4080b'),
  ('20260116124035', '2b2c47a7-e622-45f0-8aed-dc76e69b484d'),
  ('20260116211953', '76e684f0-801f-46cd-8280-d18ddf9f02bd'),
  ('20260121011807', '48740d9d-cf1e-496c-a337-c7be90e94d9f'),
  ('20260121090741', 'f2e016ae-b0ae-4d8f-9475-b1bd384d8245'),
  ('20260201090000', 'add_user_settings_preferences'),
  ('20260203111509', '249ec965-509e-4aa0-a901-499dda472b28'),
  ('20260205190811', '53775f4e-5179-4c57-b663-686ce92b671e'),
  ('20260214025733', '3362bb0d-579a-409b-b979-ae29dbc4229c'),
  ('20260322120000', 'add_mrn_to_patients'),
  ('20260323000000', 'add_missing_patient_columns')
ON CONFLICT (version) DO NOTHING;
