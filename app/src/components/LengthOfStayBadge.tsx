import * as React from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type LengthOfStayBadgeProps = {
  createdAt: string;
  className?: string;
};

export const LengthOfStayBadge = ({ createdAt, className }: LengthOfStayBadgeProps) => {
  const days = React.useMemo(() => {
    const t = new Date(createdAt).getTime();
    if (Number.isNaN(t)) return 1;
    return Math.max(1, Math.ceil((Date.now() - t) / 86400000));
  }, [createdAt]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "gap-0.5 text-[10px] px-1.5 py-0 h-5 text-muted-foreground border-border/60",
              className,
            )}
          >
            <Clock className="h-2.5 w-2.5" aria-hidden="true" />
            <span>{days}d</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          Length of stay: approximate days since this patient was added to your list (day 1 = same calendar day or first day).
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
