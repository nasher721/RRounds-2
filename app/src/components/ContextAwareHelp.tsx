import * as React from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { HelpCircle, X } from "lucide-react";
import { useLocation } from "react-router-dom";

// Mapping of contexts (paths/sections) to help content
const helpContent: Record<string, { title: string; content: React.ReactNode }> = {
    default: {
        title: "Help & Tips",
        content: (
            <div className="space-y-2 text-sm">
                <p>Welcome to Round Robin Notes!</p>
                <p>Use the sidebar to navigate between patients.</p>
                <p>Press <kbd className="px-1 py-0.5 rounded bg-muted">Ctrl+K</kbd> to search.</p>
                <p>Empty roster? Use <strong>Add Patient</strong> or <strong>Import Patient List</strong> from the tools menu.</p>
            </div>
        ),
    },
    "/": {
        title: "Dashboard Help",
        content: (
            <div className="space-y-2 text-sm">
                <p><strong>Add Patient:</strong> Click the "+ Add Patient" button.</p>
                <p><strong>Import:</strong> Use "Smart Import" to paste text or "Epic Import" for handoff lists.</p>
                <p><strong>Filters:</strong> When no patients match, use Clear filters in the roster rail.</p>
                <p><strong>Dictation:</strong> Mic buttons need browser microphone permission. If denied, allow access in browser settings and retry.</p>
                <p><strong>Quick Actions:</strong> One-tap labs, consults, and documentation snippets for the selected patient.</p>
                <p><strong>Shortcuts:</strong></p>
                <ul className="list-disc list-inside">
                    <li><kbd className="px-1 py-0.5 rounded bg-muted">Ctrl+K</kbd>: Search</li>
                    <li><kbd className="px-1 py-0.5 rounded bg-muted">Ctrl+P</kbd>: Print</li>
                    <li><kbd className="px-1 py-0.5 rounded bg-muted">⌘⇧A</kbd>: AI workspace</li>
                </ul>
            </div>
        )
    },
    patient: {
        title: "Patient Chart Help",
        content: (
            <div className="space-y-2 text-sm">
                <p>Document systems review, interval events, and todos for the active patient.</p>
                <p><strong>Duplicate:</strong> Copies this patient card into a new roster entry.</p>
                <p><strong>Generate / Summary:</strong> AI drafts from current chart text — review before accepting.</p>
                <p><strong>Dictation:</strong> Allow microphone access if the browser prompts; denied permission shows recovery text beside the mic.</p>
                <p>Press <kbd className="px-1 py-0.5 rounded bg-muted">Ctrl+K</kbd> to jump to another patient.</p>
            </div>
        ),
    },
};

const resolveHelp = (pathname: string) => {
    if (helpContent[pathname]) {
        return helpContent[pathname];
    }
    if (pathname.startsWith("/patient")) {
        return helpContent.patient;
    }
    return helpContent.default;
};

export function ContextAwareHelp() {
    const [open, setOpen] = React.useState(false);
    const location = useLocation();

    // Determine current content based on route
    // We could extend this to watch for focus/active section if we add that to a global context
    const currentHelp = resolveHelp(location.pathname);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg bg-background border-primary/20 hover:bg-primary/10 transition-all z-50"
                    aria-label="Get Help"
                    title="Context-aware help for this screen"
                >
                    <HelpCircle className="h-6 w-6 text-primary" />
                    <span className="sr-only">Get Help</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 mr-6 mb-2" align="end" side="top">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                    <h4 className="font-semibold leading-none">{currentHelp.title}</h4>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setOpen(false)}
                        aria-label="Close help"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="text-muted-foreground">
                    {currentHelp.content}
                </div>
            </PopoverContent>
        </Popover>
    );
}
