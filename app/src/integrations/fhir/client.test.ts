import assert from 'node:assert/strict';
import test from 'node:test';
import FHIR from 'fhirclient';
import {
  assertFHIRLaunchOwner,
  clearFHIRState,
  handleCallback,
  launchSMART,
  loadFHIRState,
  reconcileFHIRStateForAuthOwner,
  saveFHIRState,
} from './client';

const SMART_KEY = 'SMART_KEY';
const APP_STATE_KEY = 'fhir_state';
const LEGACY_LAUNCH_KEY = 'fhir_launch_state';

type AuthMockGlobal = typeof globalThis & {
  __SUPABASE_AUTH_MOCK__?: {
    getSession: () => Promise<{
      data: { session: { user: { id: string } } | null };
      error: Error | null;
    }>;
  };
};

function installOAuth2Mock(mock: {
  authorize?: (options: unknown) => Promise<void>;
  ready?: () => Promise<unknown>;
}): () => void {
  const fhirObject = FHIR as unknown as object;
  const originalDescriptor = Object.getOwnPropertyDescriptor(fhirObject, 'oauth2');
  Object.defineProperty(fhirObject, 'oauth2', {
    configurable: true,
    value: {
      authorize: mock.authorize ?? (async () => undefined),
      ready: mock.ready ?? (async () => undefined),
    },
    writable: true,
  });

  return () => {
    if (originalDescriptor) {
      Object.defineProperty(fhirObject, 'oauth2', originalDescriptor);
    } else {
      Reflect.deleteProperty(fhirObject, 'oauth2');
    }
  };
}

function seedSMARTState(ownerId: string, smartStateKey: string): void {
  saveFHIRState({ isLaunching: true, ownerId });
  window.sessionStorage.setItem(SMART_KEY, JSON.stringify(smartStateKey));
  window.sessionStorage.setItem(smartStateKey, JSON.stringify({
    tokenResponse: { access_token: `${ownerId}-access-token` },
  }));
  window.sessionStorage.setItem(LEGACY_LAUNCH_KEY, 'launching');
}

test('clearFHIRState purges app metadata, SMART_KEY, and its token-bearing pointed state', () => {
  const smartStateKey = 'smartStateUserA1';
  seedSMARTState('user-a', smartStateKey);

  clearFHIRState();

  assert.equal(window.sessionStorage.getItem(APP_STATE_KEY), null);
  assert.equal(window.sessionStorage.getItem(SMART_KEY), null);
  assert.equal(window.sessionStorage.getItem(smartStateKey), null);
  assert.equal(window.sessionStorage.getItem(LEGACY_LAUNCH_KEY), null);
});

test('FHIR launch ownership is preserved only for the same authenticated user', () => {
  const smartStateKey = 'smartStateUserA2';
  seedSMARTState('user-a', smartStateKey);

  reconcileFHIRStateForAuthOwner('user-a');
  assert.equal(loadFHIRState()?.ownerId, 'user-a');
  assert.doesNotThrow(() => assertFHIRLaunchOwner('user-a'));
  assert.throws(
    () => assertFHIRLaunchOwner('user-b'),
    /no longer belongs to the current user/,
  );

  reconcileFHIRStateForAuthOwner('user-b');
  assert.equal(loadFHIRState(), null);
  assert.equal(window.sessionStorage.getItem(SMART_KEY), null);
  assert.equal(window.sessionStorage.getItem(smartStateKey), null);
});

test('legacy unowned launch metadata fails closed and purges SMART state', () => {
  const smartStateKey = 'smartStateLegacy';
  window.sessionStorage.setItem(APP_STATE_KEY, JSON.stringify({ isLaunching: true }));
  window.sessionStorage.setItem(SMART_KEY, JSON.stringify(smartStateKey));
  window.sessionStorage.setItem(smartStateKey, JSON.stringify({
    tokenResponse: { access_token: 'legacy-access-token' },
  }));

  reconcileFHIRStateForAuthOwner('user-a');

  assert.equal(loadFHIRState(), null);
  assert.equal(window.sessionStorage.getItem(SMART_KEY), null);
  assert.equal(window.sessionStorage.getItem(smartStateKey), null);
});

test('launchSMART binds launch metadata to the current Supabase user', async () => {
  const authGlobal = globalThis as AuthMockGlobal;
  authGlobal.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({
      data: { session: { user: { id: 'user-a' } } },
      error: null,
    }),
  };
  let authorizeCalls = 0;
  const restoreOAuth2 = installOAuth2Mock({
    authorize: async () => {
      authorizeCalls += 1;
    },
  });

  try {
    await launchSMART({ clientId: 'test-client-id' });
    assert.equal(authorizeCalls, 1);
    assert.equal(loadFHIRState()?.ownerId, 'user-a');
  } finally {
    restoreOAuth2();
    delete authGlobal.__SUPABASE_AUTH_MOCK__;
    clearFHIRState();
  }
});

test('handleCallback rejects a cross-user callback before ready and purges its SMART state', async () => {
  const smartStateKey = 'smartStateCallbackA';
  seedSMARTState('user-a', smartStateKey);
  let readyCalls = 0;
  const restoreOAuth2 = installOAuth2Mock({
    ready: async () => {
      readyCalls += 1;
      return {};
    },
  });

  try {
    await assert.rejects(
      () => handleCallback('user-b'),
      /no longer belongs to the current user/,
    );
    assert.equal(readyCalls, 0);
    assert.equal(window.sessionStorage.getItem(SMART_KEY), null);
    assert.equal(window.sessionStorage.getItem(smartStateKey), null);
  } finally {
    restoreOAuth2();
    clearFHIRState();
  }
});

test('handleCallback purges SMART state when fhirclient readiness fails', async () => {
  const smartStateKey = 'smartStateReadyFailure';
  seedSMARTState('user-a', smartStateKey);
  const restoreOAuth2 = installOAuth2Mock({
    ready: async () => {
      throw new Error('token exchange failed');
    },
  });

  try {
    await assert.rejects(
      () => handleCallback('user-a'),
      /token exchange failed/,
    );
    assert.equal(window.sessionStorage.getItem(SMART_KEY), null);
    assert.equal(window.sessionStorage.getItem(smartStateKey), null);
  } finally {
    restoreOAuth2();
    clearFHIRState();
  }
});
