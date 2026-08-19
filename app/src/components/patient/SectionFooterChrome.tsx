import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Clock, Loader2, MoreHorizontal, Sparkles, Trash2, ChevronDown } from "lucide-react";
import { FieldTimestamp } from "@/components/FieldTimestamp";

export interface SectionAIAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}

export interface SectionFooterChromeProps {
  /** Field label used in aria-labels, e.g. "clinical summary". */
  fieldLabel: string;
  /** Existing fieldTimestamps value for the quiet "last edited" note. */
  timestamp?: string;
  /** Existing per-section action: prepend a timestamp to the field. */
  onAddTimestamp: () => void;
  /** Opens the existing clear-section confirmation dialog. */
  onClearSection: () => void;
  /** Section-level AI generation actions (may be empty — then no AI menu is shown). */
  aiActions?: SectionAIAction[];
  /** True while any section AI generation is in flight. */
  aiBusy?: boolean;
  /** Cancel the in-flight generation. */
  onCancelAI?: () => void;
  /** Active model label shown in the menu footer. */
  modelLabel: string;
}

/**
 * Unified editor footer (mockup artboard A): quiet timestamp on the left;
 * overflow icon for per-section actions and one "AI assist" menu on the right.
 * Destructive clear lives at the bottom of the menu, separated from generative
 * actions. Rendered in place of the old scattered per-section button rows.
 */
export const SectionFooterChrome = ({
  fieldLabel,
  timestamp,
  onAddTimestamp,
  onClearSection,
  aiActions = [],
  aiBusy = false,
  onCancelAI,
  modelLabel,
}: SectionFooterChromeProps) => {
  const hasAI = aiActions.length > 0;

  const clearItem = (
    <DropdownMenuItem
      onClick={onClearSection}
      className="cursor-pointer text-[13px]"
      style={{ color: "var(--rr-danger)" }}
    >
      <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
      Clear section…
    </DropdownMenuItem>
  );

  return (
    <div className="flex items-center gap-2 px-1 pt-1 no-print">
      <span
        className="inline-flex items-center gap-1 text-[12px]"
        style={{ color: "var(--rr-label-3)" }}
      >
        <Clock className="h-3 w-3" aria-hidden="true" />
        <FieldTimestamp timestamp={timestamp} />
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rr-icon-btn"
              aria-label={`${fieldLabel} section actions`}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rr-ws w-56 rounded-[12px] p-1.5">
            <DropdownMenuItem onClick={onAddTimestamp} className="cursor-pointer text-[13px]">
              <Clock className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              Add timestamp
            </DropdownMenuItem>
            {!hasAI && (
              <>
                <DropdownMenuSeparator />
                {clearItem}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasAI && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rr-btn rr-btn-secondary"
                aria-label={`AI assist for ${fieldLabel}`}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                AI assist
                <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rr-ws w-60 rounded-[12px] p-1.5">
              {aiBusy && onCancelAI ? (
                <DropdownMenuItem onClick={onCancelAI} className="cursor-pointer text-[13px]">
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Cancel generation
                </DropdownMenuItem>
              ) : null}
              {aiActions.map((action) => (
                <DropdownMenuItem
                  key={action.key}
                  onClick={action.onSelect}
                  disabled={action.disabled || aiBusy}
                  className="cursor-pointer text-[13px]"
                >
                  <span className="mr-2 inline-flex" aria-hidden="true">
                    {action.icon}
                  </span>
                  {action.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {clearItem}
              <DropdownMenuSeparator />
              <div
                className="px-2 pb-1 pt-1.5 text-xs leading-4"
                style={{ color: "var(--rr-label-2)" }}
              >
                {modelLabel} · drafts are reviewed before inserting
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </span>
    </div>
  );
};
