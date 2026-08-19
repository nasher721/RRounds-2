import * as React from "react";
import { Check, ChevronLeft, ChevronRight, Download, Home, Menu, MoreHorizontal, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRoundSession } from "@/contexts/RoundSessionContext";
import { safeLocalStorage, safeSessionStorage } from "@/utils/safeStorage";
import { describeRoundSync } from "@/lib/round/sync/syncPresentation";
import { toast } from "sonner";
import { OfflineIndicator } from "@/components/OfflineIndicator";

export interface RoundChromeProps {
  onOpenRoster: () => void;
  /** Opens ToolsSheet (demoted panels). */
  onOpenTools: () => void;
  /** Quiet path to Round Home (Import / Start). */
  onGoHome?: () => void;
  /** Quiet path to Round End (Print / Export). */
  onEndRound?: () => void;
  /** Show Home / End beside Tools when mid-Focus. */
  showLifecycleActions?: boolean;
  className?: string;
  /**
   * Phone layout: ≥44px targets, Done/Next/Prev in a sticky bottom bar,
   * quieter top bar (roster · Round · N/M · Tools).
   * Pass `children` (Patient Focus) so the action bar sits under the chart.
   */
  touchFriendly?: boolean;
  children?: React.ReactNode;
  /** Optional overrides when the shell wires navigation itself. */
  onPrev?: () => void;
  onNext?: () => void;
  onDoneAndNext?: () => void;
  /** Download local PHI recovery JSON when sync cannot be trusted. */
  onExportRecovery?: () => void;
}

/**
 * Quiet Round top chrome: roster, Round · N/M, sync cue slot, Tools, Done/Next.
 * No IBCC / AI / compare megabar.
 */
