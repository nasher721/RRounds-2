import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  cacheMetrics, 
  getCombinedMetrics,
  CacheMetricsData 
} from '@/lib/cache/performanceMonitor';
import { cacheInvalidation } from '@/lib/cache/cacheInvalidation';
import { cacheHydration } from '@/lib/cache/queryClientConfig';

export interface CacheMonitorData {
  query: CacheMetricsData;
  serviceWorker: {
    cacheHits: number;
    cacheMisses: number;
    networkRequests: number;
    hitRate: number;
    averageRetrievalTime: number;
  } | null;
  combined: {
    totalHits: number;
    totalMisses: number;
    overallHitRate: number;
  };
}

export function useCacheMonitor() {
  const queryClient = useQueryClient();
  const [metrics, setMetrics] = useState<CacheMonitorData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Refresh metrics
  const refreshMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      const combined = await getCombinedMetrics();
      setMetrics(combined);
    } catch (error) {
      console.error('Failed to get cache metrics:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Subscribe to query cache metrics updates
  useEffect(() => {
    refreshMetrics();
    
    const unsubscribe = cacheMetrics.subscribe(() => {
      refreshMetrics();
    });
    
    // Refresh every 30 seconds
    const interval = setInterval(refreshMetrics, 30000);
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [refreshMetrics]);
  
  // Clear all caches
  const clearAllCaches = useCallback(async () => {
    await cacheInvalidation.invalidateAll(queryClient);
    cacheMetrics.reset();
    cacheHydration.clear();
    await refreshMetrics();
  }, [queryClient, refreshMetrics]);
  
  // Clear API caches only
  const clearApiCaches = useCallback(async () => {
    await cacheInvalidation.clearServiceWorkerApiCache();
    await queryClient.invalidateQueries();
    await refreshMetrics();
  }, [queryClient, refreshMetrics]);
  
  // Reset metrics only
  const resetMetrics = useCallback(async () => {
    cacheMetrics.reset();
    
    // Reset service worker metrics
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const channel = new MessageChannel();
      navigator.serviceWorker.controller.postMessage(
        { type: 'RESET_METRICS' },
        [channel.port2]
      );
    }
    
    await refreshMetrics();
  }, [refreshMetrics]);
  
  // Get cache size estimate
  const getCacheSize = useCallback(async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        usagePercentage: estimate.quota 
          ? ((estimate.usage || 0) / estimate.quota) * 100 
          : 0,
      };
    }
    return null;
  }, []);
  
  return {
    metrics,
    isLoading,
    refreshMetrics,
    clearAllCaches,
    clearApiCaches,
    resetMetrics,
    getCacheSize,
  };
}
