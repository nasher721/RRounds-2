import * as React from "react";
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { syncEngine, type SyncStatus } from "@/lib/offline/syncEngine";
import { indexedDBQueue, type ConflictData } from "@/lib/offline/indexedDBQueue";
import { isBrowserKnownOffline } from "@/lib/networkConnectivity";

export type { ConflictData };

interface OfflineSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  conflicts: ConflictData[];
}

interface OfflineSyncContextValue {
  state: OfflineSyncState;
  sync: () => Promise<void>;
  resolveConflict: (conflictId: string, strategy: "server-wins" | "client-wins") => Promise<boolean>;
  dismissConflict: (conflictId: string) => void;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function useOfflineSyncContext(): OfflineSyncContextValue {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error("useOfflineSyncContext must be used within OfflineSyncProvider");
  }
  return context;
}

export function useOfflineSync(): Pick<OfflineSyncContextValue, "sync" | "resolveConflict"> {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error("useOfflineSync must be used within OfflineSyncProvider");
  }
  return {
    sync: context.sync,
    resolveConflict: context.resolveConflict,
  };
}

interface OfflineSyncProviderProps {
  children: React.ReactNode;
}

export function OfflineSyncProvider({ children }: OfflineSyncProviderProps): React.ReactElement {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [conflicts, setConflicts] = useState<ConflictData[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(() => !isBrowserKnownOffline());

  useEffect(() => {
    const unsubscribeStatus = syncEngine.on("status-change", (newStatus: SyncStatus) => {
      setStatus(newStatus);
    });

    const unsubscribeConflict = syncEngine.on("conflict", (data) => {
      setConflicts((prev) => [...prev, data]);
    });

    const updatePendingCount = async (): Promise<void> => {
      const count = await indexedDBQueue.getPendingCount();
      setPendingCount(count);
    };

    void updatePendingCount();
    const interval = setInterval(() => void updatePendingCount(), 5000);

    const handleOnline = (): void => {
      setIsOnline(true);
      void syncEngine.sync();
    };

    const handleOffline = (): void => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsubscribeStatus();
      unsubscribeConflict();
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const sync = useCallback(async (): Promise<void> => {
    await syncEngine.sync();
  }, []);

  const resolveConflict = useCallback(async (
    conflictId: string, 
    strategy: "server-wins" | "client-wins"
  ): Promise<boolean> => {
    const conflict = conflicts.find((c) => c.id === conflictId);
    if (!conflict) return false;

    try {
      const resolved = await syncEngine.resolvePendingConflict(conflict, strategy);
      if (!resolved) return false;
      setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
      return true;
    } catch {
      return false;
    }
  }, [conflicts]);

  const dismissConflict = useCallback((conflictId: string): void => {
    setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
  }, []);

  const value: OfflineSyncContextValue = {
    state: {
      isOnline,
      isSyncing: status === "syncing",
      pendingCount,
      conflicts,
    },
    sync,
    resolveConflict,
    dismissConflict,
  };

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  );
}
