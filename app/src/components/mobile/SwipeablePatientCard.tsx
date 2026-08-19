import { useState, useRef, useCallback } from "react";
import { Patient } from "@/types/patient";
import { ChevronRight, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { DOCUMENTATION_STATUS_LABELS, getPatientDocumentationSummary } from "@/lib/patientDocumentation";

interface SwipeablePatientCardProps {
  patient: Patient;
  onSelect: (patient: Patient) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  index: number;
  compact?: boolean;
}

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 160;

export const SwipeablePatientCard = ({
  patient,
  onSelect,
  onDelete,
  onDuplicate,
  index,
  compact = false,
}: SwipeablePatientCardProps) => {
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = translateX;
    isDraggingRef.current = true;
  }, [translateX, isAnimating]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.touches[0].clientX - startXRef.current;
    let newTranslateX = currentXRef.current + deltaX;

    if (newTranslateX > 0) {
      newTranslateX = newTranslateX * 0.3;
    } else if (newTranslateX < -MAX_SWIPE) {
      newTranslateX = -MAX_SWIPE - (Math.abs(newTranslateX + MAX_SWIPE) * 0.3);
    }

    setTranslateX(newTranslateX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsAnimating(true);

    if (translateX < -SWIPE_THRESHOLD) {
      setTranslateX(-MAX_SWIPE);
    } else {
      setTranslateX(0);
    }

    setTimeout(() => setIsAnimating(false), 300);
  }, [translateX]);

  const handleActionClick = (action: "delete" | "duplicate") => {
    setIsAnimating(true);
    setTranslateX(0);

    setTimeout(() => {
      setIsAnimating(false);
      if (action === "delete") {
        onDelete(patient.id);
      } else {
        onDuplicate(patient.id);
      }
    }, 300);
  };

  const handleCardActivate = () => {
    if (translateX < -10) {
      setIsAnimating(true);
      setTranslateX(0);
      setTimeout(() => setIsAnimating(false), 300);
      return;
    }
    onSelect(patient);
  };

  const actionOpacity = Math.min(1, Math.abs(translateX) / SWIPE_THRESHOLD);
  const lastUpdatedLabel = new Date(patient.lastModified).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const documentation = getPatientDocumentationSummary(patient);
  const accessibleName = [
    patient.name || "Unnamed Patient",
    patient.bed ? `Bed ${patient.bed}` : null,
    DOCUMENTATION_STATUS_LABELS[documentation.status],
    `Updated ${lastUpdatedLabel}`,
  ].filter(Boolean).join(", ");

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden animate-fade-in"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: MAX_SWIPE }}
      >
        <button
          type="button"
          onClick={() => handleActionClick("duplicate")}
          className="flex-1 flex min-h-11 items-center justify-center bg-primary text-primary-foreground transition-opacity"
          style={{ opacity: actionOpacity }}
          aria-label={`Duplicate ${patient.name || "patient"}`}
        >
          <Copy className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => handleActionClick("delete")}
          className="flex-1 flex min-h-11 items-center justify-center bg-destructive text-destructive-foreground transition-opacity"
          style={{ opacity: actionOpacity }}
          aria-label={`Delete ${patient.name || "patient"}`}
        >
          <Trash2 className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <button
        type="button"
        className={cn(
          "relative w-full bg-background flex items-center gap-3 px-4 text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          compact ? "py-2.5 min-h-14" : "py-3.5 min-h-16",
          isAnimating && "transition-transform duration-300 ease-out"
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardActivate}
        aria-label={`Open patient ${accessibleName}`}
      >
        <div className={cn(
          "rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0 border border-primary/10",
          compact ? "h-8 w-8" : "h-10 w-10",
        )} aria-hidden>
          <span className={cn("font-semibold text-primary", compact ? "text-xs" : "text-sm")}>
            {patient.name ? patient.name.charAt(0).toUpperCase() : '#'}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn("font-semibold truncate", compact ? "text-[13px]" : "text-[15px]")}>
              {patient.name || "Unnamed Patient"}
            </span>
            {patient.bed && (
              <span className="text-xs text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
                {patient.bed}
              </span>
            )}
          </div>
          <div className={cn("flex items-center gap-2 text-muted-foreground", compact ? "text-xs" : "text-xs")}>
            {patient.clinicalSummary ? (
              <span className="truncate">
                {patient.clinicalSummary.replace(/<[^>]*>/g, "").slice(0, 50)}
              </span>
            ) : (
              <span className="italic">No summary</span>
            )}
          </div>
          <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", compact ? "mt-1" : "mt-1.5")}>
            <span>{DOCUMENTATION_STATUS_LABELS[documentation.status]}</span>
            <span aria-hidden="true">·</span>
            <span>{documentation.completed}/{documentation.total}</span>
            <span aria-hidden="true">·</span>
            <span>{lastUpdatedLabel}</span>
          </div>
        </div>

        <ChevronRight
          className="h-4 w-4 text-muted-foreground/50 flex-shrink-0 transition-opacity"
          style={{ opacity: 1 - actionOpacity }}
          aria-hidden
        />
      </button>
    </div>
  );
};
