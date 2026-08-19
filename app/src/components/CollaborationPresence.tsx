import * as React from "react";
import {
  Users,
  Eye,
  Edit3,
  MessageSquare,
  Bell,
  AtSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  UserPresence,
  Notification,
  NotificationType,
} from "@/types/collaboration";
import {
  PRESENCE_STATUS_CONFIG,
  NOTIFICATION_CONFIG,
  formatPresenceStatus,
} from "@/types/collaboration";

interface CollaborationPresenceProps {
  currentUser: UserPresence;
  activeUsers: UserPresence[];
  notifications: Notification[];
  onMarkNotificationRead: (notificationId: string) => void;
  onClearAllNotifications: () => void;
  onNavigateToPatient?: (patientId: string) => void;
  className?: string;
}

export function CollaborationPresence({
  activeUsers,
  notifications,
  onMarkNotificationRead,
  onClearAllNotifications,
  onNavigateToPatient,
  className,
}: CollaborationPresenceProps) {
  const onlineUsers = activeUsers.filter(u => u.status !== 'offline');

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Active Users */}
      <PresenceIndicator
        users={onlineUsers}
        onNavigateToPatient={onNavigateToPatient}
      />

      {/* Notifications */}
      <NotificationBell
        notifications={notifications}
        onMarkRead={onMarkNotificationRead}
        onClearAll={onClearAllNotifications}
        onNavigateToPatient={onNavigateToPatient}
      />
    </div>
  );
}

interface PresenceIndicatorProps {
  users: UserPresence[];
  onNavigateToPatient?: (patientId: string) => void;
}

export function PresenceIndicator({ users, onNavigateToPatient }: PresenceIndicatorProps) {
  const displayedUsers = users.slice(0, 4);
  const remainingCount = users.length - displayedUsers.length;

  if (users.length === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              <span className="text-xs">No one else online</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>You're the only one here right now</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 hover:bg-muted rounded-full p-1 transition-colors">
          <div className="flex -space-x-2">
            {displayedUsers.map((user) => (
              <UserAvatar key={user.id} user={user} size="sm" showStatus />
            ))}
          </div>
          {remainingCount > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              +{remainingCount}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Team Online</h4>
            <Badge variant="outline">{users.length} active</Badge>
          </div>

          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <UserAvatar user={user} size="md" showStatus />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{user.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {formatPresenceStatus(user)}
                    </div>
                  </div>
                  {user.currentPatientId && onNavigateToPatient && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onNavigateToPatient(user.currentPatientId!)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface UserAvatarProps {
  user: UserPresence;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
}

export function UserAvatar({ user, size = 'md', showStatus = false }: UserAvatarProps) {
  const sizeClasses = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
  };

  const statusConfig = PRESENCE_STATUS_CONFIG[user.status];
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative inline-block">
            <Avatar
              className={cn(
                sizeClasses[size],
                "border-2 border-background"
              )}
              style={{ borderColor: user.color }}
            >
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback style={{ backgroundColor: user.color, color: 'white' }}>
                {initials}
              </AvatarFallback>
            </Avatar>
            {showStatus && (
              <span
                className={cn(
                  "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background",
                  size === 'sm' && "w-2 h-2"
                )}
                style={{ backgroundColor: statusConfig.color }}
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{formatPresenceStatus(user)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface NotificationBellProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onClearAll: () => void;
  onNavigateToPatient?: (patientId: string) => void;
}

export function NotificationBell({
  notifications,
  onMarkRead,
  onClearAll,
  onNavigateToPatient,
}: NotificationBellProps) {
  const unread = notifications.filter(n => !n.read);
  const hasUnread = unread.length > 0;

  const getIcon = (type: NotificationType) => {
    const icons: Record<NotificationType, React.ElementType> = {
      mention: AtSign,
      comment: MessageSquare,
      handoff_request: Users,
      handoff_received: Users,
      alert_critical: Bell,
      alert_warning: Bell,
      task_assigned: Edit3,
      task_completed: Edit3,
      patient_update: Eye,
      system: Bell,
    };
    return icons[type];
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs font-bold rounded-full bg-red-500 text-white">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={onClearAll}
              >
                Clear all
              </Button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-1">
                {notifications
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .slice(0, 20)
                  .map((notification) => {
                    const config = NOTIFICATION_CONFIG[notification.type];
                    const IconComponent = getIcon(notification.type);

                    return (
                      <button
                        key={notification.id}
                        onClick={() => {
                          onMarkRead(notification.id);
                          if (notification.patientId) {
                            onNavigateToPatient?.(notification.patientId);
                          }
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded-lg transition-colors",
                          notification.read
                            ? "opacity-60 hover:bg-muted/50"
                            : "bg-muted/50 hover:bg-muted"
                        )}
                      >
                        <div className="flex gap-3">
                          <div
                            className="p-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: `${config.color}20` }}
                          >
                            <IconComponent
                              className="h-4 w-4"
                              style={{ color: config.color }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{notification.title}</div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                              <span>
                                {new Date(notification.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {notification.patientName && (
                                <>
                                  <span>|</span>
                                  <span>{notification.patientName}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Inline presence indicator for patient cards
interface PatientPresenceProps {
  viewers: UserPresence[];
}

export function PatientPresence({ viewers }: PatientPresenceProps) {
  if (viewers.length === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex -space-x-1.5">
            {viewers.slice(0, 3).map((user) => (
              <div
                key={user.id}
                className="w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-medium text-white"
                style={{ backgroundColor: user.color }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {viewers.length > 3 && (
              <div className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium">
                +{viewers.length - 3}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium mb-1">Currently viewing:</p>
          {viewers.map((user) => (
            <div key={user.id} className="text-xs">
              {user.name}
              {user.currentField && ` (editing ${user.currentField})`}
            </div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Field-level editing indicator
interface FieldEditingIndicatorProps {
  editor?: UserPresence;
}

export function FieldEditingIndicator({ editor }: FieldEditingIndicatorProps) {
  if (!editor) return null;

  return (
    <div
      className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${editor.color}20`, color: editor.color }}
    >
      <Edit3 className="h-3 w-3" />
      <span>{editor.name} is editing...</span>
    </div>
  );
}

export default CollaborationPresence;
