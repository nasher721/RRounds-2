import * as React from "react";
import { Activity, ChevronDown, ChevronUp, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Vitals } from "@/types/patient";

interface VitalsSectionProps {
  vitals?: Vitals;
  onVitalsChange?: (vitals: Vitals) => void;
  /** Callback to update a single vital field */
  onVitalChange?: (field: keyof Vitals, value: string) => void;
  /** Show last recorded timestamp */
  showTimestamp?: boolean;
  className?: string;
}

/** Temperature unit preference */
type TempUnit = "F" | "C";

/**
 * Structured vitals input section for patient cards.
 * Collapsed by default, displays temperature, HR, BP, RR, SpO2.
 */
export function VitalsSection({
  vitals,
  onVitalChange,
  showTimestamp = true,
  className,
}: VitalsSectionProps) {
  // Collapsed by default as per requirements
  const [isOpen, setIsOpen] = React.useState(false);
  const [tempUnit, setTempUnit] = React.useState<TempUnit>(() => {
    // Auto-detect from initial value
    const initial = vitals?.temp ?? "";
    return initial.includes("C") ? "C" : "F";
  });

  // Parse temperature for display based on unit
  const displayTemp = React.useMemo(() => {
    if (!vitals?.temp) return "";
    const match = vitals.temp.match(/^([\d.]+)/);
    return match ? match[1] : vitals.temp;
  }, [vitals?.temp]);

  const handleTempChange = (value: string) => {
    onVitalChange?.("temp", value ? `${value}°${tempUnit}` : "");
  };

  const handleTempUnitToggle = () => {
    const newUnit = tempUnit === "F" ? "C" : "F";
    setTempUnit(newUnit);
    // Convert existing value if present
    if (vitals?.temp) {
      const match = vitals.temp.match(/^([\d.]+)/);
      if (match) {
        const num = parseFloat(match[1]);
        if (tempUnit === "F") {
          // Convert F to C: (F - 32) * 5/9
          const celsius = ((num - 32) * 5) / 9;
          onVitalChange?.("temp", `${celsius.toFixed(1)}°C`);
        } else {
          // Convert C to F: C * 9/5 + 32
          const fahrenheit = num * (9 / 5) + 32;
          onVitalChange?.("temp", `${fahrenheit.toFixed(1)}°F`);
        }
      }
    }
  };

  const handleFieldChange = (field: keyof Vitals) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onVitalChange?.(field, e.target.value);
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return null;
    try {
      const date = new Date(iso);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  const hasAnyVitals = vitals?.temp || vitals?.hr || vitals?.bp || vitals?.rr || vitals?.spo2;

  return (
    <div className={cn("space-y-2", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Header */}
        <div className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/10 border border-primary/15">
              <Activity className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vitals
            </span>
            {hasAnyVitals && (
              <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                ✓
              </span>
            )}
            {showTimestamp && vitals?.lastRecorded && (
              <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTimestamp(vitals.lastRecorded)}
              </span>
            )}
          </div>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-foreground"
              aria-label={isOpen ? "Collapse vitals" : "Expand vitals"}
            >
              {isOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        {/* Content */}
        <CollapsibleContent className="pt-2">
          <div className="bg-background/50 rounded-lg p-3 border border-border/40 transition-all duration-200">
            {/* 2-column grid for inputs */}
            <div className="grid grid-cols-2 gap-3">
              {/* Temperature */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="vitals-temp"
                    className="text-xs text-muted-foreground font-medium"
                  >
                    Temp ({tempUnit === "F" ? "°F" : "°C"})
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleTempUnitToggle}
                    className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                    aria-label={`Switch to ${tempUnit === "F" ? "Celsius" : "Fahrenheit"}`}
                  >
                    °{tempUnit === "F" ? "C" : "F"}
                  </Button>
                </div>
                <Input
                  id="vitals-temp"
                  type="text"
                  inputMode="decimal"
                  placeholder={tempUnit === "F" ? "98.6" : "37.0"}
                  value={displayTemp}
                  onChange={(e) => handleTempChange(e.target.value)}
                  className="h-8 text-sm"
                  aria-label={`Temperature in degrees ${tempUnit === "F" ? "Fahrenheit" : "Celsius"}`}
                />
              </div>

              {/* Heart Rate */}
              <div className="space-y-1">
                <Label
                  htmlFor="vitals-hr"
                  className="text-xs text-muted-foreground font-medium"
                >
                  HR (bpm)
                </Label>
                <Input
                  id="vitals-hr"
                  type="text"
                  inputMode="numeric"
                  placeholder="72"
                  value={vitals?.hr ?? ""}
                  onChange={handleFieldChange("hr")}
                  className="h-8 text-sm"
                  aria-label="Heart rate in beats per minute"
                />
              </div>

              {/* Blood Pressure */}
              <div className="space-y-1">
                <Label
                  htmlFor="vitals-bp"
                  className="text-xs text-muted-foreground font-medium"
                >
                  BP (systolic/diastolic)
                </Label>
                <Input
                  id="vitals-bp"
                  type="text"
                  inputMode="numeric"
                  placeholder="120/80"
                  value={vitals?.bp ?? ""}
                  onChange={handleFieldChange("bp")}
                  className="h-8 text-sm"
                  aria-label="Blood pressure"
                />
              </div>

              {/* Respiratory Rate */}
              <div className="space-y-1">
                <Label
                  htmlFor="vitals-rr"
                  className="text-xs text-muted-foreground font-medium"
                >
                  RR (breaths/min)
                </Label>
                <Input
                  id="vitals-rr"
                  type="text"
                  inputMode="numeric"
                  placeholder="16"
                  value={vitals?.rr ?? ""}
                  onChange={handleFieldChange("rr")}
                  className="h-8 text-sm"
                  aria-label="Respiratory rate in breaths per minute"
                />
              </div>

              {/* SpO2 */}
              <div className="space-y-1">
                <Label
                  htmlFor="vitals-spo2"
                  className="text-xs text-muted-foreground font-medium"
                >
                  SpO2 (%)
                </Label>
                <Input
                  id="vitals-spo2"
                  type="text"
                  inputMode="numeric"
                  placeholder="98"
                  value={vitals?.spo2 ?? ""}
                  onChange={handleFieldChange("spo2")}
                  className="h-8 text-sm"
                  aria-label="Oxygen saturation percentage"
                />
              </div>
            </div>

            {/* Last recorded timestamp (inline below grid) */}
            {showTimestamp && (
              <div className="mt-2 pt-2 border-t border-border/30">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onVitalChange?.("lastRecorded", new Date().toISOString())}
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground w-full justify-start"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  Update timestamp to now
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
