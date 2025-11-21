import { useState, useEffect, useCallback } from 'react';
import networkService from '../services/networkService';
import offlineStorage from '../services/offlineStorage';

export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(networkService.getIsOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Subscribe to network changes
    const unsubscribe = networkService.addListener(setIsOnline);

    // Load pending actions count
    loadPendingCount();

    return unsubscribe;
  }, []);

  const loadPendingCount = async () => {
    const actions = await offlineStorage.getPendingActions();
    const unsyncedCount = actions.filter(a => !a.synced).length;
    setPendingCount(unsyncedCount);
  };

  const syncNow = useCallback(async () => {
    if (!isOnline) {
      return;
    }

    setIsSyncing(true);
    try {
      await networkService.syncPendingActions();
      await loadPendingCount();
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline]);

  return {
    isOnline,
    isOffline: !isOnline,
    isSyncing,
    pendingCount,
    syncNow,
  };
};

// Hook for offline-aware data fetching
export const useOfflineData = <T,>(
  fetchOnline: () => Promise<T>,
  fetchOffline: () => Promise<T>,
  cacheOffline: (data: T) => Promise<void>
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isOnline } = useOffline();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (isOnline) {
        // Fetch from API
        const result = await fetchOnline();
        setData(result);

        // Cache for offline use
        await cacheOffline(result);
      } else {
        // Load from offline storage
        const result = await fetchOffline();
        setData(result);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');

      // If online fetch fails, try offline fallback
      if (isOnline) {
        try {
          const result = await fetchOffline();
          setData(result);
          setError('Using cached data (offline)');
        } catch {
          // Both failed
        }
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline, fetchOnline, fetchOffline, cacheOffline]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    reload: loadData,
  };
};
