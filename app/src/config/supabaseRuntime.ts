export interface SupabaseRuntimeEnv {
  VITE_SUPABASE_URL?: unknown;
  VITE_SUPABASE_PUBLISHABLE_KEY?: unknown;
  VITE_SUPABASE_ANON_KEY?: unknown;
}

export type SupabaseRuntimeConfig =
  | { available: true; url: string; key: string }
  | { available: false; reason: "missing" | "invalid" };

export function getSupabaseRuntimeConfig(env: SupabaseRuntimeEnv): SupabaseRuntimeConfig {
  const url = typeof env.VITE_SUPABASE_URL === "string"
    ? env.VITE_SUPABASE_URL.trim().replace(/\/$/, "")
    : "";
  const keyCandidate = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  const key = typeof keyCandidate === "string" ? keyCandidate.trim() : "";

  if (!url || !key) {
    return { available: false, reason: "missing" };
  }

  try {
    const parsed = new URL(url);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || !parsed.hostname) {
      return { available: false, reason: "invalid" };
    }
  } catch {
    return { available: false, reason: "invalid" };
  }

  return { available: true, url, key };
}

