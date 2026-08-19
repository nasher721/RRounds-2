# Supabase Postgres optimization

Summary of optimizations applied and recommended dashboard/config settings (Supabase Postgres best practices).

**Applied via Supabase plugin:** The migration `optimize_postgres_indexes_rls` was applied to the **RollingRounds** project (`zsavxqvnseqxusfwdovu`) using the Supabase MCP/plugin. If your app uses a different project (e.g. `project_id` in `supabase/config.toml`), run the same migration there via Dashboard SQL Editor or `supabase db push`.

## Applied in migrations

### 1. Indexes (query + schema)

- **Foreign keys / RLS columns**  
  Indexes added so WHERE/JOIN and RLS checks use index scans instead of full table scans:
  - `patient_todos`: `patient_id`, `user_id`
  - `autotexts`, `templates`: `user_id`
  - `phrase_folders`: `user_id`, `parent_id`, `team_id`
  - `phrase_teams`: `owner_id`
  - `phrase_team_members`: `team_id`, `user_id`
  - `phrase_usage_log`: `phrase_id`, `patient_id`
  - `patient_field_history`: `user_id`

### 2. RLS policy performance

- **`(SELECT auth.uid())` instead of `auth.uid()`**  
  Policies on `patients`, `patient_todos`, `autotexts`, `templates`, `user_settings`, `user_dictionary`, and `patient_field_history` now use `(SELECT auth.uid()) = user_id` so the UID is evaluated once per query instead of per row.
- Duplicate patient policies from the RxDB migration were dropped so only one set of optimized policies remains.

### 3. Extensions

- `pg_stat_statements` is enabled (in the initial migration) for query analysis.

---

## Recommended Supabase Dashboard / connection settings

These are applied in the Supabase project (Dashboard or support), not in app code.

### Connection pooling

- Use the **connection pooler** (PgBouncer) for all application connections.
- Prefer **transaction mode** for serverless/Edge Functions so connections are returned after each transaction and you can support many more concurrent clients.
- Use the **pooler connection string** (e.g. `...pooler.supabase.com` with port 6543) in the app and Edge Functions, not the direct Postgres port.

### Timeouts (if configurable)

- **Idle in transaction**: e.g. 30s so idle-in-transaction sessions don’t hold connections.
- **Idle session**: e.g. 10 minutes so fully idle connections are closed.
- Exact names and defaults depend on Supabase; set in Dashboard → Database → Settings or via support.

### Monitoring

- Use **Database → Query Performance** (and `pg_stat_statements`) to find slow or heavy queries.
- Use **Database → Roles** or `pg_stat_activity` to monitor connection count and state.

---

## References

- [Supabase connection pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Postgres query optimization](https://www.postgresql.org/docs/current/performance-tips.html)
