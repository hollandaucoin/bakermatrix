import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getOutboxCount, sanitizeOutbox } from '../util/offlineStorage.js';
import { syncOutbox } from '../util/offlineSync.js';
import { syncRequest } from '../util/api.js';

const OfflineContext = createContext(null);

const ONLINE_SYNC_DELAY_MS = 1000;
const AUTO_SYNC_COOLDOWN_MS = 30000;

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [lastSyncError, setLastSyncError] = useState(null);

  const syncingRef = useRef(false);
  const onlineSyncTimerRef = useRef(null);
  const lastAutoSyncAttemptRef = useRef(0);

  const refreshPendingCount = useCallback(async () => {
    const count = await getOutboxCount();
    setPendingCount(count);
    return count;
  }, []);

  const runSync = useCallback(async ({ manual = false } = {}) => {
    if (!navigator.onLine || syncingRef.current) {
      return { synced: 0, failed: 0 };
    }

    if (
      !manual
      && Date.now() - lastAutoSyncAttemptRef.current < AUTO_SYNC_COOLDOWN_MS
    ) {
      return { synced: 0, failed: 0 };
    }

    syncingRef.current = true;
    setIsSyncing(true);
    setLastSyncError(null);

    try {
      const pending = await getOutboxCount();
      if (pending === 0) {
        await refreshPendingCount();
        return { synced: 0, failed: 0 };
      }

      if (!manual) {
        lastAutoSyncAttemptRef.current = Date.now();
      }

      const result = await syncOutbox(syncRequest);
      await refreshPendingCount();

      if (result.synced > 0) {
        setLastSyncAt(Date.now());
        setLastSyncError(null);
        window.dispatchEvent(new Event('offline-sync-complete'));
      }

      if (result.failed > 0 && result.remaining.length > 0) {
        setLastSyncError('Some changes could not be uploaded. Tap Sync now to retry.');
      }

      return result;
    } catch (error) {
      setLastSyncError(error.message || 'Sync failed');
      return { synced: 0, failed: 1 };
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [refreshPendingCount]);

  const runSyncRef = useRef(runSync);
  runSyncRef.current = runSync;

  const scheduleAutoSync = useCallback(() => {
    if (!navigator.onLine || syncingRef.current) return;

    if (onlineSyncTimerRef.current) {
      clearTimeout(onlineSyncTimerRef.current);
    }

    onlineSyncTimerRef.current = setTimeout(async () => {
      onlineSyncTimerRef.current = null;
      if (!navigator.onLine || syncingRef.current) return;

      const count = await getOutboxCount();
      if (count > 0) {
        runSyncRef.current({ manual: false });
      }
    }, ONLINE_SYNC_DELAY_MS);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      await sanitizeOutbox();
      if (cancelled) return;

      const count = await refreshPendingCount();
      if (!cancelled && navigator.onLine && count > 0) {
        scheduleAutoSync();
      }
    };

    init();

    const handleOnline = () => {
      setIsOnline(true);
      scheduleAutoSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (onlineSyncTimerRef.current) {
        clearTimeout(onlineSyncTimerRef.current);
        onlineSyncTimerRef.current = null;
      }
    };

    const handleOutboxChange = () => refreshPendingCount();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-outbox-change', handleOutboxChange);

    return () => {
      cancelled = true;
      if (onlineSyncTimerRef.current) {
        clearTimeout(onlineSyncTimerRef.current);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-outbox-change', handleOutboxChange);
    };
  }, [refreshPendingCount, scheduleAutoSync]);

  const value = useMemo(() => ({
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncAt,
    lastSyncError,
    syncNow: () => runSync({ manual: true }),
    refreshPendingCount,
  }), [isOnline, pendingCount, isSyncing, lastSyncAt, lastSyncError, runSync, refreshPendingCount]);

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
};
