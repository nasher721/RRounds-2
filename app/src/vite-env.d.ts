/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  /** Approved same-origin or Supabase-hosted central telemetry collector */
  readonly VITE_TELEMETRY_INGEST_URL?: string;
  /** Set at build time from package.json / Vercel; optional override via VITE_APP_VERSION in .env */
  readonly VITE_APP_VERSION?: string;
  /** Landing: public contact email (mailto links) */
  readonly VITE_CONTACT_EMAIL?: string;
  /** Operator-approved public privacy notice; required for production builds */
  readonly VITE_PRIVACY_NOTICE_URL?: string;
  /** Comma-separated OAuth controls approved for this deployment: google,apple */
  readonly VITE_APPROVED_OAUTH_PROVIDERS?: string;
  /** Required production inactivity timeout shared with hosted Supabase Auth, in seconds */
  readonly VITE_SESSION_IDLE_TIMEOUT_SECONDS?: string;
  /**
   * Focus-first Today’s Round runner on desktop.
   * Unset / "1" = on (default); "0" = classic DesktopDashboard chrome.
   */
  readonly VITE_ROUND_RUNNER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
