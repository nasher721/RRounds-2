import * as React from "react"
import { FileUp, Play, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EpicHandoffImport } from "@/components/EpicHandoffImport"
import { CSVColumnMapper } from "@/components/import/CSVColumnMapper"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useDashboard } from "@/contexts/DashboardContext"
import { useRoundSession } from "@/contexts/RoundSessionContext"
import { organizeCsvImportRecord } from "@/lib/import/organizeImportedPatient"
import { cn } from "@/lib/utils"

export interface RoundHomeProps {
  onStartRound: () => void
  onEndRound: () => void
  isResume: boolean
  touchFriendly?: boolean
  className?: string
}

/**
 * Round lifecycle start surface: Import Patient List first-class,
 * Start/Resume when the list has patients, quiet account basics.
 */
export const RoundHome = ({
  onStartRound,
  onEndRound,
  isResume,
  touchFriendly = false,
  className,
}: RoundHomeProps) => {
  const { patients, onImportPatients, onSignOut, user } = useDashboard()
  const { position, round } = useRoundSession()
  const [importOpen, setImportOpen] = React.useState(false)
  const [importMode, setImportMode] = React.useState<"csv" | "document">("csv")

  const hasPatients = patients.length > 0
  const doneCount = round.patients.filter((ref) => ref.status === "done").length
  const isCompleted = round.status === "completed"
  const startLabel = isCompleted ? "Start New Round" : isResume ? "Resume Round" : "Start Round"

  const handleOpenImport = () => {
    setImportMode("csv")
    setImportOpen(true)
  }

  const handleImportPatients = async (
    imported: Parameters<typeof onImportPatients>[0],
  ) => {
    await onImportPatients(imported)
    setImportOpen(false)
  }

  const handleCsvImport = async (records: Record<string, string>[]) => {
    await handleImportPatients(records.map(organizeCsvImportRecord))
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto px-4 py-8 md:px-8",
        className,
      )}
      data-testid="round-home"
    >
      <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
        <header className="space-y-1.5 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileUp className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1
            className={cn(
              "font-bold tracking-tight text-foreground",
              touchFriendly ? "text-2xl" : "text-xl",
            )}
          >
            Today&apos;s Round
          </h1>
          <p
            className={cn(
              touchFriendly ? "text-sm text-foreground/75" : "text-sm text-muted-foreground",
            )}
          >
            {hasPatients
              ? isCompleted
                ? `Round complete · ${patients.length} patient${patients.length === 1 ? "" : "s"} · ${doneCount} done`
                : `${patients.length} patient${patients.length === 1 ? "" : "s"} · ${doneCount} done · position ${position.current}/${position.total}`
              : "Import a list or add patients to start bed-by-bed Focus."}
          </p>
        </header>

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            size={touchFriendly ? "lg" : "default"}
            className={cn(
              "w-full justify-center gap-2 font-semibold shadow-sm",
              touchFriendly && "min-h-[44px] text-base",
            )}
            onClick={handleOpenImport}
            aria-label="Import Patient List"
            data-testid="round-home-import"
          >
            <FileUp className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
            Import Patient List
          </Button>

          {hasPatients ? (
            <Button
              type="button"
              variant="secondary"
              size={touchFriendly ? "lg" : "default"}
              className={cn(
                "w-full justify-center gap-2 font-semibold",
                touchFriendly && "min-h-[44px] text-base",
              )}
              onClick={onStartRound}
              aria-label={startLabel}
              data-testid="round-home-start"
            >
              <Play className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
              {startLabel}
            </Button>
          ) : (
            <p
              className={cn(
                "text-center",
                touchFriendly ? "text-sm text-foreground/70" : "text-xs text-muted-foreground",
              )}
            >
              No blank anonymous insert — import a list to build today&apos;s Round.
            </p>
          )}

          {hasPatients && isResume && !isCompleted && (
            <Button
              type="button"
              variant="outline"
              size={touchFriendly ? "lg" : "default"}
              className={cn(
                "w-full justify-center gap-2 font-medium",
                touchFriendly && "min-h-[44px] text-base",
              )}
              onClick={onEndRound}
              aria-label="End Round and print or export"
              data-testid="round-home-end"
            >
              <Printer className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
              End Round
            </Button>
          )}
        </div>

        <div
          className={cn(
            "flex flex-wrap items-center gap-3 border-t border-border/30 pt-4",
            touchFriendly ? "justify-between" : "justify-between",
          )}
        >
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span
              className={cn(
                "truncate",
                touchFriendly ? "text-sm text-foreground/70" : "text-xs text-muted-foreground",
              )}
            >
              {user?.email ?? "Signed in"}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(touchFriendly && "min-h-[44px]")}
            onClick={onSignOut}
            aria-label="Sign out"
          >
            Sign out
          </Button>
        </div>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0 pr-8">
            <DialogTitle>Import Patient List</DialogTitle>
            <DialogDescription>
              CSV mapping runs in this browser. Document and image parsing requires the deployment&apos;s approved clinical AI service.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={importMode}
            onValueChange={(value) => setImportMode(value as "csv" | "document")}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="grid h-auto min-h-[44px] w-full grid-cols-2">
              <TabsTrigger
                value="csv"
                className="min-h-[40px] px-2 sm:px-3"
                aria-label="CSV / spreadsheet"
                data-testid="round-import-csv-tab"
              >
                <span className="sm:hidden" aria-hidden="true">CSV</span>
                <span className="hidden sm:inline" aria-hidden="true">CSV / spreadsheet</span>
              </TabsTrigger>
              <TabsTrigger
                value="document"
                className="min-h-[40px] px-2 sm:px-3"
                aria-label="Document / image"
                data-testid="round-import-document-tab"
              >
                <span className="sm:hidden" aria-hidden="true">Document</span>
                <span className="hidden sm:inline" aria-hidden="true">Document / image</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="csv" className="mt-3 min-h-0 flex-1 overflow-hidden">
              <CSVColumnMapper
                onImportPatients={handleCsvImport}
                noDialog
                hideHeader
              />
            </TabsContent>
            <TabsContent value="document" className="mt-3 min-h-0 flex-1 overflow-hidden">
              <EpicHandoffImport
                existingBeds={patients.map((p) => p.bed)}
                onImportPatients={handleImportPatients}
                noDialog
                hideHeader
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
