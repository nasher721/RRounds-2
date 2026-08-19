/**
 * Shared keyboard shortcut handler for rich text editors.
 * Provides standard formatting shortcuts that work across
 * both RichTextEditor and ImagePasteEditor.
 */
import { useCallback } from "react";

interface UseEditorKeyboardShortcutsOptions {
    execCommand: (command: string, value?: string) => void;
    onFindReplace?: (mode: "find" | "replace") => void;
    onInsertLink?: () => void;
}

export function useEditorKeyboardShortcuts({
    execCommand,
    onFindReplace,
    onInsertLink,
}: UseEditorKeyboardShortcutsOptions) {
    const handleShortcut = useCallback(
        (e: React.KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return false;

            // Ctrl/⌘ + B — Bold
            if (e.key === "b" && !e.shiftKey) {
                e.preventDefault();
                execCommand("bold");
                return true;
            }

            // Ctrl/⌘ + I — Italic
            if (e.key === "i" && !e.shiftKey) {
                e.preventDefault();
                execCommand("italic");
                return true;
            }

            // Ctrl/⌘ + U — Underline
            if (e.key === "u" && !e.shiftKey) {
                e.preventDefault();
                execCommand("underline");
                return true;
            }

            // Ctrl/⌘ + Shift + X — Strikethrough
            if ((e.key === "x" || e.key === "X") && e.shiftKey) {
                e.preventDefault();
                execCommand("strikeThrough");
                return true;
            }

            // Ctrl/⌘ + Shift + 7 — Ordered list
            if (e.key === "7" && e.shiftKey) {
                e.preventDefault();
                execCommand("insertOrderedList");
                return true;
            }

            // Ctrl/⌘ + Shift + 8 — Unordered list
            if (e.key === "8" && e.shiftKey) {
                e.preventDefault();
                execCommand("insertUnorderedList");
                return true;
            }

            // Ctrl/⌘ + K — Insert link
            if (e.key === "k" && !e.shiftKey) {
                e.preventDefault();
                onInsertLink?.();
                return true;
            }

            // Ctrl/⌘ + F — Find
            if (e.key === "f" && !e.shiftKey) {
                e.preventDefault();
                onFindReplace?.("find");
                return true;
            }

            // Ctrl/⌘ + H — Find & Replace
            if (e.key === "h" && !e.shiftKey) {
                e.preventDefault();
                onFindReplace?.("replace");
                return true;
            }

            return false;
        },
        [execCommand, onFindReplace, onInsertLink]
    );

    return { handleShortcut };
}
