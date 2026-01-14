import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';

/**
 * Hook to monitor browser online/offline network status.
 * Automatically notifies the backend when network status changes.
 * Should be mounted once at the app root level.
 */
export function useNetworkStatus(): void {
  const setNetworkOnline = useAppStore((state) => state.setNetworkOnline);

  useEffect(() => {
    const handleOnline = () => {
      console.log('[Network] Browser reports online');
      setNetworkOnline(true);
    };

    const handleOffline = () => {
      console.log('[Network] Browser reports offline');
      setNetworkOnline(false);
    };

    // Set initial state
    setNetworkOnline(navigator.onLine);

    // Listen for network status changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setNetworkOnline]);
}
