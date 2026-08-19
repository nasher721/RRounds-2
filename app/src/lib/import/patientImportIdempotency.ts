import { db, type PatientImportAttemptRecord } from "@/lib/offline/database";
import { offlineOwnerTransitionBarrier } from "@/lib/offline/ownerTransitionBarrier";

export interface PatientImportAttempt {
  fingerprint: string;
  patientIds: string[];
}

export class PatientImportStorageUnavailableError extends Error {
  constructor() {
    super("Durable patient import retry storage is unavailable");
    this.name = "PatientImportStorageUnavailableError";
  }
}

export interface PatientImportAttemptStorage {
  acquire: (
    ownerId: string,
    fingerprint: string,
    patientCount: number,
    createPatientIds: () => string[],
  ) => Promise<string[]>;
  clear: (ownerId: string, fingerprint: string) => Promise<void>;
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return '"__undefined__"';
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableSerialize(nested)}`)
    .join(",")}}`;
}

async function fingerprintImport(rows: readonly unknown[]): Promise<string> {
  const serialized = stableSerialize(rows);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(serialized),
    );
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  let hash = 0x811c9dc5;
  let secondaryHash = 0x9e3779b9;
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    hash ^= code;
    hash = Math.imul(hash, 0x01000193);
    secondaryHash ^= code + index;
    secondaryHash = Math.imul(secondaryHash, 0x85ebca6b);
  }
  return `fallback-${(hash >>> 0).toString(16).padStart(8, "0")}${(secondaryHash >>> 0).toString(16).padStart(8, "0")}-${serialized.length}`;
}

function createUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const attemptId = (ownerId: string, fingerprint: string) => `${ownerId}:${fingerprint}`;

const indexedDbAttemptStorage: PatientImportAttemptStorage = {
  acquire: async (ownerId, fingerprint, patientCount, createPatientIds) => {
    try {
      await db.open();
    } catch {
      // Without a durable, cross-tab idempotency record, a committed request
      // whose response is lost cannot be retried safely. Fail before sending.
      throw new PatientImportStorageUnavailableError();
    }
    return db.transaction("rw", db.patientImportAttempts, async () => {
      const id = attemptId(ownerId, fingerprint);
      const existing = await db.patientImportAttempts.get(id);
      if (existing?.patientIds.length === patientCount) {
        return [...existing.patientIds];
      }

      const patientIds = createPatientIds();
      const record: PatientImportAttemptRecord = {
        id,
        ownerId,
        fingerprint,
        patientIds,
        createdAt: Date.now(),
      };
      await db.patientImportAttempts.put(record);

      return patientIds;
    });
  },
  clear: async (ownerId, fingerprint) => {
    try {
      await db.patientImportAttempts.delete(attemptId(ownerId, fingerprint));
    } catch {
      throw new PatientImportStorageUnavailableError();
    }
  },
};

let attemptStorage: PatientImportAttemptStorage = indexedDbAttemptStorage;

/** Test-only dependency seam; production always uses the IndexedDB transaction. */
export function setPatientImportAttemptStorageForTests(
  storage: PatientImportAttemptStorage,
): () => void {
  const previous = attemptStorage;
  attemptStorage = storage;
  return () => {
    attemptStorage = previous;
  };
}

/**
 * Reuses client-generated patient IDs only while an identical import has an
 * ambiguous outcome. The IndexedDB transaction is atomic across same-origin
 * tabs and stores no patient content.
 */
export async function acquirePatientImportAttempt(
  ownerId: string,
  rows: readonly unknown[],
): Promise<PatientImportAttempt> {
  const fingerprint = await fingerprintImport(rows);

  return offlineOwnerTransitionBarrier.runOperation(async () => {
    const patientIds = await attemptStorage.acquire(
      ownerId,
      fingerprint,
      rows.length,
      () => rows.map(() => createUuid()),
    );
    return { fingerprint, patientIds };
  });
}

export async function clearPatientImportAttempt(
  ownerId: string,
  fingerprint: string,
): Promise<void> {
  await offlineOwnerTransitionBarrier.runOperation(async () => {
    await attemptStorage.clear(ownerId, fingerprint);
  });
}

/** Keep an import's idempotency record alive until its write outcome is known. */
export function runPatientImportWrite<T>(write: () => Promise<T>): Promise<T> {
  return offlineOwnerTransitionBarrier.runOperation(write);
}
