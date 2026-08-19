import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { parseApprovedOAuthProviders } from "./src/config/authProviderPolicy.ts";
import { parsePrivacyNoticeUrl } from "./src/config/legalPolicy.ts";
import { validateProductionObservabilityConfig } from "./src/config/observabilityPolicy.ts";
import { parseProductionPublicOrigin } from "./src/config/publicOriginPolicy.ts";
import { parseSessionIdleTimeoutSeconds } from "./src/config/sessionPolicy.ts";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { description: string; name: string; version: string };

const DEFAULT_PUBLIC_ORIGIN = "https://remix-of-remix-of-round-robin-notes.vercel.app";

/**
 * Sentry release + in-app version: env override, else package.json@git short sha on Vercel, else semver from package.json.
 */
function resolveAppVersion(): string {
  if (process.env.VITE_APP_VERSION?.trim()) {
    return process.env.VITE_APP_VERSION.trim();
  }
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  if (sha) {
    return `${pkg.version}+${sha}`;
  }
  return pkg.version;
}

function resolvePublicOrigin(
  env: Record<string, string>,
  mode: string,
  command: "build" | "serve",
): string {
  if (command === "build" && mode === "production") {
    try {
      return parseProductionPublicOrigin(env.VITE_PUBLIC_APP_URL);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "invalid public app URL";
      throw new Error(`Production build blocked: ${detail}`);
    }
  }

  const configured = env.VITE_PUBLIC_APP_URL?.trim()
    || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
    || DEFAULT_PUBLIC_ORIGIN;
  const candidate = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;

  let publicUrl: URL;
  try {
    publicUrl = new URL(candidate);
  } catch {
    throw new Error("Production build blocked: VITE_PUBLIC_APP_URL must be a valid absolute URL");
  }
  return publicUrl.origin;
}

function validateProductionContactEmail(value: string): void {
  const email = value.trim();
  const match = email.match(/^([^\s@<>]+)@([A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63})$/);
  const domain = match?.[2]?.toLowerCase();
  const reservedDomain = domain === "example.com"
    || domain === "example.org"
    || domain === "example.net"
    || domain === "yourhospital.org"
    || domain?.endsWith(".invalid")
    || domain?.endsWith(".local")
    || domain?.endsWith(".test");
  if (!match || reservedDomain) {
    throw new Error(
      "Production build blocked: VITE_CONTACT_EMAIL must be a real public contact address",
    );
  }
}

function validateApprovedOAuthProviders(value: string | undefined): void {
  try {
    parseApprovedOAuthProviders(value);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid provider list";
    throw new Error(`Production build blocked: ${detail}`);
  }
}

