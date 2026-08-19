import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(repositoryRoot, "supabase", "migrations");
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

const historicalRxdbMigration = "20240101000000_add_rxdb_replication_fields.sql";
const historicalOptimizationMigration = "20250315120000_optimize_postgres_indexes_rls.sql";
const catchUpMigration = "20260711000000_replay_deferred_schema_hardening.sql";
const privateImagesMigration = "20260205190811_53775f4e-5179-4c57-b663-686ce92b671e.sql";
const childOwnershipMigration = "20260711200000_harden_child_record_ownership.sql";
const distributedRateLimitsMigration = "20260811014046_add_distributed_edge_rate_limits.sql";
const backendContractMigration = "20260812000000_harden_patient_and_round_contracts.sql";
const publicSurfaceMigration = "20260813000000_harden_public_database_surface.sql";
const observabilityMigration = "20260813020000_create_client_observability_sink.sql";

const readMigration = async (file) =>
  readFile(path.join(migrationsDirectory, file), "utf8");

const collectSourceFiles = async (directory) => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(entryPath));
    } else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const requiredFile of [
  historicalRxdbMigration,
  historicalOptimizationMigration,
  catchUpMigration,
  privateImagesMigration,
  childOwnershipMigration,
  distributedRateLimitsMigration,
  backendContractMigration,
  publicSurfaceMigration,
  observabilityMigration,
]) {
  assert(migrationFiles.includes(requiredFile), `Missing migration: ${requiredFile}`);
}

const rxdbSql = await readMigration(historicalRxdbMigration);
assert.match(
  rxdbSql,
  /to_regclass\('public\.patients'\) IS NULL/i,
  "The historical RxDB migration must skip table work until public.patients exists",
);

const deferredRelations = [
  "patients",
  "patient_todos",
  "autotexts",
  "templates",
  "phrase_folders",
  "phrase_teams",
  "phrase_team_members",
  "phrase_usage_log",
  "patient_field_history",
  "user_settings",
  "user_dictionary",
];

const optimizationSql = await readMigration(historicalOptimizationMigration);
for (const relation of deferredRelations) {
  assert.match(
    optimizationSql,
    new RegExp(`to_regclass\\('public\\.${escapeRegExp(relation)}'\\) IS NULL`, "i"),
    `The historical optimization migration must guard public.${relation}`,
  );
}

const catchUpIndex = migrationFiles.indexOf(catchUpMigration);
for (const relation of deferredRelations) {
  const createPattern = new RegExp(
    `CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+public\\.${escapeRegExp(relation)}\\b`,
    "i",
  );
  const creatorIndex = await (async () => {
    for (let index = 0; index < migrationFiles.length; index += 1) {
      if (createPattern.test(await readMigration(migrationFiles[index]))) return index;
    }
    return -1;
  })();

  assert.notEqual(creatorIndex, -1, `No migration creates public.${relation}`);
  assert(
    creatorIndex < catchUpIndex,
    `The catch-up migration runs before public.${relation} is created`,
  );
}

const catchUpSql = await readMigration(catchUpMigration);
for (const requiredIndex of [
  "idx_patients_modified",
  "idx_patients_user_modified",
  "idx_patient_todos_patient_id",
  "idx_patient_todos_user_id",
  "idx_autotexts_user_id",
  "idx_templates_user_id",
  "idx_phrase_folders_user_id",
  "idx_phrase_folders_parent_id",
  "idx_phrase_folders_team_id",
  "idx_phrase_teams_owner_id",
  "idx_phrase_team_members_team_id",
  "idx_phrase_team_members_user_id",
  "idx_phrase_usage_log_phrase_id",
  "idx_phrase_usage_log_patient_id",
  "idx_patient_field_history_user_id",
]) {
  assert.match(
    catchUpSql,
    new RegExp(`CREATE\\s+INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+${requiredIndex}\\b`, "i"),
    `The catch-up migration is missing ${requiredIndex}`,
  );
}

