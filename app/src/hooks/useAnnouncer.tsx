import * as React from "react";

/**
 * Announcement types for different events
 */
export type AnnouncementType =
  | "patient-saved"
  | "patient-deleted"
  | "patient-added"
  | "error"
  | "filter-applied"
  | "sorted"
  | "sync-started"
  | "sync-complete"
  | "sync-error"
  | "loading"
  | "success"
  | "info";

/**
 * Configuration for the announcer
 */
interface AnnouncerOptions {
  /** Cooldown in ms to prevent spam (default: 1000ms) */
  cooldown?: number;
  /** Whether to deduplicate identical messages (default: true) */
  deduplicate?: boolean;
}

interface AnnouncerApi {
  announce: (message: string, type?: AnnouncementType) => void;
  announcePatientSaved: (patientName: string) => void;
  announcePatientDeleted: (patientName: string) => void;
  announcePatientAdded: (patientName: string) => void;
  announceError: (message: string) => void;
  announceFilterApplied: (filterName: string, count?: number) => void;
  announceSorted: (field: string, direction: "asc" | "desc") => void;
  announceSyncStarted: () => void;
  announceSyncComplete: (patientCount?: number) => void;
  announceSyncError: (message?: string) => void;
  announceLoading: (message: string) => void;
  announceSuccess: (message: string) => void;
  /** Current live-region content. Intended for AnnouncerRoot. */
  _message: string;
  /** Current live-region priority. Intended for AnnouncerRoot. */
  _priority: "polite" | "assertive";
}

/**
 * Custom hook for screen reader announcements via aria-live regions.
 *
 * @example
 * const { announce, announcePatientSaved, announceError } = useAnnouncer();
 *
 * // Using preset
 * announcePatientSaved("Patient John Doe");
 *
 * // Using custom message
 * announce("Custom announcement", "info");
 */
export function useAnnouncer(options: AnnouncerOptions = {}): AnnouncerApi {
  const { cooldown = 1000, deduplicate = true } = options;
  const [message, setMessage] = React.useState("");
  const [priority, setPriority] = React.useState<"polite" | "assertive">("polite");
  const lastMessageRef = React.useRef("");
  const lastTimeRef = React.useRef(0);

  /**
   * Core announce function with spam prevention
   */
  const announce = React.useCallback(
    (announcement: string, type: AnnouncementType = "info") => {
      const now = Date.now();

      // Determine priority based on type
      const isAssertive = type === "error" || type === "sync-error" || type === "loading";
      setPriority(isAssertive ? "assertive" : "polite");

      // Deduplicate: skip if same message within cooldown window
      if (deduplicate && announcement === lastMessageRef.current && now - lastTimeRef.current < cooldown) {
        return;
      }

      // Skip if too frequent (spam prevention)
      if (now - lastTimeRef.current < 200) {
        // Queue the message with a small delay to avoid spam
        setTimeout(() => {
          lastMessageRef.current = announcement;
          lastTimeRef.current = Date.now();
          setMessage(announcement);
        }, cooldown);
        return;
      }

      lastMessageRef.current = announcement;
      lastTimeRef.current = now;
      setMessage(announcement);
    },
    [cooldown, deduplicate]
  );

  // Preset announcement functions
  const announcePatientSaved = React.useCallback(
    (patientName: string) => {
      announce(`Patient ${patientName} saved`, "patient-saved");
    },
    [announce]
  );

  const announcePatientDeleted = React.useCallback(
    (patientName: string) => {
      announce(`Patient ${patientName} deleted`, "patient-deleted");
    },
    [announce]
  );

  const announcePatientAdded = React.useCallback(
    (patientName: string) => {
      announce(`Patient ${patientName} added`, "patient-added");
    },
    [announce]
  );

  const announceError = React.useCallback(
    (errorMessage: string) => {
      announce(`Error: ${errorMessage}`, "error");
    },
    [announce]
  );

  const announceFilterApplied = React.useCallback(
    (filterName: string, count?: number) => {
      const countText = count !== undefined ? `, ${count} patients` : "";
      announce(`Filter ${filterName} applied${countText}`, "filter-applied");
    },
    [announce]
  );

  const announceSorted = React.useCallback(
    (field: string, direction: "asc" | "desc") => {
      const directionText = direction === "asc" ? "ascending" : "descending";
      announce(`Sorted by ${field}, ${directionText}`, "sorted");
    },
    [announce]
  );

  const announceSyncStarted = React.useCallback(() => {
    announce("Syncing data with server", "sync-started");
  }, [announce]);

  const announceSyncComplete = React.useCallback(
    (patientCount?: number) => {
      const countText = patientCount !== undefined ? `, ${patientCount} patients synced` : "";
      announce(`Sync complete${countText}`, "sync-complete");
    },
    [announce]
  );

  const announceSyncError = React.useCallback(
    (message = "Unable to sync with server") => {
      announce(message, "sync-error");
    },
    [announce]
  );

  const announceLoading = React.useCallback(
    (loadingMessage: string) => {
      announce(loadingMessage, "loading");
    },
    [announce]
  );

  const announceSuccess = React.useCallback(
    (successMessage: string) => {
      announce(successMessage, "success");
    },
    [announce]
  );

  return {
    announce,
    announcePatientSaved,
    announcePatientDeleted,
    announcePatientAdded,
    announceError,
    announceFilterApplied,
    announceSorted,
    announceSyncStarted,
    announceSyncComplete,
    announceSyncError,
    announceLoading,
    announceSuccess,
    // Expose current message and priority for the live region
    _message: message,
    _priority: priority,
  };
}

/**
 * Context for sharing announcer across the app
 */
const AnnouncerContext = React.createContext<ReturnType<typeof useAnnouncer> | null>(null);

/**
 * Provider component for the announcer context
 */
export function AnnouncerProvider({
  children,
  options,
}: {
  children: React.ReactNode;
  options?: AnnouncerOptions;
}): React.ReactElement {
  const announcer = useAnnouncer(options);
  return (
    <AnnouncerContext.Provider value={announcer}>
      {children}
    </AnnouncerContext.Provider>
  );
}

/**
 * Hook to use the announcer from context
 * @throws Error if used outside AnnouncerProvider
 */
export function useAnnouncerContext(): ReturnType<typeof useAnnouncer> {
  const context = React.useContext(AnnouncerContext);
  if (!context) {
    throw new Error("useAnnouncerContext must be used within AnnouncerProvider");
  }
  return context;
}

/**
 * Live region component that should be rendered once at app root
 */
export function LiveRegion({
  message,
  priority = "polite",
}: {
  message: string;
  priority?: "polite" | "assertive";
}): React.ReactElement {
  // Use a separate element for each priority level to avoid conflicts
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
      style={{
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: 0,
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {message}
    </div>
  );
}

/**
 * Combined component with provider and live region
 * Use this at the app root for full functionality
 */
export function AnnouncerRoot({
  children,
  options,
}: {
  children: React.ReactNode;
  options?: AnnouncerOptions;
}): React.ReactElement {
  const announcer = useAnnouncer(options);

  return (
    <AnnouncerContext.Provider value={announcer}>
      <LiveRegion message={announcer._message} priority={announcer._priority} />
      {children}
    </AnnouncerContext.Provider>
  );
}

export default useAnnouncer;
