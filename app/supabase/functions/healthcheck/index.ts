// deno-lint-ignore no-import-prefix -- Supabase Edge runtime resolves esm.sh imports.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { authenticateRequest } from "../_shared/auth.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { safeLog } from "../_shared/mod.ts";

/**
 * Healthcheck Edge Function
 * Purpose: Provide a deterministic endpoint to integration test the DB and
 * Edge Function regional connectivity. Signed-in app users may probe with
 * their access token; external monitors use a dedicated secret header.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  const monitorAuthorized = await hasValidMonitorToken(req);
  if (!monitorAuthorized) {
    const authResult = await authenticateRequest(req);
    if ("error" in authResult) {
      return authResult.error;
    }
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing SUPABASE environment variables.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Exercise PostgREST and the database through the only public-schema
    // capability granted to anon. No clinical table is reachable while signed
    // out, and this probe performs no privileged or data-dependent work.
    const { data: databaseConnected, error: dbError } = await supabase.rpc(
      "healthcheck_database",
    );

    if (dbError || databaseConnected !== true) {
      safeLog("error", "Healthcheck database ping failed");
      return jsonResponse(req, {
        status: "unhealthy",
        component: "database",
        message: "Database unavailable",
      }, 503);
    }

    // Success payload
    return jsonResponse(req, {
      status: "healthy",
      timestamp: new Date().toISOString(),
      components: {
        database: "connected",
        edge_functions: "online",
      },
    }, 200);
  } catch (error) {
    safeLog("error", "Healthcheck request failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonResponse(req, {
      status: "unhealthy",
      message: "Internal Server Error",
    }, 500);
  }
});

async function hasValidMonitorToken(req: Request): Promise<boolean> {
  const expected = Deno.env.get("HEALTHCHECK_TOKEN")?.trim();
  const supplied = req.headers.get("x-healthcheck-token")?.trim();
  if (!expected || !supplied) return false;

  const encoder = new TextEncoder();
  const [expectedDigest, suppliedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
  ]);
  const expectedBytes = new Uint8Array(expectedDigest);
  const suppliedBytes = new Uint8Array(suppliedDigest);
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= expectedBytes[index] ^ suppliedBytes[index];
  }
  return difference === 0;
}
