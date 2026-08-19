import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline, List, ListOrdered, Type, Highlighter,
  Indent, Outdent, Palette, Undo2, Redo2, FileText, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Link2, Minus,
  Superscript, Subscript, Search, Table as TableIcon,
  ChevronDown, Maximize2, Minimize2, Sparkles, MoreHorizontal,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettings } from "@/contexts/SettingsContext";
import { useIsTablet } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { defaultAutotexts, medicalDictionary } from "@/data/autotexts";
import type { AutoText } from "@/types/autotext";
import { DictationButton } from "./DictationButton";
import { UnifiedAIDropdown } from "./UnifiedAIDropdown";
import { DocumentImport } from "./DocumentImport";
import { PatientInfoToolbar } from "./PatientInfoToolbar";
import { PhrasePicker, PhraseFormDialog } from "./phrases";
import { usePhraseExpansion } from "@/hooks/usePhraseExpansion";
import { useClinicalPhrases } from "@/hooks/useClinicalPhrases";
import { useEditorKeyboardShortcuts } from "@/hooks/useEditorKeyboardShortcuts";
import { EditorFindReplace } from "./EditorFindReplace";
import { EditorStatusBar } from "./EditorStatusBar";
import type { Patient } from "@/types/patient";
import { createSafeLinkHtml, sanitizeHtml, sanitizePastedHtml } from "@/lib/sanitize";

