import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import type { PatientTodo } from '@/types/todo';
import {
  buildPatientTodoSnapshot,
  normalizePatientTodoSnapshot,
} from './patientTodoSnapshot';

const todo = (overrides: Partial<PatientTodo> = {}): PatientTodo => ({
  id: 'todo-1',
  patientId: 'patient-1',
  userId: 'owner-1',
  section: 'resp',
  content: 'Review ventilator plan',
  completed: false,
  createdAt: '2026-08-13T10:00:00.000Z',
  updatedAt: '2026-08-13T10:00:00.000Z',
  ...overrides,
});

test('Todo snapshots preserve queued UI state for offline review and export', () => {
  const queuedTodo = todo({ syncStatus: 'queued', localOnly: true });
  const snapshot = buildPatientTodoSnapshot(
    'owner-1',
    { 'patient-1': [queuedTodo], 'patient-2': [] },
    123,
  );

  assert.ok(snapshot);
  assert.equal(snapshot.ownerId, 'owner-1');
  assert.equal(snapshot.cachedAt, 123);
  assert.deepEqual(snapshot.data, {
    'patient-1': [queuedTodo],
    'patient-2': [],
  });
});

test('Todo snapshots reject cross-owner and mismatched-patient rows', () => {
  assert.equal(normalizePatientTodoSnapshot('owner-1', {
    'patient-1': [todo({ userId: 'owner-2' })],
  }), null);
  assert.equal(normalizePatientTodoSnapshot('owner-1', {
    'patient-2': [todo({ patientId: 'patient-1' })],
  }), null);
  assert.equal(normalizePatientTodoSnapshot('owner-1', {
    'patient-1': [{ ...todo(), syncStatus: 'unknown' }],
  }), null);
});

test('Todo snapshot storage participates in every auth-boundary purge', () => {
  const source = readFileSync('src/lib/offline/database.ts', 'utf8');

  assert.match(source, /version\(5\)\.stores\(\{\s*todoSnapshots:/);
  assert.match(source, /const ownerBoundDataTables = \(\) => \[[\s\S]*db\.todoSnapshots/);
  assert.match(source, /clearOwnerBoundData[\s\S]*db\.todoSnapshots\.clear\(\)/);
});
