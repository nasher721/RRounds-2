export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type SafeStorageAdapter = StorageLike & {
  /** True after any browser access/read/write/remove failure forced memory fallback. */
  isDegraded: () => boolean;
};

export type StoredJsonResult<T> =
  | { status: "ok"; value: T }
  | { status: "missing" }
  | { status: "corrupt"; raw: string };

/**
 * Storage can be unavailable even when `window` exists (privacy mode, blocked
 * third-party storage, or a throwing browser getter). Resolve it per operation
 * and retain an in-memory fallback so callers never crash during render.
 */
export const createSafeStorage = (
  storageName: "localStorage" | "sessionStorage" = "localStorage",
): SafeStorageAdapter => {
  const memoryStore = new Map<string, string>();
  const pendingOverrides = new Map<string, string | null>();
  let degraded = false;

  const markDegraded = (_reason: unknown): void => {
    degraded = true;
  };

  const getBrowserStorage = (): Storage | null => {
    if (typeof window === "undefined") return null;
    try {
      return window[storageName];
    } catch (error) {
      markDegraded(error);
      return null;
    }
  };

  return {
    isDegraded: () => degraded,
    getItem: (key) => {
      if (pendingOverrides.has(key)) {
        return pendingOverrides.get(key) ?? null;
      }

      try {
        const storage = getBrowserStorage();
        if (storage) {
          const browserValue = storage.getItem(key);
          if (browserValue !== null) {
            memoryStore.set(key, browserValue);
            return browserValue;
          }
          memoryStore.delete(key);
          return null;
        }
      } catch (error) {
        markDegraded(error);
        // Fall through to the in-memory value.
      }
      return memoryStore.get(key) ?? null;
    },
    setItem: (key, value) => {
      memoryStore.set(key, value);
      try {
        const storage = getBrowserStorage();
        if (!storage) throw new Error("Browser storage unavailable");
        storage.setItem(key, value);
        pendingOverrides.delete(key);
      } catch (error) {
        markDegraded(error);
        // A stale browser value must not override the newer in-memory write.
        pendingOverrides.set(key, value);
      }
    },
    removeItem: (key) => {
      memoryStore.delete(key);
      try {
        const storage = getBrowserStorage();
        if (!storage) throw new Error("Browser storage unavailable");
        storage.removeItem(key);
        pendingOverrides.delete(key);
      } catch (error) {
        markDegraded(error);
        // Retain a tombstone so a stale browser value cannot reappear.
        pendingOverrides.set(key, null);
      }
    },
  };
};

/** Explicit sessionStorage adapter (same resilience as createSafeStorage). */
export const createSafeSessionStorage = (): SafeStorageAdapter =>
  createSafeStorage("sessionStorage");

/**
 * Read JSON from a StorageLike without masking corruption as a missing key.
 * Callers should apply defaults on `missing` or `corrupt`; corrupt payloads
 * remain distinguishable so they can be quarantined.
 */
export const readStoredJson = <T>(
  storage: StorageLike,
  key: string,
): StoredJsonResult<T> => {
  const raw = storage.getItem(key);
  if (raw === null) return { status: "missing" };
  try {
    return { status: "ok", value: JSON.parse(raw) as T };
  } catch {
    return { status: "corrupt", raw };
  }
};

export const safeLocalStorage = createSafeStorage("localStorage");
export const safeSessionStorage = createSafeSessionStorage();
