import type { Patient } from '@/types/patient';
import { logInfo } from '@/lib/observability/logger';
import { indexedDBQueue } from './indexedDBQueue';
import {
  AUTH_OWNER_METADATA_ID,
  db,
  type CachedPatient,
  type QueuedMutationDB,
  type SyncMetadata,
} from './database';
import { offlineOwnerTransitionBarrier } from './ownerTransitionBarrier';

const PATIENT_ROSTER_SNAPSHOT_ID = '__patient_roster_snapshot__';
let rosterWriteTail: Promise<void> = Promise.resolve();

function lastModifiedEpoch(patient: Patient): number {
  const parsed = Date.parse(patient.lastModified);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildCachedPatientRows(
  patients: readonly Patient[],
  cachedAt: number,
): CachedPatient[] {
  return patients.map((patient) => ({
    id: patient.id,
    data: patient as unknown as Record<string, unknown>,
    cachedAt,
    lastModified: lastModifiedEpoch(patient),
    syncStatus: 'synced',
    version: patient.revision ?? 0,
  }));
}

function isPatient(value: unknown): value is Patient {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Patient>;
  return typeof candidate.id === 'string'
    && typeof candidate.patientNumber === 'number'
    && typeof candidate.name === 'string'
    && typeof candidate.clinicalSummary === 'string'
    && typeof candidate.systems === 'object'
    && candidate.systems !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function applyQueuedPatientUpdate(patient: Patient, payload: Record<string, unknown>): Patient {
  const next: Patient = { ...patient };
  const assignString = (dbField: string, uiField: keyof Patient) => {
    const value = payload[dbField];
    if (typeof value === 'string') {
      (next as unknown as Record<string, unknown>)[uiField] = value;
    }
  };
  const assignOptionalString = (dbField: string, uiField: keyof Patient) => {
    if (!Object.prototype.hasOwnProperty.call(payload, dbField)) return;
    const value = payload[dbField];
    if (typeof value === 'string' || value === null) {
      (next as unknown as Record<string, unknown>)[uiField] = value ?? undefined;
    }
  };

  assignString('name', 'name');
  assignString('mrn', 'mrn');
  assignString('bed', 'bed');
  assignString('clinical_summary', 'clinicalSummary');
  assignString('interval_events', 'intervalEvents');
  assignString('imaging', 'imaging');
  assignString('labs', 'labs');
  assignString('last_modified', 'lastModified');

  assignOptionalString('date_of_birth', 'dateOfBirth');
  assignOptionalString('gender', 'gender');
  assignOptionalString('admission_date', 'admissionDate');
  assignOptionalString('service_line', 'serviceLine');
  assignOptionalString('attending_physician', 'attendingPhysician');
  assignOptionalString('acuity', 'acuity');
  assignOptionalString('code_status', 'codeStatus');
  assignOptionalString('assigned_to', 'assignedTo');

  if (typeof payload.patient_number === 'number') next.patientNumber = payload.patient_number;
  if (typeof payload.age === 'number' || payload.age === null) next.age = payload.age ?? undefined;
  if (typeof payload.collapsed === 'boolean') next.collapsed = payload.collapsed;
  if (isRecord(payload.systems)) {
    next.systems = { ...next.systems, ...payload.systems } as Patient['systems'];
  }
  if (isRecord(payload.medications)) {
    next.medications = { ...next.medications, ...payload.medications } as Patient['medications'];
  }
  if (isRecord(payload.field_timestamps)) {
    next.fieldTimestamps = {
      ...next.fieldTimestamps,
      ...payload.field_timestamps,
    } as Patient['fieldTimestamps'];
  }
  if (Array.isArray(payload.consulting_team)) {
    next.consultingTeam = payload.consulting_team.filter((value): value is string => typeof value === 'string');
  }
  if (Array.isArray(payload.alerts)) {
    next.alerts = payload.alerts.filter((value): value is string => typeof value === 'string');
  }
  if (isRecord(payload.vitals)) next.vitals = payload.vitals as Patient['vitals'];

  return next;
}

/**
 * Rebuild the roster visible to the clinician by applying durable, unresolved
 * local edits over the last server snapshot. The queue remains the source of
 * truth for replay; this projection only prevents a reload from hiding work
 * that the UI already accepted as "Offline queued".
 */
export function applyQueuedPatientUpdates(
  patients: readonly Patient[],
  mutations: readonly QueuedMutationDB[],
  ownerId: string,
): Patient[] {
  const updates = mutations
    .filter((mutation) => (
      mutation.ownerId === ownerId
      && mutation.type === 'patient'
      && mutation.table === 'patients'
      && mutation.operation === 'update'
      && mutation.entityId
      && mutation.status !== 'completed'
    ))
    .sort((left, right) => left.timestamp - right.timestamp);

  if (updates.length === 0) return [...patients];

  const byId = new Map(patients.map((patient) => [patient.id, patient]));
  for (const mutation of updates) {
    const patient = byId.get(mutation.entityId!);
    if (!patient) continue;
    byId.set(patient.id, applyQueuedPatientUpdate(patient, mutation.payload));
  }

  return patients
    .map((patient) => byId.get(patient.id) ?? patient)
    .sort((left, right) => left.patientNumber - right.patientNumber);
}

/** Overlay the authenticated owner's durable patient queue on a roster base. */
export async function overlayPendingPatientUpdates(
  ownerId: string,
  patients: readonly Patient[],
): Promise<Patient[]> {
  try {
    return applyQueuedPatientUpdates(patients, await indexedDBQueue.getQueue(), ownerId);
  } catch (error) {
    logInfo(`[PatientRosterCache] Queue overlay unavailable: ${error instanceof Error ? error.name : 'storage_error'}`);
    return [...patients];
  }
}

/**
 * Persist the last owner-scoped server/UI roster atomically. The database is
 * globally bound to one authenticated owner; the metadata check prevents a
 * stale async write from crossing an auth transition.
 */
export async function writePatientRosterSnapshot(
  ownerId: string,
  patients: readonly Patient[],
): Promise<boolean> {
  if (typeof globalThis.indexedDB === 'undefined') return false;

  try {
    const write = rosterWriteTail.then(() => (
      offlineOwnerTransitionBarrier.runOperation(async () => {
        await db.open();
        return db.transaction('rw', db.patients, db.syncMetadata, async () => {
          const owner = await db.syncMetadata.get(AUTH_OWNER_METADATA_ID);
          if (owner?.ownerId !== ownerId) return false;

          const cachedAt = Date.now();
          const rows = buildCachedPatientRows(patients, cachedAt);
          const snapshotMetadata: SyncMetadata = {
            id: PATIENT_ROSTER_SNAPSHOT_ID,
            tableName: 'patients',
            lastSyncAt: cachedAt,
            lastSuccessfulSyncAt: cachedAt,
            pendingChanges: 0,
            conflictCount: 0,
            ownerId,
          };

          await db.patients.clear();
          if (rows.length > 0) await db.patients.bulkPut(rows);
          await db.syncMetadata.put(snapshotMetadata);
          return true;
        });
      })
    ));
    rosterWriteTail = write.then(() => undefined, () => undefined);
    return await write;
  } catch (error) {
    logInfo(`[PatientRosterCache] Snapshot unavailable: ${error instanceof Error ? error.name : 'storage_error'}`);
    return false;
  }
}

/** Return null when no trustworthy snapshot exists; [] is a valid empty roster. */
export async function readPatientRosterSnapshot(ownerId: string): Promise<Patient[] | null> {
  if (typeof globalThis.indexedDB === 'undefined') return null;

  try {
    return await offlineOwnerTransitionBarrier.runOperation(async () => {
      await db.open();
      return db.transaction('r', db.patients, db.syncMetadata, async () => {
        const [owner, snapshot, rows] = await Promise.all([
          db.syncMetadata.get(AUTH_OWNER_METADATA_ID),
          db.syncMetadata.get(PATIENT_ROSTER_SNAPSHOT_ID),
          db.patients.toArray(),
        ]);
        if (owner?.ownerId !== ownerId || snapshot?.ownerId !== ownerId) return null;

        return rows
          .map((row): unknown => row.data)
          .filter(isPatient)
          .sort((left, right) => left.patientNumber - right.patientNumber);
      });
    });
  } catch (error) {
    logInfo(`[PatientRosterCache] Restore unavailable: ${error instanceof Error ? error.name : 'storage_error'}`);
    return null;
  }
}

/** Read the last roster and restore every accepted, still-pending patient edit. */
export async function readPatientRosterWithPendingUpdates(ownerId: string): Promise<Patient[] | null> {
  const snapshot = await readPatientRosterSnapshot(ownerId);
  if (snapshot === null) return null;
  return overlayPendingPatientUpdates(ownerId, snapshot);
}
