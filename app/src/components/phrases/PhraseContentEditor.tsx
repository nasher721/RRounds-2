/**
 * Rich Text Editor for Phrase Content
 * Simplified version of RichTextEditor with formatting tools
 */

import { useRef, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Bold, Italic, Underline, List, ListOrdered,
  Indent, Outdent, Palette, Undo2, Redo2
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { sanitizeHtml, sanitizePastedHtml } from "@/lib/sanitize";

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

interface PhraseContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export const PhraseContentEditor = ({ 
  value, 
  onChange, 
  placeholder = "Enter phrase content...", 
  className,
  minHeight = "150px",
}: PhraseContentEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const [isFocused, setIsFocused] = useState(false);
  
  // Initialize content
  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current) {
      const sanitizedValue = sanitizeHtml(value);
      const currentContent = editorRef.current.innerHTML;
      if (currentContent !== sanitizedValue) {
        editorRef.current.innerHTML = sanitizedValue;
      }
    }
    isInternalUpdate.current = false;
  }, [value]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    // Trigger change after command
    if (editorRef.current) {
      const sanitizedValue = sanitizeHtml(editorRef.current.innerHTML);
      if (sanitizedValue !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = sanitizedValue;
      }
      isInternalUpdate.current = true;
      onChange(sanitizedValue);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const sanitizedValue = sanitizeHtml(editorRef.current.innerHTML);
      if (sanitizedValue !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = sanitizedValue;
      }
      isInternalUpdate.current = true;
      onChange(sanitizedValue);
    }
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    const sanitizedContent = sanitizePastedHtml(html, text);
    document.execCommand('insertHTML', false, sanitizedContent);
    if (editorRef.current) {
      const sanitizedValue = sanitizeHtml(editorRef.current.innerHTML);
      if (sanitizedValue !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = sanitizedValue;
      }
      isInternalUpdate.current = true;
      onChange(sanitizedValue);
    }
  }, [onChange]);

  return (
    <div className={cn("border-2 border-border rounded-md bg-card overflow-hidden relative", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/50 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('undo')}
          title="Undo (Ctrl+Z)"
          className="h-7 w-7 p-0"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('redo')}
          title="Redo (Ctrl+Y)"
          className="h-7 w-7 p-0"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('bold')}
          title="Bold (Ctrl+B)"
          className="h-7 w-7 p-0"
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('italic')}
          title="Italic (Ctrl+I)"
          className="h-7 w-7 p-0"
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('underline')}
          title="Underline (Ctrl+U)"
          className="h-7 w-7 p-0"
        >
          <Underline className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertUnorderedList')}
          title="Bullet List"
          className="h-7 w-7 p-0"
        >
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertOrderedList')}
          title="Numbered List"
          className="h-7 w-7 p-0"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('outdent')}
          title="Decrease Indent"
          className="h-7 w-7 p-0"
        >
          <Outdent className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('indent')}
          title="Increase Indent"
          className="h-7 w-7 p-0"
        >
          <Indent className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Text Color"
              className="h-7 w-7 p-0"
            >
              <Palette className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-3 gap-1">
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
                >
                  {color.value ? (
                    <div 
                      className="w-4 h-4 rounded-full border border-border" 
                      style={{ backgroundColor: color.value }}
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-dashed border-muted-foreground/50 flex items-center justify-center text-[8px]">
                      ✕
                    </div>
                  )}
                  <span>{color.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      {/* Editor Area with scroll container */}
      <div className="relative max-h-[300px] editor-scroll-container">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            "p-3 outline-none min-h-[80px] text-card-foreground",
            "prose prose-sm max-w-none",
            "[&_ul]:list-disc [&_ul]:ml-4",
            "[&_ol]:list-decimal [&_ol]:ml-4"
          )}
          style={{ 
            fontSize: '14px',
            lineHeight: '1.5',
            minHeight,
          }}
        />
        {!value && !isFocused && (
          <div 
            className="absolute top-3 left-3 text-muted-foreground pointer-events-none"
            style={{ fontSize: '14px' }}
          >
            {placeholder}
          </div>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground px-3 pb-2 pt-1 border-t border-border bg-muted/30">
        Use {'{{field_name}}'} for dynamic placeholders
      </p>
    </div>
  );
};
