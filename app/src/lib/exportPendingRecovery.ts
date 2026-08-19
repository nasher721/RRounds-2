import type { QueuedMutation } from "@/lib/offline/indexedDBQueue";
import { pendingQueueSignature } from "@/lib/offline/queueSignature";

export const PENDING_RECOVERY_FORMAT = "rolling-rounds-pending-recovery-v1" as const;

export interface PendingRecoveryPayload {
  format: typeof PENDING_RECOVERY_FORMAT;
  exportedAt: string;
  warning: string;
  recoveryInstructions: string;
  mutations: QueuedMutation[];
}

export function pendingRecoverySignature(
  mutations: readonly QueuedMutation[],
): string {
  return pendingQueueSignature(mutations);
}

export function createPendingRecoveryPayload(
  mutations: readonly QueuedMutation[],
  exportedAt = new Date(),
): PendingRecoveryPayload {
  return {
    format: PENDING_RECOVERY_FORMAT,
    exportedAt: exportedAt.toISOString(),
    warning: "Contains PHI. Store and transmit only under organization policy.",
    recoveryInstructions:
      "This file is not automatically re-imported. Keep it for authorized support or manual clinical recovery.",
    mutations: mutations.map((mutation) => ({
      ...mutation,
      payload: { ...mutation.payload },
      ...(mutation.conflictData
        ? { conflictData: { ...mutation.conflictData } }
        : {}),
      ...(mutation.conflictServerData
        ? { conflictServerData: { ...mutation.conflictServerData } }
        : mutation.conflictServerData === null
          ? { conflictServerData: null }
          : {}),
    })),
  };
}

export function pendingRecoveryFilename(exportedAt = new Date()): string {
  const timestamp = exportedAt
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/:/g, "-");
  return `rolling-rounds-pending-recovery-${timestamp}.json`;
}

/** Explicit user-triggered local PHI recovery export; never uploads data. */
export function downloadPendingRecovery(
  mutations: readonly QueuedMutation[],
  exportedAt = new Date(),
): void {
  if (mutations.length === 0) {
    throw new Error("No pending changes are available to export.");
  }

  const payload = createPendingRecoveryPayload(mutations, exportedAt);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = pendingRecoveryFilename(exportedAt);
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
