/**
 * Evidence Selection Popover
 * Mounted once for the whole authenticated shell. Watches for a text
 * selection inside any element carrying `data-evidence-selectable` (every
 * `RichTextEditor` instance opts in) and quietly surfaces a small "search
 * Open Evidence" button near the selection — no dialog, no interruption,
 * gone again as soon as the selection changes or the button is used.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Microscope } from "lucide-react";
import { useEvidenceSelection } from "@/hooks/useEvidenceSelection";
import { useOpenEvidenceState } from "@/hooks/useOpenEvidenceState";

const POPOVER_OFFSET_PX = 8;
const POPOVER_HEIGHT_ESTIMATE_PX = 36;

export function EvidenceSelectionPopover() {
  const { text, rect } = useEvidenceSelection();
  const { search } = useOpenEvidenceState();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || typeof document === "undefined" || !text || !rect) return null;

  const showAbove = rect.top > POPOVER_HEIGHT_ESTIMATE_PX + POPOVER_OFFSET_PX;
  const top = showAbove ? rect.top - POPOVER_HEIGHT_ESTIMATE_PX - POPOVER_OFFSET_PX : rect.bottom + POPOVER_OFFSET_PX;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - 220));

  return createPortal(
    <button
      ref={buttonRef}
      type="button"
      // Keep the browser from collapsing the selection on mousedown before onClick fires.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        search(text, "selection");
        document.getSelection()?.removeAllRanges();
      }}
      className="fixed z-[70] flex items-center gap-1.5 rounded-full border border-primary/30 bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 hover:bg-primary hover:text-primary-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ top, left }}
      aria-label={`Search Open Evidence for "${text}"`}
      title="Search Open Evidence"
    >
      <Microscope className="h-3.5 w-3.5" aria-hidden />
      Open Evidence
    </button>,
    document.body,
  );
}
