import * as React from "react";
import {
  ArrowRightLeft,
  CheckCircle,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  Send,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BatchCourseGenerator } from "@/components/BatchCourseGenerator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Patient } from "@/types/patient";
import type {
  HandoffData,
  SBARNote,
  IfThenPlan,
  HandoffTask,
} from "@/types/handoff";
import {
  createEmptyHandoff,
  generateSBARFromPatient,
  SBAR_TEMPLATES,
  CODE_STATUS_OPTIONS,
} from "@/types/handoff";

interface ShiftHandoffProps {
  patients: Patient[];
  onSaveHandoff: (handoff: HandoffData) => void;
  onCompleteHandoff: (handoffs: HandoffData[]) => void;
  onUpdatePatient?: (id: string, field: string, value: unknown) => void;
  existingHandoffs?: HandoffData[];
  className?: string;
}

export function ShiftHandoff({
  patients,
  onSaveHandoff,
  onCompleteHandoff,
  onUpdatePatient,
  existingHandoffs = [],
  className,
}: ShiftHandoffProps) {
  const [selectedPatientId, setSelectedPatientId] = React.useState<string | null>(
    patients[0]?.id || null
  );
  const [handoffs, setHandoffs] = React.useState<Map<string, HandoffData>>(
    () => {
      const map = new Map();
      existingHandoffs.forEach(h => map.set(h.patientId, h));
      return map;
    }
  );
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(['sbar', 'tasks', 'ifthen'])
  );

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Get or create handoff for patient
  const getHandoff = (patientId: string): HandoffData => {
    if (handoffs.has(patientId)) {
      return handoffs.get(patientId)!;
    }
    const patient = patients.find(p => p.id === patientId);
    if (!patient) {
      return createEmptyHandoff(patientId, 'Unknown', '');
    }
    return createEmptyHandoff(patientId, patient.name, patient.bed);
  };

  const currentHandoff = selectedPatientId ? getHandoff(selectedPatientId) : null;

  const updateHandoff = (updates: Partial<HandoffData>) => {
    if (!selectedPatientId || !currentHandoff) return;

    const updated = { ...currentHandoff, ...updates };
    setHandoffs(prev => new Map(prev).set(selectedPatientId, updated));
  };

  const updateSBAR = (field: keyof SBARNote, value: string) => {
    if (!currentHandoff) return;
    updateHandoff({
      sbar: { ...currentHandoff.sbar, [field]: value },
    });
  };

  const addIfThenPlan = () => {
    if (!currentHandoff) return;
    const newPlan: IfThenPlan = {
      id: `plan-${Date.now()}`,
      condition: '',
      action: '',
      priority: 'routine',
    };
    updateHandoff({
      ifThenPlans: [...currentHandoff.ifThenPlans, newPlan],
    });
  };

  const updateIfThenPlan = (planId: string, updates: Partial<IfThenPlan>) => {
    if (!currentHandoff) return;
    updateHandoff({
      ifThenPlans: currentHandoff.ifThenPlans.map(p =>
        p.id === planId ? { ...p, ...updates } : p
      ),
    });
  };

  const removeIfThenPlan = (planId: string) => {
    if (!currentHandoff) return;
    updateHandoff({
      ifThenPlans: currentHandoff.ifThenPlans.filter(p => p.id !== planId),
    });
  };

  const addPendingTask = () => {
    if (!currentHandoff) return;
    const newTask: HandoffTask = {
      id: `task-${Date.now()}`,
      description: '',
      priority: 'medium',
      completed: false,
    };
    updateHandoff({
      pendingTasks: [...currentHandoff.pendingTasks, newTask],
    });
  };

  const updateTask = (taskId: string, updates: Partial<HandoffTask>) => {
    if (!currentHandoff) return;
    updateHandoff({
      pendingTasks: currentHandoff.pendingTasks.map(t =>
        t.id === taskId ? { ...t, ...updates } : t
      ),
    });
  };

  const removeTask = (taskId: string) => {
    if (!currentHandoff) return;
    updateHandoff({
      pendingTasks: currentHandoff.pendingTasks.filter(t => t.id !== taskId),
    });
  };

  const autoGenerateSBAR = () => {
    if (!selectedPatient) return;
    const sbar = generateSBARFromPatient({
      name: selectedPatient.name,
      bed: selectedPatient.bed,
      clinicalSummary: selectedPatient.clinicalSummary,
      intervalEvents: selectedPatient.intervalEvents,
      labs: selectedPatient.labs,
      systems: selectedPatient.systems as unknown as Record<string, string>,
    });
    updateHandoff({ sbar });
  };

  const applyTemplate = (templateKey: keyof typeof SBAR_TEMPLATES) => {
    const template = SBAR_TEMPLATES[templateKey];
    updateHandoff({ sbar: { ...template } });
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const completedCount = Array.from(handoffs.values()).filter(h => h.sbar.situation).length;

  return (
    <div className={cn("flex h-full", className)}>
      {/* Patient List Sidebar */}
      <div className="w-64 border-r bg-muted/20 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Shift Handoff
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {completedCount}/{patients.length} patients documented
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {patients.map(patient => {
              const handoff = handoffs.get(patient.id);
              const hasContent = handoff?.sbar.situation;
              const isSelected = selectedPatientId === patient.id;

              return (
                <button
                  key={patient.id}
                  onClick={() => setSelectedPatientId(patient.id)}
                  className={cn(
                    "w-full p-3 rounded-lg text-left transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{patient.name}</span>
                    {hasContent && (
                      <CheckCircle className={cn(
                        "h-4 w-4 flex-shrink-0",
                        isSelected ? "text-primary-foreground" : "text-green-500"
                      )} />
                    )}
                  </div>
                  <div className={cn(
                    "text-xs mt-0.5",
                    isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    Bed: {patient.bed}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-3 border-t space-y-2">
          {onUpdatePatient && (
            <BatchCourseGenerator
              patients={patients}
              className="w-full [&>button]:w-full"
            />
          )}
          <Button
            className="w-full"
            onClick={() => onCompleteHandoff(Array.from(handoffs.values()))}
            disabled={completedCount === 0}
          >
            <Send className="h-4 w-4 mr-2" />
            Complete Handoff
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {selectedPatient && currentHandoff ? (
          <>
            {/* Patient Header */}
            <div className="p-4 border-b bg-muted/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{selectedPatient.name}</h3>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span>Bed: {selectedPatient.bed}</span>
                    <Select
                      value={currentHandoff.codeStatus || 'full'}
                      onValueChange={(v) => updateHandoff({ codeStatus: v })}
                    >
                      <SelectTrigger className="h-7 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CODE_STATUS_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={autoGenerateSBAR}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Auto-Generate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSaveHandoff(currentHandoff)}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            </div>

            {/* Handoff Form */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-3xl">
                {/* One-Liner */}
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    One-Liner Summary
                  </Label>
                  <Input
                    value={currentHandoff.oneLiner}
                    onChange={(e) => updateHandoff({ oneLiner: e.target.value })}
                    placeholder="e.g., 65M with COPD exacerbation, improving on BiPAP"
                    className="mt-1"
                  />
                </div>

                {/* SBAR Section */}
                <Collapsible
                  open={expandedSections.has('sbar')}
                  onOpenChange={() => toggleSection('sbar')}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="py-3 cursor-pointer hover:bg-muted/50">
                        <CardTitle className="text-sm flex items-center gap-2">
                          {expandedSections.has('sbar') ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          SBAR Communication
                          {currentHandoff.sbar.situation && (
                            <Badge variant="outline" className="ml-2">Completed</Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-4">
                        {/* Template selector */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyTemplate('general')}
                          >
                            General
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyTemplate('deteriorating')}
                          >
                            Deteriorating
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyTemplate('stable')}
                          >
                            Stable
                          </Button>
                        </div>

                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                                S
                              </span>
                              Situation
                            </Label>
                            <Textarea
                              value={currentHandoff.sbar.situation}
                              onChange={(e) => updateSBAR('situation', e.target.value)}
                              placeholder="What is happening right now?"
                              rows={2}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                                B
                              </span>
                              Background
                            </Label>
                            <Textarea
                              value={currentHandoff.sbar.background}
                              onChange={(e) => updateSBAR('background', e.target.value)}
                              placeholder="What is the clinical context?"
                              rows={3}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                                A
                              </span>
                              Assessment
                            </Label>
                            <Textarea
                              value={currentHandoff.sbar.assessment}
                              onChange={(e) => updateSBAR('assessment', e.target.value)}
                              placeholder="What do you think is going on?"
                              rows={3}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                                R
                              </span>
                              Recommendation
                            </Label>
                            <Textarea
                              value={currentHandoff.sbar.recommendation}
                              onChange={(e) => updateSBAR('recommendation', e.target.value)}
                              placeholder="What do you need?"
                              rows={2}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Pending Tasks */}
                <Collapsible
                  open={expandedSections.has('tasks')}
                  onOpenChange={() => toggleSection('tasks')}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="py-3 cursor-pointer hover:bg-muted/50">
                        <CardTitle className="text-sm flex items-center gap-2">
                          {expandedSections.has('tasks') ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          Pending Tasks
                          {currentHandoff.pendingTasks.length > 0 && (
                            <Badge variant="secondary" className="ml-2">
                              {currentHandoff.pendingTasks.length}
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-2">
                        {currentHandoff.pendingTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-2 p-2 border rounded-lg"
                          >
                            <Select
                              value={task.priority}
                              onValueChange={(v: 'high' | 'medium' | 'low') =>
                                updateTask(task.id, { priority: v })
                              }
                            >
                              <SelectTrigger className="w-[90px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              value={task.description}
                              onChange={(e) =>
                                updateTask(task.id, { description: e.target.value })
                              }
                              placeholder="Task description"
                              className="flex-1"
                            />
                            <Input
                              value={task.dueTime || ''}
                              onChange={(e) =>
                                updateTask(task.id, { dueTime: e.target.value })
                              }
                              placeholder="Due time"
                              className="w-24"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeTask(task.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addPendingTask}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Task
                        </Button>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* If-Then Plans */}
                <Collapsible
                  open={expandedSections.has('ifthen')}
                  onOpenChange={() => toggleSection('ifthen')}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="py-3 cursor-pointer hover:bg-muted/50">
                        <CardTitle className="text-sm flex items-center gap-2">
                          {expandedSections.has('ifthen') ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          If-Then Plans
                          {currentHandoff.ifThenPlans.length > 0 && (
                            <Badge variant="secondary" className="ml-2">
                              {currentHandoff.ifThenPlans.length}
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-3">
                        {currentHandoff.ifThenPlans.map((plan) => (
                          <div
                            key={plan.id}
                            className="p-3 border rounded-lg space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={plan.priority === 'urgent' ? 'destructive' : 'outline'}
                                className="text-xs"
                              >
                                {plan.priority}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-auto"
                                onClick={() => removeIfThenPlan(plan.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">If...</Label>
                                <Input
                                  value={plan.condition}
                                  onChange={(e) =>
                                    updateIfThenPlan(plan.id, { condition: e.target.value })
                                  }
                                  placeholder="Condition"
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Then...</Label>
                                <Input
                                  value={plan.action}
                                  onChange={(e) =>
                                    updateIfThenPlan(plan.id, { action: e.target.value })
                                  }
                                  placeholder="Action"
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addIfThenPlan}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add If-Then Plan
                        </Button>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Anticipatory Guidance */}
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Anticipatory Guidance
                  </Label>
                  <Textarea
                    value={currentHandoff.anticipatoryGuidance}
                    onChange={(e) =>
                      updateHandoff({ anticipatoryGuidance: e.target.value })
                    }
                    placeholder="What might happen and what to do about it..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Select a patient to start handoff documentation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ShiftHandoff;
