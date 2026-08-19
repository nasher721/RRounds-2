import * as React from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { safeLocalStorage } from '@/utils/safeStorage';

export type TeamRole = 'admin' | 'editor' | 'viewer';

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: TeamRole;
  joinedAt: string;
}

export interface OnlineUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  lastSeen: number;
  currentPage?: string;
}

export interface PatientPresence {
  patientId: string;
  viewingUsers: OnlineUser[];
  editingUserId: string | null;
}

export interface TeamContextType {
  teamId: string | null;
  teamMembers: TeamMember[];
  currentUserRole: TeamRole | null;
  isTeamAdmin: boolean;
  isLoadingTeam: boolean;

  onlineUsers: OnlineUser[];
  totalOnline: number;
  isPresenceConnected: boolean;

  patientPresence: Map<string, PatientPresence>;
  getPatientViewers: (patientId: string) => OnlineUser[];
  isPatientBeingEdited: (patientId: string) => boolean;
  getPatientEditor: (patientId: string) => OnlineUser | null;

  joinPatientChannel: (patientId: string) => void;
  leavePatientChannel: (patientId: string) => void;
  setEditingPatient: (patientId: string | null) => void;
  refreshTeamMembers: () => Promise<void>;
}

const TeamContext = React.createContext<TeamContextType | undefined>(undefined);

const LEGACY_GLOBAL_TEAM_ID_KEY = 'rr_team_id';

interface TeamProviderProps {
  children: React.ReactNode;
  initialTeamId?: string | null;
}

interface TeamOwnerProviderProps extends TeamProviderProps {
  user: User | null;
}

