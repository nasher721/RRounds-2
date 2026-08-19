import * as React from "react";
import {
  ArrowRightLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Plus,
  X,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Activity,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Patient } from "@/types/patient";
import type { HandoffData, SBARNote, IfThenPlan } from "@/types/handoff";
import { createEmptyHandoff, generateSBARFromPatient, CODE_STATUS_OPTIONS } from "@/types/handoff";

interface MobileHandoffProps {
  patient: Patient;
  handoff?: HandoffData;
  onSave: (handoff: HandoffData) => void;
  onComplete: () => void;
  className?: string;
}

const CODE_STATUS_COLORS: Record<string, string> = {
  full: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  dnr: "bg-amber-500/10 text-amber-700 border-amber-200",
  dni: "bg-red-500/10 text-red-700 border-red-200",
  comfort: "bg-slate-500/10 text-slate-600 border-slate-200",
};

const CODE_STATUS_LABELS: Record<string, string> = {
  full: "Full Code",
  dnr: "DNR",
  dni: "DNI",
  comfort: "Comfort Care",
};

export function MobileHandoff({
  patient,
  handoff: initialHandoff,
  onSave,
  onComplete,
  className,
}: MobileHandoffProps) {
  const [handoff, setHandoff] = React.useState<HandoffData>(() =>
    initialHandoff || createEmptyHandoff(patient.id, patient.name, patient.bed)
  );
  const [expandedSection, setExpandedSection] = React.useState<string | null>("sbar");

  const updateHandoff = (updates: Partial<HandoffData>) => {
    setHandoff(prev => ({ ...prev, ...updates }));
  };

  const updateSBAR = (field: keyof SBARNote, value: string) => {
    updateHandoff({
      sbar: { ...handoff.sbar, [field]: value },
    });
  };

  const autoGenerate = () => {
    const sbar = generateSBARFromPatient({
      name: patient.name,
      bed: patient.bed,
      clinicalSummary: patient.clinicalSummary,
      intervalEvents: patient.intervalEvents,
      labs: patient.labs,
      systems: patient.systems as unknown as Record<string, string>,
    });
    updateHandoff({ sbar });
  };

  const addIfThenPlan = () => {
    const newPlan: IfThenPlan = {
      id: `plan-${Date.now()}`,
      condition: '',
      action: '',
      priority: 'routine',
    };
    updateHandoff({
      ifThenPlans: [...handoff.ifThenPlans, newPlan],
    });
  };

  const updateIfThenPlan = (planId: string, updates: Partial<IfThenPlan>) => {
    updateHandoff({
      ifThenPlans: handoff.ifThenPlans.map(p =>
        p.id === planId ? { ...p, ...updates } : p
      ),
    });
  };

  const removeIfThenPlan = (planId: string) => {
    updateHandoff({
      ifThenPlans: handoff.ifThenPlans.filter(p => p.id !== planId),
    });
  };

  const isSBARComplete = handoff.sbar.situation && handoff.sbar.assessment;
  const codeStatus = handoff.codeStatus || 'full';
  const codeStatusColor = CODE_STATUS_COLORS[codeStatus] || CODE_STATUS_COLORS.full;
  const codeStatusLabel = CODE_STATUS_LABELS[codeStatus] || CODE_STATUS_LABELS.full;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Patient Header */}
      <div className="px-4 py-4 border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base tracking-tight truncate">{patient.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className="rounded-lg text-xs font-medium px-2 py-0.5">
                {patient.bed}
              </Badge>
              {isSBARComplete && (
                <Badge variant="outline" className="rounded-lg text-xs font-medium px-2 py-0.5 bg-emerald-500/10 text-emerald-700 border-emerald-200">
                  <Check className="h-3 w-3 mr-1" />
                  Ready
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Code Status & One-Liner */}
        <div className="mt-3 space-y-2.5">
          <div className="flex gap-2">
            <Select
              value={codeStatus}
              onValueChange={(v) => updateHandoff({ codeStatus: v })}
            >
              <SelectTrigger className={cn(
                "flex-1 h-11 rounded-xl border font-medium",
                codeStatusColor
              )}>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <SelectValue>{codeStatusLabel}</SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent>
                {CODE_STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={autoGenerate}
              className="h-11 rounded-xl gap-1.5 shrink-0"
            >
              <Sparkles className="h-4 w-4" />
              <span className="text-sm">Auto-fill</span>
            </Button>
          </div>
          <Input
            value={handoff.oneLiner}
            onChange={(e) => updateHandoff({ oneLiner: e.target.value })}
            placeholder="One-liner summary..."
            className="h-11 rounded-xl text-sm"
          />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {/* SBAR Section */}
          <Collapsible
            open={expandedSection === 'sbar'}
            onOpenChange={(open) => setExpandedSection(open ? 'sbar' : null)}
          >
            <Card className="rounded-2xl border-border/50 overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="w-full px-4 py-3.5 flex items-center justify-between min-h-[48px]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">S</span>
                    </div>
                    <span className="font-semibold text-sm tracking-tight">SBAR</span>
                    {isSBARComplete && (
                      <Check className="h-4 w-4 text-emerald-600" />
                    )}
                  </div>
                  {expandedSection === 'sbar' ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-4 pb-4 space-y-4">
                  <SBARField
                    letter="S"
                    label="Situation"
                    value={handoff.sbar.situation}
                    onChange={(v) => updateSBAR('situation', v)}
                    placeholder="What is happening right now?"
                    color="blue"
                  />
                  <SBARField
                    letter="B"
                    label="Background"
                    value={handoff.sbar.background}
                    onChange={(v) => updateSBAR('background', v)}
                    placeholder="What is the clinical context?"
                    color="green"
                  />
                  <SBARField
                    letter="A"
                    label="Assessment"
                    value={handoff.sbar.assessment}
                    onChange={(v) => updateSBAR('assessment', v)}
                    placeholder="What do you think is going on?"
                    color="amber"
                  />
                  <SBARField
                    letter="R"
                    label="Recommendation"
                    value={handoff.sbar.recommendation}
                    onChange={(v) => updateSBAR('recommendation', v)}
                    placeholder="What do you need?"
                    color="purple"
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* If-Then Plans */}
          <Collapsible
            open={expandedSection === 'ifthen'}
            onOpenChange={(open) => setExpandedSection(open ? 'ifthen' : null)}
          >
            <Card className="rounded-2xl border-border/50 overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="w-full px-4 py-3.5 flex items-center justify-between min-h-[48px]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="font-semibold text-sm tracking-tight">If-Then Plans</span>
                    {handoff.ifThenPlans.length > 0 && (
                      <Badge variant="secondary" className="rounded-lg text-xs font-medium">
                        {handoff.ifThenPlans.length}
                      </Badge>
                    )}
                  </div>
                  {expandedSection === 'ifthen' ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-4 pb-4 space-y-3">
                  {handoff.ifThenPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="p-3.5 rounded-xl border border-border/50 bg-muted/30 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={plan.priority === 'urgent' ? 'destructive' : 'secondary'}
                          className="rounded-lg text-xs font-medium"
                        >
                          {plan.priority}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg"
                          onClick={() => removeIfThenPlan(plan.id)}
                          aria-label="Remove plan"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Input
                        value={plan.condition}
                        onChange={(e) => updateIfThenPlan(plan.id, { condition: e.target.value })}
                        placeholder="If..."
                        className="h-10 rounded-xl text-sm"
                      />
                      <Input
                        value={plan.action}
                        onChange={(e) => updateIfThenPlan(plan.id, { action: e.target.value })}
                        placeholder="Then..."
                        className="h-10 rounded-xl text-sm"
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addIfThenPlan}
                    className="w-full h-11 rounded-xl gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Add If-Then Plan
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Anticipatory Guidance */}
          <Collapsible
            open={expandedSection === 'guidance'}
            onOpenChange={(open) => setExpandedSection(open ? 'guidance' : null)}
          >
            <Card className="rounded-2xl border-border/50 overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="w-full px-4 py-3.5 flex items-center justify-between min-h-[48px]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <span className="font-semibold text-sm tracking-tight">Anticipatory Guidance</span>
                  </div>
                  {expandedSection === 'guidance' ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-4 pb-4">
                  <Textarea
                    value={handoff.anticipatoryGuidance}
                    onChange={(e) => updateHandoff({ anticipatoryGuidance: e.target.value })}
                    placeholder="What might happen and what to do about it..."
                    rows={4}
                    className="rounded-xl text-sm resize-none"
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="px-4 py-3 border-t border-border/50 bg-background/90 backdrop-blur-xl safe-area-bottom">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-11 rounded-xl font-medium"
            onClick={() => onSave(handoff)}
          >
            Save Draft
          </Button>
          <Button
            className="flex-1 h-11 rounded-xl font-medium gap-1.5"
            onClick={onComplete}
            disabled={!isSBARComplete}
          >
            <Send className="h-4 w-4" />
            Complete
          </Button>
        </div>
      </div>
    </div>
  );
}

interface SBARFieldProps {
  letter: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  color: 'blue' | 'green' | 'amber' | 'purple';
}

function SBARField({ letter, label, value, onChange, placeholder, color }: SBARFieldProps) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-700',
    green: 'bg-emerald-500/10 text-emerald-700',
    amber: 'bg-amber-500/10 text-amber-700',
    purple: 'bg-purple-500/10 text-purple-700',
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={cn(
          "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold",
          colorClasses[color]
        )}>
          {letter}
        </span>
        <span className="text-sm font-medium tracking-tight">{label}</span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="rounded-xl text-sm resize-none"
      />
    </div>
  );
}

