/**
 * Open Evidence Trigger Button
 * Opens the Open Evidence search panel.
 */

import { Microscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOpenEvidenceState } from "@/hooks/useOpenEvidenceState";

interface OpenEvidenceTriggerProps {
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
  className?: string;
}

export function OpenEvidenceTrigger({
  variant = "outline",
  size = "default",
  showLabel = true,
  className,
}: OpenEvidenceTriggerProps) {
  const { openPanel } = useOpenEvidenceState();

  const button = (
    <Button
      variant={variant}
      size={size}
      onClick={() => openPanel()}
      className={className}
    >
      <Microscope className="h-4 w-4" aria-hidden />
      {showLabel && <span className="ml-2">Open Evidence</span>}
    </Button>
  );

  if (!showLabel) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {button}
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Search Open Evidence (Ctrl+E)</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
