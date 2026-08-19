import { safeLocalStorage, type StorageLike } from "@/utils/safeStorage";

const PRINT_STORAGE_PREFIX = "rr:print-preferences:v1";

/**
 * Unscoped keys used by older releases. Some values contain user-authored
 * layout names and combinations, so they must never be attributed to the next
 * account that signs in on a shared browser.
 */
export const LEGACY_PRINT_PREFERENCE_KEYS = [
  "printColumnWidths",
  "printColumnPrefs",
  "printFontSize",
  "printFontFamily",
  "printOnePatientPerPage",
  "printAutoFitFontSize",
  "printCombinedColumns",
  "printCombinedColumnWidths",
  "printSystemsReviewColumnCount",
  "printOrientation",
  "printCustomPresets",
  "printCustomCombinations",
  "printTemplatePresets",
  "printSelectedTemplateId",
  "printMargins",
  "printHeaderStyle",
  "printBorderStyle",
  "printShowPageNumbers",
  "printShowTimestamp",
  "printAlternateRowColors",
  "printCompactMode",
  "printPhysicianName",
  "layoutDesigner_savedLayouts",
  "layoutDesigner_currentLayoutId",
  "layoutDesigner_recentLayouts",
] as const;

const ownerSegment = (ownerId: string | null): string =>
  ownerId ? `user:${encodeURIComponent(ownerId)}` : "anonymous";

export const getScopedPrintStorageKey = (ownerId: string | null, key: string): string =>
  `${PRINT_STORAGE_PREFIX}:${ownerSegment(ownerId)}:${key}`;

/** Restrict a Storage-like object to one account-specific print namespace. */
export const createScopedPrintStorage = (
  ownerId: string | null,
  storage: StorageLike = safeLocalStorage,
): StorageLike => ({
  getItem: (key) => storage.getItem(getScopedPrintStorageKey(ownerId, key)),
  setItem: (key, value) => storage.setItem(getScopedPrintStorageKey(ownerId, key), value),
  removeItem: (key) => storage.removeItem(getScopedPrintStorageKey(ownerId, key)),
});

/** Delete legacy values whose owner cannot be proven. */
export const quarantineLegacyPrintPreferences = (
  storage: StorageLike = safeLocalStorage,
): void => {
  LEGACY_PRINT_PREFERENCE_KEYS.forEach((key) => storage.removeItem(key));
};

export interface AuthenticatedPrintPayloadDecision<T> {
  payload: T;
  shouldInitializeDatabase: boolean;
}

/**
 * Authenticated print preferences are sourced only from the user's DB row.
 * If no row exists, initialize it from application defaults—not browser data
 * whose ownership cannot be established.
 */
export const getAuthenticatedPrintPayload = <T>(
  databasePayload: T | null | undefined,
  defaultPayload: T,
): AuthenticatedPrintPayloadDecision<T> => {
  if (databasePayload == null) {
    return { payload: defaultPayload, shouldInitializeDatabase: true };
  }
  return { payload: databasePayload, shouldInitializeDatabase: false };
};
