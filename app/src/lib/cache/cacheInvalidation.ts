import { QueryClient } from '@tanstack/react-query';

// Cache invalidation utilities
export const cacheInvalidation = {
  // Invalidate all caches
  async invalidateAll(queryClient: QueryClient): Promise<void> {
    await queryClient.invalidateQueries();
    await this.clearServiceWorkerCache();
  },
  
  // Clear service worker API cache
  async clearServiceWorkerApiCache(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      return false;
    }
    const controller = navigator.serviceWorker.controller;
    if (!controller) return false;
    
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        resolve(event.data?.success || false);
      };
      
      controller.postMessage(
        { type: 'CLEAR_API_CACHE' },
        [channel.port2]
      );
      
      setTimeout(() => resolve(false), 3000);
    });
  },
  
  // Clear all service worker caches
  async clearServiceWorkerCache(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      return false;
    }
    const controller = navigator.serviceWorker.controller;
    if (!controller) return false;
    
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        resolve(event.data?.success || false);
      };
      
      controller.postMessage(
        { type: 'CLEAR_CACHE' },
        [channel.port2]
      );
      
      setTimeout(() => resolve(false), 3000);
    });
  },
};
