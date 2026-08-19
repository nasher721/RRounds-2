import type { ReactNode } from "react";
import { Shield, Lock, FileText, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TrustBadgeProps {
  icon: ReactNode;
  label: string;
  description: string;
  testId: string;
}

function TrustBadge({ icon, label, description, testId }: TrustBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          data-testid={testId}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            "bg-muted/50 hover:bg-muted transition-colors cursor-help",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          )}
          aria-describedby={`${testId}-tooltip`}
          type="button"
        >
          <span className="flex-shrink-0">{icon}</span>
          <span className="hidden sm:inline">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent id={`${testId}-tooltip`} side="top" className="max-w-xs">
        <p className="font-medium mb-1">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export interface TrustIndicatorsProps {
  className?: string;
}

export function TrustIndicators({ className }: TrustIndicatorsProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <TrustBadge
        testId="deployment-review-badge"
        icon={<Shield className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
        label="Deployment Review"
        description="Sensitive-data use requires the deployment operator to approve the configuration, authorization policies, providers, agreements, and workflow."
      />
      
      <TrustBadge
        testId="https-badge"
        icon={<Lock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
        label="HTTPS Transport"
        description="When the app is served over HTTPS, traffic is encrypted in transit. Hosting, at-rest encryption, and key controls depend on the deployment."
      />
      
      <TrustBadge
        testId="history-badge"
        icon={<FileText className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />}
        label="Change History"
        description="Selected field changes may include timestamps and user attribution. This is not a comprehensive access audit log."
      />
      
      <Link
        to="/security"
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
          "text-muted-foreground hover:text-foreground transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
        aria-label="Review security deployment guidance"
      >
        <span>Security</span>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </div>
  );
}
