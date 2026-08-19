import { useState, useEffect } from 'react';
import { isBrowserKnownOffline } from '@/lib/networkConnectivity';

/**
 * Minimal hook that tracks online/offline connectivity.
 * Single source of truth – consumed by useOfflineMode and useNetworkStatus.
 */
export function useOnlineStatus(): boolean {
    const [isOnline, setIsOnline] = useState(() => !isBrowserKnownOffline());

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}
