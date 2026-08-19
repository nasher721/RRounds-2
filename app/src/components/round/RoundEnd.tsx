import * as React from "react"
import { AlertTriangle, ArrowLeft, CheckCircle2, Printer } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useDashboard } from "@/contexts/DashboardContext"
import { useDashboardTodos } from "@/contexts/DashboardTodosContext"
import { useRoundSession } from "@/contexts/RoundSessionContext"
import { cn } from "@/lib/utils"
import { loadRoundPrintExport } from "./roundPrintExportLoader"

const PrintExportModal = React.lazy(loadRoundPrintExport)

export interface RoundEndProps {
  onBackToFocus: () => void
  onBackToHome: () => void
  touchFriendly?: boolean
  className?: string
}

/**
 * End-of-Round surface: Print / Export first-class, then mark Round complete.
 */
export const RoundEnd = ({
  onBackToFocus,
  onBackToHome,
  touchFriendly = false,
  className,
}: RoundEndProps) => {
  const {
    patients,
    onUpdatePatient,
    patientVerification = "verified",
  } = useDashboard()
  const { todosMap, verification: todosVerification } = useDashboardTodos(true)
  const {
    position,
    round,
    completeRound,
    canCompleteRound,
    pendingCount,
    failedCount,
    softFailedCount,
    generationConflictCount,
    conflicts,
    completionSafety,
    adoptRemoteRoundGeneration,
  } = useRoundSession()
  const [printOpen, setPrintOpen] = React.useState(false)

  const doneCount = round.patients.filter((ref) => ref.status === "done").length
  const incompleteTodoCount = Object.values(todosMap)
    .flat()
    .filter((todo) => !todo.completed).length
  const isComplete = round.status === "completed"
  const activePendingCount = Math.max(0, pendingCount - softFailedCount)
  const blockedSyncParts = [
    activePendingCount > 0 ? `${activePendingCount} pending` : null,
    softFailedCount > 0 ? `${softFailedCount} stalled` : null,
    failedCount > 0 ? `${failedCount} failed` : null,
    conflicts.length > 0 ? `${conflicts.length} conflicts` : null,
    completionSafety.mutationPendingCount > 0
      ? `${completionSafety.mutationPendingCount} patient changes pending`
      : null,
    completionSafety.mutationFailedCount > 0
      ? `${completionSafety.mutationFailedCount} patient changes failed`
      : null,
    completionSafety.mutationConflictCount > 0
      ? `${completionSafety.mutationConflictCount} patient conflicts`
      : null,
    completionSafety.patientSaveBlockerCount > 0
      ? `${completionSafety.patientSaveBlockerCount} active patient saves`
      : null,
    completionSafety.dataVerificationBlockerCount > 0
      ? "Clinical data not server-verified"
      : null,
  ].filter(Boolean).join(" · ")

  const handleOpenPrint = () => {
    setPrintOpen(true)
  }

  const handleMarkComplete = () => {
    completeRound()
    toast.success("Round marked complete", {
      description: "Print or export anytime from this screen.",
    })
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto px-4 py-8 md:px-8",
        className,
      )}
      data-testid="round-end"
    >
      <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
        <header className="space-y-2 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Printer className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1
            className={cn(
              "font-bold tracking-tight text-foreground",
              touchFriendly ? "text-2xl" : "text-xl",
            )}
          >
            End Round
          </h1>
          <p
            className={cn(
              touchFriendly ? "text-sm text-foreground/75" : "text-sm text-muted-foreground",
            )}
          >
            {patients.length === 0
              ? "No patients to export yet."
              : `${doneCount}/${position.total} marked done · print or export handoff summaries.`}
          </p>
          {isComplete && (
            <p
              className={cn(
                "flex items-center justify-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400",
                touchFriendly ? "text-sm" : "text-xs",
              )}
              data-testid="round-end-completed"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Round marked complete
            </p>
          )}
          {patients.length > 0 && (
            <div className="mt-2 rounded-xl border border-border/40 bg-muted/30 p-3 text-left text-xs text-foreground/85 space-y-1">
              <p className="flex justify-between">
                <span>Patients remaining:</span>
                <span className="font-semibold">{position.total - doneCount}</span>
              </p>
              <p className="flex justify-between">
                <span>Incomplete todos:</span>
                <span className="font-semibold">{incompleteTodoCount}</span>
              </p>
              <p className="flex justify-between border-t border-border/20 pt-1 text-muted-foreground">
                <span>Sync status:</span>
                <span>
                  {canCompleteRound
                    ? "All changes saved"
                    : blockedSyncParts || "Waiting for sync"}
                </span>
              </p>
            </div>
          )}
          {todosVerification === "stale" && patients.length > 0 ? (
            <p
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-left text-xs leading-relaxed text-amber-950 dark:text-amber-100"
              role="status"
              data-testid="round-end-todos-unverified"
            >
              Showing the last Todo snapshot saved on this device. Print / Export remains available for recovery, but reconnect before marking the Round complete so server Todo truth can be verified.
            </p>
          ) : null}
          {patientVerification === "stale" ? (
            <p
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-left text-xs leading-relaxed text-amber-950 dark:text-amber-100"
              role="status"
              data-testid="round-end-patients-unverified"
            >
              Patient roster is not server-verified. Review and Print / Export use the roster data available on this device, which may be incomplete. Reconnect before marking the Round complete.
            </p>
          ) : null}
        </header>

        {!canCompleteRound && patients.length > 0 ? (
          <div
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100"
            role="status"
            data-testid="round-completion-guard"
          >
            <p className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Finish syncing before marking complete
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/90 dark:text-amber-100/80">
              {blockedSyncParts || "One or more patient changes still need attention."}
              {" "}Use the sync control in the top bar to retry or review. Print / Export remains available for recovery.
            </p>
            {generationConflictCount > 0 ? (
              <div className="mt-3 space-y-2 border-t border-amber-500/30 pt-3">
                <p className="text-xs leading-relaxed">
                  Another device started a different active Round. Retry first if this Round was just created; otherwise use the remotely saved Round. Patient notes and Todos are not discarded.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] w-full border-amber-600/50 bg-background/80 text-amber-950 dark:text-amber-100"
                  onClick={() => void adoptRemoteRoundGeneration()}
                  data-testid="round-use-remote-generation"
                >
                  Use Round from another device
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            size={touchFriendly ? "lg" : "default"}
            className={cn(
              "w-full justify-center gap-2",
              touchFriendly && "min-h-[44px] text-base",
            )}
            onClick={handleOpenPrint}
            disabled={patients.length === 0}
            aria-label="Print or export patient summaries"
            data-testid="round-end-print"
          >
            <Printer className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
            Print / Export
          </Button>

          {!isComplete && (
            <Button
              type="button"
              variant="outline"
              size={touchFriendly ? "lg" : "default"}
              className={cn(
                "w-full justify-center gap-2",
                touchFriendly && "min-h-[44px] text-base",
              )}
              disabled={!canCompleteRound || patients.length === 0}
              onClick={handleMarkComplete}
              aria-label="Mark Round complete"
              data-testid="round-end-complete"
            >
              <CheckCircle2 className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
              Mark Round complete
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border/30 pt-4 sm:flex-row">
          {!isComplete ? (
            <Button
              type="button"
              variant="ghost"
              className={cn("gap-2", touchFriendly && "min-h-[44px]")}
              onClick={onBackToFocus}
              disabled={patients.length === 0}
              aria-label="Back to patient Focus"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Focus
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className={cn(touchFriendly && "min-h-[44px]")}
            onClick={onBackToHome}
            aria-label="Back to Round Home"
          >
            Round Home
          </Button>
        </div>
      </div>

      {printOpen ? (
        <React.Suspense fallback={null}>
          <PrintExportModal
            open={printOpen}
            onOpenChange={setPrintOpen}
            patients={patients}
            patientTodos={todosMap}
            onUpdatePatient={onUpdatePatient}
          />
        </React.Suspense>
      ) : null}
    </div>
  )
}
