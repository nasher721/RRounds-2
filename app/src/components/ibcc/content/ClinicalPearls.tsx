/**
 * Clinical Pearls Component
 * Displays key clinical takeaways with importance indicators
 */

import { memo } from 'react';
import { Lightbulb, AlertTriangle, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import type { ClinicalPearl } from '@/types/ibcc';
import { cn } from '@/lib/utils';

interface ClinicalPearlsProps {
  pearls: ClinicalPearl[];
  defaultOpen?: boolean;
}

const importanceConfig = {
  critical: {
    icon: AlertTriangle,
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    textColor: 'text-destructive',
    label: 'Critical',
  },
  high: {
    icon: Lightbulb,
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    textColor: 'text-warning',
    label: 'High',
  },
  moderate: {
    icon: Info,
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/30',
    textColor: 'text-primary',
    label: 'Moderate',
  },
};

function ClinicalPearlsComponent({ pearls, defaultOpen = true }: ClinicalPearlsProps) {
  if (!pearls || pearls.length === 0) return null;

  // Sort by importance: critical first, then high, then moderate
  const sortedPearls = [...pearls].sort((a, b) => {
    const order = { critical: 0, high: 1, moderate: 2 };
    return order[a.importance] - order[b.importance];
  });

  return (
    <Collapsible defaultOpen={defaultOpen} className="mb-4">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-warning" />
          <span className="font-medium text-sm">Clinical Pearls</span>
          <Badge variant="secondary" className="text-xs">
            {pearls.length}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">Click to expand</span>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2 space-y-2">
        {sortedPearls.map((pearl) => {
          const config = importanceConfig[pearl.importance];
          const Icon = config.icon;
          
          return (
            <div
              key={pearl.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border",
                config.bgColor,
                config.borderColor
              )}
            >
              <Icon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", config.textColor)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed">{pearl.text}</p>
                {pearl.category && (
                  <Badge variant="outline" className="mt-2 text-[10px]">
                    {pearl.category}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

export const ClinicalPearls = memo(ClinicalPearlsComponent);
