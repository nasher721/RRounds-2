import * as React from "react";
import { List, ListImperativeAPI, RowComponentProps } from "react-window";
import { Patient } from "@/types/patient";
import { SwipeablePatientCard } from "./SwipeablePatientCard";
import { Button } from "@/components/ui/button";
import { ArrowUp, Hospital, Lightbulb, Search } from "lucide-react";

interface VirtualizedMobilePatientListProps {
  patients: Patient[];
  onPatientSelect: (patient: Patient) => void;
  onPatientDelete: (id: string) => void;
  onPatientDuplicate: (id: string) => void;
  searchQuery?: string;
  onAddPatient?: () => void;
  onOpenImport?: () => void;
  viewMode?: "rich" | "compact";
}

interface RowProps {
  patients: Patient[];
  onSelect: (patient: Patient) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  viewMode: "rich" | "compact";
}

const RICH_ROW_HEIGHT = 88;
const COMPACT_ROW_HEIGHT = 72;
const MOBILE_NAV_RESERVE = 96;
const MIN_LIST_HEIGHT = COMPACT_ROW_HEIGHT * 4;

// Row component for the virtualized list
const PatientRowComponent = ({
  index,
  style,
  ariaAttributes,
  patients,
  onSelect,
  onDelete,
  onDuplicate,
  viewMode,
}: RowComponentProps<RowProps>): React.ReactElement | null => {
  const patient = patients[index];

  if (!patient) return null;

  return (
    <div
      style={style}
      {...ariaAttributes}
      className="border-b border-border/30 overflow-hidden"
    >
      <SwipeablePatientCard
        patient={patient}
        onSelect={onSelect}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        index={index}
        compact={viewMode === "compact"}
      />
    </div>
  );
};

export const VirtualizedMobilePatientList = React.memo(({
  patients,
  onPatientSelect,
  onPatientDelete,
  onPatientDuplicate,
  searchQuery,
  onAddPatient,
  onOpenImport,
  viewMode = "rich",
}: VirtualizedMobilePatientListProps) => {
  const listRef = React.useRef<ListImperativeAPI>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = React.useState(400);
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const rowHeight = viewMode === "compact" ? COMPACT_ROW_HEIGHT : RICH_ROW_HEIGHT;
  const prefersReducedMotion = React.useCallback(() => {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);

  // Calculate container height based on viewport
  React.useLayoutEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const visibleRowsHeight = Math.min(rowHeight * patients.length, rowHeight * 8);
        const availableHeight = viewportHeight - rect.top - MOBILE_NAV_RESERVE;
        setContainerHeight(Math.max(MIN_LIST_HEIGHT, Math.min(availableHeight, visibleRowsHeight)));
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("resize", updateHeight);
    return () => {
      window.removeEventListener("resize", updateHeight);
      window.visualViewport?.removeEventListener("resize", updateHeight);
    };
  }, [patients.length, rowHeight]);

  // Memoize row props to prevent re-renders
  const rowProps = React.useMemo<RowProps>(() => ({
    patients,
    onSelect: onPatientSelect,
    onDelete: onPatientDelete,
    onDuplicate: onPatientDuplicate,
    viewMode,
  }), [patients, onPatientSelect, onPatientDelete, onPatientDuplicate, viewMode]);

  // Track scroll position via scroll event listener
  React.useEffect(() => {
    const element = listRef.current?.element;
    if (!element) return;
    
    const handleScroll = () => {
      setShowScrollTop(element.scrollTop > rowHeight * 3);
    };
    
    element.addEventListener('scroll', handleScroll);
    return () => element.removeEventListener('scroll', handleScroll);
  }, [patients.length, rowHeight]); // Re-attach when patient count or row height changes

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center mb-5 border border-border/30">
          {searchQuery ? (
            <Search className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          ) : (
            <Hospital className="h-6 w-6 text-primary" aria-hidden="true" />
          )}
        </div>
        <h3 className="text-lg font-semibold mb-1.5">
          {searchQuery ? "No patients found" : "Ready to Start Rounds"}
        </h3>
        <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
          {searchQuery
            ? "Try adjusting your search."
            : "Tap the + button below to add your first patient."}
        </p>
        {!searchQuery && (
          <div className="flex flex-col gap-2 mt-8 w-full max-w-[240px]">
            <Button onClick={onAddPatient} className="min-h-11 w-full shadow-sm" disabled={!onAddPatient}>
              Add patient
            </Button>
            <Button variant="outline" onClick={onOpenImport} className="min-h-11 w-full border-border/40" disabled={!onOpenImport}>
              Import Patient List
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-full overflow-x-hidden">
      <List
        listRef={listRef}
        rowCount={patients.length}
        rowHeight={rowHeight}
        rowComponent={PatientRowComponent}
        rowProps={rowProps}
        overscanCount={3}
        className="scrollbar-thin"
        data-testid="virtualized-mobile-patient-list"
        style={{ height: containerHeight, width: '100%' }}
      />

      {/* Swipe hint for first-time users */}
      {patients.length === 1 && (
        <div className="flex items-center justify-center gap-1.5 py-4 px-6 text-center text-xs text-muted-foreground motion-safe:animate-fade-in">
          <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Swipe left on a patient for quick actions</span>
        </div>
      )}

      {showScrollTop && (
        <Button
          variant="secondary"
          size="icon"
          onClick={() => {
            listRef.current?.scrollToRow({
              index: 0,
              align: 'start',
              behavior: prefersReducedMotion() ? 'auto' : 'smooth',
            });
          }}
          className="absolute bottom-4 right-4 h-11 w-11 rounded-full shadow-lg"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
});

VirtualizedMobilePatientList.displayName = "VirtualizedMobilePatientList";
