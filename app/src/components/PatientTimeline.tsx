import * as React from "react";
import {
  LogIn,
  LogOut,
  ArrowRightLeft,
  Scissors,
  Pill,
  TestTube,
  Scan,
  Users,
  FileText,
  AlertTriangle,
  Activity,
  UtensilsCrossed,
  HeartPulse,
  Star,
  Filter,
  Calendar,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  TimelineEvent,
  TimelineEventType,
  TimelineEventSeverity,
  TimelineFilter,
  TimelineViewOptions,
} from "@/types/timeline";
import {
  TIMELINE_EVENT_CONFIG,
  DEFAULT_TIMELINE_FILTER,
  DEFAULT_TIMELINE_VIEW,
  groupEventsByDate,
  filterEvents,
} from "@/types/timeline";

const ICON_MAP: Record<TimelineEventType, React.ElementType> = {
  admission: LogIn,
  discharge: LogOut,
  transfer: ArrowRightLeft,
  procedure: Scissors,
  medication: Pill,
  lab: TestTube,
  imaging: Scan,
  consult: Users,
  note: FileText,
  alert: AlertTriangle,
  vital_change: Activity,
  diet_change: UtensilsCrossed,
  code_status: HeartPulse,
  custom: Star,
};

interface PatientTimelineProps {
  patientId: string;
  patientName: string;
  events: TimelineEvent[];
  onAddEvent?: (event: Partial<TimelineEvent>) => void;
  onEventClick?: (event: TimelineEvent) => void;
  className?: string;
}

