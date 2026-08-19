import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { PatientRosterVerification } from "@/hooks/patients/usePatientFetch";
import { Button } from "@/components/ui/button";

interface PatientRosterStatusBannerProps {
  verification: PatientRosterVerification;
  onRetry: () => void | Promise<void>;
}

/** Persistent clinical-truth warning for backend failures that do not flip navigator.onLine. */
export function PatientRosterStatusBanner({
  verification,
  onRetry,
}: PatientRosterStatusBannerProps): React.ReactElement | null {
  const [isRetrying, setIsRetrying] = React.useState(false);

  if (verification !== "stale") return null;

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-950 dark:bg-amber-500/20 dark:text-amber-100"
      role="status"
      aria-live="polite"
      data-testid="patient-roster-status-banner"
    >
      <p className="flex min-w-0 items-start gap-2 leading-relaxed">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Patient-list recovery could not be verified. The visible roster may be incomplete or unavailable after a reload; retry before completing the Round.
        </span>
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 min-h-[44px] shrink-0 sm:min-h-0 sm:h-8"
        onClick={() => void handleRetry()}
        disabled={isRetrying}
        aria-busy={isRetrying || undefined}
      >
        <RefreshCw className={`mr-1.5 h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} aria-hidden="true" />
        {isRetrying ? "Checking…" : "Retry patient list"}
      </Button>
    </div>
  );
}
