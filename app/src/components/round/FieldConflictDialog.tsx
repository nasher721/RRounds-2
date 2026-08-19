import * as React from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { FieldConflict, FieldConflictChoice } from "@/lib/round/sync"

export interface FieldConflictDialogProps {
  conflict: FieldConflict | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onResolve: (choice: FieldConflictChoice, mergedValue?: string) => void
  className?: string
}

const preview = (value: string, max = 280): string => {
  const plain = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  if (plain.length <= max) return plain || "(empty)"
  return `${plain.slice(0, max - 1)}…`
}

/**
 * Explicit Mine / Theirs / merge for same-field offline divergence.
 * Never silent-drops either version.
 */
export const FieldConflictDialog = ({
  conflict,
  open,
  onOpenChange,
  onResolve,
  className,
}: FieldConflictDialogProps) => {
  const [mergeText, setMergeText] = React.useState("")
  const [showMergeEditor, setShowMergeEditor] = React.useState(false)

  React.useEffect(() => {
    if (!conflict) return
    setMergeText(`${conflict.mine.value}\n\n${conflict.theirs.value}`.trim())
    setShowMergeEditor(false)
  }, [conflict])

  if (!conflict) return null

  const handleMine = () => {
    onResolve("mine")
  }

  const handleTheirs = () => {
    onResolve("theirs")
  }

  const handleStartMerge = () => {
    setShowMergeEditor(true)
  }

  const handleConfirmMerge = () => {
    onResolve("merge", mergeText)
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
  }

  const handleMergeChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMergeText(event.target.value)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        className={cn("max-w-lg", className)}
        data-testid="field-conflict-dialog"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Field conflict</AlertDialogTitle>
          <AlertDialogDescription>
            This field changed on two devices while offline. Choose Mine, Theirs, or edit a merge.
            Nothing is dropped silently.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground" data-testid="field-conflict-key">
            {conflict.fieldKey}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border/50 bg-muted/30 p-3">
              <p className="mb-1 text-xs font-medium text-foreground">Mine</p>
              <p className="whitespace-pre-wrap text-foreground/90" data-testid="field-conflict-mine">
                {preview(conflict.mine.value)}
              </p>
            </div>
            <div className="rounded-md border border-border/50 bg-muted/30 p-3">
              <p className="mb-1 text-xs font-medium text-foreground">Theirs</p>
              <p className="whitespace-pre-wrap text-foreground/90" data-testid="field-conflict-theirs">
                {preview(conflict.theirs.value)}
              </p>
            </div>
          </div>

          {showMergeEditor && (
            <div className="space-y-2">
              <label htmlFor="field-conflict-merge" className="text-xs font-medium text-foreground">
                Merged text
              </label>
              <Textarea
                id="field-conflict-merge"
                value={mergeText}
                onChange={handleMergeChange}
                className="min-h-28 text-sm"
                data-testid="field-conflict-merge"
                aria-label="Merged field value"
              />
            </div>
          )}
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel className="mt-0">Keep unresolved</AlertDialogCancel>
          <Button type="button" variant="outline" onClick={handleMine} data-testid="field-conflict-choose-mine">
            Mine
          </Button>
          <Button type="button" variant="outline" onClick={handleTheirs} data-testid="field-conflict-choose-theirs">
            Theirs
          </Button>
          {showMergeEditor ? (
            <Button type="button" onClick={handleConfirmMerge} data-testid="field-conflict-confirm-merge">
              Save merge
            </Button>
          ) : (
            <Button type="button" onClick={handleStartMerge} data-testid="field-conflict-start-merge">
              Edit merge
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
