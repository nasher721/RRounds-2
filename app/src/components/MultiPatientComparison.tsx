import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Patient } from "@/types/patient";
import { PatientTodo } from "@/types/todo";
import { X } from "lucide-react";

interface MultiPatientComparisonProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    patients: Patient[];
    todosMap: Record<string, PatientTodo[]>;
}

export function MultiPatientComparison({
    open,
    onOpenChange,
    patients,
    todosMap,
}: MultiPatientComparisonProps) {
    const [selectedPatientIds, setSelectedPatientIds] = React.useState<string[]>([]);

    // Initialize selected patients with the first 3 or all if less than 3
    React.useEffect(() => {
        if (open && selectedPatientIds.length === 0) {
            setSelectedPatientIds(patients.slice(0, 3).map(p => p.id));
        }
    }, [open, patients, selectedPatientIds.length]);

    const selectedPatients = React.useMemo(
        () => patients.filter(p => selectedPatientIds.includes(p.id)),
        [patients, selectedPatientIds]
    );

    const togglePatient = (id: string) => {
        setSelectedPatientIds(prev =>
            prev.includes(id)
                ? prev.filter(pId => pId !== id)
                : [...prev, id]
        );
    };

    if (!open) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 gap-0 rounded-lg shadow-modal">
                <DialogHeader className="px-6 py-4 border-b border-border/50">
                    <DialogDescription className="sr-only">
                        Compare patient notes, labs, systems, medications, and active todos side by side.
                    </DialogDescription>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Patient Comparison</DialogTitle>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground mr-2">
                                Select patients to compare:
                            </span>
                            <div className="flex items-center gap-2 overflow-x-auto max-w-md pb-1">
                                {patients.map(p => (
                                    <Badge
                                        key={p.id}
                                        variant={selectedPatientIds.includes(p.id) ? "default" : "outline"}
                                        className="cursor-pointer whitespace-nowrap"
                                        onClick={() => togglePatient(p.id)}
                                    >
                                        {p.bed} - {p.name}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 p-6">
                    <div className="min-w-max">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[150px] sticky left-0 bg-background z-10 font-bold">
                                        Attribute
                                    </TableHead>
                                    {selectedPatients.map(p => (
                                        <TableHead key={p.id} className="min-w-[300px] font-bold text-base">
                                            {p.name} <span className="text-muted-foreground text-sm font-normal">({p.bed})</span>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Clinical Summary */}
                                <TableRow>
                                    <TableCell className="sticky left-0 bg-background font-medium align-top">
                                        Clinical Summary
                                    </TableCell>
                                    {selectedPatients.map(p => (
                                        <TableCell key={p.id} className="align-top whitespace-pre-wrap text-sm">
                                            {p.clinicalSummary || <span className="text-muted-foreground italic">None</span>}
                                        </TableCell>
                                    ))}
                                </TableRow>

                                {/* Interval Events */}
                                <TableRow>
                                    <TableCell className="sticky left-0 bg-background font-medium align-top">
                                        Interval Events
                                    </TableCell>
                                    {selectedPatients.map(p => (
                                        <TableCell key={p.id} className="align-top whitespace-pre-wrap text-sm">
                                            {p.intervalEvents || <span className="text-muted-foreground italic">None</span>}
                                        </TableCell>
                                    ))}
                                </TableRow>

                                {/* Labs */}
                                <TableRow>
                                    <TableCell className="sticky left-0 bg-background font-medium align-top">
                                        Labs
                                    </TableCell>
                                    {selectedPatients.map(p => (
                                        <TableCell key={p.id} className="align-top whitespace-pre-wrap text-sm font-mono bg-muted/20">
                                            {p.labs || <span className="text-muted-foreground italic">None</span>}
                                        </TableCell>
                                    ))}
                                </TableRow>

                                {/* Medications */}
                                <TableRow>
                                    <TableCell className="sticky left-0 bg-background font-medium align-top">
                                        Medications
                                    </TableCell>
                                    {selectedPatients.map(p => (
                                        <TableCell key={p.id} className="align-top text-sm">
                                            <div className="space-y-2">
                                                {p.medications.infusions.length > 0 && (
                                                    <div>
                                                        <span className="font-semibold text-xs uppercase text-muted-foreground">Infusions</span>
                                                        <ul className="list-disc list-inside">
                                                            {p.medications.infusions.map((m, i) => <li key={i}>{m}</li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                                {p.medications.scheduled.length > 0 && (
                                                    <div>
                                                        <span className="font-semibold text-xs uppercase text-muted-foreground">Scheduled</span>
                                                        <ul className="list-disc list-inside">
                                                            {p.medications.scheduled.map((m, i) => <li key={i}>{m}</li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                                {p.medications.prn.length > 0 && (
                                                    <div>
                                                        <span className="font-semibold text-xs uppercase text-muted-foreground">PRN</span>
                                                        <ul className="list-disc list-inside">
                                                            {p.medications.prn.map((m, i) => <li key={i}>{m}</li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                                {(!p.medications.infusions.length && !p.medications.scheduled.length && !p.medications.prn.length) && (
                                                    <span className="text-muted-foreground italic">None</span>
                                                )}
                                            </div>
                                        </TableCell>
                                    ))}
                                </TableRow>

                                {/* Systems Review */}
                                <TableRow>
                                    <TableCell className="sticky left-0 bg-background font-medium align-top">
                                        Systems
                                    </TableCell>
                                    {selectedPatients.map(p => (
                                        <TableCell key={p.id} className="align-top text-sm">
                                            <div className="grid grid-cols-1 gap-2">
                                                {Object.entries(p.systems).map(([sys, val]) => {
                                                    if (!val) return null;
                                                    return (
                                                        <div key={sys} className="border-b border-border/50 pb-1 last:border-0">
                                                            <span className="font-semibold text-xs uppercase text-muted-foreground block">{sys}</span>
                                                            <span className="whitespace-pre-wrap">{val}</span>
                                                        </div>
                                                    );
                                                })}
                                                {Object.values(p.systems).every(v => !v) && <span className="text-muted-foreground italic">None</span>}
                                            </div>
                                        </TableCell>
                                    ))}
                                </TableRow>

                                {/* Todos */}
                                <TableRow>
                                    <TableCell className="sticky left-0 bg-background font-medium align-top">
                                        Todos
                                    </TableCell>
                                    {selectedPatients.map(p => {
                                        const todos = todosMap[p.id] || [];
                                        const activeTodos = todos.filter(t => !t.completed);
                                        return (
                                            <TableCell key={p.id} className="align-top text-sm">
                                                {activeTodos.length > 0 ? (
                                                    <ul className="list-none space-y-1">
                                                        {activeTodos.map(todo => (
                                                            <li key={todo.id} className="flex gap-2 items-start">
                                                                <span className="text-emerald-500 font-bold">•</span>
                                                                <span>{todo.content}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <span className="text-muted-foreground italic">No active todos</span>
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
