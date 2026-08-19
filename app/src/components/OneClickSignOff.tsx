import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDialogDescriptionText,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, AlertCircle, Clock, FileText, ListTodo, Activity, TestTube, Pill, ImageIcon, User, Signature } from "lucide-react";
import type { Patient, PatientSystems } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";
import { toast } from "sonner";

interface SignOffSection {
  id: string;
  label: string;
  icon: React.ElementType;
  isComplete: (patient: Patient, todos?: PatientTodo[]) => boolean;
  getDescription: (patient: Patient, todos?: PatientTodo[]) => string;
}

const SECTIONS: SignOffSection[] = [
  {
    id: 'clinical-summary',
    label: 'Clinical Summary',
    icon: FileText,
    isComplete: (p) => p.clinicalSummary.length > 50,
    getDescription: (p) => `${p.clinicalSummary.length} characters`,
  },
  {
    id: 'interval-events',
    label: 'Interval Events',
    icon: Clock,
    isComplete: (p) => p.intervalEvents.length > 20,
    getDescription: (p) => `${p.intervalEvents.length} characters`,
  },
  {
    id: 'imaging',
    label: 'Imaging',
    icon: ImageIcon,
    isComplete: (p) => p.imaging.length > 10,
    getDescription: (p) => `${p.imaging.length} characters`,
  },
  {
    id: 'labs',
    label: 'Labs',
    icon: TestTube,
    isComplete: (p) => p.labs.length > 20,
    getDescription: (p) => `${p.labs.length} characters`,
  },
  {
    id: 'medications',
    label: 'Medications',
    icon: Pill,
    isComplete: (p) => {
      const totalMeds = p.medications.infusions.length + p.medications.scheduled.length + p.medications.prn.length;
      return totalMeds > 0;
    },
    getDescription: (p) => {
      const total = p.medications.infusions.length + p.medications.scheduled.length + p.medications.prn.length;
      return `${total} medication${total !== 1 ? 's' : ''}`;
    },
  },
  {
    id: 'systems-review',
    label: 'Systems Review',
    icon: Activity,
    isComplete: (p) => Object.values(p.systems).some(v => v.length > 10),
    getDescription: (p) => {
      const completed = Object.values(p.systems).filter(v => v.length > 10).length;
      return `${completed}/10 systems`;
    },
  },
  {
    id: 'todos',
    label: 'Todos',
    icon: ListTodo,
    isComplete: (p, todos) => {
      const patientTodos = todos ?? [];
      return patientTodos.length > 0;
    },
    getDescription: (p, todos) => {
      const patientTodos = todos ?? [];
      const completed = patientTodos.filter(t => t.completed).length;
      return `${completed}/${patientTodos.length} completed`;
    },
  },
];

interface OneClickSignOffProps {
  patients: Patient[];
  todosMap: Record<string, PatientTodo[]>;
  onSignOff: (patientIds: string[], signature: string) => void;
  /** Optional replacement for the built-in trigger button. */
  trigger?: React.ReactNode;
  /** Render no trigger at all (use together with open/onOpenChange). */
  hideTrigger?: boolean;
  /** Controlled open state; falls back to internal state when omitted. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Patients pre-selected when the dialog opens (e.g. the focused chart). */
  initialSelectedIds?: string[];
}

