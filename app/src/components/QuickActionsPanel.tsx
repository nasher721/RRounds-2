import * as React from "react";
import {
  Zap,
  Stethoscope,
  Pill,
  FileText,
  ClipboardCheck,
  Phone,
  UserPlus,
  AlertTriangle,
  Syringe,
  Droplets,
  Wind,
  Heart,
  Activity,
  Send,
  Clipboard,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Patient } from "@/types/patient";

interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  category: 'order' | 'documentation' | 'communication' | 'clinical';
  shortcut?: string;
  action: (patient: Patient, helpers: ActionHelpers) => void;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

interface ActionHelpers {
  updatePatient: (field: string, value: string) => void;
  copyToClipboard: (text: string) => void;
  showToast: (message: string) => void;
  openDialog: (content: React.ReactNode) => void;
}

const QUICK_ACTIONS: QuickAction[] = [
  // Orders
  {
    id: 'order-labs',
    label: 'Order Morning Labs',
    description: 'CBC, BMP, Mg, Phos',
    icon: Droplets,
    category: 'order',
    shortcut: 'L',
    action: (patient, { showToast, updatePatient }) => {
      const timestamp = new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      updatePatient('intervalEvents', `${patient.intervalEvents}\n[${timestamp}] Morning labs ordered: CBC, BMP, Mg, Phos`);
      showToast('Morning labs ordered');
    },
  },
  {
    id: 'order-blood-gas',
    label: 'Order ABG/VBG',
    description: 'Arterial or venous blood gas',
    icon: Wind,
    category: 'order',
    shortcut: 'G',
    action: (patient, { showToast, updatePatient }) => {
      const timestamp = new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      updatePatient('intervalEvents', `${patient.intervalEvents}\n[${timestamp}] ABG ordered`);
      showToast('Blood gas ordered');
    },
  },
  {
    id: 'order-cultures',
    label: 'Order Cultures',
    description: 'Blood cx x2, UA/UCx',
    icon: Syringe,
    category: 'order',
    shortcut: 'C',
    action: (patient, { showToast, updatePatient }) => {
      const timestamp = new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      updatePatient('intervalEvents', `${patient.intervalEvents}\n[${timestamp}] Cultures ordered: Blood cx x2, UA with reflex culture`);
      showToast('Cultures ordered');
    },
  },
  {
    id: 'order-cardiac',
    label: 'Order Cardiac Panel',
    description: 'Troponin, BNP, ECG',
    icon: Heart,
    category: 'order',
    shortcut: 'H',
    action: (patient, { showToast, updatePatient }) => {
      const timestamp = new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      updatePatient('intervalEvents', `${patient.intervalEvents}\n[${timestamp}] Cardiac workup ordered: Troponin, BNP, 12-lead ECG`);
      showToast('Cardiac panel ordered');
    },
  },
  {
    id: 'order-prn',
    label: 'Order PRN Meds',
    description: 'Standard PRN orders',
    icon: Pill,
    category: 'order',
    action: (patient, { showToast, updatePatient }) => {
      const timestamp = new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      updatePatient('intervalEvents', `${patient.intervalEvents}\n[${timestamp}] PRN orders placed: Tylenol, Zofran, Melatonin`);
      showToast('PRN medications ordered');
    },
  },

  // Documentation
  {
    id: 'doc-note-template',
    label: 'Progress Note Template',
    description: 'Copy SOAP template',
    icon: FileText,
    category: 'documentation',
    shortcut: 'N',
    action: (patient, { copyToClipboard, showToast }) => {
      const template = `PROGRESS NOTE - ${patient.name}
Room: ${patient.bed}
Date: ${new Date().toLocaleDateString()}

SUBJECTIVE:
${patient.intervalEvents || 'Not documented'}

OBJECTIVE:
Vitals:
Labs: ${patient.labs || 'Not documented'}
Imaging: ${patient.imaging || 'Not documented'}

ASSESSMENT & PLAN:
${Object.entries(patient.systems)
  .filter(([_, v]) => v)
  .map(([k, v]) => `# ${k.toUpperCase()}\n${v}`)
  .join('\n\n') || 'Not documented'}

Disposition: ${patient.systems.dispo || 'Not documented'}`;
      copyToClipboard(template);
      showToast('Progress note copied to clipboard');
    },
  },
  {
    id: 'doc-one-liner',
    label: 'Generate One-Liner',
    description: 'Quick summary for handoff',
    icon: Clipboard,
    category: 'documentation',
    shortcut: 'O',
    action: (patient, { copyToClipboard, showToast }) => {
      const oneLiner = `${patient.bed}: ${patient.name} - ${patient.clinicalSummary?.slice(0, 100) || 'No summary'}...`;
      copyToClipboard(oneLiner);
      showToast('One-liner copied');
    },
  },
  {
    id: 'doc-signout',
    label: 'Create Sign-Out',
    description: 'Structured handoff note',
    icon: Send,
    category: 'documentation',
    action: (patient, { copyToClipboard, showToast }) => {
      const signout = `SIGN-OUT: ${patient.name} (${patient.bed})
Summary: ${patient.clinicalSummary || 'No summary'}
Overnight Events: ${patient.intervalEvents || 'None documented'}
Active Issues: ${Object.entries(patient.systems).filter(([_, v]) => v).map(([k]) => k).join(', ') || 'None'}
Pending: Not documented
If-Then: Not documented`;
      copyToClipboard(signout);
      showToast('Sign-out copied');
    },
  },
  {
    id: 'doc-attestation',
    label: 'Attending Attestation',
    description: 'Copy attestation statement',
    icon: ClipboardCheck,
    category: 'documentation',
    action: (patient, { copyToClipboard, showToast }) => {
      const attestation = `I have personally seen and examined this patient, reviewed the history, physical examination, and diagnostic data, and agree with the documented assessment and plan. The resident/APP note reflects my discussion with the care team.`;
      copyToClipboard(attestation);
      showToast('Attestation copied');
    },
  },

  // Communication
  {
    id: 'comm-family',
    label: 'Log Family Update',
    description: 'Document family communication',
    icon: Phone,
    category: 'communication',
    action: (patient, { updatePatient, showToast }) => {
      const timestamp = new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      updatePatient('intervalEvents', `${patient.intervalEvents}\n[${timestamp}] Family updated by phone - discussed current status and plan`);
      showToast('Family communication logged');
    },
  },
  {
    id: 'comm-consult',
    label: 'Request Consult',
    description: 'Log consult request',
    icon: UserPlus,
    category: 'communication',
    shortcut: 'R',
    action: (patient, { updatePatient, showToast }) => {
      const timestamp = new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      updatePatient('intervalEvents', `${patient.intervalEvents}\n${timestamp} Consult requested — service and indication not documented`);
      showToast('Consult request logged');
    },
  },
  {
    id: 'comm-nursing',
    label: 'Nursing Communication',
    description: 'Log nursing interaction',
    icon: MessageSquare,
    category: 'communication',
    action: (patient, { updatePatient, showToast }) => {
      const timestamp = new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      updatePatient('intervalEvents', `${patient.intervalEvents}\n[${timestamp}] Spoke with bedside nurse regarding patient care`);
      showToast('Nursing communication logged');
    },
  },

  // Clinical
  {
    id: 'clinical-rrt',
    label: 'RRT/Rapid Response',
    description: 'Document rapid response',
    icon: AlertTriangle,
    category: 'clinical',
    requiresConfirmation: true,
    confirmationMessage: 'Document Rapid Response Team activation?',
    action: (patient, { updatePatient, showToast }) => {
      const timestamp = new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      updatePatient('intervalEvents', `${patient.intervalEvents}\n${timestamp} **RRT ACTIVATED** — reason not documented`);
      showToast('RRT documented');
    },
  },
  {
    id: 'clinical-code',
    label: 'Document Code Status',
    description: 'Update code status discussion',
    icon: Activity,
    category: 'clinical',
    action: (patient, { updatePatient, showToast }) => {
      const timestamp = new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      updatePatient('systems.dispo', `${patient.systems.dispo}\n[${timestamp}] Code status: FULL CODE - discussed with patient/family`);
      showToast('Code status updated');
    },
  },
  {
    id: 'clinical-rounds',
    label: 'Mark Rounded',
    description: 'Mark patient as rounded',
    icon: Stethoscope,
    category: 'clinical',
    shortcut: 'M',
    action: (patient, { updatePatient, showToast }) => {
      const timestamp = new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      updatePatient('intervalEvents', `${patient.intervalEvents}\n[${timestamp}] Rounded - examined patient, reviewed data, plan discussed with team`);
      showToast('Marked as rounded');
    },
  },
];

interface QuickActionsPanelProps {
  patient: Patient;
  onUpdatePatient: (id: string, field: string, value: unknown) => void;
  className?: string;
}

export function QuickActionsPanel({ patient, onUpdatePatient, className }: QuickActionsPanelProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [confirmDialog, setConfirmDialog] = React.useState<{
    action: QuickAction;
    open: boolean;
  } | null>(null);

  const helpers: ActionHelpers = {
    updatePatient: (field, value) => {
      onUpdatePatient(patient.id, field, value);
    },
    copyToClipboard: (text) => {
      navigator.clipboard.writeText(text);
    },
    showToast: (message) => {
      toast.success(message);
    },
    openDialog: () => {
      // Could be expanded to show custom dialogs
    },
  };

  const executeAction = (action: QuickAction) => {
    if (action.requiresConfirmation) {
      setConfirmDialog({ action, open: true });
      return;
    }
    action.action(patient, helpers);
    setOpen(false);
  };

  const confirmedAction = () => {
    if (confirmDialog?.action) {
      confirmDialog.action.action(patient, helpers);
      setConfirmDialog(null);
      setOpen(false);
    }
  };

  const searchLower = search.toLowerCase();
  const filteredActions = QUICK_ACTIONS.filter(action =>
    action.label.toLowerCase().includes(searchLower) ||
    action.description?.toLowerCase().includes(searchLower)
  );

  const groupedActions = {
    order: filteredActions.filter(a => a.category === 'order'),
    documentation: filteredActions.filter(a => a.category === 'documentation'),
    communication: filteredActions.filter(a => a.category === 'communication'),
    clinical: filteredActions.filter(a => a.category === 'clinical'),
  };

  // Keyboard shortcut handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.metaKey || e.ctrlKey) return;

      const pressedKey = e.key.toLowerCase();
      const action = QUICK_ACTIONS.find(a => a.shortcut?.toLowerCase() === pressedKey);
      if (action) {
        e.preventDefault();
        executeAction(action);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patient]);

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("gap-1.5 h-8", className)}
                aria-label="Quick actions: orders, documentation, and common rounding shortcuts for this patient"
                aria-haspopup="dialog"
              >
                <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline text-xs">Quick Actions</span>
                <ChevronRight className="h-3 w-3 opacity-50 shrink-0" aria-hidden="true" />
              </Button>
            </SheetTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            Open quick actions: labs, imaging, consults, and one-tap documentation snippets for this patient.
          </TooltipContent>
        </Tooltip>
        <SheetContent className="w-[400px] sm:w-[480px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Quick Actions
              <Badge variant="outline" className="ml-2">
                {patient.name || 'Patient'}
              </Badge>
            </SheetTitle>
          </SheetHeader>

          <Command className="mt-4 border rounded-lg">
            <CommandInput
              placeholder="Search actions..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[calc(100vh-220px)]">
              <CommandEmpty>No actions found.</CommandEmpty>

              {groupedActions.order.length > 0 && (
                <CommandGroup heading="Orders">
                  {groupedActions.order.map(action => (
                    <CommandItem
                      key={action.id}
                      onSelect={() => executeAction(action)}
                      className="flex items-center gap-3 p-3 cursor-pointer"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-600">
                        <action.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{action.label}</p>
                        {action.description && (
                          <p className="text-xs text-muted-foreground">{action.description}</p>
                        )}
                      </div>
                      {action.shortcut && (
                        <Badge variant="outline" className="text-xs font-mono">
                          {action.shortcut}
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {groupedActions.documentation.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Documentation">
                    {groupedActions.documentation.map(action => (
                      <CommandItem
                        key={action.id}
                        onSelect={() => executeAction(action)}
                        className="flex items-center gap-3 p-3 cursor-pointer"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-100 text-green-600">
                          <action.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{action.label}</p>
                          {action.description && (
                            <p className="text-xs text-muted-foreground">{action.description}</p>
                          )}
                        </div>
                        {action.shortcut && (
                          <Badge variant="outline" className="text-xs font-mono">
                            {action.shortcut}
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {groupedActions.communication.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Communication">
                    {groupedActions.communication.map(action => (
                      <CommandItem
                        key={action.id}
                        onSelect={() => executeAction(action)}
                        className="flex items-center gap-3 p-3 cursor-pointer"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 text-purple-600">
                          <action.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{action.label}</p>
                          {action.description && (
                            <p className="text-xs text-muted-foreground">{action.description}</p>
                          )}
                        </div>
                        {action.shortcut && (
                          <Badge variant="outline" className="text-xs font-mono">
                            {action.shortcut}
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {groupedActions.clinical.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Clinical">
                    {groupedActions.clinical.map(action => (
                      <CommandItem
                        key={action.id}
                        onSelect={() => executeAction(action)}
                        className="flex items-center gap-3 p-3 cursor-pointer"
                      >
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-lg",
                          action.id === 'clinical-rrt' ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                        )}>
                          <action.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{action.label}</p>
                          {action.description && (
                            <p className="text-xs text-muted-foreground">{action.description}</p>
                          )}
                        </div>
                        {action.shortcut && (
                          <Badge variant="outline" className="text-xs font-mono">
                            {action.shortcut}
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>

          <div className="mt-4 p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Tip:</strong> Press the shortcut key while this panel is open to quickly execute an action.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog?.open ?? false} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Action
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.action.confirmationMessage || 'Are you sure you want to perform this action?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button onClick={confirmedAction}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Compact quick action buttons for inline use
interface QuickActionButtonsProps {
  patient: Patient;
  onUpdatePatient: (id: string, field: string, value: unknown) => void;
  actions?: string[];
  className?: string;
}

export function QuickActionButtons({
  patient,
  onUpdatePatient,
  actions = ['clinical-rounds', 'order-labs', 'doc-one-liner'],
  className,
}: QuickActionButtonsProps) {
  const helpers: ActionHelpers = {
    updatePatient: (field, value) => {
      onUpdatePatient(patient.id, field, value);
    },
    copyToClipboard: (text) => {
      navigator.clipboard.writeText(text);
    },
    showToast: (message) => {
      toast.success(message);
    },
    openDialog: () => {},
  };

  const selectedActions = QUICK_ACTIONS.filter(a => actions.includes(a.id));

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {selectedActions.map(action => (
        <Button
          key={action.id}
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => action.action(patient, helpers)}
          title={action.label}
        >
          <action.icon className="h-3.5 w-3.5" />
        </Button>
      ))}
    </div>
  );
}

export default QuickActionsPanel;
