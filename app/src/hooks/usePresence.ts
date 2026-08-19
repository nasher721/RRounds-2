import { useCallback } from 'react';

interface PresenceUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  lastSeen: number;
  currentPage?: string;
}

interface PresenceState {
  users: PresenceUser[];
  totalOnline: number;
}

const disabledPresenceUsers: PresenceUser[] = [];
Object.freeze(disabledPresenceUsers);

const DISABLED_PRESENCE_STATE: PresenceState = Object.freeze({
  users: disabledPresenceUsers,
  totalOnline: 0,
});

/**
 * Realtime presence is intentionally disabled.
 *
 * Supabase Realtime presence channels are not protected by table RLS. Until
 * channels are configured as private and authorized against a concrete team,
 * publishing user or patient context would disclose it to any channel
 * subscriber. Keep the hook's API stable so callers degrade safely.
 */
export function usePresence(_channelId: string = 'global') {
  const updatePage = useCallback(async (_page: string): Promise<void> => {
    // Intentionally disabled pending private, server-authorized channels.
  }, []);

  return {
    ...DISABLED_PRESENCE_STATE,
    isConnected: false,
    updatePage,
  };
}

/**
 * Disabled patient-presence adapter. See usePresence for the security gate.
 */
export function usePatientPresence(patientId: string) {
  return usePresence(`patient-${patientId}`);
}
