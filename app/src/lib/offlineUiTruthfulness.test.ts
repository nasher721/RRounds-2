import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const fromRoot = (...segments: string[]) => path.join(process.cwd(), ...segments);
const readSource = (file: string) => readFileSync(fromRoot(file), 'utf8');

test('mounted offline UI scopes durable queue claims to confirmed patient changes', () => {
  const indicator = readSource('src/components/OfflineIndicator.tsx');
  const networkStatus = readSource('src/hooks/useNetworkStatus.ts');
  const source = [indicator, networkStatus].join('\n');

  assert.match(source, /stored on this device/i);
  assert.match(source, /confirms Offline queued/i);
  assert.doesNotMatch(networkStatus, /changes are not queued/i);
  assert.match(
    networkStatus,
    /Only patient changes showing Offline queued or Queued are stored on this device/i,
  );
  assert.match(networkStatus, /confirm Queued clears or Saved appears/i);
});

test('queued clinical changes require a recovery-first confirmation before discard', () => {
  const indicator = readSource('src/components/OfflineIndicator.tsx');
  const desktopDashboard = readSource('src/components/dashboard/DesktopDashboard.tsx');

  assert.match(indicator, /Download recovery copy/);
  assert.match(indicator, /Discard local pending changes\?/);
  assert.match(indicator, /recoveryReady/);
  assert.match(indicator, /disabled=\{!recoveryReady \|\| isClearingQueue\}/);
  assert.match(indicator, /discardQueue\(downloadedQueueSignature\)/);
  assert.match(indicator, /Pending changes changed/);
  const queue = readSource('src/lib/offline/indexedDBQueue.ts');
  assert.match(queue, /BroadcastChannel/);
  assert.match(queue, /db\.transaction\('rw', db\.mutations/);
  assert.match(queue, /pendingQueueSignature\(ownedMutations\) !== expectedSignature/);
  assert.equal(
    (desktopDashboard.match(/<OfflineIndicator/g) ?? []).length,
    1,
    'one shared dashboard recovery surface must remain visible at every breakpoint',
  );
});

test('persistent network warning does not cover Round lifecycle controls', () => {
  const app = readSource('src/App.tsx');
  const sonner = readSource('src/components/ui/sonner.tsx');

  assert.match(app, /<Sonner position="bottom-right"/);
  assert.doesNotMatch(app, /<Sonner position="top-right"/);
  assert.match(sonner, /toast pointer-events-none/);
  assert.match(sonner, /closeButton: "pointer-events-auto/);
});

test('production patient mutations durably enqueue retryable update failures', () => {
  const source = readSource('src/hooks/patients/usePatientMutations.ts');

  assert.match(source, /indexedDBQueue\.enqueue/);
  assert.match(source, /Offline — change queued/);
  assert.match(source, /Patient changes could not be saved or queued/);
});

test('post-fetch roster and Todo cache writes revoke verification when persistence fails', () => {
  const patientFetch = readSource('src/hooks/patients/usePatientFetch.ts');
  const todoFetch = readSource('src/hooks/useAllPatientTodos.ts');

  assert.match(patientFetch, /writePatientRosterSnapshot[\s\S]*!snapshotPersisted[\s\S]*verification: "stale"/);
  assert.match(todoFetch, /writePatientTodoSnapshot[\s\S]*!snapshotPersisted[\s\S]*verification: 'stale'/);
});

test('unreachable alternate offline mutation hooks remain removed', () => {
  assert.equal(existsSync(fromRoot('src/hooks/useOfflineMutation.ts')), false);
  assert.equal(existsSync(fromRoot('src/hooks/useOfflineSync.ts')), false);
});
