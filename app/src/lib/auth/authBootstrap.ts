import type { Session } from "@supabase/supabase-js";
import type { StorageLike } from "@/utils/safeStorage";

/** Public routes should never wait through the full API retry envelope. */
export const AUTH_BOOTSTRAP_TIMEOUT_MS = 3_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Read only a structurally valid, still-usable browser session. This is a
 * recovery path for a stalled auth client, not a replacement for Supabase's
 * eventual refresh/validation result.
 */
export function readUnexpiredCachedSession(
  storage: StorageLike,
  storageKey: string,
  nowMs = Date.now(),
): Session | null {
  let raw: string | null;
  try {
    raw = storage.getItem(storageKey);
  } catch {
    return null;
  }
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || !isRecord(value.user)) return null;

  const expiresAt = value.expires_at;
  if (
    typeof value.access_token !== "string"
    || value.access_token.length === 0
    || typeof value.refresh_token !== "string"
    || value.refresh_token.length === 0
    || typeof value.user.id !== "string"
    || value.user.id.length === 0
    || typeof expiresAt !== "number"
    || !Number.isSafeInteger(expiresAt)
    || expiresAt * 1_000 <= nowMs
  ) {
    return null;
  }

  return value as unknown as Session;
}
