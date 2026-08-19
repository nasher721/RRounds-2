/**
 * EditorFindReplace — inline find & replace panel for contentEditable editors.
 * Highlights matches using CSS custom highlights API (fallback to manual span wrapping).
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    X,
    ChevronUp,
    ChevronDown,
    Replace,
    ReplaceAll,
    CaseSensitive,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorFindReplaceProps {
    editorRef: React.RefObject<HTMLDivElement>;
    mode: "find" | "replace";
    onClose: () => void;
    onChange: () => void; // called when we mutate editor content (replace)
}

// Walk all text nodes inside an element
function getTextNodes(root: Node): Text[] {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
        nodes.push(node as Text);
    }
    return nodes;
}

function highlightMatches(ranges: Range[], activeIdx: number) {
    // Use CSS Custom Highlight API if available
    if ("Highlight" in window && CSS.highlights) {
        CSS.highlights.delete("editor-find-matches");
        CSS.highlights.delete("editor-find-active");

        if (ranges.length === 0) return;

        const inactive = ranges.filter((_, i) => i !== activeIdx);
        const active = ranges[activeIdx] ? [ranges[activeIdx]] : [];

        const matchHighlight = new Highlight(...inactive);
        const activeHighlight = new Highlight(...active);

        CSS.highlights.set("editor-find-matches", matchHighlight);
        CSS.highlights.set("editor-find-active", activeHighlight);
    }
}

function clearHighlights() {
    if ("Highlight" in window && CSS.highlights) {
        CSS.highlights.delete("editor-find-matches");
        CSS.highlights.delete("editor-find-active");
    }
}

export const EditorFindReplace = ({
    editorRef,
    mode: initialMode,
    onClose,
    onChange,
}: EditorFindReplaceProps) => {
    const [query, setQuery] = React.useState("");
    const [replacement, setReplacement] = React.useState("");
    const [caseSensitive, setCaseSensitive] = React.useState(false);
    const [showReplace, setShowReplace] = React.useState(initialMode === "replace");
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [matches, setMatches] = React.useState<Range[]>([]);
    const searchRef = React.useRef<HTMLInputElement>(null);

    const scrollToMatch = React.useCallback((range: Range | undefined) => {
        if (!range) return;
        const rect = range.getBoundingClientRect();
        const editor = editorRef.current;
        if (!editor) return;
        const editorRect = editor.getBoundingClientRect();

        // Scroll into view if not visible
        if (rect.top < editorRect.top || rect.bottom > editorRect.bottom) {
            const scrollContainer = editor.closest(".editor-scroll-container");
            if (scrollContainer) {
                const offsetTop = rect.top - editorRect.top + scrollContainer.scrollTop;
                scrollContainer.scrollTo({ top: offsetTop - 40, behavior: "smooth" });
            }
        }

        // Also set selection to the match
        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range.cloneRange());
        }
    }, [editorRef]);

    // Update mode when prop changes
    React.useEffect(() => {
        setShowReplace(initialMode === "replace");
    }, [initialMode]);

    // Focus search input on mount
    React.useEffect(() => {
        searchRef.current?.focus();
    }, []);

    // Find all matches whenever query or caseSensitive changes
    React.useEffect(() => {
        const editor = editorRef.current;
        if (!editor || !query) {
            setMatches([]);
            setCurrentIndex(0);
            clearHighlights();
            return;
        }

        const textNodes = getTextNodes(editor);
        const flags = caseSensitive ? "g" : "gi";
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedQuery, flags);
        const foundRanges: Range[] = [];

        for (const node of textNodes) {
            const text = node.textContent || "";
            let match: RegExpExecArray | null;
            while ((match = regex.exec(text)) !== null) {
                const range = document.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                foundRanges.push(range);
            }
        }

        setMatches(foundRanges);
        setCurrentIndex(foundRanges.length > 0 ? 0 : -1);
        highlightMatches(foundRanges, 0);
    }, [query, caseSensitive, editorRef]);

    // Update highlight when currentIndex changes
    React.useEffect(() => {
        if (matches.length > 0 && currentIndex >= 0) {
            highlightMatches(matches, currentIndex);
            scrollToMatch(matches[currentIndex]);
        }
    }, [currentIndex, matches, scrollToMatch]);

    // Clean up highlights on unmount only (clearHighlights is module scope, stable)
    React.useEffect(() => {
        return () => {
            clearHighlights();
        };
    }, []);

    const goNext = () => {
        if (matches.length === 0) return;
        setCurrentIndex((prev) => (prev + 1) % matches.length);
    };

    const goPrev = () => {
        if (matches.length === 0) return;
        setCurrentIndex((prev) => (prev - 1 + matches.length) % matches.length);
    };

    const replaceCurrent = () => {
        if (matches.length === 0 || currentIndex < 0 || !editorRef.current) return;

        const range = matches[currentIndex];
        range.deleteContents();
        range.insertNode(document.createTextNode(replacement));

        // Normalize to merge adjacent text nodes
        editorRef.current.normalize();
        onChange();

        // Re-search
        setQuery((q) => q); // trigger re-search via key change
        // Force re-find by toggling a dummy state
        const newQuery = query;
        setQuery("");
        requestAnimationFrame(() => setQuery(newQuery));
    };

    const replaceAll = () => {
        if (matches.length === 0 || !editorRef.current) return;

        // Replace in reverse order to preserve ranges
        for (let i = matches.length - 1; i >= 0; i--) {
            const range = matches[i];
            range.deleteContents();
            range.insertNode(document.createTextNode(replacement));
        }

        editorRef.current.normalize();
        onChange();

        setMatches([]);
        setCurrentIndex(-1);
        clearHighlights();
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            goNext();
        } else if (e.key === "Enter" && e.shiftKey) {
            e.preventDefault();
            goPrev();
        } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        }
    };

    return (
        <div className="flex flex-col gap-1 px-2 py-1.5 border-b border-border bg-muted/50 animate-in slide-in-from-top-1 duration-150">
            {/* Find row */}
            <div className="flex items-center gap-1">
                <Input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Find..."
                    className="h-7 text-xs flex-1 min-w-0"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCaseSensitive(!caseSensitive)}
                    title="Match case"
                    className={cn(
                        "h-7 w-7 p-0",
                        caseSensitive && "bg-primary/10 text-primary"
                    )}
                >
                    <CaseSensitive className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[10px] text-muted-foreground min-w-[50px] text-center">
                    {matches.length > 0
                        ? `${currentIndex + 1} of ${matches.length}`
                        : query
                            ? "0 results"
                            : ""}
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={goPrev}
                    disabled={matches.length === 0}
                    title="Previous (Shift+Enter)"
                    className="h-7 w-7 p-0"
                >
                    <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={goNext}
                    disabled={matches.length === 0}
                    title="Next (Enter)"
                    className="h-7 w-7 p-0"
                >
                    <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                {!showReplace && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowReplace(true)}
                        title="Toggle replace"
                        className="h-7 w-7 p-0"
                    >
                        <Replace className="h-3.5 w-3.5" />
                    </Button>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    title="Close (Esc)"
                    className="h-7 w-7 p-0"
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Replace row */}
            {showReplace && (
                <div className="flex items-center gap-1">
                    <Input
                        value={replacement}
                        onChange={(e) => setReplacement(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") onClose();
                        }}
                        placeholder="Replace with..."
                        className="h-7 text-xs flex-1 min-w-0"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={replaceCurrent}
                        disabled={matches.length === 0}
                        title="Replace"
                        className="h-7 w-7 p-0"
                    >
                        <Replace className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={replaceAll}
                        disabled={matches.length === 0}
                        title="Replace all"
                        className="h-7 w-7 p-0"
                    >
                        <ReplaceAll className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )}
        </div>
    );
};
