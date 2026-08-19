import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";

export interface AIDraftPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dialog title, e.g. "AI draft — Clinical Summary". */
  title: string;
  /** Generated content shown for review before it is written to the chart. */
  draft: string;
  /** Optional meta line, e.g. "Sources: Systems review (10), Labs · gpt-4o". */
  meta?: string;
  /** Called when the user confirms the insert; parent performs the write. */
  onInsert: () => void;
  description?: string;
  insertLabel?: string;
  discardLabel?: string;
}

/**
 * AI draft preview (mockup artboard C): gates section-level AI generation
 * behind an explicit review step. Nothing is written until "Insert draft".
 */
export const AIDraftPreviewDialog = ({
  open,
  onOpenChange,
  title,
  draft,
  meta,
  onInsert,
  description = "Review the generated draft before inserting. Nothing is written to the chart until you insert it.",
  insertLabel = "Insert draft",
  discardLabel = "Discard",
}: AIDraftPreviewDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rr-ws max-w-[560px] gap-4 rounded-[16px] p-6"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle
            className="text-[16px] font-medium leading-6"
            style={{ color: "var(--rr-label-1)" }}
          >
            {title}
          </DialogTitle>
          <DialogDescription
            className="text-[14px] leading-5"
            style={{ color: "var(--rr-label-1)" }}
          >
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-2">
          <div
            className="max-h-[320px] overflow-y-auto whitespace-pre-wrap rounded-[12px] p-4 text-[14px] leading-[22px]"
            style={{ background: "var(--rr-f1)", color: "var(--rr-label-1)" }}
          >
            {draft}
          </div>
          {meta ? (
            <div
              className="flex items-center gap-1 text-[12px] leading-[18px]"
              style={{ color: "var(--rr-label-3)" }}
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              <span>{meta}</span>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <button
            type="button"
            className="rr-btn rr-btn-secondary"
            onClick={() => onOpenChange(false)}
          >
            {discardLabel}
          </button>
          <button
            type="button"
            className="rr-btn rr-btn-primary"
            onClick={onInsert}
          >
            {insertLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
