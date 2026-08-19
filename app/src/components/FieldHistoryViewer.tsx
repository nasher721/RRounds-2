import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as AlertDialogContentRoot,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader as AlertDialogHeaderRoot,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Clock, ArrowRight, Trash2, Loader2 } from "lucide-react";
import { useFieldHistory, FieldHistoryEntry } from "@/hooks/useFieldHistory";
import { useSystemsConfig } from "@/hooks/useSystemsConfig";

interface FieldHistoryViewerProps {
  patientId: string;
  patientName: string;
  trigger?: React.ReactNode;
}

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const truncateText = (text: string | null, maxLength: number = 100): string => {
  if (!text) return "(empty)";
  // Strip HTML tags for display
  const stripped = text.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");
  if (stripped.length <= maxLength) return stripped;
  return stripped.substring(0, maxLength) + "...";
};

const HistoryEntry = ({ entry, fieldLabels }: { entry: FieldHistoryEntry; fieldLabels: Record<string, string> }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-primary">
          {fieldLabels[entry.fieldName] || entry.fieldName}
        </span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span title={new Date(entry.changedAt).toLocaleString()}>
            {formatRelativeTime(entry.changedAt)}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-2 text-sm">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground mb-1">Before:</div>
          <div 
            className={`bg-destructive/10 rounded p-2 text-xs break-words ${
              expanded ? "" : "line-clamp-2"
            }`}
          >
            {truncateText(entry.oldValue, expanded ? 10000 : 100)}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground mb-1">After:</div>
          <div 
            className={`bg-success/10 rounded p-2 text-xs break-words ${
              expanded ? "" : "line-clamp-2"
            }`}
          >
            {truncateText(entry.newValue, expanded ? 10000 : 100)}
          </div>
        </div>
      </div>

      {((entry.oldValue?.length || 0) > 100 || (entry.newValue?.length || 0) > 100) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-6 text-xs w-full"
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      )}
    </div>
  );
};

export const FieldHistoryViewer = ({
  patientId,
  patientName,
  trigger,
}: FieldHistoryViewerProps) => {
  const [open, setOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<string>("all");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { history, loading, fetchHistory, clearHistory } = useFieldHistory(patientId);
  const { systems } = useSystemsConfig();

  // Build field labels dynamically based on systems config
  const fieldLabels = useMemo(() => {
    const labels: Record<string, string> = {
      clinicalSummary: "Clinical Summary",
      intervalEvents: "Interval Events",
      imaging: "Imaging",
      labs: "Labs",
    };
    systems.forEach(s => {
      labels[`systems.${s.key}`] = `Systems: ${s.label}`;
    });
    return labels;
  }, [systems]);

  useEffect(() => {
    if (open) {
      fetchHistory(selectedField === "all" ? undefined : selectedField);
    }
  }, [open, selectedField, fetchHistory]);

  const handleClearHistory = async () => {
    await clearHistory();
    setShowClearConfirm(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <History className="h-3 w-3" />
            History
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Change History: {patientName || "Patient"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 py-2">
          <Select value={selectedField} onValueChange={setSelectedField}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fields</SelectItem>
              <SelectItem value="clinicalSummary">Clinical Summary</SelectItem>
              <SelectItem value="intervalEvents">Interval Events</SelectItem>
              <SelectItem value="imaging">Imaging</SelectItem>
              <SelectItem value="labs">Labs</SelectItem>
              {systems.map((system) => (
                <SelectItem key={system.key} value={`systems.${system.key}`}>
                  {system.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowClearConfirm(true)}
            className="text-destructive hover:text-destructive"
            disabled={history.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear History
          </Button>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mb-2 opacity-20" />
              <p>No changes recorded yet</p>
              <p className="text-xs">Changes will appear here as you edit fields</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <HistoryEntry key={entry.id} entry={entry} fieldLabels={fieldLabels} />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContentRoot>
          <AlertDialogHeaderRoot>
            <AlertDialogTitle>Clear history</AlertDialogTitle>
            <AlertDialogDescription>
              Clear all history for this patient? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeaderRoot>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear history
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentRoot>
      </AlertDialog>
    </Dialog>
  );
};
