import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { TimelineGenerator } from './TimelineGenerator';
import { cn } from '@/lib/utils';

export function TimelineDialog({ triggerClassName }: { triggerClassName?: string }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className={cn("w-full justify-start gap-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/20", triggerClassName)}
                >
                    <Calendar className="h-4 w-4" />
                    Patient Timeline Generator
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full p-0 bg-background overflow-hidden border-border/50">
                <DialogTitle className="sr-only">Patient Timeline Generator</DialogTitle>
                <DialogDescription className="sr-only">
                    Build and review a chronological clinical timeline from chart events.
                </DialogDescription>
                <div className="h-full w-full overflow-hidden flex flex-col">
                    <TimelineGenerator />
                </div>
            </DialogContent>
        </Dialog>
    );
}