const textColors = [
  { name: "Default", value: "" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Gray", value: "#6b7280" },
];

const highlightColors = [
  { name: "None", value: "" },
  { name: "Yellow", value: "#fef08a" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Orange", value: "#fed7aa" },
  { name: "Purple", value: "#e9d5ff" },
];

// Rich text editor with formatting, autotexts, and optional change tracking

const ESSENTIAL_TOOLBAR_IDS = ['undo', 'redo', 'bold', 'italic', 'bulletList', 'numberedList'] as const;

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  autotexts?: AutoText[];
  fontSize?: number;
  changeTracking?: {
    enabled: boolean;
    wrapWithMarkup: (text: string) => string;
    wrapHtmlWithMarkup?: (html: string) => string;
  } | null;
  patient?: Patient;
  section?: string;
  /** Visible heading that labels the contenteditable region. */
  ariaLabelledby?: string;
  /** When true, show an expand button to open this editor in a large focus overlay */
  popOutAvailable?: boolean;
  /** Internal: when true, this instance is the one rendered inside the pop-out dialog */
  isPopOutInstance?: boolean;
}

export const RichTextEditor = ({
  value,
  onChange,
  placeholder = "Enter text...",
  className,
  minHeight = "120px",
  autotexts = defaultAutotexts,
  fontSize = 14,
  changeTracking = null,
  patient,
  section,
  ariaLabelledby,
  popOutAvailable = false,
  isPopOutInstance = false,
}: RichTextEditorProps) => {
  const { editorToolbarMode, editorToolbarButtons } = useSettings();
  const isTablet = useIsTablet();
  const editorRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const fontSizeRef = React.useRef(fontSize);
  const [showAutocomplete, setShowAutocomplete] = React.useState(false);
  const [autocompleteOptions, setAutocompleteOptions] = React.useState<{ shortcut: string; expansion: string }[]>([]);
  const [autocompletePosition, setAutocompletePosition] = React.useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const lastWordRef = React.useRef("");
  const isInternalUpdate = React.useRef(false);
  const [localMarkingDisabled, setLocalMarkingDisabled] = React.useState(false);
  const [findReplaceMode, setFindReplaceMode] = React.useState<"find" | "replace" | null>(null);
  const [showTablePicker, setShowTablePicker] = React.useState(false);
  const [tableHover, setTableHover] = React.useState({ rows: 0, cols: 0 });
  const [isPoppedOut, setIsPoppedOut] = React.useState(false);
  const [isEditorFocused, setIsEditorFocused] = React.useState(false);

  // On tablet, collapse full toolbars so controls stay associated with the editor.
  const effectiveToolbarMode =
    isTablet && editorToolbarMode === "full" ? "minimal" : editorToolbarMode;

  const showButtonInBar = (id: string) => {
    if (effectiveToolbarMode === 'full') return true;
    if (effectiveToolbarMode === 'minimal') return (ESSENTIAL_TOOLBAR_IDS as readonly string[]).includes(id);
    return editorToolbarButtons.includes(id);
  };

  const toolbarIconClass = "h-[44px] w-[44px] p-0";
  // Show patient-field inserts only while the editor is focused to reduce density.
  const showPatientInfoToolbar = Boolean(patient) && isEditorFocused;
  // Keep full formatting chrome off until the field is active to cut empty vertical space.
  const showDenseToolbar =
    isEditorFocused || isPopOutInstance || Boolean(findReplaceMode) || isPoppedOut;

  // Effective change tracking state - must be defined before any callbacks that use it
  const effectiveChangeTracking = localMarkingDisabled ? null : changeTracking;

  // Clinical phrase system
  const { folders } = useClinicalPhrases();

  // Insert phrase content handler
  const insertPhraseContent = React.useCallback((content: string) => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0
      ? selection.getRangeAt(0)
      : null;

    let contentHtml = content;
    if (effectiveChangeTracking?.enabled) {
      const safeContent = sanitizeHtml(content);
      contentHtml = effectiveChangeTracking.wrapHtmlWithMarkup?.(safeContent)
        ?? effectiveChangeTracking.wrapWithMarkup(content);
    }
    contentHtml = sanitizeHtml(contentHtml);

    if (range && editorRef.current.contains(range.startContainer)) {
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = contentHtml;
      const fragment = document.createDocumentFragment();
      while (temp.firstChild) {
        fragment.appendChild(temp.firstChild);
      }
      range.insertNode(fragment);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else {
      editorRef.current.innerHTML += contentHtml;
    }

    isInternalUpdate.current = true;
    onChange(editorRef.current.innerHTML);
    editorRef.current.focus();
  }, [onChange, effectiveChangeTracking]);

  const handleInsertPatientInfo = React.useCallback((text: string) => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0
      ? selection.getRangeAt(0)
      : null;

    let contentHtml = text;
    if (effectiveChangeTracking?.enabled) {
      contentHtml = effectiveChangeTracking.wrapWithMarkup(text);
    }
    contentHtml = sanitizeHtml(contentHtml);

    if (range && editorRef.current.contains(range.startContainer)) {
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = contentHtml + ' ';
      const fragment = document.createDocumentFragment();
      while (temp.firstChild) {
        fragment.appendChild(temp.firstChild);
      }
      range.insertNode(fragment);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else {
      editorRef.current.innerHTML += contentHtml + ' ';
    }

    isInternalUpdate.current = true;
    onChange(editorRef.current.innerHTML);
    editorRef.current.focus();
  }, [onChange, effectiveChangeTracking]);

  // Use phrase expansion hook
  const {
    phrases,
    selectedPhrase,
    phraseFields,
    showForm,
    handleFormInsert,
    handleLogUsage,
    closeForm,
    selectPhrase,
  } = usePhraseExpansion({
    patient,
    context: { section },
    onInsert: insertPhraseContent,
  });

  // Handle dictation transcript insertion
  const handleDictationTranscript = React.useCallback((text: string) => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0
      ? selection.getRangeAt(0)
      : null;

    // Create content with optional change tracking
    let contentHtml = text;
    if (effectiveChangeTracking?.enabled) {
      contentHtml = effectiveChangeTracking.wrapWithMarkup(text);
    }
    contentHtml = sanitizeHtml(contentHtml);

    if (range && editorRef.current.contains(range.startContainer)) {
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = contentHtml + ' ';
      const fragment = document.createDocumentFragment();
      while (temp.firstChild) {
        fragment.appendChild(temp.firstChild);
      }
      range.insertNode(fragment);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else {
      // Insert at end if no selection
      editorRef.current.innerHTML += ' ' + contentHtml + ' ';
    }

    isInternalUpdate.current = true;
    onChange(editorRef.current.innerHTML);
    editorRef.current.focus();
  }, [effectiveChangeTracking, onChange]);

  const execCommand = React.useCallback((command: string, cmdValue?: string) => {
    document.execCommand(command, false, cmdValue);
    if (editorRef.current) {
      const sanitizedValue = sanitizeHtml(editorRef.current.innerHTML);
      if (sanitizedValue !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = sanitizedValue;
      }
      isInternalUpdate.current = true;
      onChange(sanitizedValue);
    }
  }, [onChange]);

  // Use native event listener for beforeinput (more reliable than React's onBeforeInput)
  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleBeforeInput = (e: InputEvent) => {
      if (!effectiveChangeTracking?.enabled || !e.data) return;

      // Handle both insertText and insertFromPaste
      if (e.inputType === 'insertText' || e.inputType === 'insertFromPaste') {
        e.preventDefault();

        const markedHtml = sanitizeHtml(effectiveChangeTracking.wrapWithMarkup(e.data));
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const temp = document.createElement('div');
        temp.innerHTML = markedHtml;
        const fragment = document.createDocumentFragment();
        while (temp.firstChild) {
          fragment.appendChild(temp.firstChild);
        }
        range.insertNode(fragment);

        // Move cursor after inserted content
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);

        isInternalUpdate.current = true;
        onChange(editor.innerHTML);
      }
    };

    editor.addEventListener('beforeinput', handleBeforeInput);
    return () => editor.removeEventListener('beforeinput', handleBeforeInput);
  }, [effectiveChangeTracking, onChange]);

  // Always intercept rich-text paste so executable clipboard markup never
  // reaches the contenteditable DOM.
  const handlePaste = React.useCallback((e: React.ClipboardEvent) => {
    const html = e.clipboardData?.getData('text/html') || '';
    const text = e.clipboardData?.getData('text/plain');
    if (!html && !text) return;

    e.preventDefault();

    const safePastedHtml = sanitizePastedHtml(html, text || '');
    const contentHtml = effectiveChangeTracking?.enabled
      ? sanitizeHtml(effectiveChangeTracking.wrapHtmlWithMarkup?.(safePastedHtml)
        ?? effectiveChangeTracking.wrapWithMarkup(text || ''))
      : safePastedHtml;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const temp = document.createElement('div');
    temp.innerHTML = contentHtml;
    const fragment = document.createDocumentFragment();
    while (temp.firstChild) {
      fragment.appendChild(temp.firstChild);
    }
    range.insertNode(fragment);

    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    if (editorRef.current) {
      isInternalUpdate.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [effectiveChangeTracking, onChange]);

  const handleInput = React.useCallback(() => {
    if (editorRef.current) {
      const sanitizedValue = sanitizeHtml(editorRef.current.innerHTML);
      if (sanitizedValue !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = sanitizedValue;
      }
      isInternalUpdate.current = true;
      onChange(sanitizedValue);
    }
  }, [onChange]);

  const handleFontSizeChange = (newSize: number[]) => {
    fontSizeRef.current = newSize[0];
    if (editorRef.current) {
      editorRef.current.style.fontSize = `${newSize[0]}px`;
    }
  };

  const applyFontSizeToSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = `${fontSizeRef.current}px`;
      range.surroundContents(span);
      editorRef.current?.focus();
      if (editorRef.current) {
        isInternalUpdate.current = true;
        onChange(editorRef.current.innerHTML);
      }
    }
  };

  const getCurrentWord = (): { word: string; range: Range | null } => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return { word: "", range: null };

    const range = selection.getRangeAt(0);
    if (!range.collapsed) return { word: "", range: null };

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return { word: "", range: null };

    const text = node.textContent || "";
    const offset = range.startOffset;

    // Find word boundaries
    let start = offset;

    while (start > 0 && /\S/.test(text[start - 1])) start--;

    const word = text.substring(start, offset);

    // Create range for the word
    const wordRange = document.createRange();
    wordRange.setStart(node, start);
    wordRange.setEnd(node, offset);

    return { word, range: wordRange };
  };

  const replaceCurrentWord = (replacement: string) => {
    const { range } = getCurrentWord();
    if (!range) return;

    range.deleteContents();

    // Apply change tracking markup if enabled
    let content: Node;
    if (effectiveChangeTracking?.enabled) {
      const markedHtml = sanitizeHtml(effectiveChangeTracking.wrapWithMarkup(replacement));
      const temp = document.createElement('div');
      temp.innerHTML = markedHtml + " ";
      content = document.createDocumentFragment();
      while (temp.firstChild) {
        content.appendChild(temp.firstChild);
      }
    } else {
      content = document.createTextNode(replacement + " ");
    }

    range.insertNode(content);

    // Move cursor after inserted text
    const selection = window.getSelection();
    if (selection) {
      const newRange = document.createRange();
      newRange.selectNodeContents(editorRef.current!);
      newRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    if (editorRef.current) {
      isInternalUpdate.current = true;
      onChange(editorRef.current.innerHTML);
    }

    setShowAutocomplete(false);
  };

  // Insert link helper
  const handleInsertLink = React.useCallback(() => {
    const selection = window.getSelection();
    const selectedText = selection && !selection.isCollapsed ? selection.toString() : "";
    const url = window.prompt("Enter URL:", "https://");
    if (url) {
      const linkText = selectedText || window.prompt("Link text:", url) || url;
      const link = createSafeLinkHtml(url, linkText);
      if (link) {
        execCommand("insertHTML", link);
      }
    }
  }, [execCommand]);

  // Insert table helper
  const insertTable = React.useCallback((rows: number, cols: number) => {
    if (!editorRef.current) return;
    let html = '<table><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        if (r === 0) {
          html += '<th>&nbsp;</th>';
        } else {
          html += '<td>&nbsp;</td>';
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table><br>';
    execCommand("insertHTML", html);
    setShowTablePicker(false);
  }, [execCommand]);

  // Keyboard shortcut hook
  const { handleShortcut } = useEditorKeyboardShortcuts({
    execCommand,
    onFindReplace: (mode) => setFindReplaceMode(mode),
    onInsertLink: handleInsertLink,
  });

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    // Check keyboard shortcuts first
    if (handleShortcut(e)) return;

    // Handle autocomplete navigation
    if (showAutocomplete && autocompleteOptions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % autocompleteOptions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + autocompleteOptions.length) % autocompleteOptions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        replaceCurrentWord(autocompleteOptions[selectedIndex].expansion);
        return;
      }
      if (e.key === "Escape") {
        setShowAutocomplete(false);
        editorRef.current?.blur();
        return;
      }
    }

    // Handle autotext expansion on space/tab
    if (e.key === "Escape") {
      editorRef.current?.blur();
      setShowAutocomplete(false);
      return;
    }

    if (e.key === " " || e.key === "Tab") {
      const { word } = getCurrentWord();
      if (word) {
        const autotext = autotexts.find(a => a.shortcut.toLowerCase() === word.toLowerCase());
        if (autotext) {
          e.preventDefault();
          replaceCurrentWord(autotext.expansion);
          return;
        }

        // Autocorrect on space
        if (e.key === " ") {
          const corrected = medicalDictionary[word.toLowerCase()];
          if (corrected) {
            e.preventDefault();
            replaceCurrentWord(corrected);
            return;
          }
        }
      }

      if (e.key === "Tab") {
        e.preventDefault();
        const focusable = Array.from(document.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
        )).filter((element) => element.getClientRects().length > 0 || element === editorRef.current);
        const currentIndex = focusable.indexOf(editorRef.current!);
        const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
        editorRef.current?.blur();
        focusable[nextIndex]?.focus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAutocomplete, autocompleteOptions, selectedIndex, autotexts, handleShortcut]);

  const handleKeyUp = React.useCallback((e: React.KeyboardEvent) => {
    // Don't show autocomplete for navigation/modifier keys
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Shift", "Control", "Alt", "Meta", "Escape", "Enter", "Tab"].includes(e.key)) {
      return;
    }

    const { word } = getCurrentWord();
    lastWordRef.current = word;

    if (word.length >= 2) {
      const matches = autotexts.filter(a =>
        a.shortcut.toLowerCase().startsWith(word.toLowerCase())
      ).slice(0, 5);

      if (matches.length > 0) {
        // Get caret position
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const editorRect = editorRef.current?.getBoundingClientRect();

          if (editorRect) {
            setAutocompletePosition({
              top: rect.bottom - editorRect.top + 4,
              left: rect.left - editorRect.left
            });
          }
        }

        setAutocompleteOptions(matches);
        setSelectedIndex(0);
        setShowAutocomplete(true);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  }, [autotexts]);

  // Sync fontSize prop with ref
  React.useEffect(() => {
    fontSizeRef.current = fontSize;
    if (editorRef.current) {
      editorRef.current.style.fontSize = `${fontSize}px`;
    }
  }, [fontSize]);

  // Sync external value changes - only when value actually changes externally
  React.useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    const sanitizedValue = sanitizeHtml(value);
    if (editorRef.current && editorRef.current.innerHTML !== sanitizedValue) {
      // Save cursor position
      const selection = window.getSelection();
      const hadFocus = document.activeElement === editorRef.current;

      editorRef.current.innerHTML = sanitizedValue;

      // Restore cursor to end if we had focus
      if (hadFocus && selection && editorRef.current.childNodes.length > 0) {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, [value]);

  const collapsedMinHeight = isPopOutInstance ? minHeight : "72px";
  const activeMinHeight = isPopOutInstance ? minHeight : minHeight;

  const editorArea = (
    <>
      <div className={cn("max-h-[600px] overflow-y-auto editor-scroll-container relative", isPoppedOut && isPopOutInstance && "min-h-[60vh] max-h-[70vh]")}>
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={ariaLabelledby}
          aria-label={ariaLabelledby ? undefined : section ? `${section} notes` : placeholder}
          spellCheck
          contentEditable
          className={cn(
            "p-3 rounded-lg empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0 prose prose-sm max-w-none relative whitespace-pre-wrap text-foreground",
            showDenseToolbar && "rounded-t-none",
            isPopOutInstance ? "min-h-[55vh]" : showDenseToolbar ? "min-h-[120px]" : "min-h-[72px]",
          )}
          style={{
            fontSize: `${fontSizeRef.current}px`,
            minHeight: showDenseToolbar ? activeMinHeight : collapsedMinHeight,
          }}
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          data-placeholder={placeholder}
          onFocus={(e) => {
            if (e.currentTarget.innerHTML === '' || e.currentTarget.innerHTML === '<br>') {
              e.currentTarget.dataset.empty = 'true';
            }
          }}
          onBlur={(e) => {
            delete e.currentTarget.dataset.empty;
            setShowAutocomplete(false);
          }}
          suppressContentEditableWarning
        />
      </div>
      {showDenseToolbar ? <EditorStatusBar html={value} /> : null}
    </>
  );

  const toolbarContent = showDenseToolbar ? (
    <>
      {showPatientInfoToolbar && (
        <div className="border-b border-border/50 bg-muted/20">
          <PatientInfoToolbar
            onInsert={handleInsertPatientInfo}
            patient={patient}
          />
        </div>
      )}

      {/* Find & Replace Panel */}
      {findReplaceMode && (
        <EditorFindReplace
          editorRef={editorRef as React.RefObject<HTMLDivElement>}
          mode={findReplaceMode}
          onClose={() => setFindReplaceMode(null)}
          onChange={() => {
            if (editorRef.current) {
              isInternalUpdate.current = true;
              onChange(editorRef.current.innerHTML);
            }
          }}
        />
      )}

      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Text formatting"
        className={cn(
          "flex items-center gap-1.5 p-2 border-b border-border/50 bg-muted/40 rounded-t-lg",
          isTablet ? "flex-nowrap overflow-x-auto" : "flex-wrap",
        )}
      >
        {popOutAvailable && !isPopOutInstance && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsPoppedOut(true)} title="Expand to focus mode" aria-label="Expand to focus mode" className={cn(toolbarIconClass, "text-muted-foreground hover:text-foreground")}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {popOutAvailable && !isPopOutInstance && <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />}
        {showButtonInBar('undo') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('undo')} title="Undo (Ctrl+Z)" aria-label="Undo (Ctrl+Z)" className={toolbarIconClass}>
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {showButtonInBar('redo') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('redo')} title="Redo (Ctrl+Y)" aria-label="Redo (Ctrl+Y)" className={toolbarIconClass}>
            <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {(showButtonInBar('undo') || showButtonInBar('redo')) && <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />}

        {showButtonInBar('bold') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('bold')} title="Bold (Ctrl+B)" aria-label="Bold (Ctrl+B)" className={toolbarIconClass}>
            <Bold className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {showButtonInBar('italic') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('italic')} title="Italic (Ctrl+I)" aria-label="Italic (Ctrl+I)" className={toolbarIconClass}>
            <Italic className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {showButtonInBar('underline') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('underline')} title="Underline (Ctrl+U)" aria-label="Underline (Ctrl+U)" className={toolbarIconClass}>
            <Underline className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {showButtonInBar('strikethrough') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('strikeThrough')} title="Strikethrough" aria-label="Strikethrough" className={toolbarIconClass}>
            <Strikethrough className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {showButtonInBar('superscript') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('superscript')} title="Superscript" aria-label="Superscript" className={toolbarIconClass}>
            <Superscript className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {showButtonInBar('subscript') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('subscript')} title="Subscript" aria-label="Subscript" className={toolbarIconClass}>
            <Subscript className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {(showButtonInBar('bold') || showButtonInBar('italic') || showButtonInBar('underline') || showButtonInBar('strikethrough') || showButtonInBar('superscript') || showButtonInBar('subscript')) && <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />}

        {showButtonInBar('heading') && (
          <>
            <select
              onChange={(e) => { const val = e.target.value; if (val === "p") execCommand("formatBlock", "<p>"); else execCommand("formatBlock", `<${val}>`); }}
              defaultValue="p"
              aria-label="Heading level"
              className="h-[44px] px-2 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              title="Heading level"
            >
              <option value="p">Normal</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="h4">Heading 4</option>
            </select>
            <div className="w-px h-5 bg-border mx-1" />
          </>
        )}

        {showButtonInBar('bulletList') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('insertUnorderedList')} title="Bullet List" aria-label="Bullet list" className={toolbarIconClass}>
            <List className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {showButtonInBar('numberedList') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('insertOrderedList')} title="Numbered List" aria-label="Numbered list" className={toolbarIconClass}>
            <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {(showButtonInBar('bulletList') || showButtonInBar('numberedList')) && <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />}

        {showButtonInBar('indent') && (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('outdent')} title="Decrease Indent" aria-label="Decrease indent" className={toolbarIconClass}>
              <Outdent className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('indent')} title="Increase Indent" aria-label="Increase indent" className={toolbarIconClass}>
              <Indent className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />
          </>
        )}

        {showButtonInBar('alignLeft') && (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('justifyLeft')} title="Align Left" aria-label="Align left" className={toolbarIconClass}>
              <AlignLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('justifyCenter')} title="Align Center" aria-label="Align center" className={toolbarIconClass}>
              <AlignCenter className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('justifyRight')} title="Align Right" aria-label="Align right" className={toolbarIconClass}>
              <AlignRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('justifyFull')} title="Justify" aria-label="Justify text" className={toolbarIconClass}>
              <AlignJustify className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />
          </>
        )}

        {/* More dropdown: actions not visible in bar (minimal/custom mode) */}
        {effectiveToolbarMode !== 'full' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-[44px] gap-1 px-3" aria-label="More formatting options">
                <span className="text-xs font-medium">More</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[70vh] overflow-y-auto w-56">
              {/* Text Style group */}
              {(!showButtonInBar('underline') || !showButtonInBar('strikethrough') || !showButtonInBar('superscript') || !showButtonInBar('subscript')) && (
                <DropdownMenuLabel className="px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground">Text Style</DropdownMenuLabel>
              )}
              {!showButtonInBar('underline') && <DropdownMenuItem onClick={() => execCommand('underline')}><Underline className="h-3.5 w-3.5 mr-2" /> Underline</DropdownMenuItem>}
              {!showButtonInBar('strikethrough') && <DropdownMenuItem onClick={() => execCommand('strikeThrough')}><Strikethrough className="h-3.5 w-3.5 mr-2" /> Strikethrough</DropdownMenuItem>}
              {!showButtonInBar('superscript') && <DropdownMenuItem onClick={() => execCommand('superscript')}><Superscript className="h-3.5 w-3.5 mr-2" /> Superscript</DropdownMenuItem>}
              {!showButtonInBar('subscript') && <DropdownMenuItem onClick={() => execCommand('subscript')}><Subscript className="h-3.5 w-3.5 mr-2" /> Subscript</DropdownMenuItem>}

              {/* Headings group */}
              {!showButtonInBar('heading') && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground">Headings</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => execCommand('formatBlock', '<p>')}>Normal text</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => execCommand('formatBlock', '<h1>')}>Heading 1</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => execCommand('formatBlock', '<h2>')}>Heading 2</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => execCommand('formatBlock', '<h3>')}>Heading 3</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => execCommand('formatBlock', '<h4>')}>Heading 4</DropdownMenuItem>
                </>
              )}

              {/* Lists & Indent group */}
              {(!showButtonInBar('bulletList') || !showButtonInBar('numberedList') || !showButtonInBar('indent')) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground">Lists & Indent</DropdownMenuLabel>
                </>
              )}
              {!showButtonInBar('bulletList') && <DropdownMenuItem onClick={() => execCommand('insertUnorderedList')}><List className="h-3.5 w-3.5 mr-2" /> Bullet list</DropdownMenuItem>}
              {!showButtonInBar('numberedList') && <DropdownMenuItem onClick={() => execCommand('insertOrderedList')}><ListOrdered className="h-3.5 w-3.5 mr-2" /> Numbered list</DropdownMenuItem>}
              {!showButtonInBar('indent') && (
                <>
                  <DropdownMenuItem onClick={() => execCommand('outdent')}><Outdent className="h-3.5 w-3.5 mr-2" /> Decrease indent</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => execCommand('indent')}><Indent className="h-3.5 w-3.5 mr-2" /> Increase indent</DropdownMenuItem>
                </>
              )}

              {/* Alignment group */}
              {!showButtonInBar('alignLeft') && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground">Alignment</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => execCommand('justifyLeft')}><AlignLeft className="h-3.5 w-3.5 mr-2" /> Align left</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => execCommand('justifyCenter')}><AlignCenter className="h-3.5 w-3.5 mr-2" /> Align center</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => execCommand('justifyRight')}><AlignRight className="h-3.5 w-3.5 mr-2" /> Align right</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => execCommand('justifyFull')}><AlignJustify className="h-3.5 w-3.5 mr-2" /> Justify</DropdownMenuItem>
                </>
              )}

              {/* Insert group */}
              {(!showButtonInBar('link') || !showButtonInBar('table') || !showButtonInBar('find')) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground">Insert</DropdownMenuLabel>
                </>
              )}
              {!showButtonInBar('link') && <DropdownMenuItem onClick={handleInsertLink}><Link2 className="h-3.5 w-3.5 mr-2" /> Insert link</DropdownMenuItem>}
              {!showButtonInBar('link') && <DropdownMenuItem onClick={() => execCommand('insertHorizontalRule')}><Minus className="h-3.5 w-3.5 mr-2" /> Horizontal rule</DropdownMenuItem>}
              {!showButtonInBar('table') && <DropdownMenuItem onClick={() => insertTable(3, 3)}><TableIcon className="h-3.5 w-3.5 mr-2" /> Insert table (3×3)</DropdownMenuItem>}
              {!showButtonInBar('find') && <DropdownMenuItem onClick={() => setFindReplaceMode(findReplaceMode ? null : 'find')}><Search className="h-3.5 w-3.5 mr-2" /> Find & replace</DropdownMenuItem>}
              {!showButtonInBar('fontSize') && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground">Typography</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => { handleFontSizeChange([14]); applyFontSizeToSelection(); }}><Type className="h-3.5 w-3.5 mr-2" /> Font size 14px</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {showButtonInBar('textColor') && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Text Color"
              aria-label="Text color"
              className={toolbarIconClass}
            >
              <Palette className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-3 gap-1" role="group" aria-label="Text colors">
              {textColors.map((color) => (
                <button
                  key={color.name}
                  onClick={() => {
                    if (color.value) {
                      execCommand('foreColor', color.value);
                    } else {
                      execCommand('removeFormat');
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors",
                    !color.value && "border border-dashed border-muted-foreground/30"
                  )}
                  title={color.name}
                  aria-label={`Text color ${color.name}`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: color.value || 'transparent' }}
                    aria-hidden="true"
                  />
                  <span className="text-foreground">{color.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        )}

        {showButtonInBar('highlight') && (
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" title="Highlight Color" aria-label="Highlight color" className={toolbarIconClass}>
              <Highlighter className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-4 gap-1" role="group" aria-label="Highlight colors">
              {highlightColors.map((color) => (
                <button
                  key={color.name}
                  onClick={() => { if (color.value) execCommand('hiliteColor', color.value); else execCommand('hiliteColor', 'transparent'); }}
                  className={cn("flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors", !color.value && "border border-dashed border-muted-foreground/30")}
                  title={color.name}
                  aria-label={`Highlight ${color.name}`}
                >
                  <span className="w-4 h-4 rounded border border-border" style={{ backgroundColor: color.value || 'transparent' }} aria-hidden="true" />
                  <span className="text-foreground">{color.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        )}
        {(showButtonInBar('textColor') || showButtonInBar('highlight')) && <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />}

        {showButtonInBar('link') && (
          <Button type="button" variant="ghost" size="sm" onClick={handleInsertLink} title="Insert Link (Ctrl+K)" aria-label="Insert link (Ctrl+K)" className={toolbarIconClass}>
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {showButtonInBar('hr') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => execCommand('insertHorizontalRule')} title="Horizontal Rule" aria-label="Insert horizontal rule" className={toolbarIconClass}>
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {showButtonInBar('table') && (
        <Popover open={showTablePicker} onOpenChange={setShowTablePicker}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" title="Insert Table" aria-label="Insert table" aria-haspopup="true" className={toolbarIconClass}>
              <TableIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="text-xs text-muted-foreground mb-1" aria-live="polite" aria-atomic="true">
              {tableHover.rows > 0 ? `${tableHover.rows} × ${tableHover.cols}` : "Select size"}
            </div>
            <div className="grid gap-0.5" style={{ gridTemplateColumns: "repeat(6, 1fr)" }} role="grid" aria-label="Table size picker">
              {Array.from({ length: 6 }, (_, r) =>
                Array.from({ length: 6 }, (_, c) => (
                  <button
                    key={`${r}-${c}`}
                    aria-label={`${r + 1} rows by ${c + 1} columns`}
                    className={cn("w-5 h-5 border border-border rounded-[2px] transition-colors", r < tableHover.rows && c < tableHover.cols ? "bg-primary/30 border-primary/50" : "bg-muted/30 hover:bg-muted/60")}
                    onMouseEnter={() => setTableHover({ rows: r + 1, cols: c + 1 })}
                    onMouseLeave={() => setTableHover({ rows: 0, cols: 0 })}
                    onClick={() => insertTable(r + 1, c + 1)}
                  />
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
        )}

        {showButtonInBar('find') && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFindReplaceMode(findReplaceMode ? null : "find")}
            title="Find & Replace (Ctrl+F)"
            aria-label="Find and replace (Ctrl+F)"
            aria-pressed={!!findReplaceMode}
            className={toolbarIconClass}
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {showButtonInBar('find') && <div className="w-px h-5 bg-border mx-1" />}

        {showButtonInBar('fontSize') && (
        <div className="flex items-center gap-2">
          <Type className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <select
            value={fontSizeRef.current}
            onChange={(e) => handleFontSizeChange([parseInt(e.target.value)])}
            className="h-[44px] px-2 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            title="Font size"
            aria-label="Font size"
          >
            {[14, 15, 16, 18, 20, 22, 24].map((size) => (
              <option key={size} value={size}>{size}px</option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={applyFontSizeToSelection} title="Apply size to selection" className="h-[44px] text-xs px-3">
            Apply
          </Button>
        </div>
        )}
        {(() => {
          const editorTools = (
            <>
              <DocumentImport
                onImport={(content) => {
                  if (editorRef.current) {
                    const safeContent = sanitizeHtml(content);
                    const importedContent = effectiveChangeTracking?.enabled
                      ? sanitizeHtml(effectiveChangeTracking.wrapHtmlWithMarkup?.(safeContent)
                        ?? effectiveChangeTracking.wrapWithMarkup(content))
                      : safeContent;
                    const newContent = sanitizeHtml(editorRef.current.innerHTML
                      ? `${editorRef.current.innerHTML}<br/><br/>${importedContent}`
                      : importedContent);
                    editorRef.current.innerHTML = newContent;
                    isInternalUpdate.current = true;
                    onChange(newContent);
                  }
                }}
              />
              <UnifiedAIDropdown
                getSelectedText={() => {
                  const selection = window.getSelection();
                  if (!selection || selection.isCollapsed || !editorRef.current?.contains(selection.anchorNode)) {
                    return null;
                  }
                  return selection.toString();
                }}
                replaceSelectedText={(newText) => {
                  const selection = window.getSelection();
                  if (!selection || selection.rangeCount === 0 || !editorRef.current?.contains(selection.anchorNode)) {
                    return;
                  }
                  const range = selection.getRangeAt(0);
                  range.deleteContents();

                  let content: Node;
                  if (effectiveChangeTracking?.enabled) {
                    const markedHtml = sanitizeHtml(effectiveChangeTracking.wrapWithMarkup(newText));
                    const temp = document.createElement('div');
                    temp.innerHTML = markedHtml;
                    content = document.createDocumentFragment();
                    while (temp.firstChild) {
                      content.appendChild(temp.firstChild);
                    }
                  } else {
                    content = document.createTextNode(newText);
                  }

                  range.insertNode(content);
                  range.collapse(false);
                  selection.removeAllRanges();
                  selection.addRange(range);

                  isInternalUpdate.current = true;
                  onChange(editorRef.current!.innerHTML);
                }}
                getDocumentText={() => editorRef.current?.innerText ?? null}
                onDraftNoteGenerated={(draft) => {
                  if (!editorRef.current) return;
                  const isEmpty = editorRef.current.innerText.trim() === "";
                  const separator = isEmpty ? "" : "<br/><br/>";
                  const safeDraft = sanitizeHtml(draft);
                  const sanitizedDraft = effectiveChangeTracking?.enabled
                    ? sanitizeHtml(effectiveChangeTracking.wrapHtmlWithMarkup?.(safeDraft)
                      ?? effectiveChangeTracking.wrapWithMarkup(draft))
                    : safeDraft;
                  const newContent = sanitizeHtml(isEmpty
                    ? sanitizedDraft
                    : `${editorRef.current.innerHTML}${separator}${sanitizedDraft}`);
                  editorRef.current.innerHTML = newContent;
                  isInternalUpdate.current = true;
                  onChange(newContent);
                }}
                patient={patient}
              />
              <DictationButton
                onTranscript={handleDictationTranscript}
                size="sm"
              />
              <PhrasePicker
                phrases={phrases}
                folders={folders}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Insert clinical phrase from your library"
                    aria-label="Insert clinical phrase from library"
                    className="h-[44px] px-3 gap-1"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    <span className="text-xs">Phrases</span>
                  </Button>
                }
                onSelect={selectPhrase}
                context={{ section }}
              />
              {changeTracking?.enabled && (
                <Button
                  type="button"
                  variant={localMarkingDisabled ? "outline" : "ghost"}
                  size="sm"
                  onClick={() => setLocalMarkingDisabled(!localMarkingDisabled)}
                  title={localMarkingDisabled ? "Enable marking for this field" : "Disable marking for this field"}
                  className={cn(
                    "h-[44px] px-3 gap-1",
                    !localMarkingDisabled && "text-orange-600 hover:text-orange-700",
                    localMarkingDisabled && "text-muted-foreground"
                  )}
                >
                  <Highlighter className="h-3.5 w-3.5" aria-hidden />
                  <span className="text-xs">
                    {localMarkingDisabled ? "Marking off" : "Marking on"}
                  </span>
                </Button>
              )}
            </>
          );

          return (
            <div className="ml-auto flex items-center gap-2">
              {isTablet ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(toolbarIconClass, "gap-1 px-2 min-w-[2.75rem]")}
                      aria-label="AI, phrases, and insert tools"
                      title="Editor tools"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                      <span className="text-xs">Tools</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 space-y-2 p-3">
                    <p className="text-xs font-medium text-muted-foreground">AI & insert</p>
                    <div className="flex flex-col gap-2 items-stretch">
                      {editorTools}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                      Autotexts expand as you type
                    </p>
                  </PopoverContent>
                </Popover>
              ) : (
                <>
                  {editorTools}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden sm:inline">Autotexts</span>
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>
    </>
  ) : null;

  return (
    <>
      {isPoppedOut && popOutAvailable && !isPopOutInstance && (
        <>
          <Dialog open={isPoppedOut} onOpenChange={(open) => !open && setIsPoppedOut(false)}>
            <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
              <DialogHeader className="p-3 border-b shrink-0">
                <DialogTitle>Focus mode</DialogTitle>
                <DialogDescription>
                  Expanded editor for the current note field. Close to return to the chart layout.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-[60vh] overflow-hidden flex flex-col p-3">
                <RichTextEditor
                  value={value}
                  onChange={onChange}
                  placeholder={placeholder}
                  className="border-0 shadow-none"
                  minHeight={minHeight}
                  autotexts={autotexts}
                  fontSize={fontSize}
                  changeTracking={changeTracking}
                  patient={patient}
                  section={section}
                  isPopOutInstance
                  popOutAvailable={false}
                />
              </div>
            </DialogContent>
          </Dialog>
          <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Editing in expanded view</span>
            <Button variant="outline" size="sm" onClick={() => setIsPoppedOut(false)}>
              <Minimize2 className="h-3.5 w-3.5 mr-1" />
              Return to card
            </Button>
          </div>
        </>
      )}
      {(isPopOutInstance || !isPoppedOut) && (
    <div
      ref={containerRef}
      className={cn("border border-border/50 rounded-lg bg-card relative h-auto shadow-card", className)}
      onFocusCapture={() => setIsEditorFocused(true)}
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && containerRef.current?.contains(next)) return;
        window.requestAnimationFrame(() => {
          const active = document.activeElement;
          if (active instanceof HTMLElement) {
            if (containerRef.current?.contains(active)) return;
            if (active.closest('[data-radix-popper-content-wrapper], [role="dialog"], [role="menu"]')) return;
          }
          setIsEditorFocused(false);
        });
      }}
    >
      {toolbarContent}
      {/* Editor area (larger default min-height; pop-out instance uses min-h-[55vh]) */}
      {editorArea}

      {/* Autocomplete dropdown */}
      {showAutocomplete && autocompleteOptions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Autotext suggestions"
          className="absolute z-50 bg-popover border border-border rounded-lg shadow-modal overflow-hidden list-none m-0 p-0"
          style={{ top: autocompletePosition.top, left: autocompletePosition.left, minWidth: 200 }}
        >
          {autocompleteOptions.map((option, index) => (
            <li
              key={option.shortcut}
              role="option"
              aria-selected={index === selectedIndex}
              id={`autotext-option-${index}`}
              className={cn(
                "px-3 py-2 cursor-pointer text-sm flex items-center gap-2",
                index === selectedIndex ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                replaceCurrentWord(option.expansion);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="font-mono text-xs bg-muted/50 px-1 rounded">{option.shortcut}</span>
              <span className="truncate">{option.expansion}</span>
            </li>
          ))}
          <li className="px-3 py-1 text-xs text-muted-foreground border-t bg-muted/30" aria-hidden="true">
            Tab/Enter to insert • Esc to close
          </li>
        </ul>
      )}

      {/* Phrase Form Dialog */}
      {selectedPhrase && (
        <PhraseFormDialog
          phrase={selectedPhrase}
          fields={phraseFields}
          patient={patient}
          open={showForm}
          onOpenChange={(open) => !open && closeForm()}
          onInsert={handleFormInsert}
          onLogUsage={handleLogUsage}
        />
      )}
    </div>
      )}
    </>
  );
};
