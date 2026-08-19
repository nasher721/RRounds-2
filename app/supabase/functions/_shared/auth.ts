/**
 * Shared Authentication Module for Edge Functions
 *
 * Provides consistent authentication across all Edge Functions.
 * Validates JWT tokens via Supabase Auth and extracts user ID.
 *
 * Usage:
 *   import { authenticateRequest } from '../_shared/auth.ts';
 *
 *   const authResult = await authenticateRequest(req);
 *   if ('error' in authResult) {
 *     return authResult.error;
 *   }
 *   const userId = authResult.userId;
 */

// deno-lint-ignore no-import-prefix -- Supabase Edge runtime resolves esm.sh imports.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse } from "./cors.ts";

export interface AuthResult {
  userId: string;
  email?: string;
}

/**
 * Authenticate a request by validating the Bearer token
 *
 * @param req - The incoming Request object
 * @returns AuthResult with userId, or error Response
 */
export async function authenticateRequest(
  req: Request,
): Promise<AuthResult | { error: Response }> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !/^Bearer\s+\S/im.test(authHeader)) {
    return {
      error: errorResponse(
        req,
        "Missing or invalid authorization header",
        401,
      ),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(JSON.stringify({
      level: "error",
      event: "Authentication service configuration missing",
      timestamp: new Date().toISOString(),
    }));
    return {
      error: errorResponse(
        req,
        "Server configuration error",
        500,
      ),
    };
  }

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return {
      error: errorResponse(req, "Missing or invalid authorization header", 401),
    };
  }

  try {
    // Use getUser() for server-side validation - this actually verifies
    // with the Supabase Auth server that the session is still valid
    // (unlike getClaims() which only does local JWT validation)
    const { data, error } = await supabaseClient.auth.getUser(token);

    if (error || !data?.user) {
      return {
        error: errorResponse(
          req,
          "Unauthorized - invalid token",
          401,
        ),
      };
    }

    return {
      userId: data.user.id,
      email: data.user.email,
    };
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "Authentication failed",
      errorType: error instanceof Error ? error.name : "UnknownError",
      timestamp: new Date().toISOString(),
    }));
    return {
      error: errorResponse(
        req,
        "Authentication failed",
        401,
      ),
    };
  }
}

/**
 * Log authentication events safely (without exposing PHI)
 */
export function logAuthEvent(
  event: "authenticated" | "auth_failed" | "rate_limited",
  _userId?: string,
): void {
  console.log(JSON.stringify({
    level: "info",
    event: `Authentication ${event}`,
    timestamp: new Date().toISOString(),
  }));
}
