import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import * as React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_SECTION_VISIBILITY } from '@/constants/config';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { getUserTeamId, TeamProvider, useTeam } from '@/contexts/TeamContext';
import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

declare global {
  var __SUPABASE_AUTH_MOCK__: unknown;
  var __SUPABASE_SELECT_MOCK__: unknown;
}

type TestUser = {
  id: string;
  email: string;
  user_metadata: { full_name: string };
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function makeUser(id: string): TestUser {
  return {
    id,
    email: `${id}@example.test`,
    user_metadata: { full_name: id.toUpperCase() },
  };
}

function setupAuthTransitionMock(initialUserId = 'user-a') {
  let activeUser = makeUser(initialUserId);
  let authStateCallback:
    | ((event: string, session: { user: TestUser }) => void)
    | undefined;

  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: activeUser } }, error: null }),
    onAuthStateChange: (callback: typeof authStateCallback) => {
      authStateCallback = callback;
      return { unsubscribe: () => {} };
    },
  };

  return {
    async transitionTo(nextUserId: string) {
      assert.ok(authStateCallback, 'auth listener should be registered');
      activeUser = makeUser(nextUserId);
      await act(async () => {
        authStateCallback!('SIGNED_IN', { user: activeUser });
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    },
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete globalThis.__SUPABASE_AUTH_MOCK__;
  delete globalThis.__SUPABASE_SELECT_MOCK__;
});

test('team resolution deterministically selects one membership inside the requested owner boundary', async () => {
  globalThis.__SUPABASE_SELECT_MOCK__ = (query: {
    table: string;
    filters: Array<{ column: string; value: unknown }>;
    orders: Array<{ column: string; options: { ascending: boolean } }>;
    limitCount: number | null;
  }) => {
    assert.equal(query.table, 'phrase_team_members');
    assert.deepEqual(query.filters, [{ op: 'eq', column: 'user_id', value: 'user-a' }]);
    assert.deepEqual(query.orders, [
      { column: 'created_at', options: { ascending: false } },
      { column: 'team_id', options: { ascending: true } },
    ]);
    assert.equal(query.limitCount, 1);

    // The schema permits both memberships. PostgREST applies the asserted
    // owner filter, stable ordering, and limit before maybeSingle.
    return {
      data: [
        { team_id: 'team-current', created_at: '2026-02-01T00:00:00Z' },
        { team_id: 'team-older', created_at: '2026-01-01T00:00:00Z' },
      ],
      error: null,
    };
  };

  assert.equal(await getUserTeamId('user-a'), 'team-current');
});

test('SettingsProvider quarantines user-A settings and cancels A debounce work on an A-to-B transition', async () => {
  const auth = setupAuthTransitionMock();
  const pendingUserB = deferred<{ data: unknown; error: null }>();
  const upserts: Array<{
    user_id: string;
    app_preferences: Record<string, unknown> & { selectedSpecialty?: string | null };
  }> = [];
  const observed: Array<{ ownerId: string; specialty: string | null }> = [];

  const supabaseWithMutableFrom = supabase as unknown as { from: (table: string) => unknown };
  const originalFrom = supabaseWithMutableFrom.from.bind(supabase);
  supabaseWithMutableFrom.from = (table: string) => {
    assert.equal(table, 'user_settings');
    return {
      select: () => {
        let requestedOwner = '';
        const query = {
          eq: (_column: string, value: string) => {
            requestedOwner = value;
            return query;
          },
          maybeSingle: () => requestedOwner === 'user-b'
            ? pendingUserB.promise
            : Promise.resolve({
                data: {
                  section_visibility: DEFAULT_SECTION_VISIBILITY,
                  app_preferences: {
                    selectedSpecialty: 'user-a-private-specialty',
                    aiCredentials: { openai: 'legacy-browser-secret' },
                    aiProvider: 'openai',
                    aiModel: 'gpt-4o-mini',
                    aiFeatureModels: { todos: 'gpt-4o-mini' },
                  },
                },
                error: null,
              }),
        };
        return query;
      },
      upsert: (payload: {
        user_id: string;
        app_preferences: Record<string, unknown> & { selectedSpecialty?: string | null };
      }) => {
        upserts.push(payload);
        return Promise.resolve({ error: null });
      },
    };
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>
      <SettingsProvider>{children}</SettingsProvider>
    </AuthProvider>
  );

  try {
    const { result } = renderHook(() => {
      const currentAuth = useAuth();
      const settings = useSettings();
      if (currentAuth.user) {
        observed.push({
          ownerId: currentAuth.user.id,
          specialty: settings.selectedSpecialty,
        });
      }
      return { auth: currentAuth, settings };
    }, { wrapper });

    await waitFor(() => {
      assert.equal(result.current.auth.user?.id, 'user-a');
      assert.equal(result.current.settings.selectedSpecialty, 'user-a-private-specialty');
    });
    await waitFor(() => assert.equal(upserts.length, 1));
    assert.deepEqual(upserts[0]?.app_preferences, {
      selectedSpecialty: 'user-a-private-specialty',
    }, 'legacy browser provider fields must be removed from synced preferences');

    await act(async () => {
      result.current.settings.setSelectedSpecialty('user-a-unsaved-specialty');
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    upserts.length = 0;

    await auth.transitionTo('user-b');
    await waitFor(() => assert.equal(result.current.auth.user?.id, 'user-b'));

    assert.equal(
      observed.some(({ ownerId, specialty }) =>
        ownerId === 'user-b' && specialty?.startsWith('user-a-')),
      false,
      'no render owned by B may expose settings loaded or edited by A',
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });
    assert.equal(upserts.length, 0, 'user-A debounce work must be cancelled at the auth boundary');

    await act(async () => {
      pendingUserB.resolve({
        data: {
          section_visibility: DEFAULT_SECTION_VISIBILITY,
          app_preferences: { selectedSpecialty: 'user-b-specialty' },
        },
        error: null,
      });
    });
    await waitFor(() => assert.equal(result.current.settings.selectedSpecialty, 'user-b-specialty'));

    assert.equal(localStorage.getItem('selectedSpecialty'), null);
    assert.equal(
      localStorage.getItem('selectedSpecialty:user:user-a'),
      'user-a-unsaved-specialty',
      'authenticated preferences should be persisted only in their owner namespace',
    );
  } finally {
    supabaseWithMutableFrom.from = originalFrom;
  }
});

test('TeamProvider resolves each owner independently and ignores a late user-A member response', async () => {
  const auth = setupAuthTransitionMock();
  const lateUserARefresh = deferred<{ data: unknown[]; error: null }>();
  const memberRequestCount = new Map<string, number>();
  let failNextTeamBRefresh = false;
  const observed: Array<{ ownerId: string; teamId: string | null; memberIds: string[] }> = [];
  localStorage.setItem('rr_team_id', 'legacy-user-a-team');

  const supabaseWithMutableFrom = supabase as unknown as { from: (table: string) => unknown };
  const originalFrom = supabaseWithMutableFrom.from.bind(supabase);
  supabaseWithMutableFrom.from = (table: string) => {
    assert.equal(table, 'phrase_team_members');
    return {
      select: (columns: string) => {
        const filters = new Map<string, string>();
        const resolve = () => {
          if (columns === 'team_id') {
            const ownerId = filters.get('user_id');
            return Promise.resolve({
              data: ownerId === 'user-a' ? { team_id: 'team-a' } : { team_id: 'team-b' },
              error: null,
            });
          }

          const requestedTeam = filters.get('team_id') ?? '';
          if (requestedTeam === 'team-b' && failNextTeamBRefresh) {
            failNextTeamBRefresh = false;
            return Promise.resolve({ data: null, error: new Error('membership lookup failed') });
          }
          const count = (memberRequestCount.get(requestedTeam) ?? 0) + 1;
          memberRequestCount.set(requestedTeam, count);
          if (requestedTeam === 'team-a' && count > 1) return lateUserARefresh.promise;

          const ownerId = requestedTeam === 'team-a' ? 'user-a' : 'user-b';
          return Promise.resolve({
            data: [{
              user_id: ownerId,
              role: 'admin',
              created_at: '2026-01-01T00:00:00Z',
            }],
            error: null,
          });
        };
        const query = {
          eq: (column: string, value: string) => {
            filters.set(column, value);
            return query;
          },
          order: () => query,
          limit: () => query,
          maybeSingle: () => resolve(),
          then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
            resolve().then(onFulfilled, onRejected),
        };
        return query;
      },
    };
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>
      <TeamProvider>{children}</TeamProvider>
    </AuthProvider>
  );

  try {
    const { result } = renderHook(() => {
      const currentAuth = useAuth();
      const team = useTeam();
      if (currentAuth.user) {
        observed.push({
          ownerId: currentAuth.user.id,
          teamId: team.teamId,
          memberIds: team.teamMembers.map(({ id }) => id),
        });
      }
      return { auth: currentAuth, team };
    }, { wrapper });

    await waitFor(() => {
      assert.equal(result.current.auth.user?.id, 'user-a');
      assert.equal(result.current.team.teamId, 'team-a');
      assert.deepEqual(result.current.team.teamMembers.map(({ id }) => id), ['user-a']);
    });

    let pendingRefresh!: Promise<void>;
    await act(async () => {
      pendingRefresh = result.current.team.refreshTeamMembers();
      await Promise.resolve();
    });
    assert.equal(memberRequestCount.get('team-a'), 2);

    await auth.transitionTo('user-b');
    await waitFor(() => {
      assert.equal(result.current.auth.user?.id, 'user-b');
      assert.equal(result.current.team.teamId, 'team-b');
      assert.deepEqual(result.current.team.teamMembers.map(({ id }) => id), ['user-b']);
    });

    await act(async () => {
      lateUserARefresh.resolve({
        data: [{
          user_id: 'late-user-a',
          role: 'viewer',
          created_at: '2026-01-02T00:00:00Z',
        }],
        error: null,
      });
      await pendingRefresh;
    });

    assert.equal(
      observed.some(({ ownerId, teamId, memberIds }) =>
        ownerId === 'user-b' && (teamId === 'team-a' || memberIds.some((id) => id.includes('user-a')))),
      false,
      'no render owned by B may expose A team state',
    );
    assert.equal(result.current.team.teamId, 'team-b');
    assert.deepEqual(result.current.team.teamMembers.map(({ id }) => id), ['user-b']);
    assert.equal(localStorage.getItem('rr_team_id'), null, 'legacy global team state must be removed');

    failNextTeamBRefresh = true;
    await act(async () => {
      await result.current.team.refreshTeamMembers();
    });
    assert.deepEqual(result.current.team.teamMembers, []);
    assert.equal(result.current.team.currentUserRole, null);
    assert.equal(result.current.team.isTeamAdmin, false);
  } finally {
    supabaseWithMutableFrom.from = originalFrom;
  }
});
