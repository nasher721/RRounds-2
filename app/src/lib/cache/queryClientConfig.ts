import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CACHE_CONFIG } from './cacheConfig';
import { cacheMetrics } from './performanceMonitor';
import { safeLocalStorage } from '../../utils/safeStorage';
import { getUserFacingErrorMessage } from '@/lib/userFacingErrors';

// Create optimized query client with caching strategies
export function createOptimizedQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Only show error toast for user-initiated queries
        if (query.state.data !== undefined) {
          toast.error(getUserFacingErrorMessage(error));
        }
        cacheMetrics.recordError(query.queryKey.toString());
      },
      onSuccess: (data, query) => {
        cacheMetrics.recordHit(query.queryKey.toString());
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        toast.error(getUserFacingErrorMessage(error, 'Failed to save. Please try again.'));
      },
    }),
    defaultOptions: {
      queries: {
        // Default stale time - 1 minute
        staleTime: 60 * 1000,
        // Cache time - 5 minutes
        gcTime: 5 * 60 * 1000,
        // Retry configuration
        retry: CACHE_CONFIG.retry.count,
        retryDelay: (attemptIndex) => 
          Math.min(
            CACHE_CONFIG.retry.delay * Math.pow(CACHE_CONFIG.retry.backoffMultiplier, attemptIndex),
            30000
          ),
        // Refetch behavior
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: false,
        // Network mode
        networkMode: 'offlineFirst',
        // Structural sharing for performance
        structuralSharing: true,
      },
      mutations: {
        retry: 1,
        networkMode: 'offlineFirst',
      },
    },
  });
}

function clearLegacyPersistedCache(): void {
  safeLocalStorage.removeItem(CACHE_CONFIG.storageKeys.queryCache);
  safeLocalStorage.removeItem(CACHE_CONFIG.storageKeys.lastSync);
}

// Clinical query results must remain in memory. Persisting arbitrary successful
// queries can expose one user's patient data to the next user of the browser.
export const cacheHydration = {
  persist: (queryClient: QueryClient) => {
    void queryClient;
    clearLegacyPersistedCache();
  },

  hydrate: (queryClient: QueryClient) => {
    void queryClient;
    clearLegacyPersistedCache();
  },

  clear: clearLegacyPersistedCache,
};
