import type { Patient } from "@/types/patient";
import type { Round } from "@/types/round";

/** Explicit user-triggered local PHI recovery export; never uploads data. */
export function exportRoundRecovery(round: Round, patients: readonly Patient[]): void {
  const payload = {
    format: "rolling-rounds-recovery-v1",
    exportedAt: new Date().toISOString(),
    warning: "Contains PHI. Store and transmit only under organization policy.",
    round,
    patients,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rolling-rounds-recovery-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
