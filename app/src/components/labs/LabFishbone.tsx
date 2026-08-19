/**
 * Lab Fishbone Component
 * Displays BMP and CBC labs in traditional medical "fishbone" skeleton format
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  type LabValue,
  type StructuredLabs,
  LAB_NORMAL_RANGES,
  getLabStatus,
  getLabDelta,
  parseLabText,
} from '@/types/labs';

interface LabFishboneProps {
  labs: string;
  className?: string;
}

interface LabSlotProps {
  label: string;
  labKey: string;
  value: LabValue | undefined;
  className?: string;
}

// Individual lab value slot with tooltip
const LabSlot = ({ label, labKey, value, className }: LabSlotProps) => {
  const status = getLabStatus(labKey, value?.value);
  const delta = getLabDelta(value?.value, value?.previousValue);
  const range = LAB_NORMAL_RANGES[labKey];

  const statusColors = {
    high: 'text-red-500 dark:text-red-400 font-semibold',
    low: 'text-blue-500 dark:text-blue-400 font-semibold',
    normal: 'text-foreground',
    unknown: 'text-muted-foreground',
  };

  const displayValue = value?.value !== null && value?.value !== undefined 
    ? value.value.toString() 
    : '—';
  const hasPrevious = value?.previousValue !== null && value?.previousValue !== undefined;
  const trendDirection = delta !== null
    ? delta > 0
      ? 'up'
      : delta < 0
        ? 'down'
        : 'flat'
    : null;
  const trendIcon = trendDirection === 'up' ? '▲' : trendDirection === 'down' ? '▼' : '▶';

  const tooltipContent = (
    <div className="space-y-1 text-xs">
      <div className="font-medium">{label}</div>
      {value?.value !== null && value?.value !== undefined && (
        <>
          <div>Recent: {value.value} {range?.unit || ''}</div>
          {value.previousValue !== null && value.previousValue !== undefined && (
            <div className="flex items-center gap-1">
              <span>Prior: {value.previousValue}</span>
              {delta !== null && (
                <span className={cn(
                  'font-medium',
                  delta > 0 ? 'text-red-400' : delta < 0 ? 'text-blue-400' : ''
                )}>
                  ({delta > 0 ? '+' : ''}{delta})
                </span>
              )}
            </div>
          )}
          {range && (
            <div className="text-muted-foreground">
              Normal: {range.low}–{range.high} {range.unit}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'text-center cursor-default min-w-[28px] transition-colors',
            statusColors[status],
            className
          )}>
            <span className="text-[10px] text-muted-foreground block leading-tight">{label}</span>
            <span className="text-sm leading-tight">{displayValue}</span>
            {hasPrevious && (
              <span className="text-[9px] leading-tight text-muted-foreground flex items-center justify-center gap-0.5">
                <span className={cn(
                  'font-medium',
                  trendDirection === 'up' ? 'text-red-400' : trendDirection === 'down' ? 'text-blue-400' : 'text-muted-foreground'
                )}>
                  {trendIcon}
                </span>
                <span>Prev {value?.previousValue}</span>
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// BMP Fishbone Diagram
const BMPFishbone = ({ labs }: { labs: StructuredLabs }) => {
  const bmp = labs.bmp || {};

  return (
    <div className="inline-flex items-center gap-0.5">
      {/* Left side - Na/K */}
      <div className="flex flex-col items-end">
        <LabSlot label="Na" labKey="na" value={bmp.na} />
        <LabSlot label="K" labKey="k" value={bmp.k} />
      </div>
      
      {/* Left vertical line */}
      <div className="w-px h-10 bg-border dark:bg-border/70" />
      
      {/* Center - Cl/CO2 with horizontal line */}
      <div className="flex flex-col items-center relative">
        <LabSlot label="Cl" labKey="cl" value={bmp.cl} />
        <div className="w-8 h-px bg-border dark:bg-border/70 my-0.5" />
        <LabSlot label="CO2" labKey="co2" value={bmp.co2} />
      </div>
      
      {/* Right vertical line */}
      <div className="w-px h-10 bg-border dark:bg-border/70" />
      
      {/* Right side - BUN/Cr */}
      <div className="flex flex-col items-start">
        <LabSlot label="BUN" labKey="bun" value={bmp.bun} />
        <LabSlot label="Cr" labKey="cr" value={bmp.cr} />
      </div>
      
      {/* Tail horizontal line */}
      <div className="w-3 h-px bg-border dark:bg-border/70 self-center" />
      
      {/* Glucose tail */}
      <LabSlot label="Glu" labKey="glu" value={bmp.glu} className="ml-0.5" />
    </div>
  );
};

// CBC Display (inline format)
const CBCDisplay = ({ labs }: { labs: StructuredLabs }) => {
  const cbc = labs.cbc || {};
  
  // Check if any CBC values exist
  const hasAnyCBC = cbc.wbc || cbc.hgb || cbc.hct || cbc.plt;
  if (!hasAnyCBC) return null;

  return (
    <div className="inline-flex items-center gap-2 ml-3 pl-3 border-l border-border dark:border-border/70">
      <LabSlot label="WBC" labKey="wbc" value={cbc.wbc} />
      <span className="text-muted-foreground">/</span>
      <LabSlot label="Hgb" labKey="hgb" value={cbc.hgb} />
      <span className="text-muted-foreground">/</span>
      <LabSlot label="Hct" labKey="hct" value={cbc.hct} />
      <span className="text-muted-foreground">/</span>
      <LabSlot label="Plt" labKey="plt" value={cbc.plt} />
    </div>
  );
};

export const LabFishbone = ({ labs, className }: LabFishboneProps) => {
  // Parse lab text into structured format
  const structuredLabs = useMemo(() => parseLabText(labs), [labs]);
  
  // Check if we have any parseable lab values
  const hasBMP = structuredLabs.bmp && Object.values(structuredLabs.bmp).some(v => v?.value !== undefined);
  const hasCBC = structuredLabs.cbc && Object.values(structuredLabs.cbc).some(v => v?.value !== undefined);
  
  if (!hasBMP && !hasCBC) {
    return null; // Don't render if no structured labs found
  }

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-2 py-2 px-3 rounded-lg bg-secondary/30 border border-border/50',
      className
    )}>
      {hasBMP && <BMPFishbone labs={structuredLabs} />}
      {hasCBC && <CBCDisplay labs={structuredLabs} />}
    </div>
  );
};

export default LabFishbone;
