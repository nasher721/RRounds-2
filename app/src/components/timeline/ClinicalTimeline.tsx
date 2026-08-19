import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  time: Date;
  type: "lab" | "imaging" | "medication" | "note" | "event";
  title: string;
  description?: string;
  category?: string;
}

interface ClinicalTimelineProps {
  events: TimelineEvent[];
  title?: string;
  className?: string;
  height?: number;
  onSelectEvent?: (event: TimelineEvent) => void;
}

const eventTypeColors: Record<TimelineEvent["type"], string> = {
  lab: "#22c55e",
  imaging: "#3b82f6",
  medication: "#f59e0b",
  note: "#8b5cf6",
  event: "#6b7280",
};

const eventTypeLabels: Record<TimelineEvent["type"], string> = {
  lab: "Lab Result",
  imaging: "Imaging",
  medication: "Medication",
  note: "Clinical Note",
  event: "Event",
};

export function ClinicalTimeline({
  events,
  title = "Clinical Timeline",
  className,
  height = 300,
  onSelectEvent,
}: ClinicalTimelineProps): React.ReactElement {
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [events]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, TimelineEvent[]>();
    sortedEvents.forEach((event) => {
      const category = event.category || eventTypeLabels[event.type];
      const existing = groups.get(category) || [];
      existing.push(event);
      groups.set(category, existing);
    });
    return groups;
  }, [sortedEvents]);

  const formatTime = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex gap-2 text-xs flex-wrap">
            {Object.entries(eventTypeLabels).map(([type, label]) => (
              <div key={type} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: eventTypeColors[type as TimelineEvent["type"]] }}
                />
                <span className="text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div style={{ height }} className="w-full overflow-y-auto">
          <div className="space-y-4">
            {Array.from(groupedEvents.entries()).map(([category, categoryEvents]) => (
              <div key={category}>
                <div className="text-xs font-medium text-gray-500 mb-2">{category}</div>
                <div className="space-y-2">
                  {categoryEvents.map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "flex items-start gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer transition-colors",
                        onSelectEvent && "hover:bg-gray-100"
                      )}
                      onClick={() => onSelectEvent?.(event)}
                    >
                      <div
                        className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: eventTypeColors[event.type] }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{event.title}</div>
                        {event.description && (
                          <div className="text-xs text-gray-500 truncate">{event.description}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {formatTime(event.time)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export type { TimelineEvent };
