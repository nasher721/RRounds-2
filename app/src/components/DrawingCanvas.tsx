import React from "react";
import { useStylus, StylusTool } from "@/hooks/useStylus";
import { cn } from "@/lib/utils";

export interface DrawingCanvasProps {
  width?: number;
  height?: number;
  className?: string;
  initialTool?: StylusTool;
  initialColor?: string;
  initialWidth?: number;
  palmRejection?: boolean;
  showToolbar?: boolean;
  onPointsChange?: (points: { x: number; y: number; pressure: number }[]) => void;
  onExportPNG?: (dataURL: string) => void;
  onExportSVG?: (svg: string) => void;
  onExportBlob?: (blob: Blob) => void;
}

const TOOLS: { id: StylusTool; label: string }[] = [
  { id: "pen", label: "Pen" },
  { id: "highlighter", label: "Highlighter" },
  { id: "pencil", label: "Pencil" },
  { id: "eraser", label: "Eraser" },
];

const COLORS = [
  { name: "Black", value: "#000000" },
  { name: "Blue", value: "#0000FF" },
  { name: "Red", value: "#FF0000" },
  { name: "Green", value: "#008000" },
  { name: "Purple", value: "#800080" },
];

export function DrawingCanvas({
  width = 800,
  height = 600,
  className,
  initialTool = "pen",
  initialColor = "#000000",
  initialWidth = 3,
  palmRejection = true,
  showToolbar = true,
  onPointsChange,
  onExportPNG,
  onExportSVG,
  onExportBlob,
}: DrawingCanvasProps) {
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
    exportSVG,
    exportBlob,
    config,
    setConfig,
    points,
  } = useStylus({
    tool: initialTool,
    color: initialColor,
    baseWidth: initialWidth,
    palmRejection,
  });

  React.useEffect(() => {
    if (onPointsChange && points.length > 0) {
      onPointsChange(points.map((p) => ({ x: p.x, y: p.y, pressure: p.pressure })));
    }
  }, [points, onPointsChange]);

  const handleExportPNG = () => {
    const dataURL = exportPNG();
    if (dataURL && onExportPNG) onExportPNG(dataURL);
  };

  const handleExportSVG = () => {
    const svg = exportSVG();
    if (svg && onExportSVG) onExportSVG(svg);
  };

  const handleExportBlob = async () => {
    const blob = await exportBlob();
    if (blob && onExportBlob) onExportBlob(blob);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2">
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
              >
                {tool.label}
              </button>
            ))}
          </div>

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

          <div className="flex gap-1">
            <button
              type="button"
              className="px-2 py-1 text-xs rounded border bg-background hover:bg-muted"
              onClick={handleExportPNG}
            >
              PNG
            </button>
            <button
              type="button"
              className="px-2 py-1 text-xs rounded border bg-background hover:bg-muted"
              onClick={handleExportSVG}
            >
              SVG
            </button>
            <button
              type="button"
              className="px-2 py-1 text-xs rounded border bg-background hover:bg-muted"
              onClick={handleExportBlob}
            >
              Blob
            </button>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border rounded bg-white touch-none cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />
    </div>
  );
}
