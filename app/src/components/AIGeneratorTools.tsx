import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Calendar, ClipboardList, Loader2, Undo2 } from 'lucide-react';
import { useIntervalEventsGenerator } from '@/hooks/useIntervalEventsGenerator';
import { usePatientCourseGenerator } from '@/hooks/usePatientCourseGenerator';
import { AIErrorBoundary } from '@/components/AIErrorBoundary';
import type { Patient } from '@/types/patient';

interface AIGeneratorToolsProps {
  patient: Patient;
  onUpdatePatient: (id: string, field: string, value: unknown) => void;
  className?: string;
  compact?: boolean;
}

type HistoryEntry = {
  field: string;
  previousValue: string;
  timestamp: Date;
};

export const AIGeneratorTools = ({
  patient,
  onUpdatePatient,
  className = '',
  compact = false,
}: AIGeneratorToolsProps) => {
  const { generateIntervalEvents, isGenerating: isGeneratingEvents, cancelGeneration: cancelEvents } = useIntervalEventsGenerator();
  const { generatePatientCourse, isGenerating: isGeneratingCourse, cancelGeneration: cancelCourse } = usePatientCourseGenerator();
  
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [showCourseDialog, setShowCourseDialog] = React.useState(false);
  const [generatedCourse, setGeneratedCourse] = React.useState<string | null>(null);
  
  const isGenerating = isGeneratingEvents || isGeneratingCourse;

  const addToHistory = React.useCallback((field: string, previousValue: string) => {
    setHistory(prev => [
      { field, previousValue, timestamp: new Date() },
      ...prev.slice(0, 9), // Keep last 10 entries
    ]);
  }, []);

  const handleUndo = React.useCallback(() => {
    if (history.length === 0) return;
    
    const [lastEntry, ...rest] = history;
    onUpdatePatient(patient.id, lastEntry.field, lastEntry.previousValue);
    setHistory(rest);
  }, [history, onUpdatePatient, patient.id]);

  const handleGenerateIntervalEvents = React.useCallback(async () => {
    // Save current value for undo
    addToHistory('intervalEvents', patient.intervalEvents);
    
    const result = await generateIntervalEvents(
      patient.systems,
      patient.intervalEvents,
      patient.name
    );
    
    if (result) {
      // Append to existing interval events or replace if empty
      const newValue = patient.intervalEvents 
        ? `${patient.intervalEvents}\n\n${result}`
        : result;
      onUpdatePatient(patient.id, 'intervalEvents', newValue);
    }
  }, [generateIntervalEvents, patient, onUpdatePatient, addToHistory]);

  const handleGeneratePatientCourse = React.useCallback(async () => {
    const result = await generatePatientCourse(patient);
    
    if (result) {
      setGeneratedCourse(result);
      setShowCourseDialog(true);
    }
  }, [generatePatientCourse, patient]);

  const handleInsertCourse = React.useCallback(() => {
    if (!generatedCourse) return;
    
    // Save current value for undo
    addToHistory('clinicalSummary', patient.clinicalSummary);
    
    // Append course to clinical summary
    const newValue = patient.clinicalSummary
      ? `${patient.clinicalSummary}\n\n---\n**Hospital Course:**\n${generatedCourse}`
      : `**Hospital Course:**\n${generatedCourse}`;
    
    onUpdatePatient(patient.id, 'clinicalSummary', newValue);
    setShowCourseDialog(false);
    setGeneratedCourse(null);
  }, [generatedCourse, patient, onUpdatePatient, addToHistory]);

  const handleCopyCourse = React.useCallback(() => {
    if (!generatedCourse) return;
    navigator.clipboard.writeText(generatedCourse);
    setShowCourseDialog(false);
    setGeneratedCourse(null);
  }, [generatedCourse]);

  const handleCancel = React.useCallback(() => {
    cancelEvents();
    cancelCourse();
  }, [cancelEvents, cancelCourse]);

  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isGenerating}
              className="h-7 px-2 text-xs"
            >
              {isGenerating ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              AI Tools
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleGenerateIntervalEvents} disabled={isGenerating}>
              <ClipboardList className="h-4 w-4 mr-2" />
              Generate Interval Events
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleGeneratePatientCourse} disabled={isGenerating}>
              <Calendar className="h-4 w-4 mr-2" />
              Generate Patient Course
            </DropdownMenuItem>
            {history.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleUndo}>
                  <Undo2 className="h-4 w-4 mr-2" />
                  Undo Last AI Change
                </DropdownMenuItem>
              </>
            )}
            {isGenerating && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCancel} className="text-destructive">
                  Cancel
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Course Preview Dialog */}
        <Dialog open={showCourseDialog} onOpenChange={setShowCourseDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Generated Patient Course</DialogTitle>
              <DialogDescription>
                Review the generated hospital course. You can insert it into the clinical summary or copy to clipboard.
              </DialogDescription>
            </DialogHeader>
            <AIErrorBoundary featureLabel="Patient Course">
              <div className="my-4 p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm font-mono">
                {generatedCourse}
              </div>
            </AIErrorBoundary>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCourseDialog(false)}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={handleCopyCourse}>
                Copy to Clipboard
              </Button>
              <Button onClick={handleInsertCourse}>
                Insert into Clinical Summary
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            AI Generate
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={handleGenerateIntervalEvents} disabled={isGenerating}>
            <ClipboardList className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span>Generate Interval Events</span>
              <span className="text-xs text-muted-foreground">From today's system notes</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleGeneratePatientCourse} disabled={isGenerating}>
            <Calendar className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span>Generate Patient Course</span>
              <span className="text-xs text-muted-foreground">Chronological summary</span>
            </div>
          </DropdownMenuItem>
          {history.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleUndo}>
                <Undo2 className="h-4 w-4 mr-2" />
                Undo Last AI Change
              </DropdownMenuItem>
            </>
          )}
          {isGenerating && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCancel} className="text-destructive">
                Cancel Generation
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Course Preview Dialog */}
      <Dialog open={showCourseDialog} onOpenChange={setShowCourseDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generated Patient Course</DialogTitle>
            <DialogDescription>
              Review the generated hospital course. You can insert it into the clinical summary or copy to clipboard.
            </DialogDescription>
          </DialogHeader>
          <AIErrorBoundary featureLabel="Patient Course">
            <div className="my-4 p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm font-mono">
              {generatedCourse}
            </div>
          </AIErrorBoundary>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCourseDialog(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleCopyCourse}>
              Copy to Clipboard
            </Button>
            <Button onClick={handleInsertCourse}>
              Insert into Clinical Summary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
