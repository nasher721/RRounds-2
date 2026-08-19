import { useMemo } from 'react';
import type { Patient } from '@/types/patient';

export interface TimelineEvent {
  id: string;
  timestamp: number;
  type: 'procedure' | 'medication' | 'lab' | 'imaging' | 'note' | 'consult' | 'disposition' | 'admission';
  title: string;
  description: string;
  source: string;
  patientId: string;
  severity?: 'critical' | 'high' | 'moderate' | 'low';
}

export function usePatientTimeline(patient: Patient) {
  const events = useMemo((): TimelineEvent[] => {
    const events: TimelineEvent[] = [];
    let eventId = 0;

    // Parse clinical summary for events
    if (patient.clinicalSummary) {
      const datePattern = /(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/g;
      const matches = patient.clinicalSummary.match(datePattern);
      if (matches) {
        matches.forEach((match, i) => {
          events.push({
            id: `clinical-summary-${eventId++}`,
            timestamp: Date.now() - (matches.length - i) * 86400000,
            type: 'note',
            title: 'Clinical Summary Updated',
            description: 'Summary documented',
            source: 'Clinical Summary',
            patientId: patient.id,
          });
        });
      }
    }

    // Parse medications for changes
    if (patient.medications) {
      const medTypes = ['infusions', 'scheduled', 'prn'] as const;
      for (const type of medTypes) {
        if (patient.medications[type]) {
          for (const med of patient.medications[type]) {
            events.push({
              id: `med-${eventId++}`,
              timestamp: Date.now(),
              type: 'medication',
              title: `Medication: ${type}`,
              description: med,
              source: 'Medications',
              patientId: patient.id,
            });
          }
        }
      }
    }

    // Parse labs
    if (patient.labs) {
      const lines = patient.labs.split('\n').filter(Boolean);
      for (let i = 0; i < lines.length && i < 5; i++) {
        events.push({
          id: `lab-${eventId++}`,
          timestamp: Date.now() - i * 3600000,
          type: 'lab',
          title: 'Lab Results',
          description: lines[i].substring(0, 100),
          source: 'Laboratory',
          patientId: patient.id,
        });
      }
    }

    // Parse imaging
    if (patient.imaging) {
      const imagingLines = patient.imaging.split('\n').filter(Boolean);
      for (let i = 0; i < imagingLines.length && i < 3; i++) {
        events.push({
          id: `imaging-${eventId++}`,
          timestamp: Date.now() - i * 86400000,
          type: 'imaging',
          title: 'Imaging Study',
          description: imagingLines[i].substring(0, 100),
          source: 'Imaging',
          patientId: patient.id,
        });
      }
    }

    // Parse interval events
    if (patient.intervalEvents) {
      const lines = patient.intervalEvents.split('\n').filter(Boolean);
      for (const line of lines) {
        events.push({
          id: `interval-${eventId++}`,
          timestamp: Date.now(),
          type: 'note',
          title: 'Interval Event',
          description: line.substring(0, 150),
          source: 'Interval Events',
          patientId: patient.id,
        });
      }
    }

    // Add admission event if bed is set
    if (patient.bed) {
      events.push({
        id: `admission-${eventId++}`,
        timestamp: Date.now() - 86400000 * 2,
        type: 'admission',
        title: 'Admission',
        description: `Admitted to ${patient.bed}`,
        source: 'Admission',
        patientId: patient.id,
      });
    }

    // Sort by timestamp (newest first)
    return events.sort((a, b) => b.timestamp - a.timestamp);
  }, [patient]);

  const eventsByType = useMemo(() => {
    const byType: Record<string, TimelineEvent[]> = {};
    for (const event of events) {
      if (!byType[event.type]) {
        byType[event.type] = [];
      }
      byType[event.type].push(event);
    }
    return byType;
  }, [events]);

  const hasEvents = events.length > 0;

  const eventsByDay = useMemo(() => {
    const byDay: Record<string, TimelineEvent[]> = {};
    for (const event of events) {
      const day = new Date(event.timestamp).toDateString();
      if (!byDay[day]) {
        byDay[day] = [];
      }
      byDay[day].push(event);
    }
    return byDay;
  }, [events]);

  return {
    events,
    eventsByType,
    eventsByDay,
    hasEvents,
    totalEvents: events.length,
  };
}
