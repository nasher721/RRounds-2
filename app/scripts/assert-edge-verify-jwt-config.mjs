/**
 * Fails CI if any [functions.*] block sets verify_jwt = true.
 * Gateway JWT verification rejects ES256 user access tokens in this setup; auth is in-handler.
 */
import fs from 'node:fs'
import path from 'node:path'

const configPath = path.join(process.cwd(), 'supabase/config.toml')
const cfg = fs.readFileSync(configPath, 'utf8')
const sections = cfg.split(/\n(?=\[)/)
const configuredFunctions = new Map()

for (const sec of sections) {
  const t = sec.trimStart()
  if (!t.startsWith('[functions.')) continue
  const nameMatch = t.match(/^\[functions\.([^\]]+)\]/)
  const fnName = nameMatch?.[1]
  const jwtMatch = t.match(/verify_jwt\s*=\s*(true|false)/)
  if (!fnName || !jwtMatch) {
    console.error(
      `assert-edge-verify-jwt-config: function section ${fnName ?? '(unknown)'} must explicitly set verify_jwt.`,
    )
    process.exit(1)
  }
  configuredFunctions.set(fnName, jwtMatch[1])
  if (jwtMatch[1] === 'true') {
    console.error(
      `assert-edge-verify-jwt-config: [functions.${fnName}] has verify_jwt = true.`,
    )
    console.error(
      'This breaks signed-in calls when access tokens are ES256: the Edge gateway validates with legacy HS256.',
    )
    console.error(
      'Set verify_jwt = false and rely on authenticateRequest() (see supabase/config.toml header comment).',
    )
    process.exit(1)
  }
}

const functionsRoot = path.join(process.cwd(), 'supabase/functions')
const leastPrivilegeHealthchecks = new Set(['healthcheck'])
const publicTelemetryFunctions = new Set(['telemetry'])
const deployedFunctions = fs.readdirSync(functionsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .filter((entry) => fs.existsSync(path.join(functionsRoot, entry.name, 'index.ts')))
  .map((entry) => entry.name)

for (const fnName of deployedFunctions) {
  if (configuredFunctions.get(fnName) !== 'false') {
    console.error(
      `assert-edge-verify-jwt-config: [functions.${fnName}] must explicitly set verify_jwt = false.`,
    )
    process.exit(1)
  }
  const handlerPath = path.join(functionsRoot, fnName, 'index.ts')
  const handler = fs.readFileSync(handlerPath, 'utf8')
  if (leastPrivilegeHealthchecks.has(fnName)) {
    if (/SUPABASE_SERVICE_ROLE_KEY|checkRateLimit\s*\(/.test(handler)) {
      console.error(
        `assert-edge-verify-jwt-config: healthcheck ${fnName}/index.ts uses a privileged database path.`,
      )
      console.error(
        'Healthcheck must not use the service-role key or the service-role-backed rate limiter.',
      )
      process.exit(1)
    }
    if (!/SUPABASE_ANON_KEY/.test(handler)) {
      console.error(
        `assert-edge-verify-jwt-config: public function ${fnName}/index.ts must use the anonymous key for database connectivity checks.`,
      )
      process.exit(1)
    }
    if (!/\.rpc\(\s*["']healthcheck_database["']/.test(handler)) {
      console.error(
        `assert-edge-verify-jwt-config: public function ${fnName}/index.ts must use the dedicated healthcheck_database RPC.`,
      )
      process.exit(1)
    }
    if (/\.from\s*\(/.test(handler)) {
      console.error(
        `assert-edge-verify-jwt-config: public function ${fnName}/index.ts must not query application tables.`,
      )
      process.exit(1)
    }
    if (!/HEALTHCHECK_TOKEN/.test(handler) || !/x-healthcheck-token/.test(handler)) {
      console.error(
        `assert-edge-verify-jwt-config: ${fnName}/index.ts must require the dedicated monitor secret when no user session is present.`,
      )
      process.exit(1)
    }
  }

  if (publicTelemetryFunctions.has(fnName)) {
    for (const requiredPattern of [
      /checkRateLimit\s*\(\s*req\s*,\s*RATE_LIMITS\.telemetry\s*\)/,
      /parseTelemetryBatch\s*\(/,
      /MAX_TELEMETRY_PAYLOAD_BYTES/,
      /SUPABASE_SERVICE_ROLE_KEY/,
      /\.from\(\s*["']client_observability_events["']\s*\)/,
      /\.rpc\(\s*["']purge_expired_client_observability_events["']/,
    ]) {
      if (!requiredPattern.test(handler)) {
        console.error(
          `assert-edge-verify-jwt-config: public telemetry handler ${fnName}/index.ts is missing a required validation, rate-limit, storage, or retention boundary.`,
        )
        process.exit(1)
      }
    }
  }

  if (
    !leastPrivilegeHealthchecks.has(fnName)
    && !publicTelemetryFunctions.has(fnName)
    && !/await\s+authenticateRequest\s*\(\s*req\s*\)/.test(handler)
  ) {
    console.error(
      `assert-edge-verify-jwt-config: ${fnName}/index.ts does not authenticate the request handler.`,
    )
    console.error(
      'Every non-public function must await authenticateRequest(req) while gateway JWT verification is disabled.',
    )
    process.exit(1)
  }
}

console.log(
  `Edge auth config OK: ${deployedFunctions.length - leastPrivilegeHealthchecks.size - publicTelemetryFunctions.size} authenticated handlers; healthcheck and telemetry satisfy dedicated least-privilege public policies.`,
)
