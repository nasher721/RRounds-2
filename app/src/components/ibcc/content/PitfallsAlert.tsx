/**
 * Pitfalls Alert Component
 * Displays common clinical mistakes to avoid
 */

import { memo } from 'react';
import { AlertOctagon, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import type { ClinicalPitfall } from '@/types/ibcc';
import { cn } from '@/lib/utils';

interface PitfallsAlertProps {
  pitfalls: ClinicalPitfall[];
  defaultOpen?: boolean;
}

const severityConfig = {
  critical: {
    icon: AlertOctagon,
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/40',
    headerColor: 'bg-destructive/20',
    textColor: 'text-destructive',
    label: 'Critical',
  },
  major: {
    icon: ShieldAlert,
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/40',
    headerColor: 'bg-warning/20',
    textColor: 'text-warning',
    label: 'Major',
  },
  minor: {
    icon: Info,
    bgColor: 'bg-secondary',
    borderColor: 'border-border',
    headerColor: 'bg-secondary',
    textColor: 'text-muted-foreground',
    label: 'Minor',
  },
};

function PitfallsAlertComponent({ pitfalls, defaultOpen = true }: PitfallsAlertProps) {
  if (!pitfalls || pitfalls.length === 0) return null;

  // Sort by severity: critical first
  const sortedPitfalls = [...pitfalls].sort((a, b) => {
    const order = { critical: 0, major: 1, minor: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <Collapsible defaultOpen={defaultOpen} className="mb-4">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-destructive/10 rounded-lg hover:bg-destructive/20 transition-colors border border-destructive/30">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="font-medium text-sm">Pitfalls to Avoid</span>
          <Badge variant="destructive" className="text-xs">
            {pitfalls.length}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">Click to expand</span>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2 space-y-3">
        {sortedPitfalls.map((pitfall) => {
          const config = severityConfig[pitfall.severity];
          const Icon = config.icon;

          return (
            <div
              key={pitfall.id}
              className={cn(
                "rounded-lg border overflow-hidden",
                config.borderColor
              )}
            >
              {/* Header */}
              <div className={cn("p-3 flex items-start gap-2", config.headerColor)}>
                <Icon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", config.textColor)} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{pitfall.title}</h4>
                    <Badge 
                      variant="outline" 
                      className={cn("text-[10px]", config.borderColor, config.textColor)}
                    >
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {pitfall.description}
                  </p>
                </div>
              </div>

              {/* Consequence & Prevention */}
              <div className={cn("p-3 space-y-2", config.bgColor)}>
                <div>
                  <span className="text-xs font-medium text-destructive">⚠️ Consequence:</span>
                  <p className="text-xs text-muted-foreground">{pitfall.consequence}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-success">✓ Prevention:</span>
                  <p className="text-xs text-muted-foreground">{pitfall.prevention}</p>
                </div>
              </div>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

export const PitfallsAlert = memo(PitfallsAlertComponent);
