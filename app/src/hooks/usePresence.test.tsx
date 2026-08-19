import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { act, cleanup, renderHook } from '@testing-library/react';
import { usePatientPresence, usePresence } from './usePresence';
import { usePhrasePresence } from './usePhrasePresence';

afterEach(cleanup);

test('global presence remains disconnected and publishes no user data', async () => {
  const { result } = renderHook(() => usePresence('global'));

  assert.deepEqual(result.current.users, []);
  assert.equal(result.current.totalOnline, 0);
  assert.equal(result.current.isConnected, false);

  await act(async () => {
    await result.current.updatePage('dashboard');
  });

  assert.deepEqual(result.current.users, []);
  assert.equal(result.current.isConnected, false);
});

test('patient presence uses the same disabled adapter', () => {
  const { result } = renderHook(() => usePatientPresence('patient-123'));

  assert.deepEqual(result.current.users, []);
  assert.equal(result.current.totalOnline, 0);
  assert.equal(result.current.isConnected, false);
});

test('phrase presence remains empty and editing actions are inert', async () => {
  const { result } = renderHook(() => usePhrasePresence({ phraseId: 'phrase-123' }));

  assert.deepEqual(result.current.presenceState.viewers, []);
  assert.deepEqual(result.current.presenceState.editors, []);
  assert.equal(result.current.presenceState.viewerCount, 0);
  assert.equal(result.current.presenceState.isBeingEdited, false);
  assert.equal(result.current.isEditing, false);

  await act(async () => {
    await result.current.startEditing(4);
    await result.current.updateCursorPosition(5, { start: 4, end: 5 });
    await result.current.stopEditing();
  });

  assert.equal(result.current.presenceState.isBeingEdited, false);
  assert.equal(result.current.isEditing, false);
});
