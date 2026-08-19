import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useOnlineStatus } from "./useOnlineStatus";

const OFFLINE_DESCRIPTION =
  "Only patient changes showing Offline queued or Queued are stored on this device. Online-only tools may be unavailable.";
const ONLINE_DESCRIPTION =
  "Connection restored. Queued patient changes will attempt to sync automatically; confirm Queued clears or Saved appears before leaving this device.";

function showOfflineToast() {
  toast.warning("You are offline", {
    description: OFFLINE_DESCRIPTION,
    duration: Infinity,
    id: "network-status",
  });
}

/**
 * Monitors network connectivity and shows toast notifications
 * when the user goes offline or comes back online.
 * Suppresses the initial mount to avoid a false "back online" on page load.
 */
export function useNetworkStatus() {
  const isOnline = useOnlineStatus();
  const hasBeenOffline = useRef(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Skip the very first render to avoid false "back online" on page load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // If already offline on mount, show the notification
      if (!isOnline) {
        hasBeenOffline.current = true;
        showOfflineToast();
      }
      return;
    }

    if (!isOnline) {
      hasBeenOffline.current = true;
      showOfflineToast();
    } else if (hasBeenOffline.current) {
      hasBeenOffline.current = false;
      toast.success("Back online", {
        description: ONLINE_DESCRIPTION,
        duration: 4000,
        id: "network-status",
      });
    }
  }, [isOnline]);
}
