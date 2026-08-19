import * as React from "react";
import type {
  Round,
  RoundActiveSection,
  RoundFilters,
  RoundSyncStatus,
} from "@/types/round";
import {
  clearCurrentWalkStatus,
  completeRound,
  createRound,
  getCurrentPatientRef,
  getRoundPosition,
  markCurrentDone,
  markCurrentSkipped,
  markDoneAndNext,
  nextPatient,
  prevPatient,
  replaceRoundPatients,
  resumeRound,
  selectPatient,
  setActiveSection,
  setExpandedSystem,
  setRoundFilters,
  setRoundSyncStatus,
} from "@/lib/round/roundSessionStore";
import {
  createContinuityMeta,
  normalizeContinuityMeta,
  roundSyncEngine,
  type FieldConflict,
  type FieldConflictChoice,
  type RoundContinuityMeta,
  type VersionedField,
} from "@/lib/round/sync";
import { FieldConflictDialog } from "@/components/round/FieldConflictDialog";
import { roundOutbox } from "@/lib/round/sync/roundOutbox";
import { isBrowserKnownOffline } from "@/lib/networkConnectivity";
import { indexedDBQueue, type QueuedMutation } from "@/lib/offline/indexedDBQueue";
import {
  deriveRoundCompletionSafety,
  type RoundCompletionSafety,
} from "@/lib/round/roundCompletionSafety";
import type { PatientSaveState } from "@/hooks/patients/usePatientMutations";

export interface RoundSessionContextValue {
  round: Round;
  /** False while local/remote continuity is being restored. */
  isHydrated: boolean;
  currentPatientId: string | null;
  position: { current: number; total: number };
  continuity: RoundContinuityMeta | null;
  conflicts: FieldConflict[];
  /** Whether End/Mark complete actions are safe with current sync state. */
  canCompleteRound: boolean;
  /** Unified blocker details across Round continuity, patient fields, and Todos. */
  completionSafety: RoundCompletionSafety;
  /** Outbox rows still awaiting a real remote ack (includes soft_fail). */
  pendingCount: number;
  /** Outbox rows that entered explicit failed state after retry exhaustion. */
  failedCount: number;
  /** Outbox rows awaiting acknowledgement after a recoverable remote rejection. */
  softFailedCount: number;
  /** Competing active Round generations that require an explicit clinician choice. */
  generationConflictCount: number;
  /** Last time queued Round data received a remote acknowledgement. */
  lastSuccessfulSyncAt: string | null;
  /** Concrete outcome from the latest manual Retry action. */
  retryResult: string | null;
  selectPatient: (patientId: string) => void;
  nextPatient: () => void;
  prevPatient: () => void;
  markDone: () => void;
  markSkipped: () => void;
  clearWalkStatus: () => void;
  markDoneAndNext: () => void;
  setFilters: (patch: Partial<RoundFilters>) => void;
  setActiveSection: (section: RoundActiveSection) => void;
  setExpandedSystem: (systemId: string | null) => void;
  setSyncStatus: (status: RoundSyncStatus) => void;
  /** Mark Today’s Round complete (End Round flow). */
  completeRound: () => void;
  /** Create a new active Round after the prior Round reached its terminal state. */
  startNewRound: () => void;
  /** Queue a mid-rounds chart draft field for offline-capable sync. */
  enqueueDraftField: (field: Omit<VersionedField, "deviceId"> & { deviceId?: string }) => Promise<void>;
  /** Retry persisted failed sync writes without reloading the session. */
  retryRoundSync: () => Promise<void>;
  /** Discard rejected local walk continuity and adopt the active Round saved remotely. */
  adoptRemoteRoundGeneration: () => Promise<void>;
  resolveConflict: (
    conflict: FieldConflict,
    choice: FieldConflictChoice,
    mergedValue?: string,
  ) => Promise<void>;
  openConflictDialog: (conflict?: FieldConflict) => void;
}

const RoundSessionContext = React.createContext<RoundSessionContextValue | null>(null);