export const RoundChrome = ({
  onOpenRoster,
  onOpenTools,
  onGoHome,
  onEndRound,
  showLifecycleActions = false,
  className,
  touchFriendly = false,
  children,
  onPrev,
  onNext,
  onDoneAndNext,
  onExportRecovery,
}: RoundChromeProps) => {
  const {
    position,
    round,
    prevPatient,
    nextPatient,
    markDoneAndNext,
    openConflictDialog,
    conflicts,
    pendingCount,
    failedCount,
    softFailedCount,
    lastSuccessfulSyncAt,
    retryResult,
    canCompleteRound,
    completionSafety,
    retryRoundSync,
    clearWalkStatus,
  } = useRoundSession();

  const [isStorageDegraded, setIsStorageDegraded] = React.useState(() =>
    safeLocalStorage.isDegraded() || safeSessionStorage.isDegraded(),
  );
  const announcedRetryResultRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!retryResult || retryResult === "Retrying sync…" || announcedRetryResultRef.current === retryResult) return;
    announcedRetryResultRef.current = retryResult;
    toast.message(retryResult);
  }, [retryResult]);
  React.useEffect(() => {
    if (isStorageDegraded) return;
    const timer = window.setInterval(() => {
      if (safeLocalStorage.isDegraded() || safeSessionStorage.isDegraded()) {
        setIsStorageDegraded(true);
      }
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [isStorageDegraded]);

  const syncPresentation = describeRoundSync(
    round.syncStatus,
    pendingCount,
    failedCount,
    softFailedCount,
    lastSuccessfulSyncAt,
  );
  const clinicalCompletionLabel = completionSafety.mutationFailedCount > 0
    ? `Clinical sync failed · ${completionSafety.mutationFailedCount}`
    : completionSafety.mutationConflictCount > 0
      ? `Clinical conflict · ${completionSafety.mutationConflictCount}`
      : completionSafety.mutationUnresolvedCount > 0
        ? `Saved locally · ${completionSafety.mutationUnresolvedCount} clinical pending`
        : completionSafety.patientSaveBlockerCount > 0
          ? "Saving patient changes…"
          : completionSafety.dataVerificationBlockerCount > 0
            ? "Clinical data needs verification"
          : syncPresentation.label;
  const syncLabel = isStorageDegraded
    ? `${clinicalCompletionLabel} · storage limited`
    : clinicalCompletionLabel;
  const isEmpty = position.total === 0;
  const atStart = isEmpty || position.current <= 1;
  const atEnd = isEmpty || position.current >= position.total;
  const hasConflicts = conflicts.length > 0 || round.syncStatus === "conflict";
  const hasSyncActionCue = hasConflicts || round.syncStatus === "failed";
  const isCompletionBlocked = !canCompleteRound;
  const isCurrentDone = round.patients[round.currentIndex]?.status === "done";

  const handleOpenRoster = () => {
    onOpenRoster();
  };

  const handleOpenTools = () => {
    onOpenTools();
  };

  const handleGoHome = () => {
    onGoHome?.();
  };

  const handleEndRound = () => {
    onEndRound?.();
  };

  const handlePrev = () => {
    if (onPrev) {
      onPrev();
      return;
    }
    prevPatient();
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
      return;
    }
    nextPatient();
  };

  const handleDoneAndNext = () => {
    if (isCurrentDone) {
      clearWalkStatus();
      return;
    }
    if (onDoneAndNext) {
      onDoneAndNext();
      return;
    }
    markDoneAndNext();
  };

  const handleSyncCueActivate = () => {
    if (round.syncStatus === "failed") {
      void retryRoundSync();
      return;
    }
    if (!hasConflicts) return;
    openConflictDialog();
  };

  const handleSyncCueKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleSyncCueActivate();
  };

  const iconBtnClass = touchFriendly
    ? "h-[44px] w-[44px] shrink-0 text-foreground/80 hover:text-foreground"
    : "h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground";

  const toolsBtnClass = touchFriendly
    ? "h-[44px] gap-1.5 px-3 text-foreground/80 hover:text-foreground"
    : "h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground";

  const actionBar = (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1",
        touchFriendly && "w-full gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2",
      )}
      data-testid={touchFriendly ? "round-chrome-actions" : undefined}
    >
      <span id="round-prev-help" className="sr-only">
        Previous is unavailable when the first patient is active or the roster is empty.
      </span>
      <span id="round-done-help" className="sr-only">
        Done and End Round require all local edits to finish syncing and all conflicts to be resolved.
      </span>
      <span id="round-next-help" className="sr-only">
        Next is unavailable when the last patient is active or the roster is empty.
      </span>
      <Button
        type="button"
        variant="ghost"
        size={touchFriendly ? "default" : "icon"}
        className={cn(
          touchFriendly
            ? "h-[44px] flex-1 text-foreground/85 hover:text-foreground"
            : "h-9 w-9 text-muted-foreground hover:text-foreground",
          "disabled:border disabled:border-dashed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
        )}
        onClick={handlePrev}
        disabled={atStart}
        aria-label="Previous patient"
        aria-describedby="round-prev-help"
        title="Previous ([ or K)"
        data-testid="round-prev"
      >
        <ChevronLeft className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
        {touchFriendly && <span className="text-sm font-medium">Prev</span>}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          touchFriendly
            ? "h-[44px] flex-1 gap-1.5 px-3 border-border/50 bg-card text-foreground"
            : "h-9 gap-1.5 px-3",
          isCurrentDone && "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-emerald-500/20",
          "disabled:border disabled:border-dashed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
        )}
        onClick={handleDoneAndNext}
        disabled={isEmpty || (!isCurrentDone && isCompletionBlocked)}
        aria-label={isCurrentDone ? "Reopen completed patient" : "Mark done and go to next patient"}
        aria-describedby="round-done-help"
        title={isCurrentDone ? "Reopen patient" : "Done (D)"}
        data-testid="round-done"
      >
        <Check className={cn(touchFriendly ? "h-4 w-4" : "h-3.5 w-3.5", isCurrentDone && "text-emerald-600 dark:text-emerald-400")} aria-hidden="true" />
        <span className={cn("font-medium", touchFriendly ? "text-sm" : "text-xs")}>
          {isCurrentDone ? "Reopen" : "Done"}
        </span>
      </Button>

      <Button
        type="button"
        variant="default"
        size="sm"
        className={cn(
          touchFriendly ? "h-[44px] flex-1 gap-1.5 px-3 font-semibold" : "h-9 gap-1.5 px-3 font-semibold",
          "disabled:border disabled:border-dashed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
        )}
        onClick={handleNext}
        disabled={atEnd}
        aria-label="Next patient"
        aria-describedby="round-next-help"
        title="Next (] or J)"
        data-testid="round-next"
      >
        <span className={cn("font-medium", touchFriendly ? "text-sm" : "text-xs")}>Next</span>
        <ChevronRight className={cn(touchFriendly ? "h-4 w-4" : "h-3.5 w-3.5")} aria-hidden="true" />
      </Button>
    </div>
  );

  const header = (
    <header
      className={cn(
        "sticky top-0 z-40 flex shrink-0 items-center gap-2 border-b border-border/40 bg-background/95 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/85",
        touchFriendly ? "h-14 min-h-14 safe-area-top" : "h-12",
        className,
      )}
      data-testid="round-chrome"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={iconBtnClass}
        onClick={handleOpenRoster}
        aria-label="Open roster"
        title="Roster (R)"
        data-testid="round-roster-entry"
      >
        <Menu className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <p
          className={cn(
            "truncate font-medium tracking-tight text-foreground",
            touchFriendly ? "text-base" : "text-sm text-foreground/90",
          )}
          aria-live="polite"
          data-testid="round-position"
        >
          Round · {position.current}/{position.total}
        </p>
        {/* Quiet offline / syncing / conflict cue */}
        {hasSyncActionCue ? (
          <button
            type="button"
            className={cn(
              "truncate text-xs font-medium underline-offset-2 hover:underline",
              touchFriendly ? "text-amber-600 dark:text-amber-400" : "text-amber-700 dark:text-amber-400",
            )}
            data-testid="round-sync-cue"
            aria-live="polite"
            aria-label={round.syncStatus === "failed" ? "Retry failed sync writes" : "Resolve field conflicts"}
            onClick={handleSyncCueActivate}
            onKeyDown={handleSyncCueKeyDown}
            tabIndex={0}
            disabled={round.syncStatus !== "conflict" && round.syncStatus !== "failed"}
            title={syncPresentation.description}
          >
            {round.syncStatus === "failed"
              ? `${syncPresentation.label} — retry`
              : pendingCount > 0
                ? `conflict · ${pendingCount} pending`
                : "conflict — resolve"}
          </button>
        ) : (
          <span
            className={cn(
              "truncate text-xs",
              touchFriendly ? "text-foreground/70" : "text-muted-foreground",
              !syncLabel && "sr-only",
            )}
            data-testid="round-sync-cue"
            aria-live="polite"
            title={syncPresentation.description}
          >
            {syncLabel}
          </span>
        )}
        {retryResult ? (
          <span className="sr-only" role="status" aria-live="polite">
            {retryResult}
          </span>
        ) : null}
        <OfflineIndicator touchFriendly={touchFriendly} />
        {round.syncStatus === "failed" && onExportRecovery ? (
          <button
            type="button"
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
            onClick={onExportRecovery}
            aria-label="Download local recovery copy containing PHI"
            title="Download local recovery copy (contains PHI)"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Recovery
          </button>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {showLifecycleActions && onGoHome && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={iconBtnClass}
            onClick={handleGoHome}
            aria-label="Round Home"
            title="Round Home"
            data-testid="round-go-home"
          >
            <Home className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
          </Button>
        )}
        {showLifecycleActions && onEndRound && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleEndRound}
            aria-label="End Round"
            title="End Round"
            data-testid="round-end-entry"
            aria-describedby="round-done-help"
            className={iconBtnClass}
          >
            <Printer className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={toolsBtnClass}
          onClick={handleOpenTools}
          aria-label="Open tools"
          title="Tools"
          data-testid="round-tools-entry"
        >
          <MoreHorizontal className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
          <span className={cn("font-medium", touchFriendly ? "text-sm" : "hidden text-xs sm:inline")}>
            Tools
          </span>
        </Button>

        {!touchFriendly && actionBar}
      </div>
    </header>
  );

  if (!touchFriendly) {
    return header;
  }

  if (!children) {
    return header;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      <div
        className="shrink-0 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90"
        data-testid="round-chrome-sticky-actions"
      >
        {actionBar}
      </div>
    </div>
  );
};