function validateProductionPrivacyNoticeUrl(
  value: string | undefined,
  publicOrigin: string,
): void {
  try {
    const noticeUrl = parsePrivacyNoticeUrl(value);
    if (!noticeUrl) {
      throw new Error('Privacy notice URL is required.');
    }
    const placeholderUrl = new URL('/privacy', `${publicOrigin}/`).href;
    if (noticeUrl === placeholderUrl) {
      throw new Error('Privacy notice URL cannot point to the in-app development placeholder.');
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'invalid privacy notice URL';
    throw new Error(`Production build blocked: ${detail}`);
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appVersion = resolveAppVersion();
  const publicOrigin = resolvePublicOrigin(env, mode, command);
  const privacyNoticeUrl = env.VITE_PRIVACY_NOTICE_URL?.trim();
  const sessionIdleTimeoutSeconds = parseSessionIdleTimeoutSeconds(
    env.VITE_SESSION_IDLE_TIMEOUT_SECONDS,
  );
  if (command === "build" && mode === "production") {
    const missing = [
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "VITE_PUBLIC_APP_URL",
      "VITE_SESSION_IDLE_TIMEOUT_SECONDS",
    ].filter(
      (key) => !env[key]?.trim(),
    );
    if (missing.length > 0) {
      throw new Error(`Production build blocked: missing ${missing.join(", ")}`);
    }
    if (env.VITE_CONTACT_EMAIL?.trim()) {
      validateProductionContactEmail(env.VITE_CONTACT_EMAIL);
    }
    if (env.VITE_PRIVACY_NOTICE_URL?.trim()) {
      validateProductionPrivacyNoticeUrl(env.VITE_PRIVACY_NOTICE_URL, publicOrigin);
    }
    validateApprovedOAuthProviders(env.VITE_APPROVED_OAUTH_PROVIDERS);
    try {
      validateProductionObservabilityConfig({
        publicOrigin,
        sentryDsn: env.VITE_SENTRY_DSN,
        telemetryIngestUrl: env.VITE_TELEMETRY_INGEST_URL,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "invalid observability configuration";
      throw new Error(`Production build blocked: ${detail}`);
    }
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      {
        name: "inject-release-version-and-public-metadata",
        generateBundle() {
          const robots = [
            "User-agent: *",
            "Allow: /",
            "Disallow: /auth",
            "Disallow: /fhir/",
            "Disallow: /__print-export-test",
            `Sitemap: ${publicOrigin}/sitemap.xml`,
            "",
          ].join("\n");
          const sitemap = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            `  <url><loc>${publicOrigin}/</loc></url>`,
            `  <url><loc>${publicOrigin}/security</loc></url>`,
            "</urlset>",
            "",
          ].join("\n");
          const llms = [
            "# Rolling Rounds",
            "",
            `> ${pkg.description}`,
            "",
            "Access is provisioned by each deployment operator. The public pages describe product capabilities and deployment safeguards; the authenticated workspace and patient data are not public content.",
            "",
            "## Public pages",
            "",
            `- [Product overview](${publicOrigin}/): Product capabilities, access model, and contact information.`,
            `- [Security and deployment guidance](${publicOrigin}/security): Deployment, access-control, device, and data-handling safeguards.`,
            ...(privacyNoticeUrl
              ? [`- [Privacy notice](${privacyNoticeUrl}): The deployment operator's approved privacy notice.`]
              : []),
            "",
          ].join("\n");
          this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });
          this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
          this.emitFile({ type: "asset", fileName: "llms.txt", source: llms });
        },
        transformIndexHtml() {
          return [
            {
              tag: "meta",
              attrs: { name: "app-version", content: appVersion },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: {
                name: "session-idle-timeout",
                content: String(sessionIdleTimeoutSeconds),
              },
              injectTo: "head",
            },
            {
              tag: "link",
              attrs: { rel: "canonical", href: `${publicOrigin}/` },
              injectTo: "head",
            },
            {
              tag: "link",
              attrs: { rel: "describedby", href: `${publicOrigin}/llms.txt` },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:site_name", content: "Rolling Rounds" },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:url", content: `${publicOrigin}/` },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:image", content: `${publicOrigin}/icons/icon-512.png` },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:image:alt", content: "Rolling Rounds app icon" },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:image:width", content: "512" },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:image:height", content: "512" },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { name: "twitter:image", content: `${publicOrigin}/icons/icon-512.png` },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { name: "twitter:image:alt", content: "Rolling Rounds app icon" },
              injectTo: "head",
            },
          ];
        },
      },
    ],
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
      "import.meta.env.VITE_PUBLIC_APP_URL": JSON.stringify(publicOrigin),
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        // Supported browsers always provide Web Crypto. Avoid bundling
        // fhirclient's optional native fallback tree into the EHR chunk.
        "isomorphic-webcrypto": fileURLToPath(
          new URL("./src/integrations/fhir/webcrypto.ts", import.meta.url),
        ),
      },
      dedupe: ["react", "react-dom"],
    },
    build: {
      // Code splitting and chunk optimization
      rollupOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "vendor-react",
                test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
                priority: 100,
              },
              {
                name: "vendor-supabase",
                test: /node_modules[\\/]@supabase[\\/]/,
                priority: 90,
              },
            ],
          },
        },
      },
      // Minification settings
      minify: mode === "production" ? "oxc" : false,
      // Clinical application source maps are not published with production assets.
      sourcemap: false,
      // Large export engines are intentionally interaction-lazy and have
      // tighter named ceilings in scripts/check-bundle-size.mjs.
      chunkSizeWarningLimit: 800,
    },
  };
});
