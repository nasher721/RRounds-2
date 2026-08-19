import React, { useRef, useState } from 'react';
import { TimelineEvent } from './TimelineGenerator';
import { format } from 'date-fns';
import { Download, Trash2, Ambulance, Hospital, Stethoscope, Syringe, Activity, ActivityIcon, Home, ActivitySquare, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import html2canvas from 'html2canvas';

interface TimelineVisualizerProps {
    events: TimelineEvent[];
    onDelete?: (id: string) => void;
}

const getCategoryConfig = (category: TimelineEvent['category']) => {
    switch (category) {
        case 'ems': return { color: 'border-orange-500 bg-orange-500/10 text-orange-400', icon: Ambulance, dot: 'bg-orange-500' };
        case 'ed': return { color: 'border-red-500 bg-red-500/10 text-red-500', icon: ActivitySquare, dot: 'bg-red-500' };
        case 'icu': return { color: 'border-purple-500 bg-purple-500/10 text-purple-400', icon: Activity, dot: 'bg-purple-500' };
        case 'floor': return { color: 'border-blue-500 bg-blue-500/10 text-blue-400', icon: Hospital, dot: 'bg-blue-500' };
        case 'surgery': return { color: 'border-yellow-500 bg-yellow-500/10 text-yellow-500', icon: Syringe, dot: 'bg-yellow-500' };
        case 'discharge': return { color: 'border-green-500 bg-green-500/10 text-green-400', icon: Home, dot: 'bg-green-500' };
        default: return { color: 'border-zinc-500 bg-zinc-500/10 text-zinc-400', icon: Stethoscope, dot: 'bg-zinc-500' };
    }
};

export function TimelineVisualizer({ events, onDelete }: TimelineVisualizerProps) {
    const timelineRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        if (!timelineRef.current) return;
        setIsExporting(true);

        try {
            // Small delay to allow react states to settle if any
            await new Promise(r => setTimeout(r, 100));

            const canvas = await html2canvas(timelineRef.current, {
                scale: 2, // High resolution
                backgroundColor: '#09090b', // Match dark background
                logging: false,
                useCORS: true
            });

            const image = canvas.toDataURL('image/png', 1.0);
            const link = document.createElement('a');
            link.download = `patient_timeline_${format(new Date(), 'yyyyMMdd_HHmm')}.png`;
            link.href = image;
            link.click();
        } catch (err) {
            console.error("Failed to export timeline:", err);
            alert("Failed to export image. See console for details.");
        } finally {
            setIsExporting(false);
        }
    };

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border border-dashed border-border/50 rounded-xl bg-card w-full">
                <AlertTriangle className="h-8 w-8 mb-4 text-neutral-500 opacity-50" />
                <p className="font-medium text-neutral-300">No patient timeline events recorded</p>
                <p className="text-sm">Add only events verified from the patient record.</p>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col items-center pb-12">
            <div className="w-full flex justify-end mb-6 px-4">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExport}
                    disabled={isExporting}
                    className="bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border border-indigo-500/30 shadow-sm"
                >
                    {isExporting ? (
                        <div className="h-4 w-4 mr-2 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Download className="h-4 w-4 mr-2" />
                    )}
                    {isExporting ? 'Exporting...' : 'Export Image'}
                </Button>
            </div>

            {/* The Printable Container */}
            <div
                ref={timelineRef}
                className="relative w-full max-w-4xl mx-auto px-4 py-8 bg-[#09090b] rounded-xl overflow-hidden" // Locked background for consistent export
            >
                <h2 className="text-2xl font-bold text-white text-center mb-12 tracking-tight">Patient Clinical Journey</h2>

                {/* Central Vertical Line (hidden on very small screens, placed left on mobile, center on md+) */}
                <div className="absolute left-6 md:left-1/2 top-24 bottom-12 w-0.5 bg-gradient-to-b from-border/10 via-border/50 to-border/10 transform md:-translate-x-1/2 z-0"></div>

                <div className="space-y-12 relative z-10 w-full">
                    {events.map((event, index) => {
                        const config = getCategoryConfig(event.category);
                        const Icon = config.icon;
                        const isLeft = index % 2 === 0;

                        return (
                            <div key={event.id} className="relative flex items-center md:justify-center w-full group">

                                {/* Center Node / Icon */}
                                <div className={`absolute left-6 md:left-1/2 transform -translate-x-1/2 flex items-center justify-center w-10 h-10 rounded-full border-2 ${config.color} shadow-lg shadow-black/50 z-20 transition-transform group-hover:scale-110 duration-300`}>
                                    <Icon className="w-5 h-5" />
                                </div>

                                {/* Content Card Layout */}
                                <div className={`w-full flex ${isLeft ? 'md:justify-start' : 'md:justify-end'} pl-16 md:pl-0`}>

                                    {/* The actual Card container */}
                                    <div className={`w-full md:w-[45%] relative ${isLeft ? 'md:pr-10' : 'md:pl-10'}`}>

                                        {/* Minimalist connector line visible on md+ */}
                                        <div className={`hidden md:block absolute top-5 w-10 border-t-2 border-dashed border-border/40 ${isLeft ? 'right-0' : 'left-0'}`}></div>

                                        <div className={`p-5 rounded-xl border border-border/30 bg-card/50 backdrop-blur-md shadow-xl transition-all duration-300 hover:shadow-${config.dot.replace('bg-', '')}/10 hover:border-white/10 ${isExporting ? 'bg-card' : ''}`}> {/* Solidify bg on export */}
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex flex-col">
                                                    <span className={`text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 ${config.color.split(' ')[2]}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></div>
                                                        {event.category}
                                                    </span>
                                                    <h4 className="text-lg font-semibold text-white leading-tight">{event.title}</h4>
                                                </div>
                                                {onDelete && !isExporting && (
                                                    <button
                                                        onClick={() => onDelete(event.id)}
                                                        className="text-neutral-500 hover:text-red-400 transition-colors bg-transparent border-0 opacity-0 group-hover:opacity-100"
                                                        title="Remove Event"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="text-sm font-medium text-neutral-400 mb-3 flex items-center gap-2">
                                                <span className="bg-black/30 px-2.5 py-1 rounded inline-flex border border-white/5">
                                                    {format(event.date, "MMM d, yyyy")}
                                                </span>
                                                <span className="bg-black/30 px-2.5 py-1 rounded inline-flex border border-white/5">
                                                    {format(event.date, "HH:mm")}
                                                </span>
                                            </div>

                                            {event.description && (
                                                <p className="text-sm text-neutral-300 leading-relaxed border-t border-white/5 pt-3 mt-1">
                                                    {event.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
