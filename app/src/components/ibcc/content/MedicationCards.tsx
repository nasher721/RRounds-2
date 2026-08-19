/**
 * Medication Card Component
 * Displays medication dosing information with categories
 */

import { memo, useState } from 'react';
import { Pill, ChevronDown, ChevronUp, AlertTriangle, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import type { MedicationDosing } from '@/types/ibcc';
import { cn } from '@/lib/utils';

interface MedicationCardsProps {
  medications: MedicationDosing[];
  defaultOpen?: boolean;
}

const categoryConfig = {
  'first-line': {
    label: '1st Line',
    color: 'bg-success text-success-foreground',
  },
  'second-line': {
    label: '2nd Line',
    color: 'bg-primary text-primary-foreground',
  },
  adjunct: {
    label: 'Adjunct',
    color: 'bg-secondary text-secondary-foreground',
  },
  rescue: {
    label: 'Rescue',
    color: 'bg-destructive text-destructive-foreground',
  },
};

function MedicationCardsComponent({ medications, defaultOpen = true }: MedicationCardsProps) {
  if (!medications || medications.length === 0) return null;

  // Group by category
  const grouped = medications.reduce((acc, med) => {
    if (!acc[med.category]) acc[med.category] = [];
    acc[med.category].push(med);
    return acc;
  }, {} as Record<string, MedicationDosing[]>);

  const categoryOrder: MedicationDosing['category'][] = ['first-line', 'second-line', 'adjunct', 'rescue'];

  return (
    <Collapsible defaultOpen={defaultOpen} className="mb-4">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors">
        <div className="flex items-center gap-2">
          <Pill className="h-4 w-4 text-success" />
          <span className="font-medium text-sm">Medications</span>
          <Badge variant="secondary" className="text-xs">
            {medications.length}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">Click to expand</span>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2 space-y-3">
        {categoryOrder.map((category) => {
          const meds = grouped[category];
          if (!meds || meds.length === 0) return null;
          const config = categoryConfig[category];

          return (
            <div key={category}>
              <Badge className={cn("mb-2", config.color)}>
                {config.label}
              </Badge>
              <div className="space-y-2">
                {meds.map((med) => (
                  <MedicationCard key={med.id} medication={med} />
                ))}
              </div>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

function MedicationCard({ medication }: { medication: MedicationDosing }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/30 transition-colors"
      >
        <div>
          <h4 className="font-medium text-sm">{medication.name}</h4>
          {medication.genericName && (
            <p className="text-xs text-muted-foreground">{medication.genericName}</p>
          )}
          <p className="text-xs text-primary mt-1">{medication.indication}</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Dosing info - always visible */}
      <div className="px-3 pb-3 border-t border-border bg-secondary/20">
        <div className="pt-2 space-y-1">
          {medication.dosing.map((dose, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                {dose.route}
              </Badge>
              <span className="font-medium">{dose.dose}</span>
              {dose.frequency && (
                <span className="text-muted-foreground">{dose.frequency}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border">
          {/* Contraindications */}
          {medication.contraindications && medication.contraindications.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-1 mb-1">
                <AlertTriangle className="h-3 w-3 text-destructive" />
                <span className="text-xs font-medium text-destructive">Contraindications</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5 pl-4">
                {medication.contraindications.map((item, idx) => (
                  <li key={idx} className="list-disc">{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Side Effects */}
          {medication.sideEffects && medication.sideEffects.length > 0 && (
            <div>
              <span className="text-xs font-medium">Side Effects</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {medication.sideEffects.map((effect, idx) => (
                  <Badge key={idx} variant="secondary" className="text-[10px]">
                    {effect}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Monitoring */}
          {medication.monitoringParameters && medication.monitoringParameters.length > 0 && (
            <div>
              <span className="text-xs font-medium">Monitor</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {medication.monitoringParameters.map((param, idx) => (
                  <Badge key={idx} variant="outline" className="text-[10px]">
                    {param}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Pearls */}
          {medication.pearls && medication.pearls.length > 0 && (
            <div className="bg-primary/5 rounded p-2 border border-primary/20">
              <div className="flex items-center gap-1 mb-1">
                <Info className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium text-primary">Pearls</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {medication.pearls.map((pearl, idx) => (
                  <li key={idx}>• {pearl}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const MedicationCards = memo(MedicationCardsComponent);
