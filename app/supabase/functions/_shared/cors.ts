/**
 * CORS for Edge Functions (shared by all handlers using `jsonResponse` / `handleOptions`).
 *
 * **Layers**
 * 1. `DEFAULT_ALLOWED_ORIGINS` plus any origins in the `ALLOWED_ORIGINS` secret (comma-separated, merged in).
 * 2. Named regexes for this repo’s Vercel production and common preview URL shapes.
 * 3. Any `http://localhost:<port>` and `http://127.0.0.1:<port>` for local dev.
 * 4. Optional: any `https://*.vercel.app` only when secret `RELAX_VERCEL_CORS` is `true` or `1` (see docs/deployment.md).
 *
 * Tight deployments should leave `RELAX_VERCEL_CORS` unset and list extra preview hosts in `ALLOWED_ORIGINS` instead.
 */

// Default allowed origins - override via ALLOWED_ORIGINS env var (comma-separated)
const DEFAULT_ALLOWED_ORIGINS = [
  // Local development
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
  "http://localhost:3000",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:3000",
  // Production Vercel deployments
  "https://remix-of-remix-of-round-robin-notes.vercel.app",
  // Supabase dashboard (for testing)
  "https://supabase.com",
];

/**
 * Get allowed origins from environment merged with defaults.
 * When ALLOWED_ORIGINS is set, it is merged with DEFAULT_ALLOWED_ORIGINS so
 * the app's production and local origins are always allowed (avoids CORS
 * failures when the secret only adds extra origins).
 */
function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  const fromEnv = envOrigins
    ? envOrigins.split(",").map((o) => o.trim()).filter(Boolean)
    : [];
  const combined = [...DEFAULT_ALLOWED_ORIGINS];
  for (const o of fromEnv) {
    if (o && !combined.includes(o)) combined.push(o);
  }
  return combined;
}

/** When true, allow any HTTPS origin under `.vercel.app` (preview ergonomics). Default: off. */
function isRelaxedVercelCorsEnabled(): boolean {
  const v = Deno.env.get("RELAX_VERCEL_CORS")?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/**
 * Standard CORS headers for all responses
 */
export const STANDARD_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
].join(", ");

/**
 * Get CORS headers for a specific request
 * Validates the origin against the allowlist
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ||
    request.headers.get("referer")?.split("/").slice(0, 3).join("/");
  const allowedOrigins = getAllowedOrigins();

  // Check if origin is allowed
  const isAllowed = origin && (
    // Check explicit allowlist
    allowedOrigins.some((allowed) =>
      origin === allowed || origin.startsWith(allowed + "/")
    ) ||
    // Allow Vercel preview deployments
    /^https:\/\/[a-z0-9-]+-nasher721(-[a-z0-9-]+)?\.vercel\.app$/.test(
      origin,
    ) ||
    /^https:\/\/remix-of-remix-of-round-robin-notes-.*\.vercel\.app$/.test(
      origin,
    ) ||
    // Any Vercel preview (HTTPS only) — gated; applies to every function using this module
    (isRelaxedVercelCorsEnabled() &&
      /^https:\/\//.test(origin) &&
      /\.vercel\.app$/i.test(origin)) ||
    // Local dev on any port
    /^http:\/\/localhost:\d+$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
  );

  // SECURITY: If origin is not allowed, return NO CORS headers
  // Browser will block the request. This prevents cross-origin PHI exposure.
  if (!isAllowed) {
    return {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      // Security headers still apply even for blocked origins
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Cache-Control": "no-store",
    };
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": STANDARD_HEADERS,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400", // 24 hours
    // Security headers
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleOptions(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

/**
 * Create a JSON response with CORS headers
 * Use this for all Edge Function responses
 */
export function jsonResponse(
  request: Request,
  data: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(request),
      "Content-Type": "application/json",
    },
  });
}

/**
 * Create an error response with CORS headers
 */
export function errorResponse(
  request: Request,
  message: string,
  status = 500,
): Response {
  return jsonResponse(request, { error: message, success: false }, status);
}
