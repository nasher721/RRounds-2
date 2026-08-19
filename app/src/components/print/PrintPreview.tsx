import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PrintSettings, PrintDataProps } from "@/lib/print/types";
import { PrintDocument } from "./PrintDocument";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Table2,
  LayoutGrid,
  List,
  Columns2,
  FileText,
} from "lucide-react";

interface PrintPreviewProps extends PrintDataProps {
  settings: PrintSettings;
}

const ZOOM_LEVELS = [
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "100%" },
  { value: 125, label: "125%" },
  { value: 150, label: "150%" },
  { value: 200, label: "200%" },
];

export function PrintPreview({ 
  patients, 
  patientTodos, 
  patientNotes, 
  patientImageOwnerId,
  patientImageSignedUrls,
  settings,
}: PrintPreviewProps) {
  const prefersReducedMotion = useReducedMotion();
  const [zoom, setZoom] = React.useState(100);
  const [fitToWidth, setFitToWidth] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [mounted, setMounted] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Defer CSS transition until after mount to avoid an initial-render flash
  React.useEffect(() => { setMounted(true); }, []);

  // Paged preview: when onePatientPerPage is true, each patient gets their own page
  // When false, show ALL patients in a single scrollable preview (no pagination)
  //
  // The rounds document lays out its own sheets, so it is previewed whole —
  // slicing it here would hide the page breaks the format exists to produce.
  const isRounds = settings.activeTab === 'rounds';
  const isPaginated = !isRounds && settings.onePatientPerPage;

  const twoColumnRounds = isRounds && settings.rounds?.variant === 'twoColumn';
  const FormatIcon = isRounds ? (twoColumnRounds ? Columns2 : FileText)
    : settings.activeTab === 'cards' ? LayoutGrid
    : settings.activeTab === 'list' ? List
    : Table2;
  const formatLabel = isRounds
    ? `Rounds · ${twoColumnRounds ? 'two column' : 'single column'}`
    : settings.activeTab === 'cards' ? 'Cards'
    : settings.activeTab === 'list' ? 'List'
    : 'Table';
  const totalPages = isPaginated ? patients.length : 1;
  const patientsPerPage = isPaginated ? 1 : patients.length;

  React.useEffect(() => {
    if (isPaginated) {
      setCurrentPage((p) => Math.min(Math.max(1, p), totalPages));
    }
  }, [totalPages, isPaginated]);

  // When paginated, show one patient per page. Otherwise, show all patients.
  const previewPatients = React.useMemo(() => {
    if (!isPaginated) {
      return patients;
    }
    const start = (currentPage - 1) * patientsPerPage;
    return patients.slice(start, start + patientsPerPage);
  }, [patients, currentPage, patientsPerPage, isPaginated]);

  const handleZoomIn = React.useCallback(() => {
    setZoom((prev) => Math.min(200, prev + 25));
  }, []);

  const handleZoomOut = React.useCallback(() => {
    setZoom((prev) => Math.max(50, prev - 25));
  }, []);

  const handleResetZoom = React.useCallback(() => {
    setZoom(100);
  }, []);

  const handleFitToWidth = React.useCallback(() => {
    setFitToWidth((prev) => !prev);
  }, []);

  const handleFullscreen = React.useCallback(() => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, [isFullscreen]);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "+" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === "0" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleResetZoom();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleResetZoom]);

  // Compute the actual scale to apply
  const effectiveScale = fitToWidth ? 100 : zoom;

  return (
    <motion.div
      ref={containerRef}
      initial={!prefersReducedMotion ? { opacity: 0, y: 8 } : {}}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "bg-background border border-border/50 rounded-xl shadow-lg h-full min-h-0 flex flex-col overflow-hidden",
        isFullscreen && "fixed inset-0 z-50 rounded-none shadow-none"
      )}
    >
      {/* Preview Toolbar — single scroll row on narrow screens so controls stay reachable */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-muted/30 border-b border-border/30 shrink-0 overflow-x-auto overflow-y-hidden min-h-[48px] [scrollbar-width:thin]">
        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50 || fitToWidth}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom Out (Ctrl+-)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Select
            value={zoom.toString()}
            onValueChange={(v) => setZoom(parseInt(v))}
            disabled={fitToWidth}
          >
            <SelectTrigger className="w-[80px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ZOOM_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value.toString()} className="text-xs">
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200 || fitToWidth}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom In (Ctrl++)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleResetZoom}
                  aria-label="Reset zoom"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset Zoom (Ctrl+0)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Fit-to-Width Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={fitToWidth ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleFitToWidth}
                  aria-label={fitToWidth ? "Exit fit to width" : "Fit to width"}
                >
                  {fitToWidth ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{fitToWidth ? "Exit Fit to Width" : "Fit to Width"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Active format — chosen in the sidebar, echoed here for orientation */}
        <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 whitespace-nowrap">
          <FormatIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="text-xs font-medium">{formatLabel}</span>
        </div>

        {/* Page Navigation (only when onePatientPerPage is true) */}
        {isPaginated && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[60px] text-center">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Fullscreen Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleFullscreen}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Settings Summary */}
        <div className="text-xs text-muted-foreground hidden sm:block whitespace-nowrap">
          {isRounds
            ? `${settings.rounds?.pageSize ?? 'letter'}, ${settings.rounds?.orientation ?? 'portrait'}, ${settings.rounds?.bodyPt ?? 9}pt`
            : `${settings.printOrientation}, ${settings.printFontSize}pt`}
        </div>
      </div>

      {/* Preview Content — min-h-0 so flex + ScrollArea can shrink and scroll */}
      <ScrollArea className="flex-1 min-h-0 p-4 md:p-6">
        <div
          className={cn(
            "mx-auto origin-top",
            mounted && "transition-transform duration-200 ease-out"
          )}
          style={{ 
            transform: `scale(${effectiveScale / 100})`, 
            transformOrigin: "top center", 
            willChange: "transform",
            width: fitToWidth ? "100%" : undefined
          }}
        >
          <PrintDocument
            patients={previewPatients}
            patientTodos={patientTodos}
            patientNotes={patientNotes}
            patientImageOwnerId={patientImageOwnerId}
            patientImageSignedUrls={patientImageSignedUrls}
            settings={settings}
            preview
            className={cn(!isRounds && "shadow-xl rounded-sm")}
            documentId="preview"
          />
        </div>
      </ScrollArea>
    </motion.div>
  );
}
