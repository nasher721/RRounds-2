import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultMedications, defaultSystems, type Patient } from '@/types/patient';
import type { QueuedMutationDB } from './database';
import { applyQueuedPatientUpdates, buildCachedPatientRows } from './patientRosterCache';

const patient = (overrides: Partial<Patient> = {}): Patient => ({
  id: 'patient-1',
  patientNumber: 3,
  name: 'Cached Patient',
  mrn: 'MRN-1',
  bed: 'B3',
  clinicalSummary: 'Stable',
  intervalEvents: '',
  imaging: '',
  labs: '',
  systems: { ...defaultSystems },
  medications: { ...defaultMedications },
  fieldTimestamps: {},
  collapsed: false,
  createdAt: '2026-08-13T10:00:00.000Z',
  lastModified: '2026-08-13T10:05:00.000Z',
  revision: 7,
  ...overrides,
});

test('patient roster snapshots preserve the complete UI record and revision', () => {
  const cachedAt = Date.parse('2026-08-13T10:10:00.000Z');
  const [row] = buildCachedPatientRows([patient()], cachedAt);

  assert.equal(row.id, 'patient-1');
  assert.equal(row.cachedAt, cachedAt);
  assert.equal(row.lastModified, Date.parse('2026-08-13T10:05:00.000Z'));
  assert.equal(row.version, 7);
  assert.equal(row.syncStatus, 'synced');
  assert.deepEqual(row.data, patient());
});

test('patient roster snapshots tolerate malformed legacy timestamps', () => {
  const [row] = buildCachedPatientRows([patient({ lastModified: '' })], 1);
  assert.equal(row.lastModified, 0);
});

const queuedUpdate = (
  overrides: Partial<QueuedMutationDB> = {},
): QueuedMutationDB => ({
  id: 'mutation-1',
  type: 'patient',
  operation: 'update',
  table: 'patients',
  entityId: 'patient-1',
  ownerId: 'owner-1',
  payload: {
    clinical_summary: 'Queued bedside update',
    systems: { ...defaultSystems, resp: 'Vent changed while offline' },
    field_timestamps: { clinicalSummary: '2026-08-13T10:11:00.000Z' },
    last_modified: '2026-08-13T10:11:00.000Z',
  },
  timestamp: 1,
  retryCount: 0,
  maxRetries: 3,
  status: 'pending',
  ...overrides,
});

test('queued patient updates are restored over a stale roster snapshot', () => {
  const [restored] = applyQueuedPatientUpdates(
    [patient()],
    [queuedUpdate()],
    'owner-1',
  );

  assert.equal(restored.clinicalSummary, 'Queued bedside update');
  assert.equal(restored.systems.resp, 'Vent changed while offline');
  assert.equal(restored.fieldTimestamps.clinicalSummary, '2026-08-13T10:11:00.000Z');
  assert.equal(restored.lastModified, '2026-08-13T10:11:00.000Z');
  assert.equal(restored.revision, 7, 'local projection must preserve the server replay revision');
});

test('patient roster overlay rejects another owner and completed queue records', () => {
  const restored = applyQueuedPatientUpdates(
    [patient()],
    [
      queuedUpdate({ ownerId: 'owner-2' }),
      queuedUpdate({ id: 'mutation-2', status: 'completed' }),
    ],
    'owner-1',
  );

  assert.deepEqual(restored, [patient()]);
});
