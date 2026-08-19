import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  acquirePatientImportAttempt,
  clearPatientImportAttempt,
  PatientImportStorageUnavailableError,
  runPatientImportWrite,
  setPatientImportAttemptStorageForTests,
  type PatientImportAttemptStorage,
} from "./patientImportIdempotency";
import { offlineOwnerTransitionBarrier } from "../offline/ownerTransitionBarrier";

function createMemoryAttemptStorage(): PatientImportAttemptStorage & { serialized: () => string } {
  const attempts = new Map<string, string[]>();
  let transactionTail = Promise.resolve();
  return {
    serialized: () => JSON.stringify([...attempts.entries()]),
    acquire: async (ownerId, fingerprint, patientCount, createPatientIds) => {
      const previous = transactionTail;
      let release: () => void = () => {};
      transactionTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        const key = `${ownerId}:${fingerprint}`;
        const existing = attempts.get(key);
        if (existing?.length === patientCount) return [...existing];
        const patientIds = createPatientIds();
        attempts.set(key, patientIds);
        return [...patientIds];
      } finally {
        release();
      }
    },
    clear: async (ownerId, fingerprint) => {
      attempts.delete(`${ownerId}:${fingerprint}`);
    },
  };
}

let restoreStorage: () => void = () => {};
let memoryStorage: ReturnType<typeof createMemoryAttemptStorage>;

beforeEach(() => {
  memoryStorage = createMemoryAttemptStorage();
  restoreStorage = setPatientImportAttemptStorageForTests(memoryStorage);
});

afterEach(() => {
  restoreStorage();
});

test("patient import retries reuse IDs without storing patient content", async () => {
  const rows = [{ name: "Jane Sensitive", mrn: "MRN-SECRET", bed: "12A" }];

  const first = await acquirePatientImportAttempt("owner-a", rows);
  const retry = await acquirePatientImportAttempt("owner-a", rows);

  assert.deepEqual(retry, first);
  assert.equal(first.patientIds.length, 1);
  assert.match(first.patientIds[0], /^[0-9a-f-]{36}$/i);
  assert.doesNotMatch(memoryStorage.serialized(), /Jane Sensitive|MRN-SECRET|12A/);
});

test("concurrent same-owner attempts atomically converge on one ID set", async () => {
  const rows = [{ name: "Concurrent Roster", bed: "1" }];

  const [first, second] = await Promise.all([
    acquirePatientImportAttempt("owner-a", rows),
    acquirePatientImportAttempt("owner-a", rows),
  ]);

  assert.deepEqual(second.patientIds, first.patientIds);
});

test("a confirmed import clears its retry IDs for a later intentional import", async () => {
  const rows = [{ name: "Same Roster", bed: "1" }];
  const first = await acquirePatientImportAttempt("owner-a", rows);

  await clearPatientImportAttempt("owner-a", first.fingerprint);
  const laterImport = await acquirePatientImportAttempt("owner-a", rows);

  assert.notDeepEqual(laterImport.patientIds, first.patientIds);
});

test("a second pending roster does not displace an earlier ambiguous retry", async () => {
  const firstRows = [{ name: "First Roster", bed: "1" }];
  const secondRows = [{ name: "Second Roster", bed: "2" }];
  const first = await acquirePatientImportAttempt("owner-a", firstRows);

  await acquirePatientImportAttempt("owner-a", secondRows);
  const firstRetry = await acquirePatientImportAttempt("owner-a", firstRows);

  assert.deepEqual(firstRetry.patientIds, first.patientIds);
});

test("many pending rosters do not silently evict an earlier ambiguous retry", async () => {
  const firstRows = [{ name: "First Roster", bed: "1" }];
  const first = await acquirePatientImportAttempt("owner-a", firstRows);

  for (let index = 0; index < 12; index += 1) {
    await acquirePatientImportAttempt("owner-a", [
      { name: `Later Roster ${index}`, bed: String(index + 2) },
    ]);
  }

  const firstRetry = await acquirePatientImportAttempt("owner-a", firstRows);
  assert.deepEqual(firstRetry.patientIds, first.patientIds);
});

test("owner transitions wait until an import write outcome is known", async () => {
  const order: string[] = [];
  let releaseWrite: () => void = () => {};
  const writeGate = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });

  const write = runPatientImportWrite(async () => {
    order.push("write-start");
    await writeGate;
    order.push("write-end");
  });
  await Promise.resolve();

  const transition = offlineOwnerTransitionBarrier.runTransition(async () => {
    order.push("transition");
  });
  await Promise.resolve();
  assert.deepEqual(order, ["write-start"]);

  releaseWrite();
  await Promise.all([write, transition]);
  assert.deepEqual(order, ["write-start", "write-end", "transition"]);
});

test("missing durable storage fails before an import can be sent", async () => {
  restoreStorage();

  await assert.rejects(
    acquirePatientImportAttempt("owner-a", [{ name: "Unsafe retry" }]),
    PatientImportStorageUnavailableError,
  );
});