const TeamOwnerProvider = ({ children, initialTeamId = null, user }: TeamOwnerProviderProps) => {
  const ownerId = user?.id ?? null;
  const [teamId, setTeamId] = React.useState<string | null>(null);

  const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>([]);
  const [currentUserRole, setCurrentUserRole] = React.useState<TeamRole | null>(null);
  const [isResolvingTeam, setIsResolvingTeam] = React.useState(Boolean(user));
  const [isLoadingMembers, setIsLoadingMembers] = React.useState(false);
  const isActiveRef = React.useRef(true);
  const teamIdRef = React.useRef<string | null>(null);
  teamIdRef.current = teamId;

  const onlineUsers = React.useMemo<OnlineUser[]>(() => [], []);
  const patientPresence = React.useMemo<Map<string, PatientPresence>>(() => new Map(), []);

  React.useEffect(() => {
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const isCurrentOwner = () => !cancelled && isActiveRef.current;

    const resolveTeam = async () => {
      setTeamMembers([]);
      setCurrentUserRole(null);

      if (!user) {
        setTeamId(null);
        setIsResolvingTeam(false);
        return;
      }

      setIsResolvingTeam(true);
      try {
        let resolvedTeamId: string | null = null;
        if (initialTeamId) {
          const canUseInitialTeam = await isTeamMember(user.id, initialTeamId);
          if (!isCurrentOwner()) return;
          resolvedTeamId = canUseInitialTeam ? initialTeamId : null;
        }

        if (!resolvedTeamId) {
          resolvedTeamId = await getUserTeamId(user.id);
          if (!isCurrentOwner()) return;
        }

        setTeamId(resolvedTeamId);
      } finally {
        if (isCurrentOwner()) setIsResolvingTeam(false);
      }
    };

    void resolveTeam();
    return () => {
      cancelled = true;
    };
  }, [initialTeamId, user]);

  const fetchTeamMembers = React.useCallback(async () => {
    if (!isActiveRef.current) return;
    if (!user || !teamId) {
      if (isActiveRef.current) {
        setTeamMembers([]);
        setCurrentUserRole(null);
      }
      return;
    }

    const requestedOwnerId = user.id;
    const requestedTeamId = teamId;
    const isCurrentRequest = () => (
      isActiveRef.current
      && ownerId === requestedOwnerId
      && teamIdRef.current === requestedTeamId
    );

    setIsLoadingMembers(true);
    try {
      const { data: members, error } = await supabase
        .from('phrase_team_members')
        .select('user_id, role, created_at')
        .eq('team_id', requestedTeamId);
      if (!isCurrentRequest()) return;

      if (error) {
        console.error('Team member lookup failed');
        setTeamMembers([]);
        setCurrentUserRole(null);
        return;
      }

      const mappedMembers: TeamMember[] = (members || []).map((membership) => {
        const isCurrentUser = membership.user_id === requestedOwnerId;

        return {
          id: membership.user_id,
          email: isCurrentUser ? user.email || '' : '',
          name: isCurrentUser
            ? user.user_metadata?.full_name || user.email?.split('@')[0] || 'You'
            : 'Team member',
          avatarUrl: isCurrentUser ? user.user_metadata?.avatar_url || null : null,
          role: (membership.role as TeamRole) || 'viewer',
          joinedAt: membership.created_at,
        };
      });

      setTeamMembers(mappedMembers);

      const myMembership = mappedMembers.find((m) => m.id === requestedOwnerId);
      setCurrentUserRole(myMembership?.role || null);
    } catch {
      if (!isCurrentRequest()) return;
      console.error('Team member lookup failed');
      setTeamMembers([]);
      setCurrentUserRole(null);
    } finally {
      if (isCurrentRequest()) setIsLoadingMembers(false);
    }
  }, [ownerId, user, teamId]);

  React.useEffect(() => {
    if (teamId) {
      void fetchTeamMembers();
    } else {
      setTeamMembers([]);
      setCurrentUserRole(null);
      setIsLoadingMembers(false);
    }
  }, [teamId, fetchTeamMembers]);

  const isLoadingTeam = isResolvingTeam || isLoadingMembers;
  const isTeamAdmin = currentUserRole === 'admin';

  // Realtime presence remains disabled until private channels are authorized
  // against team membership on the server. These no-op adapters preserve the
  // context API without publishing global or patient-identifying payloads.
  const getPatientViewers = React.useCallback((_patientId: string): OnlineUser[] => [], []);
  const isPatientBeingEdited = React.useCallback((_patientId: string): boolean => false, []);
  const getPatientEditor = React.useCallback((_patientId: string): OnlineUser | null => null, []);
  const joinPatientChannel = React.useCallback((_patientId: string): void => {}, []);
  const leavePatientChannel = React.useCallback((_patientId: string): void => {}, []);
  const setEditingPatient = React.useCallback((_patientId: string | null): void => {}, []);

  const value = React.useMemo<TeamContextType>(
    () => ({
      teamId,
      teamMembers,
      currentUserRole,
      isTeamAdmin,
      isLoadingTeam,
      onlineUsers,
      totalOnline: 0,
      isPresenceConnected: false,
      patientPresence,
      getPatientViewers,
      isPatientBeingEdited,
      getPatientEditor,
      joinPatientChannel,
      leavePatientChannel,
      setEditingPatient,
      refreshTeamMembers: fetchTeamMembers,
    }),
    [
      teamId,
      teamMembers,
      currentUserRole,
      isTeamAdmin,
      isLoadingTeam,
      onlineUsers,
      patientPresence,
      getPatientViewers,
      isPatientBeingEdited,
      getPatientEditor,
      joinPatientChannel,
      leavePatientChannel,
      setEditingPatient,
      fetchTeamMembers,
    ]
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
};

export const TeamProvider = ({ children, initialTeamId = null }: TeamProviderProps) => {
  const { user } = useAuth();
  const ownerId = user?.id ?? 'anonymous';

  React.useEffect(() => {
    // Older builds stored one account's team selection in a device-global key.
    safeLocalStorage.removeItem(LEGACY_GLOBAL_TEAM_ID_KEY);
  }, []);

  return (
    <TeamOwnerProvider key={ownerId} user={user} initialTeamId={initialTeamId}>
      {children}
    </TeamOwnerProvider>
  );
};

export const useTeam = (): TeamContextType => {
  const context = React.useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
};

export async function getUserTeamId(userId: string): Promise<string | null> {
  try {
    // Team switching is not exposed yet, so the most recently joined team is
    // the deterministic active team. team_id breaks created_at ties stably.
    const { data, error } = await supabase
      .from('phrase_team_members')
      .select('team_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('team_id', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data.team_id;
  } catch {
    return null;
  }
}

export async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('phrase_team_members')
      .select('user_id')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}
