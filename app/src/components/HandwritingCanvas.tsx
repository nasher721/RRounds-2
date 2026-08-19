import React, { useState, useEffect, useCallback } from "react";
import { useStylus, StylusTool } from "@/hooks/useStylus";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeStorage";

export interface HandwritingCanvasProps {
  width?: number;
  height?: number;
  className?: string;
  noteId?: string;
  onAutoSave?: (data: string) => void;
  onExportPNG?: (dataURL: string) => void;
}

const TOOLS: { id: StylusTool; label: string; icon: string }[] = [
  { id: "pen", label: "Pen", icon: "✏️" },
  { id: "highlighter", label: "Highlighter", icon: "🖍️" },
  { id: "pencil", label: "Pencil", icon: "📝" },
  { id: "eraser", label: "Eraser", icon: "🧹" },
];

const COLORS = [
  { name: "Black", value: "#000000" },
  { name: "Blue", value: "#0000FF" },
  { name: "Red", value: "#FF0000" },
  { name: "Green", value: "#008000" },
];

export function HandwritingCanvas({
  width = 800,
  height = 600,
  className,
  noteId = "handwriting-note",
  onAutoSave,
  onExportPNG,
}: HandwritingCanvasProps) {
  const [noteContent, setNoteContent] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    canvasRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    exportPNG,
    config,
    setConfig,
  } = useStylus({
    tool: "pen",
    color: "#000000",
    baseWidth: 3,
    palmRejection: true,
  });

  // Auto-save to localStorage
  const saveToLocalStorage = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const dataURL = exportPNG();
      if (dataURL) {
        safeLocalStorage.setItem(`handwriting-${noteId}`, dataURL);
        setLastSaved(new Date());
        if (onAutoSave) onAutoSave(dataURL);
      }
    } finally {
      setIsSaving(false);
    }
  }, [exportPNG, noteId, onAutoSave, isSaving]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = safeLocalStorage.getItem(`handwriting-${noteId}`);
    if (saved && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
        };
        img.src = saved;
      }
    }
  }, [noteId, canvasRef]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(saveToLocalStorage, 30000);
    return () => clearInterval(interval);
  }, [saveToLocalStorage]);

  // Save on unmount
  useEffect(() => {
    return () => {
      saveToLocalStorage();
    };
  }, [saveToLocalStorage]);

  const handleExportPNG = () => {
    const dataURL = exportPNG();
    if (dataURL && onExportPNG) onExportPNG(dataURL);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-muted rounded-t">
        {/* Tool Selection */}
        <div className="flex gap-1">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={cn(
                "px-2 py-1 text-xs rounded border",
                config.tool === tool.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              )}
              onClick={() => setConfig({ tool: tool.id })}
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Color Selection */}
        <div className="flex gap-1">
          {COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              className={cn(
                "w-6 h-6 rounded-full border-2",
                config.color === color.value ? "border-foreground" : "border-transparent"
              )}
              style={{ backgroundColor: color.value }}
              onClick={() => setConfig({ color: color.value })}
              title={color.name}
            />
          ))}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Width Control */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Width:</label>
          <input
            type="range"
            min={1}
            max={20}
            value={config.baseWidth}
            onChange={(e) => setConfig({ baseWidth: Number(e.target.value) })}
            className="w-20"
          />
          <span className="text-xs font-medium">{config.baseWidth}px</span>
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Undo/Redo/Clear */}
        <div className="flex gap-1">
          <button
            type="button"
            className="px-2 py-1 text-xs rounded border bg-background hover:bg-muted disabled:opacity-50"
            onClick={undo}
            disabled={!canUndo}
          >
            Undo
          </button>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded border bg-background hover:bg-muted disabled:opacity-50"
            onClick={redo}
            disabled={!canRedo}
          >
            Redo
          </button>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded border bg-background hover:bg-muted"
            onClick={clear}
          >
            Clear
          </button>
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Export */}
        <div className="flex gap-1">
          <button
            type="button"
            className="px-2 py-1 text-xs rounded border bg-background hover:bg-muted"
            onClick={handleExportPNG}
          >
            Export PNG
          </button>
        </div>

        {/* Save Status */}
        <div className="ml-auto text-xs text-muted-foreground">
          {isSaving ? (
            <span>Saving...</span>
          ) : lastSaved ? (
            <span>Saved {lastSaved.toLocaleTimeString()}</span>
          ) : null}
        </div>
      </div>

      {/* Canvas Area with Ruled Lines */}
      <div className="relative border rounded-b bg-white">
        {/* Ruled Lines Background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(to bottom, transparent 0px, transparent 23px, #ccc 23px, #ccc 24px)
            `,
            backgroundSize: "100% 24px",
          }}
        />

        {/* Left Margin Line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-red-300 opacity-50"
          style={{ left: "60px" }}
        />

        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="relative z-10 touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        />
      </div>

      {/* Text Notes Area */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Additional Notes:</label>
        <textarea
          className="p-2 border rounded resize-none"
          rows={3}
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="Type additional notes here..."
        />
      </div>
    </div>
  );
}
