import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cacheWarming, WarmingProgress } from '@/lib/cache/cacheWarming';
import { useAuth } from '@/hooks/useAuth';

export function useCacheWarming() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const ownerIdRef = useRef(ownerId);
  ownerIdRef.current = ownerId;
  const runSequenceRef = useRef(0);
  const activeRunRef = useRef<{ ownerId: string; sequence: number } | null>(null);
  const [warmingState, setWarmingState] = useState<{
    ownerId: string | null;
    isWarming: boolean;
    progress: WarmingProgress | null;
  }>({ ownerId: null, isWarming: false, progress: null });

  const stateBelongsToOwner = warmingState.ownerId === ownerId;
  const isWarming = stateBelongsToOwner ? warmingState.isWarming : false;
  const progress = stateBelongsToOwner ? warmingState.progress : null;

  // Manual and automatic warming share one owner-bound run. A new owner may
  // start immediately; its run token invalidates any pending work for the old
  // owner before a late response can reach cache or progress state.
  const warmCaches = useCallback(async () => {
    const requestOwnerId = ownerId;
    if (!requestOwnerId) return null;

    const activeRun = activeRunRef.current;
    if (activeRun?.ownerId === requestOwnerId) return null;

    const run = {
      ownerId: requestOwnerId,
      sequence: ++runSequenceRef.current,
    };
    activeRunRef.current = run;
    const isCurrentRun = () => (
      ownerIdRef.current === requestOwnerId
      && activeRunRef.current?.sequence === run.sequence
    );

    setWarmingState({ ownerId: requestOwnerId, isWarming: true, progress: null });

    try {
      const result = await cacheWarming.warmEssential(
        queryClient,
        requestOwnerId,
        isCurrentRun,
        (nextProgress) => {
          if (!isCurrentRun()) return;
          setWarmingState({
            ownerId: requestOwnerId,
            isWarming: true,
            progress: nextProgress,
          });
        },
      );
      return isCurrentRun() ? result : null;
    } catch {
      if (isCurrentRun()) console.error('Cache warming failed');
      return null;
    } finally {
      const runIsStillActive = activeRunRef.current?.sequence === run.sequence;
      if (runIsStillActive) {
        activeRunRef.current = null;
      }
      if (runIsStillActive && ownerIdRef.current === requestOwnerId) {
        setWarmingState((previous) => (
          previous.ownerId === requestOwnerId
            ? { ...previous, isWarming: false }
            : previous
        ));
      }
    }
  }, [ownerId, queryClient]);

  // Warm essential caches when user logs in
  useEffect(() => {
    if (ownerId) {
      void warmCaches();
      return;
    }

    activeRunRef.current = null;
    setWarmingState({ ownerId: null, isWarming: false, progress: null });
  }, [ownerId, warmCaches]);

  // Prefetch patient data on hover
  const prefetchPatient = useCallback(async (patientId: string) => {
    const requestOwnerId = ownerId;
    if (!requestOwnerId || !patientId) return;

    try {
      await cacheWarming.prefetchPatient(
        queryClient,
        requestOwnerId,
        patientId,
        () => ownerIdRef.current === requestOwnerId,
      );
    } catch {
      if (ownerIdRef.current === requestOwnerId) {
        console.error('Patient cache prefetch failed');
      }
    }
  }, [ownerId, queryClient]);
  
  return {
    isWarming,
    progress,
    warmCaches,
    prefetchPatient,
  };
}
