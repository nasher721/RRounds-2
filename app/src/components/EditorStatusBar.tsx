/**
 * EditorStatusBar — compact footer for rich text editors.
 * Displays word count, character count, and estimated reading time.
 */
import * as React from "react";
import { stripHtml } from "@/lib/sanitize";

interface EditorStatusBarProps {
    html: string;
}

export const EditorStatusBar = React.memo(({ html }: EditorStatusBarProps) => {
    const text = React.useMemo(() => stripHtml(html), [html]);
    const wordCount = React.useMemo(() => {
        const trimmed = text.trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).length;
    }, [text]);

    const charCount = text.length;

    // Average reading speed ~200 wpm
    const readingTime = React.useMemo(() => {
        if (wordCount === 0) return "0 sec";
        const minutes = wordCount / 200;
        if (minutes < 1) return `${Math.ceil(minutes * 60)} sec`;
        return `${Math.round(minutes)} min`;
    }, [wordCount]);

    return (
        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border bg-muted/30 text-[11px] text-foreground/75 select-none">
            <span>{wordCount} word{wordCount !== 1 ? "s" : ""}</span>
            <span className="w-px h-3 bg-border" />
            <span>{charCount} char{charCount !== 1 ? "s" : ""}</span>
            <span className="w-px h-3 bg-border" />
            <span>~{readingTime} read</span>
        </div>
    );
});

EditorStatusBar.displayName = "EditorStatusBar";
