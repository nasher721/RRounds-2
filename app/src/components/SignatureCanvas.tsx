import React from "react";
import { useStylus } from "@/hooks/useStylus";
import { cn } from "@/lib/utils";

export interface SignatureCanvasProps {
  width?: number;
  height?: number;
  className?: string;
  onConfirm?: (blob: Blob) => void;
  onCancel?: () => void;
}

export function SignatureCanvas({
  width = 400,
  height = 200,
  className,
  onConfirm,
  onCancel,
}: SignatureCanvasProps) {
  const {
    canvasRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    clear,
    exportBlob,
  } = useStylus({
    tool: "pen",
    color: "#000000",
    baseWidth: 3,
    palmRejection: true,
  });

  const handleConfirm = async () => {
    const blob = await exportBlob();
    if (blob && onConfirm) {
      onConfirm(blob);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Sign below:</span>
        <button
          type="button"
          className="px-2 py-1 text-xs rounded border bg-background hover:bg-muted"
          onClick={clear}
        >
          Clear
        </button>
      </div>

      <div className="border rounded bg-white">
        {/* Signature line */}
        <div
          className="absolute left-8 right-8 border-b border-gray-400"
          style={{ bottom: "40px" }}
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

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="px-4 py-2 text-sm rounded border bg-background hover:bg-muted"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={handleConfirm}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
