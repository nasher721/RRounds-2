import * as React from "react";
import { Check, Search, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDashboard } from "@/contexts/DashboardContext";
import { useRoundSession } from "@/contexts/RoundSessionContext";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types/patient";
import type { RoundPatientWalkStatus } from "@/types/round";

export interface RosterOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Larger row hit targets and stronger contrast for phone. */
  touchFriendly?: boolean;
  /** First-class path to Round End from roster. */
  onEndRound?: () => void;
  /** Path back to Round Home (Import / Start). */
  onGoHome?: () => void;
}

const toOneLine = (value: string | undefined): string =>
  (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const STATUS_LABEL: Record<RoundPatientWalkStatus, string> = {
  pending: "Pending",
  done: "Done",
  skipped: "Skipped",
};

/**
 * Summoned roster for jump/search. Overlay only — does not unmount Patient Focus,
 * so in-memory chart drafts stay intact when opening/closing.
 */
export const RosterOverlay = ({
  open,
  onOpenChange,
  touchFriendly = false,
  onEndRound,
  onGoHome,
}: RosterOverlayProps) => {
  const { patients } = useDashboard();
  const { round, currentPatientId, selectPatient, setFilters } = useRoundSession();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const triggerElementRef = React.useRef<HTMLElement | null>(null);

  const patientsById = React.useMemo(() => {
    const map = new Map<string, Patient>();
    for (const patient of patients) {
      map.set(patient.id, patient);
    }
    return map;
  }, [patients]);

  React.useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (open && !nextOpen && triggerElementRef.current) {
      window.setTimeout(() => {
        triggerElementRef.current?.focus();
      }, 0);
    }
    onOpenChange(nextOpen);
  }, [open, onOpenChange]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ search: event.target.value });
  };

  const handleToggleHideDone = (checked: boolean | "indeterminate") => {
    setFilters({ hideDone: checked === true });
  };

  const handleToggleHideSkipped = (checked: boolean | "indeterminate") => {
    setFilters({ hideSkipped: checked === true });
  };

  const handleSelectPatient = (patientId: string) => {
    selectPatient(patientId);
    handleOpenChange(false);
  };

  const handleKeyDownSearch = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const firstVisible = visibleRows[0];
    if (!firstVisible) return;
    handleSelectPatient(firstVisible.patientId);
  };

  const searchLower = round.filters.search.trim().toLowerCase();

  const visibleRows = React.useMemo(() => {
    return round.patients.filter((ref) => {
      if (round.filters.hideDone && ref.status === "done") return false;
      if (round.filters.hideSkipped && ref.status === "skipped") return false;
      if (!searchLower) return true;
      const patient = patientsById.get(ref.patientId);
      if (!patient) {
        return ref.patientId.toLowerCase().includes(searchLower);
      }
      const haystack = [
        patient.name,
        patient.bed,
        patient.mrn,
        toOneLine(patient.clinicalSummary),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchLower);
    });
  }, [round.patients, round.filters.hideDone, round.filters.hideSkipped, searchLower, patientsById]);

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && document.activeElement instanceof HTMLElement) {
          triggerElementRef.current = document.activeElement;
        }
        handleOpenChange(nextOpen);
      }}
    >
      <SheetContent
        side="left"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-sm"
        data-testid="roster-overlay"
        aria-describedby={undefined}
      >
        <SheetHeader className="border-b border-border/30 px-4 py-3 text-left">
          <SheetTitle className="text-sm font-semibold tracking-tight">
            Today&apos;s roster
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Jump to a patient. Closing returns to Focus without losing drafts.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 border-b border-border/20 px-4 py-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              ref={searchInputRef}
              value={round.filters.search}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDownSearch}
              placeholder="Search name, bed, MRN…"
              className="h-[44px] pl-8 text-sm"
              aria-label="Search roster"
              data-testid="roster-search"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="roster-hide-done"
                checked={round.filters.hideDone}
                onCheckedChange={handleToggleHideDone}
              />
              <Label htmlFor="roster-hide-done" className="text-xs text-muted-foreground">
                Hide done
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="roster-hide-skipped"
                checked={round.filters.hideSkipped}
                onCheckedChange={handleToggleHideSkipped}
              />
              <Label htmlFor="roster-hide-skipped" className="text-xs text-muted-foreground">
                Hide skipped
              </Label>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Round patients">
          {visibleRows.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No patients match these filters.
            </p>
          ) : (
            visibleRows.map((ref, index) => {
              const patient = patientsById.get(ref.patientId);
              const isActive = ref.patientId === currentPatientId;
              const name = patient?.name?.trim() || "Unnamed patient";
              const bed = patient?.bed?.trim() || "—";
              const stableIdentifier = patient?.mrn?.trim()
                ? `MRN …${patient.mrn.trim().slice(-4)}`
                : patient?.id
                  ? `Record …${patient.id.slice(-4)}`
                  : "Record unavailable";
              const cue = toOneLine(patient?.clinicalSummary).slice(0, 72);
              const statusIcon =
                ref.status === "done" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                ) : ref.status === "skipped" ? (
                  <SkipForward className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                ) : null;

              return (
                <Button
                  key={ref.patientId}
                  type="button"
                  variant="ghost"
                  aria-current={isActive ? "true" : undefined}
                  aria-label={`${name}, bed ${bed}, ${stableIdentifier}, ${STATUS_LABEL[ref.status]}`}
                  className={cn(
                    "mb-1 h-auto w-full justify-start gap-3 rounded-lg px-3 text-left transition-colors",
                    touchFriendly ? "min-h-[44px] py-3" : "py-2.5",
                    isActive
                      ? "bg-primary/15 font-semibold text-foreground border-l-2 border-primary pl-2.5"
                      : "hover:bg-muted/50",
                  )}
                  onClick={() => handleSelectPatient(ref.patientId)}
                  data-testid={`roster-row-${ref.patientId}`}
                >
                  <span
                    className={cn(
                      "w-6 shrink-0 text-center tabular-nums font-semibold",
                      touchFriendly ? "text-sm text-foreground/75" : "text-xs text-muted-foreground",
                    )}
                  >
                    {round.patients.findIndex((r) => r.patientId === ref.patientId) + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "truncate font-semibold",
                          touchFriendly ? "text-base text-foreground" : "text-sm text-foreground/95",
                        )}
                      >
                        {name}
                      </span>
                      {statusIcon}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block truncate",
                        touchFriendly ? "text-sm text-foreground/70" : "text-xs text-muted-foreground",
                      )}
                    >
                      Bed {bed} · {stableIdentifier}
                      {cue ? ` · ${cue}` : ""}
                    </span>
                  </span>
                  <span className="sr-only">
                    Position {index + 1} of {visibleRows.length}
                  </span>
                </Button>
              );
            })
          )}
        </nav>

        {(onEndRound || onGoHome) && (
          <div className="flex shrink-0 gap-2 border-t border-border/30 px-4 py-3">
            {onGoHome && (
              <Button
                type="button"
                variant="outline"
                className={cn("flex-1", touchFriendly && "min-h-[44px]")}
                onClick={() => {
                  onGoHome();
                  onOpenChange(false);
                }}
                aria-label="Round Home"
                data-testid="roster-go-home"
              >
                Round Home
              </Button>
            )}
            {onEndRound && (
              <Button
                type="button"
                variant="outline"
                className={cn("flex-1", touchFriendly && "min-h-[44px]")}
                onClick={() => {
                  onEndRound();
                  onOpenChange(false);
                }}
                aria-label="End Round"
                data-testid="roster-end-round"
              >
                End Round
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