assert.match(catchUpSql, /ADD COLUMN IF NOT EXISTS _modified bigint/i);
assert.match(catchUpSql, /ADD COLUMN IF NOT EXISTS _deleted boolean/i);
assert.match(catchUpSql, /CREATE TRIGGER trigger_patients_modified/i);

for (const relation of [
  "patients",
  "patient_todos",
  "autotexts",
  "templates",
  "user_settings",
  "user_dictionary",
  "patient_field_history",
]) {
  assert.match(
    catchUpSql,
    new RegExp(`ALTER\\s+TABLE\\s+public\\.${relation}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, "i"),
    `The catch-up migration does not explicitly enable RLS on public.${relation}`,
  );
}

for (const policyName of [
  "Users can view their own patients",
  "Users can create their own patients",
  "Users can update their own patients",
  "Users can delete their own patients",
  "Users can view their own todos",
  "Users can create their own todos",
  "Users can update their own todos",
  "Users can delete their own todos",
  "Users can view their own autotexts",
  "Users can create their own autotexts",
  "Users can update their own autotexts",
  "Users can delete their own autotexts",
  "Users can view their own templates",
  "Users can create their own templates",
  "Users can update their own templates",
  "Users can delete their own templates",
  "Users can view their own settings",
  "Users can create their own settings",
  "Users can update their own settings",
  "Users can view their own dictionary entries",
  "Users can create their own dictionary entries",
  "Users can update their own dictionary entries",
  "Users can delete their own dictionary entries",
  "Users can view their own field history",
  "Users can create their own field history",
  "Users can delete their own field history",
]) {
  assert.match(
    catchUpSql,
    new RegExp(`CREATE\\s+POLICY\\s+"${escapeRegExp(policyName)}"`, "i"),
    `The catch-up migration is missing policy: ${policyName}`,
  );
}

for (const match of catchUpSql.matchAll(/CREATE POLICY\s+"([^"]+)"/gi)) {
  const policyName = match[1];
  const precedingSql = catchUpSql.slice(0, match.index);
  assert.match(
    precedingSql,
    new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${escapeRegExp(policyName)}"`, "i"),
    `Policy ${policyName} is not dropped before it is recreated`,
  );
}

assert.doesNotMatch(
  catchUpSql,
  /storage\.buckets|Public can view patient images/i,
  "The catch-up migration must not alter patient-images privacy",
);

const childOwnershipSql = await readMigration(childOwnershipMigration);
for (const relation of ["patient_todos", "patient_field_history"]) {
  assert.match(
    childOwnershipSql,
    new RegExp(
      `ON\\s+public\\.${relation}[\\s\\S]+?patient\\.id\\s*=\\s*patient_id[\\s\\S]+?patient\\.user_id\\s*=\\s*auth\\.uid\\(\\)`,
      "i",
    ),
    `${relation} policies must bind child rows to a patient owned by auth.uid()`,
  );
}
assert.match(
  childOwnershipSql,
  /phrase_usage_log_metadata_only[\s\S]*CHECK\s*\(input_values IS NULL AND inserted_content IS NULL\)[\s\S]*NOT VALID/i,
  "Phrase usage must reject new expanded clinical content without purging legacy rows",
);

const backendContractSql = await readMigration(backendContractMigration);
for (const column of [
  "age",
  "service_line",
  "attending_physician",
  "consulting_team",
  "acuity",
  "code_status",
  "alerts",
  "vitals",
  "assigned_to",
]) {
  assert.match(
    backendContractSql,
    new RegExp(`ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+${column}\\b`, "i"),
    `Backend contract migration is missing patients.${column}`,
  );
}
assert.match(
  backendContractSql,
  /CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_user_patient_number/i,
  "Patient ordering must be unique within an owner",
);
assert.match(
  backendContractSql,
  /CREATE OR REPLACE FUNCTION public\.upsert_owned_round_state/i,
  "Round state must be persisted through the authenticated atomic RPC",
);
assert.match(
  backendContractSql,
  /pg_advisory_xact_lock/i,
  "Round state creation must serialize concurrent first writes",
);
assert.match(
  childOwnershipSql,
  /REVOKE SELECT, INSERT ON TABLE public\.phrase_usage_log FROM authenticated/i,
  "Browser roles must not retain table-wide access to legacy phrase payloads",
);

