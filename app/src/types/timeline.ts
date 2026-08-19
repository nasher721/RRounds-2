/**
 * Patient Timeline Types
 * Longitudinal view of patient events and interventions
 */

export type TimelineEventType =
  | 'admission'
  | 'discharge'
  | 'transfer'
  | 'procedure'
  | 'medication'
  | 'lab'
  | 'imaging'
  | 'consult'
  | 'note'
  | 'alert'
  | 'vital_change'
  | 'diet_change'
  | 'code_status'
  | 'custom';

export type TimelineEventSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface TimelineEvent {
  id: string;
  patientId: string;
  type: TimelineEventType;
  severity: TimelineEventSeverity;
  title: string;
  description: string;
  timestamp: string;
  endTimestamp?: string; // For events with duration
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdBy?: string;
  source?: 'manual' | 'system' | 'import';
  linkedEventIds?: string[]; // Related events
  attachments?: TimelineAttachment[];
}

export interface TimelineAttachment {
  id: string;
  type: 'image' | 'document' | 'link';
  name: string;
  url?: string;
  thumbnail?: string;
}

export interface TimelineFilter {
  eventTypes: TimelineEventType[];
  severities: TimelineEventSeverity[];
  dateRange: {
    start?: string;
    end?: string;
  };
  searchTerm?: string;
  showSystemEvents: boolean;
}

export interface TimelineViewOptions {
  groupBy: 'none' | 'day' | 'shift' | 'category';
  sortOrder: 'asc' | 'desc';
  showDetails: boolean;
  compactMode: boolean;
  highlightCritical: boolean;
}

// Event type configurations
export const TIMELINE_EVENT_CONFIG: Record<TimelineEventType, {
  label: string;
  icon: string;
  color: string;
  defaultSeverity: TimelineEventSeverity;
}> = {
  admission: { label: 'Admission', icon: 'LogIn', color: '#3b82f6', defaultSeverity: 'high' },
  discharge: { label: 'Discharge', icon: 'LogOut', color: '#10b981', defaultSeverity: 'high' },
  transfer: { label: 'Transfer', icon: 'ArrowRightLeft', color: '#8b5cf6', defaultSeverity: 'medium' },
  procedure: { label: 'Procedure', icon: 'Scissors', color: '#f59e0b', defaultSeverity: 'high' },
  medication: { label: 'Medication', icon: 'Pill', color: '#ec4899', defaultSeverity: 'medium' },
  lab: { label: 'Lab Result', icon: 'TestTube', color: '#06b6d4', defaultSeverity: 'low' },
  imaging: { label: 'Imaging', icon: 'Scan', color: '#84cc16', defaultSeverity: 'medium' },
  consult: { label: 'Consult', icon: 'Users', color: '#6366f1', defaultSeverity: 'medium' },
  note: { label: 'Note', icon: 'FileText', color: '#64748b', defaultSeverity: 'info' },
  alert: { label: 'Alert', icon: 'AlertTriangle', color: '#ef4444', defaultSeverity: 'critical' },
  vital_change: { label: 'Vital Change', icon: 'Activity', color: '#f97316', defaultSeverity: 'medium' },
  diet_change: { label: 'Diet Change', icon: 'UtensilsCrossed', color: '#a3e635', defaultSeverity: 'low' },
  code_status: { label: 'Code Status', icon: 'HeartPulse', color: '#dc2626', defaultSeverity: 'high' },
  custom: { label: 'Custom', icon: 'Star', color: '#94a3b8', defaultSeverity: 'info' },
};

// Default filter
export const DEFAULT_TIMELINE_FILTER: TimelineFilter = {
  eventTypes: Object.keys(TIMELINE_EVENT_CONFIG) as TimelineEventType[],
  severities: ['critical', 'high', 'medium', 'low', 'info'],
  dateRange: {},
  showSystemEvents: true,
};

// Default view options
export const DEFAULT_TIMELINE_VIEW: TimelineViewOptions = {
  groupBy: 'day',
  sortOrder: 'desc',
  showDetails: true,
  compactMode: false,
  highlightCritical: true,
};

// Helper functions
export const createTimelineEvent = (
  patientId: string,
  type: TimelineEventType,
  title: string,
  description: string,
  options?: Partial<TimelineEvent>
): TimelineEvent => {
  const config = TIMELINE_EVENT_CONFIG[type];
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    patientId,
    type,
    severity: config.defaultSeverity,
    title,
    description,
    timestamp: new Date().toISOString(),
    source: 'manual',
    ...options,
  };
};

export const groupEventsByDate = (events: TimelineEvent[]): Map<string, TimelineEvent[]> => {
  const groups = new Map<string, TimelineEvent[]>();

  events.forEach(event => {
    const date = event.timestamp.split('T')[0];
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(event);
  });

  // Sort events within each group
  groups.forEach((groupEvents, date) => {
    groups.set(date, groupEvents.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ));
  });

  return groups;
};

export const filterEvents = (
  events: TimelineEvent[],
  filter: TimelineFilter
): TimelineEvent[] => {
  return events.filter(event => {
    // Type filter
    if (!filter.eventTypes.includes(event.type)) return false;

    // Severity filter
    if (!filter.severities.includes(event.severity)) return false;

    // Date range filter
    if (filter.dateRange.start && event.timestamp < filter.dateRange.start) return false;
    if (filter.dateRange.end && event.timestamp > filter.dateRange.end) return false;

    // System events filter
    if (!filter.showSystemEvents && event.source === 'system') return false;

    // Search term filter
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      const searchable = `${event.title} ${event.description} ${event.tags?.join(' ') || ''}`.toLowerCase();
      if (!searchable.includes(term)) return false;
    }

    return true;
  });
};

// Generate events from patient data changes
export const generateEventsFromPatientUpdate = (
  patientId: string,
  fieldName: string,
  oldValue: string,
  newValue: string
): TimelineEvent | null => {
  // Only generate events for significant changes
  if (oldValue === newValue) return null;

  const fieldMappings: Record<string, { type: TimelineEventType; title: string }> = {
    clinicalSummary: { type: 'note', title: 'Clinical Summary Updated' },
    intervalEvents: { type: 'note', title: 'Interval Events Updated' },
    imaging: { type: 'imaging', title: 'Imaging Updated' },
    labs: { type: 'lab', title: 'Labs Updated' },
    medications: { type: 'medication', title: 'Medications Updated' },
  };

  const mapping = fieldMappings[fieldName];
  if (!mapping) return null;

  return createTimelineEvent(
    patientId,
    mapping.type,
    mapping.title,
    `${fieldName} was updated`,
    { source: 'system' }
  );
};
