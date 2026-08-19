/**
 * Treatment Algorithm Component
 * Step-by-step treatment approach with phases and actions
 */

import { memo, useState } from 'react';
import { ChevronRight, Clock, CheckCircle2, Circle, Zap, AlertCircle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import type { TreatmentStep, TreatmentAction } from '@/types/ibcc';
import { cn } from '@/lib/utils';

interface TreatmentAlgorithmProps {
  steps: TreatmentStep[];
  defaultOpen?: boolean;
}

const priorityConfig = {
  immediate: {
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    icon: Zap,
    label: 'Immediate',
  },
  urgent: {
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    icon: AlertCircle,
    label: 'Urgent',
  },
  routine: {
    color: 'text-muted-foreground',
    bgColor: 'bg-secondary',
    borderColor: 'border-border',
    icon: Circle,
    label: 'Routine',
  },
};

function TreatmentAlgorithmComponent({ steps, defaultOpen = true }: TreatmentAlgorithmProps) {
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());

  if (!steps || steps.length === 0) return null;

  const toggleAction = (actionId: string) => {
    setCompletedActions((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  };

  return (
    <Collapsible defaultOpen={defaultOpen} className="mb-4">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors">
        <div className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Treatment Algorithm</span>
          <Badge variant="secondary" className="text-xs">
            {steps.length} phases
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">Click to expand</span>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2">
        <div className="relative pl-4 border-l-2 border-primary/30 space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="relative">
              {/* Phase marker */}
              <div className="absolute -left-[21px] w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary-foreground">
                  {index + 1}
                </span>
              </div>
              
              {/* Phase content */}
              <div className="ml-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs font-semibold">
                    {step.phase}
                  </Badge>
                  {step.timing && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {step.timing}
                    </div>
                  )}
                </div>
                
                <h4 className="font-medium text-sm mb-2">{step.title}</h4>
                
                {step.notes && (
                  <p className="text-xs text-muted-foreground mb-2 italic">
                    {step.notes}
                  </p>
                )}
                
                {/* Actions */}
                <div className="space-y-1.5">
                  {step.actions.map((action) => (
                    <ActionItem
                      key={action.id}
                      action={action}
                      isCompleted={completedActions.has(action.id)}
                      onToggle={() => toggleAction(action.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ActionItem({
  action,
  isCompleted,
  onToggle,
}: {
  action: TreatmentAction;
  isCompleted: boolean;
  onToggle: () => void;
}) {
  const config = priorityConfig[action.priority];
  const Icon = config.icon;

  return (
    <div
      onClick={onToggle}
      className={cn(
        "flex items-start gap-2 p-2 rounded-md cursor-pointer transition-all",
        isCompleted ? "bg-success/10 border border-success/30" : config.bgColor,
        !isCompleted && `border ${config.borderColor}`
      )}
    >
      {isCompleted ? (
        <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
      ) : (
        <Icon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", config.color)} />
      )}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs",
          isCompleted && "line-through text-muted-foreground"
        )}>
          {action.text}
        </p>
        {action.details && !isCompleted && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {action.details}
          </p>
        )}
      </div>
      <Badge 
        variant="outline" 
        className={cn(
          "text-[10px] px-1.5 py-0 flex-shrink-0",
          isCompleted ? "border-success/30 text-success" : config.borderColor
        )}
      >
        {config.label}
      </Badge>
    </div>
  );
}

export const TreatmentAlgorithm = memo(TreatmentAlgorithmComponent);
