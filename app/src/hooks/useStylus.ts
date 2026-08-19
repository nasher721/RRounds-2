import { useRef, useCallback, useState, useEffect } from "react";

export type StylusTool = "pen" | "highlighter" | "pencil" | "eraser";

export interface StylusPoint {
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  timestamp: number;
}

export interface StylusConfig {
  baseWidth: number;
  color: string;
  tool: StylusTool;
  palmRejection: boolean;
}

const DEFAULT_CONFIG: StylusConfig = {
  baseWidth: 3,
  color: "#000000",
  tool: "pen",
  palmRejection: true,
};

interface UseStylusReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  handlePointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerLeave: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
  exportPNG: () => string | null;
  exportSVG: () => string | null;
  exportBlob: () => Promise<Blob | null>;
  config: StylusConfig;
  setConfig: (config: Partial<StylusConfig>) => void;
  historySize: number;
  redoSize: number;
  points: StylusPoint[];
}

export function useStylus(initialConfig?: Partial<StylusConfig>): UseStylusReturn {
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const [config, setConfigState] = useState<StylusConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });

  const historyRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<StylusPoint | null>(null);
  const pointsRef = useRef<StylusPoint[]>([]);
  const [historySize, setHistorySize] = useState(0);
  const [redoSize, setRedoSize] = useState(0);
  const [points, setPoints] = useState<StylusPoint[]>([]);

  const setConfig = useCallback((partial: Partial<StylusConfig>) => {
    setConfigState((prev) => ({ ...prev, ...partial }));
  }, []);

  const getCanvasPoint = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): StylusPoint => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0, pressure: 0.5, tiltX: 0, tiltY: 0, timestamp: Date.now() };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        pressure: e.pressure,
        tiltX: e.tiltX,
        tiltY: e.tiltY,
        timestamp: Date.now(),
      };
    },
    []
  );

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current.push(snapshot);
    redoRef.current = [];
    setHistorySize(historyRef.current.length);
    setRedoSize(0);
  }, []);

  const restoreSnapshot = useCallback((snapshot: ImageData | null) => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(snapshot, 0, 0);
  }, []);

  const getStrokeWidth = useCallback(
    (pressure: number, tool: StylusTool): number => {
      const base = config.baseWidth;
      switch (tool) {
        case "pen":
          return base * Math.pow(pressure, 0.5);
        case "highlighter":
          return base * 3 * Math.pow(pressure, 0.3);
        case "pencil":
          return base * 0.7 * Math.pow(pressure, 0.8);
        case "eraser":
          return base * 2 * Math.pow(pressure, 0.5);
        default:
          return base;
      }
    },
    [config.baseWidth]
  );

  const getStrokeOpacity = useCallback((tool: StylusTool): number => {
    switch (tool) {
      case "highlighter":
        return 0.3;
      case "pencil":
        return 0.6;
      default:
        return 1;
    }
  }, []);

  const drawStrokeSegment = useCallback(
    (ctx: CanvasRenderingContext2D, from: StylusPoint, to: StylusPoint, tool: StylusTool, color: string) => {
      const avgPressure = (from.pressure + to.pressure) / 2;
      const width = getStrokeWidth(avgPressure, tool);
      const opacity = getStrokeOpacity(tool);

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = width;
      ctx.globalAlpha = opacity;

      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
      }

      // Tilt-based shading for pencil tool
      if (tool === "pencil" && (Math.abs(to.tiltX) > 0 || Math.abs(to.tiltY) > 0)) {
        const tiltEffect = Math.sqrt(to.tiltX * to.tiltX + to.tiltY * to.tiltY) / 90;
        ctx.globalAlpha = opacity * (0.4 + 0.6 * (1 - tiltEffect));
      }

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    },
    [getStrokeWidth, getStrokeOpacity]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Palm rejection: ignore non-pen events when pen is active
      if (config.palmRejection && e.pointerType !== "pen" && isDrawingRef.current) {
        return;
      }

      canvas.setPointerCapture(e.pointerId);
      const point = getCanvasPoint(e);
      isDrawingRef.current = true;
      lastPointRef.current = point;
      pointsRef.current = [point];

      // Save snapshot for undo
      pushHistory();

      // Start path
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    },
    [config.palmRejection, getCanvasPoint, pushHistory]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const point = getCanvasPoint(e);
      const lastPoint = lastPointRef.current;
      if (lastPoint) {
        drawStrokeSegment(ctx, lastPoint, point, config.tool, config.color);
      }

      lastPointRef.current = point;
      pointsRef.current.push(point);
    },
    [getCanvasPoint, drawStrokeSegment, config.tool, config.color]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      lastPointRef.current = null;
      setPoints([...pointsRef.current]);
      pointsRef.current = [];
    },
    []
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      handlePointerUp(e);
    },
    [handlePointerUp]
  );

  const undo = useCallback(() => {
    if (historyRef.current.length <= 1) return;
    const current = historyRef.current.pop();
    if (current) {
      redoRef.current.push(current);
    }
    const prev = historyRef.current[historyRef.current.length - 1];
    restoreSnapshot(prev);
    setHistorySize(historyRef.current.length);
    setRedoSize(redoRef.current.length);
  }, [restoreSnapshot]);

  const redo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const next = redoRef.current.pop();
    if (next) {
      historyRef.current.push(next);
      restoreSnapshot(next);
    }
    setHistorySize(historyRef.current.length);
    setRedoSize(redoRef.current.length);
  }, [restoreSnapshot]);

  const canUndo = historySize > 1;
  const canRedo = redoSize > 0;

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    pushHistory();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [pushHistory]);

  const exportPNG = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL("image/png");
  }, []);

  const exportSVG = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dataURL = canvas.toDataURL("image/png");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
      <image href="${dataURL}" width="${canvas.width}" height="${canvas.height}"/>
    </svg>`;
  }, []);

  const exportBlob = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }, []);

  // Initialize canvas with white background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (historyRef.current.length === 0) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      pushHistory();
    }
  }, [pushHistory]);

  return {
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
    historySize,
    redoSize,
    points,
  };
}
