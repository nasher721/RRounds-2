import { safeLocalStorage } from "@/utils/safeStorage";

/**
 * Feature flag for the Focus-first Today’s Round runner (desktop + mobile strangler).
 *
 * - Unset / "1" / "true" / "on" → enabled (default ON)
 * - "0" / "false" / "off" → classic DesktopDashboard / MobileDashboard chrome
 *
 * Local override: `localStorage["rr-round-runner"]` = "0" | "1"
 */

const ENV_FALSE = new Set(["0", "false", "off", "no"]);
const ENV_TRUE = new Set(["1", "true", "on", "yes"]);
const ROUND_RUNNER_STORAGE_KEY = "rr-round-runner";

const normalizeFlag = (raw: string | undefined | null): boolean | null => {
  if (raw === undefined || raw === null) return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (ENV_FALSE.has(value)) return false;
  if (ENV_TRUE.has(value)) return true;
  return null;
};

/** Returns whether the Round runner shell should replace primary desktop/mobile chrome. */
export const isRoundRunnerEnabled = (): boolean => {
  if (typeof window !== "undefined") {
    const local = normalizeFlag(safeLocalStorage.getItem(ROUND_RUNNER_STORAGE_KEY));
    if (local !== null) return local;
  }

  const env = normalizeFlag(import.meta.env.VITE_ROUND_RUNNER as string | undefined);
  if (env !== null) return env;
  return true;
};
