import type { RoundSyncStatus } from "@/types/round";

export interface RoundSyncPresentation {
  label: string;
  description: string;
  lastSuccessfulSyncAt: string | null;
}

const formatLastRemoteSync = (value: string | null): string => {
  if (!value) return "No successful remote sync yet.";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Last remote sync time unavailable.";
  return `Last remote sync ${parsed.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}.`;
};

export function describeRoundSync(
  status: RoundSyncStatus,
  pendingCount: number,
  failedCount: number,
  softFailedCount: number,
  lastSuccessfulSyncAt: string | null,
): RoundSyncPresentation {
  const lastSyncDescription = formatLastRemoteSync(lastSuccessfulSyncAt);

  if (status === "idle") {
    return {
      label: "Saved remotely",
      description: lastSyncDescription,
      lastSuccessfulSyncAt,
    };
  }
  if (status === "offline") {
    return {
      label: pendingCount > 0 ? `Saved locally · ${pendingCount} pending` : "Saved locally",
      description: `Remote sync is unavailable. ${lastSyncDescription}`,
      lastSuccessfulSyncAt,
    };
  }
  if (status === "failed") {
    if (softFailedCount > 0) {
      return {
        label: `Sync blocked · ${softFailedCount} stalled`,
        description: `${softFailedCount} locally saved write${softFailedCount === 1 ? " is" : "s are"} still awaiting remote acknowledgement. Retry sync before completing the Round. ${lastSyncDescription}`,
        lastSuccessfulSyncAt,
      };
    }
    return {
      label: failedCount > 0 ? `Sync failed · ${failedCount} failed` : "Sync failed",
      description: `Local edits remain on this device. ${lastSyncDescription}`,
      lastSuccessfulSyncAt,
    };
  }
  if (status === "syncing") {
    return {
      label: pendingCount > 0 ? `Syncing · ${pendingCount} pending` : "Syncing",
      description: `Sending locally saved edits. ${lastSyncDescription}`,
      lastSuccessfulSyncAt,
    };
  }
  return {
    label: "Sync conflict",
    description: `Choose which version to keep before remote sync can finish. ${lastSyncDescription}`,
    lastSuccessfulSyncAt,
  };
}