export interface RoundSessionProviderProps {
  userId: string;
  patientIds: readonly string[];
  children: React.ReactNode;
  /**
   * Skip IndexedDB/remote hydrate, outbox listeners, and persist.
   * Intended for component/unit harnesses that only need in-memory Round transitions.
   */
  disablePersistence?: boolean;
  /** Live patient field save states from the dashboard mutation owner. */
  patientSaveStates?: Readonly<Record<string, PatientSaveState>>;
  /** Prevent completion when patient or Todo clinical truth could not be server-verified. */
  dataVerificationBlocked?: boolean;
}

const patientIdsKey = (ids: readonly string[]): string => ids.join("\0");

/**
 * React state wrapper around the pure Round session store.
 * Persists continuity locally, enqueues Round/outbox drafts, and surfaces conflicts.
 */
export const RoundSessionProvider = ({
  userId,
  patientIds,
  children,
  disablePersistence = false,
  patientSaveStates = {},
  dataVerificationBlocked = false,
}: RoundSessionProviderProps) => {
  const [round, setRound] = React.useState<Round>(() =>
    createRound({ userId, patientIds }),
  );
  const [continuity, setContinuity] = React.useState<RoundContinuityMeta | null>(null);
  const continuityRef = React.useRef<RoundContinuityMeta | null>(null);
  const [conflicts, setConflicts] = React.useState<FieldConflict[]>([]);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [failedCount, setFailedCount] = React.useState(0);
  const [softFailedCount, setSoftFailedCount] = React.useState(0);
  const [generationConflictCount, setGenerationConflictCount] = React.useState(0);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = React.useState<string | null>(null);
  const [retryResult, setRetryResult] = React.useState<string | null>(null);
  const [unresolvedCount, setUnresolvedCount] = React.useState(0);
  const [clinicalMutations, setClinicalMutations] = React.useState<QueuedMutation[]>([]);
  const [activeConflict, setActiveConflict] = React.useState<FieldConflict | null>(null);
  const [conflictOpen, setConflictOpen] = React.useState(false);
  const autoOpenedConflictIdsRef = React.useRef(new Set<string>());
  const [hydrated, setHydrated] = React.useState(disablePersistence);
  const idsKey = patientIdsKey(patientIds);
  const previousIdsKeyRef = React.useRef(idsKey);
  const previousUserIdRef = React.useRef(userId);
  const persistTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipPersistRef = React.useRef(true);
  const activeUserIdRef = React.useRef(userId);
  activeUserIdRef.current = userId;

  const clearPersistTimer = React.useCallback(() => {
    if (!persistTimerRef.current) return;
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = null;
  }, []);

  React.useEffect(() => {
    skipPersistRef.current = true;
    clearPersistTimer();
    return clearPersistTimer;
  }, [userId, clearPersistTimer]);

  React.useEffect(() => {
    continuityRef.current = continuity;
  }, [continuity]);

  React.useEffect(() => {
    if (disablePersistence) {
      setHydrated(true);
      skipPersistRef.current = true;
      return;
    }
    let cancelled = false;
    const hydrate = async () => {
      roundSyncEngine.bindOwner(userId);
      roundSyncEngine.ensureNetworkListeners();
      const fallback = createRound({ userId, patientIds });
      const result = await roundSyncEngine.hydrateRoundSession({
        userId,
        patientIds,
        fallbackRound: fallback,
      });
      if (cancelled) return;
      setRound(result.round);
      setContinuity(result.continuity);
      setConflicts(roundSyncEngine.getConflicts());
      setHydrated(true);
      skipPersistRef.current = false;
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
    // Intentionally hydrate once per user; patient list rebinds below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, disablePersistence]);

  React.useEffect(() => {
    if (disablePersistence) return;
    const unsubStatus = roundSyncEngine.onStatusChange((status) => {
      setRound((prev) => setRoundSyncStatus(prev, status));
    });
    const unsubConflicts = roundSyncEngine.onConflicts((next) => {
      setConflicts(next);
    });
    const unsubSyncSuccess = roundSyncEngine.onSyncSuccess(setLastSuccessfulSyncAt);
    const unsubOutbox = roundOutbox.subscribe(() => {
      void (async () => {
        const pending = await roundOutbox.getPendingCount();
        const conflictCount = await roundOutbox.getConflictCount();
        const failed = await roundOutbox.getFailedCount();
        const softFailed = await roundOutbox.getSoftFailedCount();
        const queue = await roundOutbox.getQueue();
        const generationConflicts = queue.filter((entry) => (
          entry.kind === "round_state"
          && entry.softFailReason === "round_generation_conflict"
        )).length;
        const unresolved = await roundOutbox.getUnresolvedCount();
        setPendingCount(pending);
        setFailedCount(failed);
        setSoftFailedCount(softFailed);
        setGenerationConflictCount(generationConflicts);
        setUnresolvedCount(unresolved);
        const status = roundSyncEngine.deriveChromeStatus({
          isOnline: !isBrowserKnownOffline(),
          pendingCount: pending,
          conflictCount,
          failedCount: failed,
          softFailedCount: softFailed,
        });
        setRound((prev) => setRoundSyncStatus(prev, status));
      })();
    });
    return () => {
      unsubStatus();
      unsubConflicts();
      unsubSyncSuccess();
      unsubOutbox();
    };
  }, [disablePersistence]);

  React.useEffect(() => {
    if (disablePersistence) {
      setClinicalMutations([]);
      return;
    }
    return indexedDBQueue.subscribe(setClinicalMutations);
  }, [disablePersistence, userId]);

  // Auto-open conflict dialog when new same-field conflicts appear (no silent drop).
  React.useEffect(() => {
    if (conflicts.length === 0) return;
    const unseen = conflicts.find((item) => !autoOpenedConflictIdsRef.current.has(item.id));
    if (!unseen) return;
    autoOpenedConflictIdsRef.current.add(unseen.id);
    setActiveConflict(unseen);
    setConflictOpen(true);
  }, [conflicts]);
  React.useEffect(() => {
    if (previousUserIdRef.current !== userId) {
      previousUserIdRef.current = userId;
      previousIdsKeyRef.current = idsKey;
      setHydrated(disablePersistence);
      setRound(createRound({ userId, patientIds }));
      setContinuity(null);
      return;
    }
    if (previousIdsKeyRef.current === idsKey) return;
    previousIdsKeyRef.current = idsKey;
    setRound((prev) => replaceRoundPatients(prev, patientIds));
  }, [userId, idsKey, patientIds, disablePersistence]);

  const schedulePersist = React.useCallback(
    (nextRound: Round, nextContinuity: RoundContinuityMeta) => {
      if (skipPersistRef.current || !hydrated) return;
      const scheduledOwnerId = nextRound.userId;
      if (scheduledOwnerId !== userId || activeUserIdRef.current !== scheduledOwnerId) return;
      clearPersistTimer();
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null;
        if (
          activeUserIdRef.current !== scheduledOwnerId ||
          roundOutbox.getOwner() !== scheduledOwnerId
        ) {
          return;
        }
        void roundSyncEngine.persistRoundSession({
          round: nextRound,
          continuity: nextContinuity,
          patientIds,
        }).catch(() => {
          if (activeUserIdRef.current !== scheduledOwnerId) return;
          setFailedCount((current) => Math.max(1, current));
          setRound((current) => setRoundSyncStatus(current, "failed"));
        });
      }, 250);
    },
    [clearPersistTimer, hydrated, patientIds, userId],
  );

  const applyRoundChange = React.useCallback(
    (
      updater: (prev: Round) => Round,
      continuityPatch?: Partial<RoundContinuityMeta>,
    ) => {
      setRound((prev) => {
        if (prev.status === "completed") return prev;
        const next = updater(prev);
        const prevMeta = continuityRef.current;
        const deviceId = prevMeta?.deviceId ?? "local";
        const base = prevMeta
          ? normalizeContinuityMeta(prevMeta, next.updatedAt)
          : createContinuityMeta(deviceId, next.updatedAt);
        const nextMeta: RoundContinuityMeta = {
          ...base,
          ...continuityPatch,
          deviceId: prevMeta?.deviceId ?? base.deviceId,
        };
        continuityRef.current = nextMeta;
        queueMicrotask(() => {
          setContinuity(nextMeta);
          schedulePersist(next, nextMeta);
        });
        return next;
      });
    },
    [schedulePersist],
  );

  const handleSelectPatient = React.useCallback((patientId: string) => {
    const now = new Date().toISOString();
    applyRoundChange((prev) => selectPatient(prev, patientId, now), {
      positionUpdatedAt: now,
    });
  }, [applyRoundChange]);

  const handleNextPatient = React.useCallback(() => {
    const now = new Date().toISOString();
    applyRoundChange((prev) => nextPatient(prev, now), { positionUpdatedAt: now });
  }, [applyRoundChange]);

  const handlePrevPatient = React.useCallback(() => {
    const now = new Date().toISOString();
    applyRoundChange((prev) => prevPatient(prev, now), { positionUpdatedAt: now });
  }, [applyRoundChange]);

  const completionSafety = React.useMemo(
    () => deriveRoundCompletionSafety({
      roundUnresolvedCount: unresolvedCount,
      roundConflictCount: conflicts.length,
      mutations: clinicalMutations,
      patientSaveStates,
      dataVerificationBlockerCount: dataVerificationBlocked ? 1 : 0,
    }),
    [clinicalMutations, conflicts.length, dataVerificationBlocked, patientSaveStates, unresolvedCount],
  );
  const canCompleteRound = completionSafety.canComplete;

  const handleMarkDone = React.useCallback(() => {
    if (!canCompleteRound) return;
    applyRoundChange((prev) => markCurrentDone(prev));
  }, [applyRoundChange, canCompleteRound]);

  const handleMarkSkipped = React.useCallback(() => {
    applyRoundChange((prev) => markCurrentSkipped(prev));
  }, [applyRoundChange]);

  const handleClearWalkStatus = React.useCallback(() => {
    applyRoundChange((prev) => clearCurrentWalkStatus(prev));
  }, [applyRoundChange]);

  const handleMarkDoneAndNext = React.useCallback(() => {
    if (!canCompleteRound) return;
    const now = new Date().toISOString();
    applyRoundChange((prev) => markDoneAndNext(prev, now), { positionUpdatedAt: now });
  }, [applyRoundChange, canCompleteRound]);

  const handleSetFilters = React.useCallback((patch: Partial<RoundFilters>) => {
    const now = new Date().toISOString();
    applyRoundChange((prev) => setRoundFilters(prev, patch, now), {
      filtersUpdatedAt: now,
    });
  }, [applyRoundChange]);

  const handleSetActiveSection = React.useCallback((section: RoundActiveSection) => {
    const now = new Date().toISOString();
    applyRoundChange((prev) => setActiveSection(prev, section, now), {
      sectionUpdatedAt: now,
    });
  }, [applyRoundChange]);

  const handleSetExpandedSystem = React.useCallback((systemId: string | null) => {
    const now = new Date().toISOString();
    applyRoundChange((prev) => setExpandedSystem(prev, systemId, now), {
      expandedUpdatedAt: now,
    });
  }, [applyRoundChange]);

  const handleSetSyncStatus = React.useCallback((status: RoundSyncStatus) => {
    setRound((prev) => setRoundSyncStatus(prev, status));
  }, []);

  const handleCompleteRound = React.useCallback(() => {
    if (!canCompleteRound) return;
    applyRoundChange((prev) => completeRound(prev));
  }, [applyRoundChange, canCompleteRound]);

  const handleStartNewRound = React.useCallback(() => {
    if (round.status !== "completed") return;
    const now = new Date().toISOString();
    const completedRound = round;
    const completedContinuity = continuityRef.current
      ?? createContinuityMeta("local", completedRound.updatedAt);
    const nextRound = createRound({ userId, patientIds, now });
    const deviceId = completedContinuity.deviceId;
    const nextContinuity = createContinuityMeta(deviceId, now);
    clearPersistTimer();
    continuityRef.current = nextContinuity;
    setContinuity(nextContinuity);
    setRetryResult(null);
    setRound(nextRound);

    if (disablePersistence || skipPersistRef.current || !hydrated) return;
    const scheduledOwnerId = completedRound.userId;
    void (async () => {
      let terminalPersistFailed = false;
      try {
        await roundSyncEngine.persistRoundSession({
          round: completedRound,
          continuity: completedContinuity,
          patientIds,
        });
      } catch {
        terminalPersistFailed = true;
      }
      if (
        activeUserIdRef.current !== scheduledOwnerId
        || roundOutbox.getOwner() !== scheduledOwnerId
      ) {
        return;
      }
      await roundSyncEngine.persistRoundSession({
        round: nextRound,
        continuity: nextContinuity,
        patientIds,
      });
      if (terminalPersistFailed) {
        throw new Error("Terminal Round persistence failed before the new Round was saved.");
      }
    })().catch(() => {
      if (activeUserIdRef.current !== scheduledOwnerId) return;
      setFailedCount((current) => Math.max(1, current));
      setRound((current) => setRoundSyncStatus(current, "failed"));
    });
  }, [clearPersistTimer, disablePersistence, hydrated, patientIds, round, userId]);

  const handleEnqueueDraftField = React.useCallback(
    async (field: Omit<VersionedField, "deviceId"> & { deviceId?: string }) => {
      // Block Done/End synchronously, before IndexedDB persistence finishes.
      setUnresolvedCount((current) => Math.max(1, current));
      setRound((current) => setRoundSyncStatus(
        current,
        isBrowserKnownOffline() ? "offline" : "syncing",
      ));
      try {
        const deviceId =
          field.deviceId
          ?? continuity?.deviceId
          ?? (await roundSyncEngine.getDeviceId());
        await roundSyncEngine.enqueueDraft(
          { ...field, deviceId },
          userId,
          round.id,
        );
      } catch {
        setFailedCount((current) => Math.max(1, current));
        setRound((current) => setRoundSyncStatus(current, "failed"));
      }
    },
    [continuity?.deviceId, round.id, userId],
  );

  const handleRetryRoundSync = React.useCallback(async () => {
    setRetryResult("Retrying sync…");
    const result = await roundSyncEngine.retryFailedWrites();
    if (isBrowserKnownOffline()) {
      setRetryResult("Retry could not start while offline. Edits remain saved locally.");
      return;
    }
    if (result.failed > 0 || result.softFailed > 0) {
      setRetryResult(`Retry finished with ${result.failed + result.softFailed} unsynced write${result.failed + result.softFailed === 1 ? "" : "s"}.`);
      return;
    }
    if (result.success > 0) {
      setRetryResult(`Retry synced ${result.success} write${result.success === 1 ? "" : "s"} remotely.`);
      return;
    }
    setRetryResult("No failed writes were available to retry.");
  }, []);

  const handleUseRemoteRoundGeneration = React.useCallback(async () => {
    setRetryResult("Loading the Round saved by another device…");
    let remote: Awaited<ReturnType<typeof roundSyncEngine.reconcileRoundGeneration>>;
    try {
      remote = await roundSyncEngine.reconcileRoundGeneration(userId);
    } catch {
      setRetryResult("The saved Round could not be stored safely. The conflict remains blocked; free device storage and retry.");
      return;
    }
    if (!remote || activeUserIdRef.current !== userId) {
      setRetryResult("The saved Round could not be loaded. Reconnect and retry sync.");
      return;
    }
    continuityRef.current = remote.continuity;
    setContinuity(remote.continuity);
    setRound(remote.round);
    setGenerationConflictCount(0);
    setRetryResult("Using the latest Round saved by another device.");
  }, [userId]);

  const handleResolveConflict = React.useCallback(
    async (conflict: FieldConflict, choice: FieldConflictChoice, mergedValue?: string) => {
      await roundSyncEngine.resolveConflict(conflict, choice, mergedValue, userId);
      setConflictOpen(false);
      setActiveConflict(null);
    },
    [userId],
  );

  const handleOpenConflictDialog = React.useCallback((conflict?: FieldConflict) => {
    const target = conflict ?? conflicts[0] ?? null;
    if (!target) return;
    setActiveConflict(target);
    setConflictOpen(true);
  }, [conflicts]);

  const handleConflictOpenChange = React.useCallback((open: boolean) => {
    setConflictOpen(open);
    if (!open) setActiveConflict(null);
  }, []);

  const handleDialogResolve = React.useCallback(
    (choice: FieldConflictChoice, mergedValue?: string) => {
      if (!activeConflict) return;
      void handleResolveConflict(activeConflict, choice, mergedValue);
    },
    [activeConflict, handleResolveConflict],
  );

  const value = React.useMemo((): RoundSessionContextValue => {
    const current = getCurrentPatientRef(round);
    return {
      round,
      isHydrated: hydrated,
      currentPatientId: current?.patientId ?? null,
      position: getRoundPosition(round),
      continuity,
      conflicts,
      canCompleteRound,
      completionSafety,
      pendingCount,
      failedCount,
      softFailedCount,
      generationConflictCount,
      lastSuccessfulSyncAt,
      retryResult,
      selectPatient: handleSelectPatient,
      nextPatient: handleNextPatient,
      prevPatient: handlePrevPatient,
      markDone: handleMarkDone,
      markSkipped: handleMarkSkipped,
      clearWalkStatus: handleClearWalkStatus,
      markDoneAndNext: handleMarkDoneAndNext,
      setFilters: handleSetFilters,
      setActiveSection: handleSetActiveSection,
      setExpandedSystem: handleSetExpandedSystem,
      setSyncStatus: handleSetSyncStatus,
      completeRound: handleCompleteRound,
      startNewRound: handleStartNewRound,
      retryRoundSync: handleRetryRoundSync,
      adoptRemoteRoundGeneration: handleUseRemoteRoundGeneration,
      enqueueDraftField: handleEnqueueDraftField,
      resolveConflict: handleResolveConflict,
      openConflictDialog: handleOpenConflictDialog,
    };
  }, [
    round,
    hydrated,
    continuity,
    conflicts,
    pendingCount,
    failedCount,
    softFailedCount,
    generationConflictCount,
    lastSuccessfulSyncAt,
    retryResult,
    canCompleteRound,
    completionSafety,
    handleSelectPatient,
    handleNextPatient,
    handlePrevPatient,
    handleMarkDone,
    handleMarkSkipped,
    handleClearWalkStatus,
    handleMarkDoneAndNext,
    handleSetFilters,
    handleSetActiveSection,
    handleSetExpandedSystem,
    handleSetSyncStatus,
    handleCompleteRound,
    handleStartNewRound,
    handleRetryRoundSync,
    handleUseRemoteRoundGeneration,
    handleEnqueueDraftField,
    handleResolveConflict,
    handleOpenConflictDialog,
  ]);

  return (
    <RoundSessionContext.Provider value={value}>
      {children}
      <FieldConflictDialog
        conflict={activeConflict}
        open={conflictOpen && Boolean(activeConflict)}
        onOpenChange={handleConflictOpenChange}
        onResolve={handleDialogResolve}
      />
    </RoundSessionContext.Provider>
  );
};

/** Optional resume helper; rehydrates from a Round snapshot. */
export const resumeRoundSession = (round: Round, patientIds?: readonly string[]): Round =>
  resumeRound({ round, patientIds });

export const useRoundSession = (): RoundSessionContextValue => {
  const context = React.useContext(RoundSessionContext);
  if (!context) {
    throw new Error("useRoundSession must be used within a RoundSessionProvider");
  }
  return context;
};
