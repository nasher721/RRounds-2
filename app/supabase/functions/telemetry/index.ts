// deno-lint-ignore no-import-prefix -- Supabase Edge runtime resolves esm.sh imports.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  checkRateLimit,
  handleOptions,
  jsonResponse,
  parseAndValidateBody,
  RATE_LIMITS,
  safeLog,
} from "../_shared/mod.ts";
import {
  MAX_TELEMETRY_PAYLOAD_BYTES,
  parseTelemetryBatch,
} from "../_shared/telemetry-schema.ts";

type UntypedTelemetryClient = {
  from: (table: string) => {
    insert: (rows: unknown[]) => PromiseLike<{ error: unknown }>;
  };
  rpc: (
    functionName: string,
    args?: Record<string, never>,
  ) => PromiseLike<{ error: unknown }>;
};

/**
 * Public, content-free browser observability ingest.
 *
 * Browser telemetry cannot carry a clinical user token because public landing
 * events are collected before sign-in. Abuse is bounded by the shared
 * distributed limiter. Every accepted field passes a fixed-vocabulary parser,
 * and only the projected scalar columns are written with the service role.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  const rateLimit = await checkRateLimit(req, RATE_LIMITS.telemetry);
  if (!rateLimit.allowed) return rateLimit.response!;

  const body = await parseAndValidateBody<unknown>(req, {
    maxBytes: MAX_TELEMETRY_PAYLOAD_BYTES,
  });
  if (!body.valid) return body.response;

  const parsed = parseTelemetryBatch(body.data);
  if (!parsed.valid) {
    safeLog("warn", "Telemetry payload rejected", { count: 0 });
    return jsonResponse(req, { error: parsed.error }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    safeLog("error", "Telemetry storage configuration missing");
    return jsonResponse(req, { error: "Telemetry service unavailable" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  }) as unknown as UntypedTelemetryClient;

  // Retention is enforced before accepting more data. A failed purge therefore
  // cannot silently turn a 30-day operational store into an unbounded archive.
  const { error: retentionError } = await supabase.rpc(
    "purge_expired_client_observability_events",
  );
  if (retentionError) {
    safeLog("error", "Telemetry retention failed");
    return jsonResponse(req, { error: "Telemetry service unavailable" }, 503);
  }

  const { error: insertError } = await supabase
    .from("client_observability_events")
    .insert(parsed.rows);
  if (insertError) {
    safeLog("error", "Telemetry insert failed");
    return jsonResponse(req, { error: "Telemetry service unavailable" }, 503);
  }

  safeLog("info", "Telemetry batch accepted", { count: parsed.rows.length });
  return jsonResponse(req, { accepted: parsed.rows.length }, 202);
});
