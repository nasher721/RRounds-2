/**
 * Collaboration Types
 * Real-time presence and team collaboration support
 */

export interface UserPresence {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string; // Unique color for this user's cursor/highlights
  status: 'online' | 'away' | 'busy' | 'offline';
  lastActive: string;
  currentPatientId?: string;
  currentField?: string;
  cursorPosition?: CursorPosition;
}

export interface CursorPosition {
  patientId: string;
  fieldKey: string;
  offset: number;
  timestamp: string;
}

export interface CollaborationSession {
  id: string;
  roomId: string; // Typically maps to unit or team
  participants: UserPresence[];
  createdAt: string;
  lastActivity: string;
}

export interface RealtimeEdit {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  patientId: string;
  fieldKey: string;
  operation: 'insert' | 'delete' | 'replace';
  content?: string;
  position: number;
  length?: number;
  timestamp: string;
}

export interface Comment {
  id: string;
  patientId: string;
  fieldKey?: string; // If attached to specific field
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  updatedAt?: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  mentions: string[]; // User IDs
  replies: CommentReply[];
}

export interface CommentReply {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  patientId?: string;
  patientName?: string;
  fromUserId?: string;
  fromUserName?: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

export type NotificationType =
  | 'mention'
  | 'comment'
  | 'handoff_request'
  | 'handoff_received'
  | 'alert_critical'
  | 'alert_warning'
  | 'task_assigned'
  | 'task_completed'
  | 'patient_update'
  | 'system';

// User colors for presence indicators
export const USER_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

// Get consistent color for a user based on their ID
export const getUserColor = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
};

// Presence status configuration
export const PRESENCE_STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  icon: string;
}> = {
  online: { label: 'Online', color: '#22c55e', icon: 'Circle' },
  away: { label: 'Away', color: '#eab308', icon: 'Clock' },
  busy: { label: 'Busy', color: '#ef4444', icon: 'MinusCircle' },
  offline: { label: 'Offline', color: '#6b7280', icon: 'CircleOff' },
};

// Default empty presence
export const createUserPresence = (
  id: string,
  name: string,
  email: string
): UserPresence => ({
  id,
  name,
  email,
  color: getUserColor(id),
  status: 'online',
  lastActive: new Date().toISOString(),
});

// Create notification
export const createNotification = (
  type: NotificationType,
  title: string,
  message: string,
  options?: Partial<Notification>
): Notification => ({
  id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type,
  title,
  message,
  timestamp: new Date().toISOString(),
  read: false,
  ...options,
});

// Format presence for display
export const formatPresenceStatus = (presence: UserPresence): string => {
  if (presence.status === 'offline') {
    return 'Offline';
  }

  if (presence.currentPatientId) {
    const fieldLabel = presence.currentField
      ? ` (editing ${presence.currentField})`
      : '';
    return `Viewing patient${fieldLabel}`;
  }

  return PRESENCE_STATUS_CONFIG[presence.status].label;
};

// Check if users are viewing same patient
export const areUsersCollaborating = (
  user1: UserPresence,
  user2: UserPresence
): boolean => {
  return !!(
    user1.currentPatientId &&
    user2.currentPatientId &&
    user1.currentPatientId === user2.currentPatientId
  );
};

// Group users by what they're viewing
export const groupUsersByPatient = (
  users: UserPresence[]
): Map<string, UserPresence[]> => {
  const groups = new Map<string, UserPresence[]>();

  users.forEach(user => {
    if (user.currentPatientId) {
      const existing = groups.get(user.currentPatientId) || [];
      groups.set(user.currentPatientId, [...existing, user]);
    }
  });

  return groups;
};

// Notification type configurations
export const NOTIFICATION_CONFIG: Record<NotificationType, {
  icon: string;
  color: string;
  priority: number;
}> = {
  alert_critical: { icon: 'AlertTriangle', color: '#ef4444', priority: 1 },
  alert_warning: { icon: 'AlertCircle', color: '#f97316', priority: 2 },
  handoff_request: { icon: 'ArrowRightLeft', color: '#8b5cf6', priority: 3 },
  handoff_received: { icon: 'Check', color: '#22c55e', priority: 4 },
  mention: { icon: 'AtSign', color: '#3b82f6', priority: 5 },
  task_assigned: { icon: 'ListTodo', color: '#06b6d4', priority: 6 },
  task_completed: { icon: 'CheckCircle', color: '#22c55e', priority: 7 },
  comment: { icon: 'MessageSquare', color: '#6b7280', priority: 8 },
  patient_update: { icon: 'User', color: '#64748b', priority: 9 },
  system: { icon: 'Info', color: '#94a3b8', priority: 10 },
};