const publicSurfaceSql = await readMigration(publicSurfaceMigration);
assert.match(
  publicSurfaceSql,
  /DROP EXTENSION IF EXISTS pg_graphql/i,
  "The unused GraphQL database surface must be disabled",
);
for (const objectType of ["TABLES", "SEQUENCES", "ROUTINES"]) {
  assert.match(
    publicSurfaceSql,
    new RegExp(
      `REVOKE\\s+ALL\\s+ON\\s+ALL\\s+${objectType}\\s+IN\\s+SCHEMA\\s+public\\s+FROM\\s+PUBLIC,\\s*anon`,
      "i",
    ),
    `Anonymous users must not inherit public-schema ${objectType.toLowerCase()} access`,
  );
  if (objectType !== "ROUTINES") {
    assert.match(
      publicSurfaceSql,
      new RegExp(
        `ALTER\\s+DEFAULT\\s+PRIVILEGES\\s+FOR\\s+ROLE\\s+postgres\\s+IN\\s+SCHEMA\\s+public[\\s\\S]+?REVOKE\\s+ALL\\s+ON\\s+${objectType}\\s+FROM\\s+PUBLIC,\\s*anon`,
        "i",
      ),
      `Future public-schema ${objectType.toLowerCase()} must not default to anonymous access`,
    );
  }
}
assert.match(
  publicSurfaceSql,
  /ALTER DEFAULT PRIVILEGES FOR ROLE postgres\s+REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/i,
  "PostgreSQL's global PUBLIC function default must be revoked for future routines",
);
assert.match(
  publicSurfaceSql,
  /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE ALL ON ROUTINES FROM anon/i,
  "Supabase's schema-scoped anon routine default must be revoked",
);
assert.match(
  publicSurfaceSql,
  /CREATE OR REPLACE FUNCTION public\.healthcheck_database\(\)/i,
  "The protected Edge healthcheck needs a dedicated database probe",
);
assert.match(
  publicSurfaceSql,
  /GRANT EXECUTE ON FUNCTION public\.healthcheck_database\(\) TO anon/i,
  "Only the dedicated database probe should be restored to anon",
);
assert.match(
  publicSurfaceSql,
  /roles\s*=\s*ARRAY\['public'\]::name\[\]/i,
  "Legacy PUBLIC-scoped owner policies must be identified explicitly",
);
assert.match(
  publicSurfaceSql,
  /ALTER POLICY %I ON %I\.%I TO authenticated/i,
  "Legacy owner policies must be narrowed to authenticated",
);
assert.match(
  publicSurfaceSql,
  /procedure\.proname\s*=\s*'rls_auto_enable'[\s\S]*REVOKE ALL ON FUNCTION/i,
  "Legacy rls_auto_enable overloads must be unavailable to browser roles",
);
for (const sourceRoot of ["src", path.join("supabase", "functions")]) {
  for (const sourceFile of await collectSourceFiles(path.join(repositoryRoot, sourceRoot))) {
    const source = await readFile(sourceFile, "utf8");
    assert.doesNotMatch(
      source,
      /\/graphql\/v1|graphql\.resolve|from\s+["'](?:@apollo|graphql-request)/i,
      `GraphQL is disabled but ${path.relative(repositoryRoot, sourceFile)} consumes it`,
    );
  }
}
const phraseUsageSelectGrant = childOwnershipSql.match(
  /GRANT SELECT\s*\([\s\S]*?\) ON TABLE public\.phrase_usage_log TO authenticated/i,
)?.[0] ?? "";
assert.doesNotMatch(
  phraseUsageSelectGrant,
  /input_values|inserted_content/i,
  "Browser roles must not be able to read legacy phrase payload columns",
);
assert.match(
  childOwnershipSql,
  /phrase\.id\s*=\s*phrase_id[\s\S]*phrase\.user_id\s*=\s*auth\.uid\(\)/i,
  "Phrase usage rows must reference a phrase owned by auth.uid()",
);

const observabilitySql = await readMigration(observabilityMigration);
assert.match(
  observabilitySql,
  /CREATE TABLE public\.client_observability_events/i,
  "The first-party client observability sink must have a durable store",
);
assert.match(
  observabilitySql,
  /ALTER TABLE public\.client_observability_events FORCE ROW LEVEL SECURITY/i,
  "The observability store must enforce RLS even for ordinary table owners",
);
assert.match(
  observabilitySql,
  /REVOKE ALL ON TABLE public\.client_observability_events[\s\S]*FROM PUBLIC, anon, authenticated/i,
  "Browser roles must not directly access central observability rows",
);
assert.match(
  observabilitySql,
  /purge_expired_client_observability_events[\s\S]*interval '30 days'/i,
  "Central observability must enforce its bounded retention period",
);
assert.doesNotMatch(
  observabilitySql,
  /\b(?:patient_id|patient_name|clinical_note|raw_context|session_id|user_agent|request_url)\s+(?:text|uuid|jsonb?)/i,
  "The observability store must not add clinical, identifying, or arbitrary payload columns",
);
assert.match(
  childOwnershipSql,
  /patient_id IS NULL[\s\S]*patient\.id\s*=\s*patient_id[\s\S]*patient\.user_id\s*=\s*auth\.uid\(\)/i,
  "Phrase usage patient references must be null or owned by auth.uid()",
);
assert.match(
  childOwnershipSql,
  /SECURITY DEFINER[\s\S]*SET search_path = ''[\s\S]*folder\.id\s*=\s*target_folder_id[\s\S]*folder\.user_id\s*=\s*auth\.uid\(\)/i,
  "Nested phrase folders must belong to the authenticated owner",
);
assert.match(
  childOwnershipSql,
  /team_id IS NULL[\s\S]*private\.can_manage_phrase_team\(team_id\)/i,
  "Team-linked phrase folders must belong to a team the user can manage",
);
assert.match(
  childOwnershipSql,
  /folder_id IS NULL[\s\S]*private\.is_owned_phrase_folder\(folder_id\)/i,
  "Clinical phrases must reference a folder owned by the authenticated user",
);

const distributedRateLimitsSql = await readMigration(distributedRateLimitsMigration);
assert.match(
  distributedRateLimitsSql,
  /CREATE TABLE IF NOT EXISTS public\.edge_rate_limits/i,
  "Distributed rate limits require durable shared state",
);
assert.match(
  distributedRateLimitsSql,
  /ON CONFLICT\s*\(rate_key\)\s*DO UPDATE/i,
  "Rate-limit quota consumption must be atomic",
);
assert.match(
  distributedRateLimitsSql,
  /SECURITY DEFINER[\s\S]*SET search_path = ''/i,
  "Rate-limit RPC must use a fixed search path",
);
assert.match(
  distributedRateLimitsSql,
  /REVOKE ALL ON FUNCTION public\.consume_edge_rate_limit\([^)]+\)\s+FROM PUBLIC/i,
  "Rate-limit RPC must not be callable by browser roles",
);
assert.match(
  distributedRateLimitsSql,
  /GRANT EXECUTE ON FUNCTION public\.consume_edge_rate_limit\([^)]+\)\s+TO service_role/i,
  "Only the Edge service role should consume distributed quota",
);

console.log(
  `Verified ${migrationFiles.length} migrations: historical guards, dependency order, RLS/anon isolation, and disabled unused GraphQL access.`,
);
