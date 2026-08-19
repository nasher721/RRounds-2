/**
 * Guidelines Panel Trigger Button
 * Opens the clinical guidelines lookup panel
 */

import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useClinicalGuidelinesState } from '@/contexts/ClinicalGuidelinesContext';

interface GuidelinesTriggerProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  className?: string;
}

export function GuidelinesTrigger({
  variant = 'outline',
  size = 'default',
  showLabel = true,
  className
}: GuidelinesTriggerProps) {
  const { openPanel } = useClinicalGuidelinesState();

  const button = (
    <Button
      variant={variant}
      size={size}
      onClick={openPanel}
      className={className}
    >
      <FileText className="h-4 w-4" />
      {showLabel && <span className="ml-2">Guidelines</span>}
    </Button>
  );

  if (!showLabel) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {button}
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Clinical Guidelines (Ctrl+G)</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