export function OneClickSignOff({ patients, todosMap, onSignOff, trigger, hideTrigger = false, open: controlledOpen, onOpenChange, initialSelectedIds }: OneClickSignOffProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );
  const [selectedPatients, setSelectedPatients] = React.useState<Set<string>>(
    () => new Set(initialSelectedIds ?? []),
  );
  const [signatures, setSignatures] = React.useState<Record<string, string>>({});
  const [completedSections, setCompletedSections] = React.useState<Record<string, Set<string>>>({});
  const [isSigning, setIsSigning] = React.useState(false);
  const [showIncompleteConfirm, setShowIncompleteConfirm] = React.useState(false);
  const [pendingUnsatisfiedPatients, setPendingUnsatisfiedPatients] = React.useState<string[]>([]);
  const [pendingPatientSignatures, setPendingPatientSignatures] = React.useState<Record<string, string>>({});
  const [signOffHistory, setSignOffHistory] = React.useState<Array<{ patientId: string; timestamp: string; signature: string }>>([]);

  // Keep the pre-selection in sync when the focused patient changes while mounted.
  const initialSelectedKey = (initialSelectedIds ?? []).join(",");
  React.useEffect(() => {
    if (initialSelectedIds) setSelectedPatients(new Set(initialSelectedIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedKey]);

  const handlePatientToggle = (patientId: string) => {
    setSelectedPatients(prev => {
      const next = new Set(prev);
      if (next.has(patientId)) {
        next.delete(patientId);
      } else {
        next.add(patientId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedPatients.size === patients.length) {
      setSelectedPatients(new Set());
    } else {
      setSelectedPatients(new Set(patients.map(p => p.id)));
    }
  };

  const handleSelectIncomplete = () => {
    const incompletePatients = patients.filter(p => !signOffHistory.find(h => h.patientId === p.id));
    setSelectedPatients(new Set(incompletePatients.map(p => p.id)));
  };

  const calculateCompletion = (patient: Patient): { sections: SignOffSection[]; completeCount: number; totalCount: number } => {
    const patientTodos = todosMap[patient.id];
    const sections = SECTIONS.filter(section => section.isComplete(patient, patientTodos));
    return {
      sections,
      completeCount: sections.length,
      totalCount: SECTIONS.length,
    };
  };

  const getOverallProgress = (): { signedCount: number; totalCount: number; percentage: number } => {
    const signedCount = signOffHistory.length;
    return {
      signedCount,
      totalCount: patients.length,
      percentage: patients.length > 0 ? Math.round((signedCount / patients.length) * 100) : 0,
    };
  };

  const finalizeSignOff = async (patientSignatures: Record<string, string>) => {
    setIsSigning(true);
    try {
      const timestamp = new Date().toISOString();
      const newHistory = Array.from(selectedPatients).map(patientId => ({
        patientId,
        timestamp,
        signature: patientSignatures[patientId],
      }));

      onSignOff(Array.from(selectedPatients), Object.values(patientSignatures)[0]);

      setSignOffHistory(prev => [...prev, ...newHistory]);
      setSelectedPatients(new Set());
      setSignatures({});
      toast.success(`Signed off ${selectedPatients.size} patient${selectedPatients.size > 1 ? 's' : ''}`);
      setOpen(false);
    } catch (error) {
      toast.error('Failed to sign off patients');
    } finally {
      setIsSigning(false);
    }
  };

  const handleSignOff = async () => {
    if (selectedPatients.size === 0) {
      toast.error('Please select at least one patient to sign off');
      return;
    }

    const unsatisfiedPatients: string[] = [];
    const patientSignatures: Record<string, string> = {};

    for (const patientId of selectedPatients) {
      const patient = patients.find(p => p.id === patientId);
      if (!patient) continue;

      const { completeCount, totalCount } = calculateCompletion(patient);
      if (completeCount < totalCount * 0.5) {
        unsatisfiedPatients.push(patient.name);
      }

      patientSignatures[patientId] = signatures[patient.id] || `Reviewed by ${patient.name.substring(0, 1)}. Doe`;
    }

    if (unsatisfiedPatients.length > 0) {
      setPendingUnsatisfiedPatients(unsatisfiedPatients);
      setPendingPatientSignatures(patientSignatures);
      setShowIncompleteConfirm(true);
      return;
    }

    await finalizeSignOff(patientSignatures);
  };

  const PatientCard = ({ patient }: { patient: Patient }) => {
    const { sections, completeCount, totalCount } = calculateCompletion(patient);
    const percentage = Math.round((completeCount / totalCount) * 100);
    const isSelected = selectedPatients.has(patient.id);
    const wasSigned = signOffHistory.find(h => h.patientId === patient.id);

    return (
      <div
        className={`p-4 border rounded-lg transition-all ${
          isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
      >
        <div className="flex items-start gap-3">
          <Checkbox
            id={`patient-${patient.id}`}
            checked={isSelected}
            onCheckedChange={() => handlePatientToggle(patient.id)}
            disabled={!!wasSigned}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <label
                  htmlFor={`patient-${patient.id}`}
                  className={`font-medium cursor-pointer ${wasSigned ? 'line-through text-muted-foreground' : ''}`}
                >
                  {patient.name}
                </label>
                <Badge variant="outline" className="text-xs">{patient.bed}</Badge>
              </div>
              {wasSigned && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <CheckCircle2 className="h-3 w-3" />
                  Signed
                </Badge>
              )}
            </div>

            {!wasSigned && (
              <>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Documentation completeness</span>
                    <span className="font-medium">{percentage}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        percentage >= 80 ? 'bg-green-500' :
                        percentage >= 50 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                <ScrollArea className="h-32">
                  <div className="space-y-1.5 pr-2">
                    {SECTIONS.map((section) => {
                      const isComplete = section.isComplete(patient, todosMap[patient.id]);
                      const description = section.getDescription(patient, todosMap[patient.id]);
                      const Icon = section.icon;

                      return (
                        <div key={section.id} className="flex items-center gap-2 text-xs">
                          {isComplete ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-700 dark:text-green-400 shrink-0" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className={`flex-1 ${!isComplete ? 'text-muted-foreground' : ''}`}>
                            {section.label}
                          </span>
                          <span className="text-muted-foreground/60 text-[10px]">{description}</span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            )}

            {wasSigned && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Signature className="h-3 w-3" />
                <span>{wasSigned.signature}</span>
                <span>•</span>
                <span>{new Date(wasSigned.timestamp).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const progress = getOverallProgress();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" size="sm" className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Off</span>
              {progress.percentage > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {progress.percentage}%
                </Badge>
              )}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>End of Shift Sign-Off</DialogTitle>
          <DialogDescription>
            Review and sign off on patient documentation
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground mb-1">Overall Progress</div>
            <div className="text-2xl font-bold">{progress.percentage}%</div>
          </div>
          <div className="flex gap-4">
            <div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {progress.signedCount}
              </div>
              <div className="text-xs text-muted-foreground">Signed</div>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div>
              <div className="text-2xl font-bold">{patients.length - progress.signedCount}</div>
              <div className="text-xs text-muted-foreground">Remaining</div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <Button
            onClick={handleSelectAll}
            variant="outline"
            size="sm"
            disabled={signOffHistory.length === patients.length}
          >
            {selectedPatients.size === patients.length ? 'Deselect All' : 'Select All'}
          </Button>
          <Button
            onClick={handleSelectIncomplete}
            variant="outline"
            size="sm"
          >
            Select Incomplete
          </Button>
        </div>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-3">
            {patients.map(patient => (
              <PatientCard key={patient.id} patient={patient} />
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSignOff}
            disabled={selectedPatients.size === 0 || isSigning}
            className="flex-1"
          >
            {isSigning ? 'Signing...' : `Sign Off ${selectedPatients.size} Patient${selectedPatients.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
      <AlertDialog
        open={showIncompleteConfirm}
        onOpenChange={(openState) => {
          setShowIncompleteConfirm(openState);
          if (!openState) {
            setPendingUnsatisfiedPatients([]);
            setPendingPatientSignatures({});
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Incomplete documentation detected</AlertDialogTitle>
            <AlertDialogDescriptionText>
              {pendingUnsatisfiedPatients.length} patient{pendingUnsatisfiedPatients.length > 1 ? 's have' : ' has'} incomplete documentation.
            </AlertDialogDescriptionText>
          </AlertDialogHeader>
          <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 text-sm">
            {pendingUnsatisfiedPatients.map((name) => (
              <div key={name} className="py-0.5">
                {name}
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowIncompleteConfirm(false);
                await finalizeSignOff(pendingPatientSignatures);
                setPendingUnsatisfiedPatients([]);
                setPendingPatientSignatures({});
              }}
            >
              Continue sign-off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
