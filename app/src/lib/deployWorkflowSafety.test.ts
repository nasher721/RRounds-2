import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

describe('Supabase deployment workflow', () => {
  it('publishes a production release identity instead of scaffold metadata', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
      name: string
      version: string
      description: string
    }
    const packageLock = JSON.parse(await readFile('package-lock.json', 'utf8')) as {
      name: string
      version: string
      packages: Record<string, { name?: string; version?: string }>
    }
    const bunLock = await readFile('bun.lock', 'utf8')
    const sbom = JSON.parse(
      await readFile('docs/security/sbom-2026-08-12.cyclonedx.json', 'utf8'),
    ) as {
      metadata: {
        component: { 'bom-ref': string; name: string; type: string; version: string }
      }
      dependencies: Array<{ ref: string }>
    }

    assert.equal(packageJson.name, 'rolling-rounds')
    assert.match(packageJson.version, /^[1-9]\d*\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/)
    assert.match(packageJson.description, /clinical rounding workspace/i)
    assert.equal(packageLock.name, packageJson.name)
    assert.equal(packageLock.version, packageJson.version)
    assert.equal(packageLock.packages['']?.name, packageJson.name)
    assert.equal(packageLock.packages['']?.version, packageJson.version)
    assert.match(bunLock, /"name": "rolling-rounds"/)
    assert.doesNotMatch(bunLock, /vite_react_shadcn_ts/)
    assert.equal(sbom.metadata.component['bom-ref'], 'rolling-rounds@1.0.0')
    assert.equal(sbom.metadata.component.type, 'application')
    assert.equal(sbom.metadata.component.name, 'rolling-rounds')
    assert.equal(sbom.metadata.component.version, '1.0.0')
    assert.ok(sbom.dependencies.some(({ ref }) => ref === 'rolling-rounds@1.0.0'))
  })

  it('deploys only a successful CI-verified main commit and rechecks destructive inputs', async () => {
    const workflow = await readFile('.github/workflows/deploy-supabase.yml', 'utf8')

    assert.match(workflow, /workflow_run:/)
    assert.match(workflow, /workflows:\s*\n\s*- CI/)
    assert.match(workflow, /branches:\s*\n\s*- main/)
    assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/)
    assert.match(workflow, /github\.event\.workflow_run\.event == 'push'/)
    assert.match(workflow, /github\.event\.workflow_run\.head_branch == 'main'/)
    assert.match(workflow, /github\.event\.workflow_run\.head_repository\.full_name == github\.repository/)
    assert.match(workflow, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/)
    assert.doesNotMatch(workflow, /on:\s*\n\s*push:/)
    assert.match(workflow, /group: deploy-supabase-production/)
    assert.doesNotMatch(workflow, /group:.*head_sha/)

    const liveMainCheck = workflow.indexOf('git ls-remote')
    const checkout = workflow.indexOf('uses: actions/checkout@')
    assert.ok(liveMainCheck >= 0 && checkout > liveMainCheck)

    const liveMainChecks = Array.from(workflow.matchAll(/git ls-remote/g), (match) => match.index)
    const firstMutation = workflow.indexOf('--request PATCH')
    const frontendRelease = workflow.indexOf('Deploy and verify the exact frontend revision')
    assert.ok(liveMainChecks.length >= 3)
    assert.ok(firstMutation >= 0)
    assert.ok(liveMainChecks[1]! < firstMutation)
    assert.ok(liveMainChecks.at(-1)! < frontendRelease)

    const validation = workflow.indexOf('npm run edge:verify')
    const migrationPush = workflow.indexOf('supabase db push')
    assert.ok(validation >= 0 && migrationPush > validation)
    assert.match(workflow, /npm run verify:migrations/)
    assert.match(workflow, /npm run edge:check-jwt-config/)
    assert.match(workflow, /npm run security:check-auth-config/)
    assert.match(workflow, /supabase secrets set[\s\S]*HEALTHCHECK_TOKEN=/)
    assert.match(workflow, /x-healthcheck-token: \$HEALTHCHECK_TOKEN/)
    assert.match(workflow, /sessions_inactivity_timeout:\$inactivity/)
    assert.match(workflow, /PRODUCTION_SESSION_IDLE_TIMEOUT_SECONDS/)
  })

  it('runs clinical AI from configured provider keys behind an explicit kill switch', async () => {
    const workflow = await readFile('.github/workflows/deploy-supabase.yml', 'utf8')
    const providerPolicy = await readFile('supabase/functions/_shared/llm-client.ts', 'utf8')
    const deploymentGuide = await readFile('docs/deployment.md', 'utf8')

    assert.match(workflow, /CLINICAL_AI_DISABLED: \$\{\{ vars\.CLINICAL_AI_DISABLED \}\}/)
    assert.match(workflow, /supabase secrets list/)
    assert.match(workflow, /for key in OPENAI_API_KEY GEMINI_API_KEY GROQ_API_KEY/)
    assert.match(workflow, /Clinical AI is explicitly disabled via CLINICAL_AI_DISABLED/)
    assert.match(providerPolicy, /isClinicalAIDisabled/)
    assert.match(providerPolicy, /listConfiguredClinicalProviders/)
    assert.match(providerPolicy, /buildClinicalProviderAttempts/)
    assert.match(deploymentGuide, /CLINICAL_AI_DISABLED/)
  })

  it('pins every third-party workflow action and grants read-only repository access', async () => {
    const workflowNames = (await readdir('.github/workflows'))
      .filter((name) => /\.ya?ml$/.test(name))
    const workflows = await Promise.all(workflowNames.map(async (name) => ({
      name,
      content: await readFile(`.github/workflows/${name}`, 'utf8'),
    })))
    const actionUses = workflows.flatMap(({ name, content }) =>
      Array.from(content.matchAll(/uses:\s*([^\s#]+)/g), (match) => ({ name, action: match[1] })),
    )

    assert.ok(actionUses.length > 0)
    for (const { name, action } of actionUses) {
      assert.match(action, /^[^@]+@[0-9a-f]{40}$/, `${name} must pin ${action}`)
    }
    for (const { name, content } of workflows) {
      assert.match(content, /permissions:\s*\n\s*contents: read/, `${name} must use read-only contents permission`)
    }
  })

  it('fails closed until Vercel publishes the exact backend-matched frontend release', async () => {
    const workflow = await readFile('.github/workflows/deploy-supabase.yml', 'utf8')
    const vercelConfig = await readFile('vercel.json', 'utf8')
    const viteConfig = await readFile('vite.config.ts', 'utf8')

    assert.match(vercelConfig, /"main": false/)
    assert.match(workflow, /VERCEL_DEPLOY_HOOK_URL is required/)
    assert.match(workflow, /PRODUCTION_APP_URL/)
    assert.match(workflow, /expected_version="\$\{package_version\}\+\$\{WORKFLOW_SHA:0:7\}"/)
    assert.match(workflow, /release_probe=\$\{WORKFLOW_SHA\}/)
    assert.match(workflow, /<meta name=\\"app-version\\" content=\\"\$\{expected_version\}\\"/)
    assert.match(workflow, /<link rel=\\"canonical\\" href=\\"\$\{production_origin\}\/\\"/)
    assert.match(workflow, /<meta name=\\"session-idle-timeout\\" content=\\"\$\{SESSION_IDLE_TIMEOUT_SECONDS\}\\"/)
    assert.match(workflow, /llms_url="\$\{production_origin\}\/llms\.txt/)
    assert.match(workflow, /\[Product overview\]\(\$\{production_origin\}\/\)/)
    assert.match(workflow, /\[Security and deployment guidance\]\(\$\{production_origin\}\/security\)/)
    assert.match(workflow, /! grep --fixed-strings --quiet "\/auth"/)
    assert.doesNotMatch(workflow, /skipping \(frontend still deploys on push/)
    assert.match(viteConfig, /name: "inject-release-version-and-public-metadata"/)
    assert.match(viteConfig, /name: "app-version", content: appVersion/)
    assert.match(viteConfig, /name: "session-idle-timeout"/)
    assert.match(viteConfig, /VITE_PUBLIC_APP_URL/)
    assert.match(viteConfig, /property: "og:url"/)
    assert.match(viteConfig, /property: "og:image"/)
  })

  it('builds and verifies metadata against one explicit production origin', async () => {
    const viteConfig = await readFile('vite.config.ts', 'utf8')
    const publicOriginPolicy = await readFile('src/config/publicOriginPolicy.ts', 'utf8')
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8')
    const envExample = await readFile('.env.example', 'utf8')

    assert.match(viteConfig, /parseProductionPublicOrigin/)
    assert.match(viteConfig, /command === "build" && mode === "production"/)
    assert.match(viteConfig, /"VITE_PUBLIC_APP_URL"/)
    assert.match(publicOriginPolicy, /Public app URL is required/)
    assert.equal((workflow.match(/VITE_PUBLIC_APP_URL:/g) ?? []).length, 2)
    assert.equal(
      (workflow.match(/VITE_PUBLIC_APP_URL: \$\{\{ vars\.PRODUCTION_APP_URL \}\}/g) ?? []).length,
      2,
    )
    assert.equal((workflow.match(/VITE_SESSION_IDLE_TIMEOUT_SECONDS:/g) ?? []).length, 2)
    assert.equal(
      (workflow.match(/VITE_SESSION_IDLE_TIMEOUT_SECONDS: \$\{\{ vars\.PRODUCTION_SESSION_IDLE_TIMEOUT_SECONDS \}\}/g) ?? []).length,
      2,
    )
    assert.match(envExample, /Required canonical production origin/)
    assert.match(envExample, /Required production inactivity timeout/)
  })

  it('keeps an unconfigured prelaunch contact surface honest', async () => {
    const viteConfig = await readFile('vite.config.ts', 'utf8')
    const marketing = await readFile('src/config/marketing.ts', 'utf8')
    const landing = await readFile('src/components/landing/FeatureHighlights.tsx', 'utf8')
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8')
    const envExample = await readFile('.env.example', 'utf8')
    const browserSmoke = await readFile('e2e/auth-dashboard.spec.ts', 'utf8')

    assert.match(viteConfig, /if \(env\.VITE_CONTACT_EMAIL\?\.trim\(\)\)/)
    assert.match(viteConfig, /validateProductionContactEmail/)
    assert.match(viteConfig, /VITE_CONTACT_EMAIL/)
    assert.match(viteConfig, /endsWith\("\.local"\)/)
    assert.match(viteConfig, /command === "build" && mode === "production"/)
    assert.doesNotMatch(marketing, /hello@rollingrounds\.app/)
    assert.match(landing, /CONTACT_EMAIL[\s\S]*mailto:/)
    assert.match(landing, /Public contact details are not available during this prelaunch deployment/)
    assert.match(workflow, /VITE_CONTACT_EMAIL: \$\{\{ vars\.PRODUCTION_CONTACT_EMAIL \}\}/)
    assert.match(envExample, /Required before market launch; optional for an explicitly prelaunch deployment/)
    assert.match(browserSmoke, /mailto:hello@rollingrounds\.app/)
  })

  it('uses an honest placeholder until an approved privacy notice is configured', async () => {
    const viteConfig = await readFile('vite.config.ts', 'utf8')
    const legalPolicy = await readFile('src/config/legalPolicy.ts', 'utf8')
    const legalConfig = await readFile('src/config/legal.ts', 'utf8')
    const landing = await readFile('src/components/landing/FeatureHighlights.tsx', 'utf8')
    const privacy = await readFile('src/pages/Privacy.tsx', 'utf8')
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8')
    const envExample = await readFile('.env.example', 'utf8')

    assert.match(viteConfig, /if \(env\.VITE_PRIVACY_NOTICE_URL\?\.trim\(\)\)/)
    assert.match(viteConfig, /validateProductionPrivacyNoticeUrl/)
    assert.match(viteConfig, /VITE_PRIVACY_NOTICE_URL/)
    assert.match(legalPolicy, /parsePrivacyNoticeUrl/)
    assert.match(legalConfig, /PRIVACY_NOTICE_URL/)
    assert.match(landing, /PRIVACY_NOTICE_URL/)
    assert.doesNotMatch(landing, /<Link to="\/privacy"[^>]*>\s*Privacy/)
    assert.match(privacy, /PRIVACY_NOTICE_IS_CONFIGURED/)
    assert.equal((workflow.match(/VITE_PRIVACY_NOTICE_URL:/g) ?? []).length, 2)
    assert.match(envExample, /privacy renders honest setup guidance rather than an approved notice/i)
  })

  it('renders only explicitly approved OAuth providers', async () => {
    const viteConfig = await readFile('vite.config.ts', 'utf8')
    const authPolicy = await readFile('src/config/authProviderPolicy.ts', 'utf8')
    const authConfig = await readFile('src/config/authProviders.ts', 'utf8')
    const authPage = await readFile('src/pages/Auth.tsx', 'utf8')
    const envExample = await readFile('.env.example', 'utf8')
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8')

    assert.match(viteConfig, /validateApprovedOAuthProviders/)
    assert.match(viteConfig, /VITE_APPROVED_OAUTH_PROVIDERS/)
    assert.match(authPolicy, /parseApprovedOAuthProviders/)
    assert.match(authConfig, /APPROVED_OAUTH_PROVIDERS/)
    assert.match(authPage, /APPROVED_OAUTH_PROVIDERS\.map/)
    assert.doesNotMatch(authPage, /onClick=\{\(\) => handleOAuthSignIn\("google"\)\}/)
    assert.doesNotMatch(authPage, /onClick=\{\(\) => handleOAuthSignIn\("apple"\)\}/)
    assert.match(envExample, /OAuth providers are hidden by default/)
    assert.equal((workflow.match(/VITE_APPROVED_OAUTH_PROVIDERS:/g) ?? []).length, 2)
  })

  it('requires a central production observability sink with a PHI-safe Sentry path', async () => {
    const viteConfig = await readFile('vite.config.ts', 'utf8')
    const policy = await readFile('src/config/observabilityPolicy.ts', 'utf8')
    const sentryClient = await readFile('src/lib/observability/sentryClient.ts', 'utf8')
    const logger = await readFile('src/lib/observability/logger.ts', 'utf8')
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8')
    const envExample = await readFile('.env.example', 'utf8')
    const edgeConfig = await readFile('supabase/config.toml', 'utf8')
    const telemetryFunction = await readFile('supabase/functions/telemetry/index.ts', 'utf8')
    const deployWorkflow = await readFile('.github/workflows/deploy-supabase.yml', 'utf8')
    const productionMonitor = await readFile('.github/workflows/production-monitor.yml', 'utf8')

    assert.match(viteConfig, /validateProductionObservabilityConfig/)
    assert.match(viteConfig, /VITE_SENTRY_DSN/)
    assert.match(viteConfig, /VITE_TELEMETRY_INGEST_URL/)
    assert.match(policy, /central observability sink/i)
    assert.match(sentryClient, /createSentryOperationalEvent/)
    assert.match(sentryClient, /captureOperationalSignalToSentry/)
    assert.match(logger, /captureOperationalSignalToSentry/)
    assert.equal((workflow.match(/VITE_SENTRY_DSN:/g) ?? []).length, 2)
    assert.equal((workflow.match(/VITE_TELEMETRY_INGEST_URL:/g) ?? []).length, 2)
    assert.match(envExample, /central observability sink/i)
    assert.match(edgeConfig, /\[functions\.telemetry\][\s\S]*verify_jwt = false/)
    assert.match(telemetryFunction, /parseTelemetryBatch/)
    assert.match(telemetryFunction, /RATE_LIMITS\.telemetry/)
    assert.match(telemetryFunction, /client_observability_events/)
    assert.match(telemetryFunction, /purge_expired_client_observability_events/)
    assert.match(deployWorkflow, /Smoke test — first-party telemetry ingest/)
    assert.match(deployWorkflow, /message: "monitor\.ingest_probe"/)
    assert.match(productionMonitor, /Probe configured first-party telemetry ingest/)
  })

  it('builds in CI from explicit public runtime configuration rather than a tracked .env', async () => {
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8')
    const gitignore = await readFile('.gitignore', 'utf8')

    assert.match(workflow, /VITE_SUPABASE_URL: \$\{\{ vars\.VITE_SUPABASE_URL \}\}/)
    assert.match(workflow, /VITE_SUPABASE_PUBLISHABLE_KEY: \$\{\{ secrets\.SUPABASE_ANON_KEY \}\}/)
    // The project URL is bound once more than the anon key: the public browser
    // smoke step derives the Supabase storage key from the project ref and must
    // not receive credentials.
    assert.equal((workflow.match(/VITE_SUPABASE_URL:/g) ?? []).length, 5)
    assert.equal((workflow.match(/VITE_SUPABASE_PUBLISHABLE_KEY:/g) ?? []).length, 4)
    assert.match(gitignore, /^\.env$/m)
  })

  it('does not contact third-party font hosts from public or clinical pages', async () => {
    const html = await readFile('index.html', 'utf8')
    const css = await readFile('src/index.css', 'utf8')
    const vercelConfig = await readFile('vercel.json', 'utf8')
    const shippedSurface = `${html}\n${css}\n${vercelConfig}`

    assert.doesNotMatch(shippedSurface, /fonts\.googleapis\.com/)
    assert.doesNotMatch(shippedSurface, /fonts\.gstatic\.com/)
    // Urbanist ships self-hosted from /public/fonts. Asserting the @font-face
    // src (rather than only the family stack) is what actually pins the policy:
    // a stack naming Urbanist would still pass if someone later pointed it at
    // a CDN, and the CSP is font-src 'self' data:.
    assert.match(css, /@font-face/)
    assert.match(css, /src: url\("\/fonts\/urbanist-latin\.woff2"\) format\("woff2"\)/)
    assert.match(css, /src: url\("\/fonts\/urbanist-latin-ext\.woff2"\) format\("woff2"\)/)
    assert.doesNotMatch(css, /@font-face[\s\S]*?src:[^;]*url\(\s*["']?https?:/)
    assert.match(css, /--font-heading: "Urbanist", ui-sans-serif, system-ui/)
    assert.match(css, /--font-sans: "Urbanist", ui-sans-serif, system-ui/)
  })

  it('generates environment-correct crawl assets instead of shipping a stale static sitemap', async () => {
    const viteConfig = await readFile('vite.config.ts', 'utf8')

    assert.match(viteConfig, /fileName: "robots\.txt"/)
    assert.match(viteConfig, /fileName: "sitemap\.xml"/)
    assert.match(viteConfig, /fileName: "llms\.txt"/)
    assert.match(viteConfig, /Disallow: \/auth/)
    assert.match(viteConfig, /Disallow: \/fhir\//)
    assert.match(viteConfig, /\$\{publicOrigin\}\/sitemap\.xml/)
    assert.match(viteConfig, /\$\{publicOrigin\}\/security/)
    assert.match(viteConfig, /\$\{publicOrigin\}\/llms\.txt/)
    assert.match(viteConfig, /\$\{privacyNoticeUrl\}/)
    assert.match(viteConfig, /authenticated workspace and patient data are not public content/)
    await assert.rejects(readFile('public/robots.txt', 'utf8'))
    await assert.rejects(readFile('public/llms.txt', 'utf8'))
  })

  it('fails closed on complete authenticated Chromium and WebKit suites', async () => {
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8')
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
      scripts: Record<string, string>
    }
    const publicSmoke = await readFile('e2e/auth-dashboard.spec.ts', 'utf8')

    assert.match(workflow, /playwright install --with-deps chromium webkit/)
    assert.match(workflow, /- run: npm run build/)
    assert.match(workflow, /npm run test:e2e:public/)
    assert.match(workflow, /name: Required authenticated Chromium suite/)
    assert.match(workflow, /name: Required authenticated WebKit suite/)
    assert.match(workflow, /run: npm run test:e2e\n/)
    assert.match(workflow, /run: npm run test:e2e:webkit\n/)
    assert.equal((workflow.match(/E2E_USE_PREVIEW: "1"/g) ?? []).length, 3)
    assert.equal((workflow.match(/E2E_REQUIRE_FULL_SUITE: "1"/g) ?? []).length, 2)
    // Build step, both authenticated suites, and the public smoke step bind the
    // project URL; only the first three carry the anon key.
    assert.equal((workflow.match(/VITE_SUPABASE_URL: \$\{\{ vars\.VITE_SUPABASE_URL \}\}/g) ?? []).length, 5)
    assert.equal((workflow.match(/VITE_SUPABASE_PUBLISHABLE_KEY: \$\{\{ secrets\.SUPABASE_ANON_KEY \}\}/g) ?? []).length, 4)
    // The public smoke step gets the project ref but must stay credential-free.
    assert.doesNotMatch(
      workflow.split('name: Public Chromium and WebKit auth-page smoke')[1]?.split('- name:')[0] ?? '',
      /SUPABASE_ANON_KEY|E2E_TEST_PASSWORD/,
    )
    assert.match(workflow, /group: e2e-shared-account/)
    assert.doesNotMatch(workflow, /test:e2e:webkit -- --grep/)
    assert.match(packageJson.scripts['test:e2e:public'], /--grep "@public"/)
    assert.match(publicSmoke, /200% text at 320px @public/)
    assert.match(publicSmoke, /toBeGreaterThanOrEqual\(44\)/)
  })

  it('keeps export engines interaction-lazy and independently budgeted', async () => {
    const handlers = await readFile('src/components/print/ExportHandlers.ts', 'utf8')
    const budgets = await readFile('scripts/check-bundle-size.mjs', 'utf8')
    const browserSmoke = await readFile('e2e/auth-dashboard.spec.ts', 'utf8')
    const app = await readFile('src/App.tsx', 'utf8')

    assert.doesNotMatch(handlers, /^import \* as XLSX from ['"]xlsx['"]/m)
    assert.doesNotMatch(handlers, /^import jsPDF from ['"]jspdf['"]/m)
    assert.doesNotMatch(handlers, /^import html2pdf from ['"]html2pdf\.js['"]/m)
    assert.match(handlers, /await import\(['"]xlsx['"]\)/)
    assert.match(handlers, /import\(['"]jspdf['"]\)/)
    assert.match(handlers, /await import\(['"]html2pdf\.js['"]\)/)
    assert.match(budgets, /print export modal chunk[\s\S]*maxBytes: 300_000/)
    assert.match(budgets, /vector PDF engine[\s\S]*maxBytes: 450_000/)
    assert.match(budgets, /HTML PDF fallback[\s\S]*maxBytes: 800_000/)
    assert.match(browserSmoke, /print\/export loads Excel and PDF engines on demand/)
    assert.match(browserSmoke, /suggestedFilename\(\)[\s\S]*\\\.xlsx\$/)
    assert.match(browserSmoke, /suggestedFilename\(\)[\s\S]*\\\.pdf\$/)
    assert.doesNotMatch(app, /preloadClinicalData/)
  })

  it('loads secondary clinical reference datasets only from requested surfaces', async () => {
    const app = await readFile('src/App.tsx', 'utf8')
    const lazyData = await readFile('src/lib/lazyData.ts', 'utf8')
    const ibccContext = await readFile('src/contexts/IBCCContext.tsx', 'utf8')
    const guidelineContext = await readFile('src/contexts/ClinicalGuidelinesContext.tsx', 'utf8')
    const ibccSearch = await readFile('src/hooks/ibcc/useIBCCSearch.ts', 'utf8')
    const ibccPatientContext = await readFile('src/hooks/ibcc/useIBCCContext.ts', 'utf8')
    const ibccBookmarks = await readFile('src/hooks/ibcc/useIBCCBookmarks.ts', 'utf8')
    const guidelineSearch = await readFile('src/hooks/guidelines/useGuidelinesSearch.ts', 'utf8')
    const guidelineBookmarks = await readFile('src/hooks/guidelines/useGuidelinesBookmarks.ts', 'utf8')
    const browserSmoke = await readFile('e2e/auth-dashboard.spec.ts', 'utf8')

    assert.doesNotMatch(app, /preloadClinicalData/)
    assert.doesNotMatch(lazyData, /export function preloadClinicalData/)
    assert.match(ibccContext, /ensureDataLoaded/)
    assert.match(guidelineContext, /ensureDataLoaded/)
    assert.doesNotMatch(ibccSearch, /useLazyData|import\(['"]@\/data\/ibccContent/)
    assert.doesNotMatch(ibccPatientContext, /useLazyData|import\(['"]@\/data\/ibccContent/)
    assert.doesNotMatch(ibccBookmarks, /useLazyData|import\(['"]@\/data\/ibccContent/)
    assert.doesNotMatch(guidelineSearch, /useLazyData|import\(['"]@\/data\/clinicalGuidelinesData/)
    assert.doesNotMatch(guidelineBookmarks, /useLazyData|import\(['"]@\/data\/clinicalGuidelinesData/)
    assert.match(browserSmoke, /clinical reference datasets load only after reference access/)
    assert.match(browserSmoke, /referenceAssets[\s\S]*toEqual\(\[\]\)/)
  })

  it('keeps workspace providers and sensitive cleanup graphs outside the public shell', async () => {
    const app = await readFile('src/App.tsx', 'utf8')
    const providers = await readFile('src/components/AuthenticatedAppProviders.tsx', 'utf8')
    const cleanup = await readFile('src/lib/auth/clearSensitiveClientState.ts', 'utf8')
    const fhirShell = await readFile('src/pages/FHIRCallback.tsx', 'utf8')
    const budgets = await readFile('scripts/check-bundle-size.mjs', 'utf8')
    const auth = await readFile('src/pages/Auth.tsx', 'utf8')

    assert.match(app, /const AuthenticatedAppProviders = React\.lazy/)
    assert.doesNotMatch(app, /^import \{ (?:TeamProvider|SettingsProvider|IBCCProvider)/m)
    assert.match(providers, /<TeamProvider>/)
    assert.match(providers, /<SettingsProvider>/)
    assert.match(providers, /<ClinicalGuidelinesProvider>/)
    assert.match(cleanup, /import\(['"]@\/lib\/offline\/database['"]\)/)
    assert.doesNotMatch(cleanup, /^import .* from ['"]@\/lib\/offline\/database['"]/m)
    assert.match(fhirShell, /React\.lazy\(\(\) => import\(['"]\.\/FHIRCallbackFlow['"]\)\)/)
    assert.match(fhirShell, /FHIRCallbackChunkBoundary/)
    assert.match(budgets, /maxInitialJavaScriptBytes = 750_000/)
    assert.match(budgets, /Supabase runtime[\s\S]*maxBytes: 230_000/)
    assert.doesNotMatch(auth, /from ['"]zod['"]/)
  })

  it('restores only the dedicated full-suite fixture before and after authenticated E2E', async () => {
    const config = await readFile('playwright.config.ts', 'utf8')
    const fixture = await readFile('e2e/fixture-state.ts', 'utf8')

    assert.match(config, /globalSetup: "\.\/e2e\/global-setup\.ts"/)
    assert.match(config, /globalTeardown: "\.\/e2e\/global-teardown\.ts"/)
    assert.match(fixture, /E2E_REQUIRE_FULL_SUITE !== "1"/)
    assert.match(fixture, /"E2E Alpha"/)
    assert.match(fixture, /"E2E Bravo"/)
    assert.match(fixture, /"E2E Charlie"/)
    assert.match(fixture, /\.eq\("user_id", auth\.user\.id\)/)
    assert.match(fixture, /\.from\("round_state"\)[\s\S]*\.delete\(\)/)
    assert.doesNotMatch(fixture, /E2E_REQUIRE_SYNTHETIC/)
  })

  it('runs a scheduled production health and reversible save canary', async () => {
    const workflow = await readFile('.github/workflows/production-monitor.yml', 'utf8')

    assert.match(workflow, /schedule:\s*\n\s*- cron: "17 \* \* \* \*"/)
    assert.match(workflow, /workflow_dispatch:/)
    assert.match(workflow, /group: production-monitor/)
    assert.match(workflow, /group: e2e-shared-account/)
    assert.match(workflow, /cancel-in-progress: false/)
    assert.match(workflow, /PRODUCTION_APP_URL: \$\{\{ vars\.PRODUCTION_APP_URL \}\}/)
    assert.match(workflow, /E2E_REQUIRE_SYNTHETIC: "1"/)
    assert.match(workflow, /npm run test:e2e:synthetic/)
    assert.match(workflow, /functions\/v1\/healthcheck/)
    assert.match(workflow, /HEALTHCHECK_TOKEN: \$\{\{ secrets\.HEALTHCHECK_TOKEN \}\}/)
    assert.match(workflow, /x-healthcheck-token: \$HEALTHCHECK_TOKEN/)
    assert.match(workflow, /\.status == "healthy" and \.components\.database == "connected"/)
    assert.match(workflow, /issues: write/)
    assert.match(workflow, /if: failure\(\)/)
    assert.match(workflow, /gh issue create --title "\$title"/)
    assert.match(workflow, /if: success\(\)/)
    assert.match(workflow, /gh issue close "\$issue" --reason completed/)
    assert.doesNotMatch(workflow, /E2E_REUSE_SERVER/)
  })
})
