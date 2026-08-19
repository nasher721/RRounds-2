import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Clock, RefreshCw, AlertCircle, Database, HardDrive, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeStorage";

export type SyncStatus = "success" | "error" | "pending";

export type SyncDataSource = "supabase" | "local" | "patients" | "autotexts" | "templates" | "settings";

export interface SyncEvent {
  id: string;
  timestamp: string;
  status: SyncStatus;
  dataSource: SyncDataSource;
  errorMessage?: string;
  details?: string;
}

const MAX_EVENTS = 10;
let inMemoryHistory: SyncEvent[] = [];

// Earlier builds stored raw error text and details here. Those strings can
// contain patient identifiers, so remove the unscoped browser copy.
safeLocalStorage.removeItem("sync-history");

const dataSourceLabels: Record<SyncDataSource, string> = {
  supabase: "Supabase",
  local: "Local Storage",
  patients: "Patients",
  autotexts: "Autotexts",
  templates: "Templates",
  settings: "Settings",
};

const dataSourceIcons: Record<SyncDataSource, React.ElementType> = {
  supabase: Cloud,
  local: HardDrive,
  patients: Database,
  autotexts: Database,
  templates: Database,
  settings: Database,
};

interface SyncHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry?: (dataSource: SyncDataSource) => void;
  isRetrying?: boolean;
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
}

function loadSyncHistory(): SyncEvent[] {
  return [...inMemoryHistory];
}

function saveSyncHistory(events: SyncEvent[]): void {
  inMemoryHistory = events.slice(0, MAX_EVENTS);
}

export function addSyncEvent(event: Omit<SyncEvent, "id" | "timestamp">): void {
  const events = loadSyncHistory();
  const newEvent: SyncEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    status: event.status,
    dataSource: event.dataSource,
    errorMessage: event.status === "error"
      ? "Sync failed. Retry or check your connection."
      : undefined,
  };
  saveSyncHistory([newEvent, ...events]);
}

export function useSyncHistory() {
  const [events, setEvents] = useState<SyncEvent[]>([]);

  useEffect(() => {
    setEvents(loadSyncHistory());
  }, []);

  const refresh = useCallback(() => {
    setEvents(loadSyncHistory());
  }, []);

  const clearHistory = useCallback(() => {
    saveSyncHistory([]);
    setEvents([]);
  }, []);

  return { events, refresh, clearHistory };
}

function StatusIcon({ status, className }: { status: SyncStatus; className?: string }) {
  switch (status) {
    case "success":
      return <CheckCircle2 className={cn("h-4 w-4 text-emerald-500", className)} />;
    case "error":
      return <XCircle className={cn("h-4 w-4 text-destructive", className)} />;
    case "pending":
      return <Clock className={cn("h-4 w-4 text-amber-500 animate-pulse", className)} />;
  }
}

function SyncEventItem({
  event,
  onRetry,
  isRetrying,
}: {
  event: SyncEvent;
  onRetry?: (dataSource: SyncDataSource) => void;
  isRetrying?: boolean;
}) {
  const Icon = dataSourceIcons[event.dataSource];

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
        event.status === "error"
          ? "bg-destructive/5 border-destructive/20"
          : event.status === "success"
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-amber-500/5 border-amber-500/20"
      )}
    >
      <div className="mt-0.5">
        <StatusIcon status={event.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-sm">{dataSourceLabels[event.dataSource]}</span>
          <Badge
            variant={event.status === "success" ? "secondary" : event.status === "error" ? "destructive" : "outline"}
            className="text-[10px] px-1.5 py-0 h-5"
          >
            {event.status}
          </Badge>
        </div>
        {event.errorMessage && (
          <p className="text-xs text-destructive/80 mb-2 line-clamp-2">{event.errorMessage}</p>
        )}
        {event.details && <p className="text-xs text-muted-foreground mb-2">{event.details}</p>}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground/60">{formatRelativeTime(event.timestamp)}</span>
          {event.status === "error" && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onRetry(event.dataSource)}
              disabled={isRetrying}
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", isRetrying && "animate-spin")} />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SyncHistoryPanel({
  open,
  onOpenChange,
  onRetry,
  isRetrying = false,
}: SyncHistoryPanelProps) {
  const { events, refresh, clearHistory } = useSyncHistory();

  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  const successCount = events.filter((e) => e.status === "success").length;
  const errorCount = events.filter((e) => e.status === "error").length;
  const pendingCount = events.filter((e) => e.status === "pending").length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sync History
          </SheetTitle>
          <SheetDescription>
            Last {MAX_EVENTS} sync events across all data sources
          </SheetDescription>
        </SheetHeader>

        {events.length > 0 && (
          <div className="flex items-center gap-3 py-3 border-b shrink-0">
            <div className="flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>{successCount}</span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <XCircle className="h-3.5 w-3.5 text-destructive" />
                <span>{errorCount}</span>
              </div>
            )}
            {pendingCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span>{pendingCount}</span>
              </div>
            )}
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearHistory}>
              Clear
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1 -mx-6 px-6">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No sync history yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Sync events will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-2 py-4">
              {events.map((event) => (
                <SyncEventItem
                  key={event.id}
                  event={event}
                  onRetry={onRetry}
                  isRetrying={isRetrying}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
