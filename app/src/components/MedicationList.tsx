import * as React from 'react';
import { Wand2, ChevronDown, Droplets, Clock, Pill, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { useMedicationFormat } from '@/hooks/useMedicationFormat';
import type { PatientMedications } from '@/types/patient';
import { cn } from '@/lib/utils';

interface MedicationListProps {
  medications: PatientMedications;
  onMedicationsChange: (medications: PatientMedications) => void;
  readOnly?: boolean;
}

const categoryConfig = {
  infusions: {
    label: 'Infusions',
    icon: Droplets,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10 border-destructive/30',
    description: 'Continuous drips & infusions',
  },
  scheduled: {
    label: 'Scheduled',
    icon: Clock,
    color: 'text-primary',
    bgColor: 'bg-primary/10 border-primary/30',
    description: 'Regular scheduled medications',
  },
  prn: {
    label: 'PRN',
    icon: Pill,
    color: 'text-warning',
    bgColor: 'bg-warning/10 border-warning/30',
    description: 'As-needed medications',
  },
};

function MedicationListComponent({ medications, onMedicationsChange, readOnly = false }: MedicationListProps) {
  const [showRaw, setShowRaw] = React.useState(false);
  const [rawInput, setRawInput] = React.useState(medications.rawText || '');
  const { formatMedications, isFormatting } = useMedicationFormat();

  const hasStructuredMeds = 
    medications.infusions.length > 0 || 
    medications.scheduled.length > 0 || 
    medications.prn.length > 0;

  const handleFormat = async () => {
    const textToFormat = rawInput.trim() || medications.rawText || '';
    if (!textToFormat) return;

    const formatted = await formatMedications(textToFormat);
    if (formatted) {
      onMedicationsChange(formatted);
      setShowRaw(false);
    }
  };

  const handleRawTextChange = (value: string) => {
    setRawInput(value);
    // Also update the medications object with raw text
    onMedicationsChange({
      ...medications,
      rawText: value,
    });
  };

  const removeMedication = (category: keyof Pick<PatientMedications, 'infusions' | 'scheduled' | 'prn'>, index: number) => {
    const updated = { ...medications };
    updated[category] = [...updated[category]];
    updated[category].splice(index, 1);
    onMedicationsChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Header with Format Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Medications</span>
          {hasStructuredMeds && (
            <Badge variant="secondary" className="text-xs">
              {medications.infusions.length + medications.scheduled.length + medications.prn.length}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRaw(!showRaw)}
            className="h-7 px-2 text-xs"
          >
            <FileText className="h-3 w-3 mr-1" />
            {showRaw ? 'View Formatted' : 'Edit Raw'}
          </Button>
          
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFormat}
              disabled={isFormatting || (!rawInput.trim() && !medications.rawText)}
              className="h-7 px-2 text-xs"
            >
              {isFormatting ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3 mr-1" />
              )}
              Format Meds
            </Button>
          )}
        </div>
      </div>

      {/* Raw Text Input View */}
      {showRaw && (
        <div className="space-y-2">
          <Textarea
            value={rawInput}
            onChange={(e) => handleRawTextChange(e.target.value)}
            placeholder="Paste or type medication list here...&#10;&#10;Examples:&#10;- Norepinephrine 5 mcg/kg/min&#10;- Metoprolol 25mg BID&#10;- Morphine 2mg IV PRN pain"
            className="min-h-[120px] text-sm font-mono"
            readOnly={readOnly}
          />
          <p className="text-xs text-muted-foreground">
            Paste unformatted medications then click "Format Meds" to auto-categorize.
          </p>
        </div>
      )}

      {/* Formatted Medications View */}
      {!showRaw && hasStructuredMeds && (
        <div className="space-y-2">
          {(['infusions', 'scheduled', 'prn'] as const).map((category) => {
            const meds = medications[category];
            if (meds.length === 0) return null;

            const config = categoryConfig[category];
            const Icon = config.icon;

            return (
              <Collapsible key={category} defaultOpen={category === 'infusions'}>
                <CollapsibleTrigger className={cn(
                  "flex items-center justify-between w-full p-2 rounded-lg border transition-colors",
                  config.bgColor,
                  "hover:opacity-80"
                )}>
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", config.color)} />
                    <span className="text-sm font-medium">{config.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {meds.length}
                    </Badge>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>

                <CollapsibleContent className="pt-1">
                  <div className="pl-6 space-y-1">
                    {meds.map((med, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1 px-2 text-sm rounded hover:bg-muted/50 group"
                      >
                        <span>{typeof med === 'string' ? med : JSON.stringify(med)}</span>
                        {!readOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeMedication(category, idx)}
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!showRaw && !hasStructuredMeds && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          <Pill className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>No medications added yet.</p>
          <p className="text-xs mt-1">
            Click "Edit Raw" to paste a medication list, then "Format Meds" to organize.
          </p>
        </div>
      )}
    </div>
  );
}

export const MedicationList = React.memo(MedicationListComponent);
