import { useState, useEffect, useCallback } from 'react';
import { smartSync, startAutoSync, stopAutoSync, getLastSyncTime, SyncStatus } from '../workers/offlineSyncWorker';
import { getPendingUploads, getUnsyncedLessons } from '../lib/offlineDB';

export interface OfflineModeState {
  isOnline: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  lastSyncTime: string | null;
  triggerSync: () => Promise<void>;
  connectionLabel: string;
  connectionColor: 'green' | 'yellow' | 'blue';
}

interface UseOfflineModeOptions {
  country: string;
  subjects?: string[];
  classLevel?: string;
  autoStart?: boolean;
}

export function useOfflineMode({
  country,
  subjects,
  classLevel,
  autoStart = true,
}: UseOfflineModeOptions): OfflineModeState {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const profile = { country, subjects, classLevel };

  const refreshPendingCount = useCallback(async () => {
    const [queue, lessons] = await Promise.all([getPendingUploads(), getUnsyncedLessons()]);
    setPendingCount(queue.length + lessons.length);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncStatus('syncing');
    try {
      await smartSync(profile);
      const last = await getLastSyncTime();
      setLastSyncTime(last);
      await refreshPendingCount();
      setSyncStatus('complete');
    } catch {
      setSyncStatus('error');
    }
  }, [country]);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); setSyncStatus('syncing'); };
    const handleOffline = () => { setIsOnline(false); setSyncStatus('idle'); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    refreshPendingCount();
    getLastSyncTime().then(setLastSyncTime);

    if (autoStart) {
      startAutoSync(profile, setSyncStatus);
    }

    return () => { if (autoStart) stopAutoSync(); };
  }, [country]);

  // Refresh pending count when sync completes
  useEffect(() => {
    if (syncStatus === 'complete') refreshPendingCount();
  }, [syncStatus]);

  const connectionLabel =
    !isOnline ? 'Offline Mode Active'
    : syncStatus === 'syncing' ? 'Sync Pending'
    : syncStatus === 'error' ? 'Sync Error'
    : 'Online Mode';

  const connectionColor: 'green' | 'yellow' | 'blue' =
    !isOnline ? 'blue'
    : syncStatus === 'syncing' || syncStatus === 'error' ? 'yellow'
    : 'green';

  return { isOnline, syncStatus, pendingCount, lastSyncTime, triggerSync, connectionLabel, connectionColor };
}
