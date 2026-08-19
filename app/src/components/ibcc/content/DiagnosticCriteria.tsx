/**
 * Diagnostic Criteria Component
 * Displays diagnostic criteria with required/optional markers
 */

import { memo } from 'react';
import { Stethoscope, CheckCircle2, Circle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import type { DiagnosticSection } from '@/types/ibcc';
import { cn } from '@/lib/utils';

interface DiagnosticCriteriaProps {
  sections: DiagnosticSection[];
  defaultOpen?: boolean;
}

function DiagnosticCriteriaComponent({ sections, defaultOpen = true }: DiagnosticCriteriaProps) {
  if (!sections || sections.length === 0) return null;

  return (
    <Collapsible defaultOpen={defaultOpen} className="mb-4">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Diagnostic Criteria</span>
          <Badge variant="secondary" className="text-xs">
            {sections.length} section{sections.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">Click to expand</span>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2 space-y-3">
        {sections.map((section) => (
          <div
            key={section.id}
            className="bg-card border border-border rounded-lg p-3"
          >
            <h4 className="font-medium text-sm mb-2">{section.title}</h4>
            
            <div className="space-y-1.5">
              {section.criteria.map((criterion) => (
                <div
                  key={criterion.id}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded text-xs",
                    criterion.required 
                      ? "bg-primary/5 border border-primary/20" 
                      : "bg-secondary/50"
                  )}
                >
                  {criterion.required ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <span className={cn(criterion.required && "font-medium")}>
                      {criterion.text}
                    </span>
                    {criterion.value && (
                      <Badge variant="outline" className="ml-2 text-[10px] font-mono">
                        {criterion.value}
                      </Badge>
                    )}
                  </div>
                  {criterion.required && (
                    <Badge variant="default" className="text-[10px] flex-shrink-0">
                      Required
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            
            {section.notes && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                {section.notes}
              </p>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export const DiagnosticCriteria = memo(DiagnosticCriteriaComponent);
