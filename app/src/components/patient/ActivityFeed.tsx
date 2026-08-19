import * as React from "react";
import { usePatientActivity, type ActivityAction } from "@/hooks/usePatientActivity";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Edit3,
  UserCheck,
  Download,
  Sparkles,
  Clock,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_CONFIG: Record<ActivityAction, { icon: React.ElementType; label: string; color: string }> = {
  created: { icon: Plus, label: "Created", color: "text-green-500" },
  updated: { icon: Edit3, label: "Updated", color: "text-blue-500" },
  assigned: { icon: UserCheck, label: "Assigned", color: "text-purple-500" },
  exported: { icon: Download, label: "Exported", color: "text-orange-500" },
  ai_used: { icon: Sparkles, label: "AI Used", color: "text-pink-500" },
};

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

interface ActivityFeedProps {
  patientId: string;
  patientName?: string;
  maxItems?: number;
  className?: string;
}

export function ActivityFeed({
  patientId,
  patientName,
  maxItems = 5,
  className,
}: ActivityFeedProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const {
    activities,
    loading,
    error,
    errorDetail,
    lastFetchedAt,
    fetchActivities,
    retry,
  } = usePatientActivity(patientId);

  React.useEffect(() => {
    if (isOpen && patientId) {
      void fetchActivities(10);
    }
  }, [isOpen, patientId, fetchActivities]);

  const displayedActivities = activities.slice(0, maxItems);
  const hasMore = activities.length > maxItems;
  const statusMessage = loading
    ? activities.length > 0
      ? "Refreshing patient activity"
      : "Loading patient activity"
    : error
      ? "Patient activity unavailable"
      : lastFetchedAt
        ? `Activity updated ${formatRelativeTime(new Date(lastFetchedAt).toISOString())}`
        : null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "flex min-h-11 items-center gap-1.5 px-3 text-muted-foreground hover:text-foreground",
            className,
          )}
          aria-busy={loading || undefined}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden />
          )}
          <Clock className="h-4 w-4" aria-hidden />
          <span className="text-xs">Activity</span>
          {activities.length > 0 && (
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
              {activities.length}
            </span>
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2" aria-busy={loading || undefined}>
          {statusMessage && !(loading && activities.length === 0) && (
            <div role="status" className="sr-only">
              {statusMessage}
            </div>
          )}

          {error && (
            <div role="alert" className="mb-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    Could not load {patientName ? `${patientName}'s ` : ""}activity
                  </p>
                  <p className="mt-1 text-muted-foreground">{error}</p>
                  {errorDetail && (
                    <p className="mt-1 text-xs text-muted-foreground/90 break-words">
                      Details: {errorDetail}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 min-w-[4.5rem] shrink-0 text-xs"
                  onClick={() => void retry()}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Retry"}
                </Button>
              </div>
            </div>
          )}

          {loading && activities.length === 0 ? (
            <div role="status" aria-label="Loading patient activity" className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 && !error ? (
            <div className="text-center py-4 text-muted-foreground text-xs">
              No activity yet
            </div>
          ) : activities.length > 0 ? (
            <ScrollArea className="h-[200px] pr-2">
              <div className="space-y-2">
                {loading && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite" aria-busy="true">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    <span>Refreshing…</span>
                  </div>
                )}
                {displayedActivities.map((activity, index) => {
                  const config = ACTION_CONFIG[activity.action];
                  const Icon = config.icon;

                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-2 text-xs"
                    >
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            "p-1 rounded-full",
                            `${config.color} bg-current/10`
                          )}
                        >
                          <Icon className={cn("h-3 w-3", config.color)} />
                        </div>
                        {index < displayedActivities.length - 1 && (
                          <div className="w-px h-full bg-border flex-1 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{config.label}</span>
                          {activity.fieldName && (
                            <span className="text-muted-foreground truncate">
                              ({activity.fieldName})
                            </span>
                          )}
                        </div>
                        {activity.summary && (
                          <p className="text-muted-foreground truncate mt-0.5">
                            {activity.summary}
                          </p>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(activity.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {hasMore && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11 w-full text-xs text-muted-foreground"
                    onClick={() => void fetchActivities(20)}
                  >
                    Show more ({activities.length - maxItems} more)
                  </Button>
                )}
              </div>
            </ScrollArea>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
