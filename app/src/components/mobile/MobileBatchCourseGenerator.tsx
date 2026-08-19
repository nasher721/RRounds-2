import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  Check,
  X,
  Users,
  Copy,
  AlertCircle,
  ChevronRight,
  Calendar,
  FileText,
  ClipboardList,
} from 'lucide-react';
import { useBatchCourseGenerator, BatchResult, BatchGenerationType } from '@/hooks/useBatchCourseGenerator';
import { AIErrorBoundary } from '@/components/AIErrorBoundary';
import type { Patient } from '@/types/patient';
import type { PatientTodo } from '@/types/todo';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MobileBatchCourseGeneratorProps {
  patients: Patient[];
  todosMap?: Record<string, PatientTodo[]>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MobileBatchCourseGenerator = ({
  patients,
  todosMap,
  open,
  onOpenChange,
}: MobileBatchCourseGeneratorProps) => {
  const {
    generateBatch,
    isGenerating,
    progress,
    cancelGeneration,
  } = useBatchCourseGenerator();

  const [generationType, setGenerationType] = React.useState<BatchGenerationType>('course');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [results, setResults] = React.useState<BatchResult[]>([]);
  const [showResults, setShowResults] = React.useState(false);

  // Filter patients based on generation type
  const patientsWithContent = React.useMemo(() => {
    return patients.filter(patient => {
      if (generationType === 'intervalEvents') {
        return Object.values(patient.systems).some(val => val?.replace(/<[^>]*>/g, '').trim());
      } else {
        const hasContent = 
          patient.clinicalSummary?.replace(/<[^>]*>/g, '').trim() ||
          patient.intervalEvents?.replace(/<[^>]*>/g, '').trim() ||
          patient.imaging?.replace(/<[^>]*>/g, '').trim() ||
          patient.labs?.replace(/<[^>]*>/g, '').trim() ||
          Object.values(patient.systems).some(val => val?.replace(/<[^>]*>/g, '').trim());
        return hasContent;
      }
    });
  }, [patients, generationType]);

  // Reset selection when type changes or drawer opens
  React.useEffect(() => {
    if (open && patientsWithContent.length > 0) {
      setSelectedIds(new Set(patientsWithContent.map(p => p.id)));
    }
  }, [open, patientsWithContent]);

  // Reset state when drawer closes
  React.useEffect(() => {
    if (!open) {
      setShowResults(false);
      setResults([]);
    }
  }, [open]);

  const togglePatient = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === patientsWithContent.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(patientsWithContent.map(p => p.id)));
    }
  };

  const handleGenerate = async () => {
    const selectedPatients = patients.filter(p => selectedIds.has(p.id));
    
    if (selectedPatients.length === 0) return;

    setShowResults(false);
    const batchResults = await generateBatch(
      selectedPatients,
      generationType,
      generationType === 'dailySummary' ? todosMap : undefined
    );
    
    setResults(batchResults);
    setShowResults(true);
  };

  const handleCopyAll = () => {
    const successResults = results.filter(r => r.content);
    const text = successResults
      .map(r => `## ${r.patientName}\n\n${r.content}`)
      .join('\n\n---\n\n');
    
    navigator.clipboard.writeText(text);
    toast.success('All content copied to clipboard');
  };

  const handleCopySingle = (content: string, name: string) => {
    navigator.clipboard.writeText(content);
    toast.success(`${name}'s content copied`);
  };

  const handleClose = () => {
    if (!isGenerating) {
      onOpenChange(false);
    }
  };

  const progressPercent = progress.total > 0 
    ? (progress.completed / progress.total) * 100 
    : 0;

  const successCount = results.filter(r => r.content).length;
  const failCount = results.filter(r => !r.content).length;

  const typeLabelMap: Record<BatchGenerationType, { plural: string; singular: string }> = {
    course: { plural: 'Courses', singular: 'Course' },
    intervalEvents: { plural: 'Events', singular: 'Event' },
    dailySummary: { plural: 'Summaries', singular: 'Summary' },
  };
  const typeLabel = typeLabelMap[generationType].plural;

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Batch AI Generation
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-hidden">
          {!showResults ? (
            <div className="p-4 space-y-4">
              {/* Generation Type Tabs */}
              <Tabs 
                value={generationType} 
                onValueChange={(v) => setGenerationType(v as BatchGenerationType)}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3 h-auto p-1">
                  <TabsTrigger value="course" className="gap-1 py-2 text-xs flex-col h-auto">
                    <Calendar className="h-4 w-4" />
                    Course
                  </TabsTrigger>
                  <TabsTrigger value="intervalEvents" className="gap-1 py-2 text-xs flex-col h-auto">
                    <FileText className="h-4 w-4" />
                    Events
                  </TabsTrigger>
                  <TabsTrigger value="dailySummary" className="gap-1 py-2 text-xs flex-col h-auto">
                    <ClipboardList className="h-4 w-4" />
                    Summary
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Selection Header */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedIds.size} of {patientsWithContent.length} selected
                </span>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selectedIds.size === patientsWithContent.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {/* Patient List */}
              <ScrollArea className="h-[250px]">
                {patientsWithContent.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No patients with data</p>
                    <p className="text-xs mt-1">
                      {generationType === 'intervalEvents' 
                        ? 'Add system notes to patients first'
                        : 'Add clinical data to patients first'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {patientsWithContent.map(patient => (
                      <button
                        key={patient.id}
                        onClick={() => togglePatient(patient.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl transition-all active:scale-[0.98]",
                          selectedIds.has(patient.id) 
                            ? "bg-primary/10 border border-primary/30" 
                            : "bg-muted/50 border border-transparent"
                        )}
                      >
                        <Checkbox
                          checked={selectedIds.has(patient.id)}
                          className="pointer-events-none"
                        />
                        <div className="flex-1 text-left min-w-0">
                          <div className="font-medium truncate">{patient.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Bed: {patient.bed}
                          </div>
                        </div>
                        {selectedIds.has(patient.id) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <Card>
                <CardContent className="p-3">
                  <p className="text-sm text-foreground" role="status">
                    Generated content remains a review-only draft. It is never written into a patient chart automatically.
                  </p>
                </CardContent>
              </Card>

              {/* Progress during generation */}
              {isGenerating && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground truncate mr-2">
                        {progress.current}
                      </span>
                      <span className="font-medium shrink-0">
                        {progress.completed}/{progress.total}
                      </span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                  </CardContent>
                </Card>
              )}

            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Results Summary */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" />
                  {successCount} Generated
                </Badge>
                {failCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <X className="h-3 w-3" />
                    {failCount} Failed
                  </Badge>
                )}
                <Badge variant="outline">Review required</Badge>
              </div>

              {/* Results List */}
              <ScrollArea className="h-[280px]">
                <AIErrorBoundary featureLabel="Batch Results">
                  <div className="space-y-3">
                    {results.map(result => (
                      <Card
                        key={result.patientId}
                        className={cn(
                          result.content
                            ? "border-l-4 border-l-green-500"
                            : "border-l-4 border-l-destructive bg-destructive/5"
                        )}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {result.content ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <X className="h-4 w-4 text-destructive" />
                              )}
                              <span className="font-medium">{result.patientName}</span>
                            </div>
                            {result.content && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleCopySingle(result.content!, result.patientName)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <p className="mb-2 text-xs text-muted-foreground">
                            Patient: {result.patientName} · Source: documented chart fields
                            {generationType === 'dailySummary' ? ' and patient todos' : ''}
                          </p>
                          {result.content ? (
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-[100px] overflow-y-auto bg-muted/50 p-2 rounded">
                              {result.content}
                            </pre>
                          ) : (
                            <p className="text-xs text-destructive">{result.error}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </AIErrorBoundary>
              </ScrollArea>

              {/* Result actions */}
              <div className="space-y-2">
                {successCount > 0 && (
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleCopyAll}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy All {typeLabel}
                  </Button>
                )}
                <Button variant="ghost" className="w-full" onClick={() => setShowResults(false)}>
                  Review selection / retry
                </Button>
              </div>
            </div>
          )}
        </div>

        <DrawerFooter className="border-t">
          {!showResults ? (
            <div className="flex gap-2 w-full">
              <DrawerClose asChild>
                <Button variant="outline" className="flex-1" disabled={isGenerating}>
                  Cancel
                </Button>
              </DrawerClose>
              {isGenerating ? (
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={cancelGeneration}
                >
                  <X className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <Button 
                  className="flex-1"
                  onClick={handleGenerate} 
                  disabled={selectedIds.size === 0}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate ({selectedIds.size})
                </Button>
              )}
            </div>
          ) : (
            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

// Trigger button component for easy integration
interface MobileBatchCourseButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const MobileBatchCourseButton = ({ onClick, disabled }: MobileBatchCourseButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="w-full text-left active:scale-[0.98] transition-transform disabled:opacity-50"
  >
    <Card className="border-l-4 hover:bg-muted/50 transition-colors" style={{ borderLeftColor: '#8b5cf6' }}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div
            className="p-3 rounded-xl"
            style={{ backgroundColor: '#8b5cf615' }}
          >
            <Users className="h-6 w-6" style={{ color: '#8b5cf6' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Batch AI Generator</h3>
              <Badge variant="outline" className="text-xs">AI</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Generate for multiple patients
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  </button>
);
