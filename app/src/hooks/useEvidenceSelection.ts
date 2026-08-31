import { useCallback, useEffect, useRef, useState } from "react";
import { MIN_EVIDENCE_SELECTION_LENGTH, sanitizeEvidenceQuery } from "@/lib/openEvidence";

export interface EvidenceSelectionRect {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}

export interface EvidenceSelectionState {
  /** Sanitized selected text, or null when nothing eligible is selected. */
  text: string | null;
  /** Viewport-relative bounding rect of the selection, for positioning a popover. */
  rect: EvidenceSelectionRect | null;
}

const EMPTY_STATE: EvidenceSelectionState = { text: null, rect: null };

/**
 * Watches the document's text selection and reports it only when the
 * selection sits fully inside an element carrying `data-evidence-selectable`
 * (the note editors opt in via that attribute) and is long enough to be
 * worth an Open Evidence lookup. Scoped globally rather than per-editor so
 * every `RichTextEditor` instance gets the popover without individual wiring.
 */
export function useEvidenceSelection(enabled: boolean = true): EvidenceSelectionState {
  const [state, setState] = useState<EvidenceSelectionState>(EMPTY_STATE);
  const frameRef = useRef<number | null>(null);

  const computeSelection = useCallback((): EvidenceSelectionState => {
    if (typeof document === "undefined") return EMPTY_STATE;
    const selection = document.getSelection?.();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return EMPTY_STATE;

    const rawText = selection.toString();
    const sanitized = sanitizeEvidenceQuery(rawText);
    if (sanitized.length < MIN_EVIDENCE_SELECTION_LENGTH) return EMPTY_STATE;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const containerElement = container.nodeType === Node.ELEMENT_NODE
      ? (container as Element)
      : container.parentElement;
    const host = containerElement?.closest('[data-evidence-selectable="true"]');
    if (!host) return EMPTY_STATE;

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return EMPTY_STATE;

    return {
      text: sanitized,
      rect: {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      },
    };
  }, []);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      setState(EMPTY_STATE);
      return;
    }

    const handleSelectionChange = () => {
      if (frameRef.current !== null) return;
      const schedule = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb: () => void) => setTimeout(cb, 16);
      frameRef.current = schedule(() => {
        frameRef.current = null;
        setState(computeSelection());
      }) as unknown as number;
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      if (frameRef.current !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
    };
  }, [enabled, computeSelection]);

  return state;
}
