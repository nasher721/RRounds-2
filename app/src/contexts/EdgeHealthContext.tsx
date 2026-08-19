import * as React from 'react';
import { toast } from 'sonner';
import { invalidateEdgeHealthCache, probeEdgeHealth } from '@/lib/edgeHealth';

export type EdgeHealthStatus = 'healthy' | 'unhealthy' | 'unknown' | 'checking';

type EdgeHealthContextValue = {
  status: EdgeHealthStatus;
  bannerDismissed: boolean;
  dismissBanner: () => void;
  refresh: (options?: { force?: boolean }) => Promise<EdgeHealthStatus>;
  /** Returns false when backend is unhealthy (shows toast). Unknown = allow. */
  assertBackendReady: () => boolean;
};

const EdgeHealthContext = React.createContext<EdgeHealthContextValue | null>(null);

export const EdgeHealthProvider = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = React.useState<EdgeHealthStatus>('checking');
  const [bannerDismissed, setBannerDismissed] = React.useState(false);

  const refresh = React.useCallback(async (options?: { force?: boolean }) => {
    if (options?.force) {
      invalidateEdgeHealthCache();
    }
    setStatus('checking');
    const result = await probeEdgeHealth({ force: options?.force });
    setStatus(result);
    return result;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('checking');
      const result = await probeEdgeHealth();
      if (!cancelled) {
        setStatus(result);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      void probeEdgeHealth({ force: true }).then((r) => {
        setStatus(r);
      });
    }, 120_000);
    return () => window.clearInterval(id);
  }, []);

  const dismissBanner = React.useCallback(() => {
    setBannerDismissed(true);
  }, []);

  const assertBackendReady = React.useCallback((): boolean => {
    if (status !== 'unhealthy') {
      return true;
    }
    toast.error('Backend is updating. Please try again in a moment.');
    return false;
  }, [status]);

  const value = React.useMemo(
    () => ({
      status,
      bannerDismissed,
      dismissBanner,
      refresh,
      assertBackendReady,
    }),
    [status, bannerDismissed, dismissBanner, refresh, assertBackendReady],
  );

  return <EdgeHealthContext.Provider value={value}>{children}</EdgeHealthContext.Provider>;
};

export function useEdgeHealth(): EdgeHealthContextValue | null {
  return React.useContext(EdgeHealthContext);
}

export function useAssertBackendReady(): () => boolean {
  const ctx = React.useContext(EdgeHealthContext);
  return React.useCallback(() => {
    if (!ctx) {
      return true;
    }
    return ctx.assertBackendReady();
  }, [ctx]);
}
