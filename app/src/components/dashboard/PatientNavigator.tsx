import * as React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Search, ChevronRight, User, Hash, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Patient } from "@/types/patient";
import { Input } from "@/components/ui/input";

import { useDashboard } from "@/contexts/DashboardContext";
import { safeLocalStorage } from "@/utils/safeStorage";

interface PatientNavigatorProps {
    onScrollToPatient: (id: string) => void;
    className?: string;
}

const NAVIGATOR_OPEN_KEY = 'patientNavigatorOpen';

export function PatientNavigator({ onScrollToPatient, className }: PatientNavigatorProps) {
    const { filteredPatients: patients } = useDashboard();
    const [isOpen, setIsOpen] = React.useState(() => {
        const saved = safeLocalStorage.getItem(NAVIGATOR_OPEN_KEY);
        return saved !== null ? saved === 'true' : true;
    });
    const [filter, setFilter] = React.useState("");

    const handleToggleOpen = React.useCallback(() => {
        setIsOpen(prev => {
            const next = !prev;
            safeLocalStorage.setItem(NAVIGATOR_OPEN_KEY, String(next));
            return next;
        });
    }, []);

    const filteredPatients = React.useMemo(() => {
        if (!filter) return patients;
        const lowerFilter = filter.toLowerCase();
        return patients.filter(
            (p) =>
                p.name.toLowerCase().includes(lowerFilter) ||
                (p.mrn ?? "").toLowerCase().includes(lowerFilter) ||
                p.bed.toLowerCase().includes(lowerFilter)
        );
    }, [patients, filter]);

    if (patients.length === 0) return null;

    return (
        <div
            className={cn(
                "fixed right-0 top-16 bottom-0 z-30 transition-all duration-300 ease-in-out border-l border-border/30 bg-card/95 backdrop-blur-xl shadow-card flex flex-col no-print rounded-l-lg",
                isOpen ? "w-64" : "w-12",
                className
            )}
        >
            {/* Toggle Button */}
            <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleOpen}
                className="absolute -left-3 top-4 min-h-11 min-w-11 h-11 w-11 rounded-full bg-card border border-border/40 shadow-card z-50 hover:bg-secondary/60"
            >
                {isOpen ? <ChevronsRight className="h-3 w-3" /> : <ChevronsLeft className="h-3 w-3" />}
            </Button>

            {isOpen ? (
                <>
                    <div className="p-3 border-b border-border/30">
                        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2 text-foreground">
                            <Hash className="h-4 w-4 text-muted-foreground" />
                            Quick Jump
                        </h3>
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Find patient..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="h-8 pl-8 text-xs bg-secondary/50 border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                    </div>
                    <ScrollArea className="flex-1 p-2">
                        <div className="space-y-1">
                            {filteredPatients.map((patient) => (
                                <button
                                    key={patient.id}
                                    onClick={() => onScrollToPatient(patient.id)}
                                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors group flex items-center gap-3"
                                >
                                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                        <span className="text-xs font-semibold text-primary">{patient.bed.slice(0, 3)}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate leading-none mb-0.5 text-foreground">{patient.name || "Unnamed"}</p>
                                        <p className="text-xs text-muted-foreground truncate font-mono">{patient.bed}</p>
                                    </div>
                                    <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                            {filteredPatients.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-xs">
                                    No matching patients
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <div className="p-2 border-t border-border/20 text-xs text-center text-card-foreground/80 bg-white/[0.03]">
                        {filteredPatients.length} patients
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center pt-4 gap-4">
                    <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <Hash className="h-4 w-4 text-card-foreground" />
                    </div>
                    <div className="flex-1 w-full flex flex-col items-center gap-2">
                        {filteredPatients.slice(0, 8).map(p => (
                            <button
                                key={p.id}
                                onClick={() => onScrollToPatient(p.id)}
                                className="min-h-11 min-w-11 h-11 w-11 rounded-full hover:bg-white/10 flex items-center justify-center text-xs font-medium text-card-foreground/80 hover:text-card-foreground transition-colors"
                                title={p.name}
                            >
                                {p.bed.slice(0, 2)}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