export function PatientTimeline({
  events,
  onEventClick,
  className,
}: PatientTimelineProps) {
  const [filter, setFilter] = React.useState<TimelineFilter>(DEFAULT_TIMELINE_FILTER);
  const [viewOptions, setViewOptions] = React.useState<TimelineViewOptions>(DEFAULT_TIMELINE_VIEW);
  const [expandedDates, setExpandedDates] = React.useState<Set<string>>(new Set());

  const filteredEvents = filterEvents(events, filter);
  const groupedEvents = groupEventsByDate(filteredEvents);

  // Initialize expanded dates with the most recent
  React.useEffect(() => {
    const dates = Array.from(groupedEvents.keys()).slice(0, 3);
    setExpandedDates(new Set(dates));
  }, [events, groupedEvents]);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const toggleEventType = (type: TimelineEventType) => {
    setFilter(prev => ({
      ...prev,
      eventTypes: prev.eventTypes.includes(type)
        ? prev.eventTypes.filter(t => t !== type)
        : [...prev.eventTypes, type],
    }));
  };

  const toggleSeverity = (severity: TimelineEventSeverity) => {
    setFilter(prev => ({
      ...prev,
      severities: prev.severities.includes(severity)
        ? prev.severities.filter(s => s !== severity)
        : [...prev.severities, severity],
    }));
  };

  const eventTypes = Object.keys(TIMELINE_EVENT_CONFIG) as TimelineEventType[];
  const severities: TimelineEventSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) return 'Today';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Patient Timeline
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* Search */}
            <Input
              value={filter.searchTerm || ''}
              onChange={(e) => setFilter(prev => ({ ...prev, searchTerm: e.target.value }))}
              placeholder="Search..."
              className="w-32 h-8 text-sm"
            />

            {/* Event Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-3.5 w-3.5 mr-1" />
                  Types
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Event Types</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {eventTypes.map(type => {
                  const config = TIMELINE_EVENT_CONFIG[type];
                  return (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={filter.eventTypes.includes(type)}
                      onCheckedChange={() => toggleEventType(type)}
                    >
                      <span
                        className="w-2 h-2 rounded-full mr-2"
                        style={{ backgroundColor: config.color }}
                      />
                      {config.label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {viewOptions.compactMode ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuCheckboxItem
                  checked={viewOptions.compactMode}
                  onCheckedChange={(checked) =>
                    setViewOptions(prev => ({ ...prev, compactMode: checked }))
                  }
                >
                  Compact Mode
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={viewOptions.highlightCritical}
                  onCheckedChange={(checked) =>
                    setViewOptions(prev => ({ ...prev, highlightCritical: checked }))
                  }
                >
                  Highlight Critical
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={viewOptions.showDetails}
                  onCheckedChange={(checked) =>
                    setViewOptions(prev => ({ ...prev, showDetails: checked }))
                  }
                >
                  Show Details
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex gap-2 mt-2 flex-wrap">
          {severities.map(severity => {
            const count = filteredEvents.filter(e => e.severity === severity).length;
            if (count === 0) return null;

            const colors: Record<TimelineEventSeverity, string> = {
              critical: 'bg-red-100 text-red-700',
              high: 'bg-orange-100 text-orange-700',
              medium: 'bg-yellow-100 text-yellow-700',
              low: 'bg-blue-100 text-blue-700',
              info: 'bg-gray-100 text-gray-700',
            };

            return (
              <Badge
                key={severity}
                variant="outline"
                className={cn(
                  "text-xs cursor-pointer",
                  colors[severity],
                  !filter.severities.includes(severity) && "opacity-40"
                )}
                onClick={() => toggleSeverity(severity)}
              >
                {count} {severity}
              </Badge>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {Array.from(groupedEvents.entries()).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No events found</p>
              <p className="text-sm mt-1">Adjust filters or add new events</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(groupedEvents.entries())
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([date, dateEvents]) => (
                  <Collapsible
                    key={date}
                    open={expandedDates.has(date)}
                    onOpenChange={() => toggleDate(date)}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded-lg px-2 transition-colors">
                        {expandedDates.has(date) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{formatDate(date)}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {dateEvents.length}
                        </Badge>
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="relative ml-6 pl-6 border-l-2 border-muted space-y-3 py-2">
                        {dateEvents.map((event) => (
                          <TimelineEventCard
                            key={event.id}
                            event={event}
                            compact={viewOptions.compactMode}
                            showDetails={viewOptions.showDetails}
                            highlight={
                              viewOptions.highlightCritical &&
                              event.severity === 'critical'
                            }
                            onClick={() => onEventClick?.(event)}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface TimelineEventCardProps {
  event: TimelineEvent;
  compact?: boolean;
  showDetails?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}

function TimelineEventCard({
  event,
  compact = false,
  showDetails = true,
  highlight = false,
  onClick,
}: TimelineEventCardProps) {
  const config = TIMELINE_EVENT_CONFIG[event.type];
  const IconComponent = ICON_MAP[event.type];

  const time = new Date(event.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 w-full text-left p-2 rounded-lg transition-colors hover:bg-muted/50",
          highlight && "bg-red-50 border border-red-200"
        )}
      >
        {/* Timeline dot */}
        <div
          className="absolute -left-[7px] w-3 h-3 rounded-full border-2 border-background"
          style={{ backgroundColor: config.color }}
        />

        <span className="text-xs text-muted-foreground w-14">{time}</span>
        <IconComponent
          className="h-4 w-4 flex-shrink-0"
          style={{ color: config.color }}
        />
        <span className="text-sm truncate">{event.title}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "block w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm",
        highlight
          ? "bg-red-50 border-red-200 hover:border-red-300"
          : "bg-card hover:border-primary/30"
      )}
    >
      {/* Timeline dot */}
      <div
        className="absolute -left-[7px] w-3 h-3 rounded-full border-2 border-background"
        style={{ backgroundColor: config.color }}
      />

      <div className="flex items-start gap-3">
        <div
          className="p-2 rounded-lg flex-shrink-0"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <IconComponent
            className="h-4 w-4"
            style={{ color: config.color }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{event.title}</span>
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{
                borderColor: config.color,
                color: config.color,
              }}
            >
              {config.label}
            </Badge>
            {event.severity === 'critical' && (
              <Badge variant="destructive" className="text-[10px]">
                Critical
              </Badge>
            )}
          </div>

          {showDetails && event.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {event.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>{time}</span>
            {event.createdBy && (
              <>
                <span>|</span>
                <span>{event.createdBy}</span>
              </>
            )}
            {event.tags && event.tags.length > 0 && (
              <div className="flex gap-1">
                {event.tags.slice(0, 3).map(tag => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-[10px] px-1"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default PatientTimeline;
