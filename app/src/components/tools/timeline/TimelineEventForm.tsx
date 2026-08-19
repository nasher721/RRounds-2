import React, { useState } from 'react';
import { TimelineEvent } from './TimelineGenerator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Clock, X } from 'lucide-react';
import { format } from 'date-fns';
import { DictationButton } from '@/components/DictationButton';

interface TimelineEventFormProps {
    onSave: (event: TimelineEvent) => void;
    onCancel: () => void;
}

export function TimelineEventForm({ onSave, onCancel }: TimelineEventFormProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [timeStr, setTimeStr] = useState(format(new Date(), 'HH:mm'));
    const [category, setCategory] = useState<TimelineEvent['category']>('ed');

    const categories: { value: TimelineEvent['category'], label: string, color: string }[] = [
        { value: 'ems', label: 'EMS / Pre-hospital', color: 'bg-orange-500/20 text-orange-400' },
        { value: 'ed', label: 'Emergency Dept', color: 'bg-red-500/20 text-red-400' },
        { value: 'icu', label: 'Intensive Care', color: 'bg-purple-500/20 text-purple-400' },
        { value: 'floor', label: 'Floor / Ward', color: 'bg-blue-500/20 text-blue-400' },
        { value: 'surgery', label: 'Surgery / OR', color: 'bg-yellow-500/20 text-yellow-500' },
        { value: 'discharge', label: 'Discharge', color: 'bg-green-500/20 text-green-400' },
        { value: 'other', label: 'Other Event', color: 'bg-zinc-500/20 text-zinc-400' }
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !dateStr) return;

        // Combine date and time
        const dateTimeStr = `${dateStr}T${timeStr || '00:00'}:00`;
        const eventDate = new Date(dateTimeStr);

        onSave({
            id: Math.random().toString(36).substring(7),
            title,
            description,
            date: eventDate,
            category
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border/20">
                <h3 className="text-lg font-semibold text-white">Add Timeline Event</h3>
                <Button variant="ghost" size="icon" onClick={onCancel} type="button" className="h-8 w-8 text-neutral-400 hover:text-white">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="p-6 space-y-6 flex-1">
                <div className="space-y-2">
                    <Label htmlFor="title" className="text-neutral-200">Event Title</Label>
                    <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Intubated, Transferred to ICU..."
                        className="bg-black/50 border-white/10"
                        autoFocus
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="date" className="text-neutral-200 flex items-center gap-1">
                            <CalendarIcon className="h-3.5 w-3.5 text-neutral-400" /> Date
                        </Label>
                        <Input
                            id="date"
                            type="date"
                            value={dateStr}
                            onChange={(e) => setDateStr(e.target.value)}
                            className="bg-black/50 border-white/10 text-neutral-200 [color-scheme:dark]"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="time" className="text-neutral-200 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-neutral-400" /> Time (Optional)
                        </Label>
                        <Input
                            id="time"
                            type="time"
                            value={timeStr}
                            onChange={(e) => setTimeStr(e.target.value)}
                            className="bg-black/50 border-white/10 text-neutral-200 [color-scheme:dark]"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <Label className="text-neutral-200">Category Phase</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {categories.map((cat) => (
                            <button
                                key={cat.value}
                                type="button"
                                onClick={() => setCategory(cat.value)}
                                className={`text-sm text-left px-3 py-2 rounded-md transition-all border ${category === cat.value
                                    ? `border-${cat.color.split('-')[1]}-500/50 ${cat.color} font-medium`
                                    : 'border-white/5 bg-black/20 text-neutral-400 hover:bg-black/40'
                                    }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="desc" className="text-neutral-200">Clinical Details</Label>
                        <DictationButton
                            onTranscript={(text) => setDescription(prev => prev ? `${prev} ${text}` : text)}
                            className="h-8 w-8"
                            variant="outline"
                        />
                    </div>
                    <Textarea
                        id="desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description of the event, vitals, interventions..."
                        className="h-24 bg-black/50 border-white/10 resize-none"
                    />
                </div>
            </div>

            <div className="p-4 border-t border-border/20 flex justify-end gap-2 bg-black/20 rounded-b-xl">
                <Button variant="ghost" onClick={onCancel} type="button" className="text-neutral-300 hover:text-white">
                    Cancel
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white border-0">
                    Add to Timeline
                </Button>
            </div>
        </form>
    );
}
