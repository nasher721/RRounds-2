/**
 * Builds JSON payload for Supabase MCP deploy_edge_function from supabase/functions/.
 *
 * verify_jwt is read from supabase/config.toml for [functions.<slug>] (defaults false).
 * This repo keeps gateway JWT off for all functions: user access tokens may be ES256 while
 * the Edge gateway only validates legacy HS256 JWTs. Auth runs in-handler via
 * authenticateRequest() (healthcheck is public by design).
 *
 * Usage: node scripts/build-mcp-edge-bundle.mjs <function-slug>
 * Optional: SUPABASE_PROJECT_REF overrides project_id from config.toml
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(process.cwd(), 'supabase/functions')
const configPath = path.join(process.cwd(), 'supabase/config.toml')

function readConfigToml() {
  return fs.readFileSync(configPath, 'utf8')
}

function parseProjectId(toml) {
  const m = toml.match(/^project_id\s*=\s*"([^"]+)"/m)
  return m?.[1] ?? null
}

/** Split on newline before a [section] header */
function tomlSections(toml) {
  return toml.split(/\n(?=\[)/)
}

function parseFunctionVerifyJwt(toml, slug) {
  const header = `[functions.${slug}]`
  const block = tomlSections(toml).find((s) => s.trimStart().startsWith(header))
  if (!block) {
    console.warn(
      `Warning: no ${header} in config.toml — defaulting verify_jwt false (match supabase CLI / this repo)`,
    )
    return false
  }
  const m = block.match(/verify_jwt\s*=\s*(true|false)/)
  return m ? m[1] === 'true' : false
}

const slug = process.argv[2]
if (!slug) {
  console.error('Usage: node scripts/build-mcp-edge-bundle.mjs <function-slug>')
  process.exit(1)
}

const toml = readConfigToml()
const projectId =
  process.env.SUPABASE_PROJECT_REF?.trim() || parseProjectId(toml)
if (!projectId) {
  console.error(
    'Could not determine project_id: set SUPABASE_PROJECT_REF or project_id in supabase/config.toml',
  )
  process.exit(1)
}

const verifyJwt = parseFunctionVerifyJwt(toml, slug)

/** healthcheck only needs CORS helpers; keep MCP deploy payload small */
const sharedFiles =
  slug === 'healthcheck'
    ? ['_shared/cors.ts']
    : [
        '_shared/mod.ts',
        '_shared/auth.ts',
        '_shared/cors.ts',
        '_shared/llm-client.ts',
        '_shared/rate-limit.ts',
        '_shared/input-validation.ts',
      ]

const files = []
files.push({
  name: `functions/${slug}/index.ts`,
  content: fs.readFileSync(path.join(root, slug, 'index.ts'), 'utf8'),
})
for (const rel of sharedFiles) {
  files.push({
    name: `functions/${rel}`,
    content: fs.readFileSync(path.join(root, rel), 'utf8'),
  })
}

const payload = {
  project_id: projectId,
  name: slug,
  entrypoint_path: `functions/${slug}/index.ts`,
  verify_jwt: verifyJwt,
  files,
}

process.stdout.write(JSON.stringify(payload))