interface HandoffSummaryProps {
  handoff?: HandoffData;
  onClick?: () => void;
}

export function HandoffSummary({ handoff, onClick }: HandoffSummaryProps) {
  if (!handoff) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        className="w-full justify-start gap-2 h-11 rounded-xl"
      >
        <ArrowRightLeft className="h-4 w-4" />
        Create Handoff
      </Button>
    );
  }

  const isComplete = handoff.sbar.situation && handoff.sbar.assessment;

  return (
    <button
      onClick={onClick}
      className="w-full p-3.5 rounded-xl border border-purple-200/50 bg-purple-500/5 text-left active:bg-purple-500/10 transition-colors"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-purple-700">Handoff</span>
        {isComplete ? (
          <Badge variant="outline" className="rounded-lg text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
            Ready
          </Badge>
        ) : (
          <Badge variant="outline" className="rounded-lg text-[10px]">Draft</Badge>
        )}
      </div>
      {handoff.oneLiner && (
        <p className="text-sm line-clamp-2">{handoff.oneLiner}</p>
      )}
      {handoff.ifThenPlans.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1.5">
          {handoff.ifThenPlans.length} if-then plan{handoff.ifThenPlans.length > 1 ? 's' : ''}
        </p>
      )}
    </button>
  );
}

export default MobileHandoff;
