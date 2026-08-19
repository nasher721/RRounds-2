import React, { useState } from 'react';
import { TimelineEventForm } from './TimelineEventForm';
import { TimelineVisualizer } from './TimelineVisualizer';
import { Button } from '@/components/ui/button';
import { Calendar, Plus } from 'lucide-react';

export interface TimelineEvent {
    id: string;
    date: Date;
    title: string;
    description: string;
    category: 'ems' | 'ed' | 'icu' | 'floor' | 'surgery' | 'discharge' | 'other';
}

export function TimelineGenerator() {
    const [events, setEvents] = useState<TimelineEvent[]>([]);

    const [isAddingEvent, setIsAddingEvent] = useState(false);

    const handleAddEvent = (event: TimelineEvent) => {
        setEvents(prev => [...prev, event].sort((a, b) => a.date.getTime() - b.date.getTime()));
        setIsAddingEvent(false);
    };

    const handleRemoveEvent = (id: string) => {
        setEvents(prev => prev.filter(e => e.id !== id));
    };

    return (
        <div className="flex flex-col h-full bg-background relative">
            <div className="flex-none p-4 border-b border-border/20 sticky top-0 bg-background/95 backdrop-blur z-10 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-indigo-400" />
                        Patient Timeline
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Build and export a visual history of the patient's hospital course.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsAddingEvent(!isAddingEvent)}>
                        <Plus className="h-4 w-4 mr-1" />
                        {isAddingEvent ? 'Cancel' : 'Add Event'}
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto flex flex-col items-center">
                {/* The visual timeline */}
                <div className="w-full flex justify-center py-6 px-4 md:px-0">
                    <TimelineVisualizer events={events} onDelete={handleRemoveEvent} />
                </div>

                {/* The Add Event Form Modal/Drawer (inline for now) */}
                {isAddingEvent && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-card border border-border/50 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                            <TimelineEventForm
                                onSave={handleAddEvent}
                                onCancel={() => setIsAddingEvent(false)}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
