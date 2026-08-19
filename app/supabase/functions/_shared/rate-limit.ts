/**
 * Distributed rate limiting for Edge Functions.
 *
 * Every request consumes quota through one atomic Postgres RPC. This keeps the
 * limit effective across concurrent Edge isolates and deployments.
 */

// deno-lint-ignore no-import-prefix -- Supabase Edge runtime resolves esm.sh imports.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "./cors.ts";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

export type RateLimitConsumer = (
  key: string,
  windowMs: number,
  maxRequests: number,
) => Promise<RateLimitDecision>;

export type RateLimitKeyHasher = (identifier: string) => Promise<string>;

export const RATE_LIMITS = {
  ai: {
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: "ai",
  } as RateLimitConfig,
  transcription: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: "transcribe",
  } as RateLimitConfig,
  standard: {
    windowMs: 60 * 1000,
    maxRequests: 60,
    keyPrefix: "std",
  } as RateLimitConfig,
  parse: {
    windowMs: 60 * 1000,
    maxRequests: 15,
    keyPrefix: "parse",
  } as RateLimitConfig,
  telemetry: {
    windowMs: 60 * 1000,
    maxRequests: 120,
    keyPrefix: "telemetry",
  } as RateLimitConfig,
};

export interface RateLimitResult {
  allowed: boolean;
  response?: Response;
  remaining?: number;
  resetTime?: number;
}

type RateLimitRpcRow = {
  allowed?: unknown;
  remaining?: unknown;
  reset_at?: unknown;
};

type UntypedRpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

let cachedClient: ReturnType<typeof createClient> | undefined;
let cachedClientConfig = "";

function getRateLimitClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Rate-limit service configuration missing");
  }

  const clientConfig = `${supabaseUrl}\u0000${serviceRoleKey}`;
  if (!cachedClient || cachedClientConfig !== clientConfig) {
    cachedClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    cachedClientConfig = clientConfig;
  }
  return cachedClient;
}

const consumeDistributedRateLimit: RateLimitConsumer = async (
  key,
  windowMs,
  maxRequests,
) => {
  const client = getRateLimitClient() as unknown as UntypedRpcClient;
  const { data, error } = await client.rpc(
    "consume_edge_rate_limit",
    {
      p_key: key,
      p_max_requests: maxRequests,
      p_window_ms: windowMs,
    },
  );
  if (error) throw new Error("Rate-limit RPC failed");

  const row = (Array.isArray(data) ? data[0] : data) as
    | RateLimitRpcRow
    | null;
  const resetTime = typeof row?.reset_at === "string"
    ? Date.parse(row.reset_at)
    : Number.NaN;
  const remaining = Number(row?.remaining);
  if (
    typeof row?.allowed !== "boolean" ||
    !Number.isInteger(remaining) ||
    remaining < 0 ||
    !Number.isFinite(resetTime)
  ) {
    throw new Error("Rate-limit RPC returned an invalid decision");
  }

  return { allowed: row.allowed, remaining, resetTime };
};

function getClientIdentifier(req: Request, userId?: string): string {
  if (userId) return `user:${userId.slice(0, 256)}`;

  const cloudflareIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return `ip:${cloudflareIp.slice(0, 256)}`;

  // Use the final proxy-appended value so a client-supplied prefix cannot
  // create arbitrary identities at trusted Edge ingress.
  const forwardedIp = req.headers.get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .at(-1);
  if (forwardedIp) return `ip:${forwardedIp.slice(0, 256)}`;

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return `ip:${realIp.slice(0, 256)}`;
  return "ip:unknown";
}

export async function hmacSha256Hex(
  value: string,
  secret: string,
): Promise<string> {
  if (!secret || secret.length < 16) {
    throw new Error("Rate-limit hash configuration missing");
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

const hashClientIdentifier: RateLimitKeyHasher = (identifier) => {
  const secret = Deno.env.get("RATE_LIMIT_HASH_SECRET") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return hmacSha256Hex(identifier, secret);
};

function validateConfig(config: RateLimitConfig): void {
  if (
    !Number.isSafeInteger(config.windowMs) ||
    config.windowMs < 1_000 ||
    config.windowMs > 86_400_000 ||
    !Number.isSafeInteger(config.maxRequests) ||
    config.maxRequests < 1 ||
    config.maxRequests > 10_000
  ) {
    throw new Error("Invalid rate-limit configuration");
  }
}

function keyPrefix(config: RateLimitConfig): string {
  const normalized = (config.keyPrefix ?? "default")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
  return normalized || "default";
}

function blockedResponse(
  req: Request,
  status: 429 | 503,
  retryAfter: number,
): Response {
  const error = status === 429
    ? "Rate limit exceeded. Please try again later."
    : "Rate limiting service unavailable. Please try again later.";
  return new Response(
    JSON.stringify({ error, retryAfter, success: false }),
    {
      status,
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  );
}

export async function checkRateLimit(
  req: Request,
  config: RateLimitConfig,
  userId?: string,
  consume: RateLimitConsumer = consumeDistributedRateLimit,
  hashIdentifier: RateLimitKeyHasher = hashClientIdentifier,
): Promise<RateLimitResult> {
  try {
    validateConfig(config);
    const identifier = getClientIdentifier(req, userId);
    const key = `${keyPrefix(config)}:${await hashIdentifier(identifier)}`;
    const decision = await consume(key, config.windowMs, config.maxRequests);

    if (decision.allowed) return decision;

    const retryAfter = Math.max(
      1,
      Math.ceil((decision.resetTime - Date.now()) / 1000),
    );
    return {
      ...decision,
      response: blockedResponse(req, 429, retryAfter),
    };
  } catch {
    console.error(JSON.stringify({
      level: "error",
      event: "Rate-limit backend unavailable",
      timestamp: new Date().toISOString(),
    }));
    return {
      allowed: false,
      remaining: 0,
      response: blockedResponse(req, 503, 1),
    };
  }
}

export function withRateLimit(
  config: RateLimitConfig,
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const rateLimitResult = await checkRateLimit(req, config);
    if (!rateLimitResult.allowed) return rateLimitResult.response!;
    return await handler(req);
  };
}
