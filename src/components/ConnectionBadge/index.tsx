import React from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { SyncStatus } from '../../workers/offlineSyncWorker';

interface ConnectionBadgeProps {
  isOnline: boolean;
  syncStatus: SyncStatus;
  pendingCount?: number;
  lastSyncTime?: string | null;
  onSyncClick?: () => void;
  compact?: boolean;
}

const BADGE_CONFIG = {
  online_idle:    { bg: 'bg-emerald-50 border-emerald-200',  text: 'text-emerald-700', dot: 'bg-emerald-500',               label: '🟢 Online Mode',         Icon: Wifi },
  online_syncing: { bg: 'bg-yellow-50 border-yellow-200',    text: 'text-yellow-700',  dot: 'bg-yellow-500 animate-pulse',  label: '🟡 Sync Pending',        Icon: RefreshCw },
  online_error:   { bg: 'bg-red-50 border-red-200',          text: 'text-red-700',     dot: 'bg-red-500',                   label: '🔴 Sync Error',          Icon: AlertCircle },
  offline:        { bg: 'bg-blue-50 border-blue-200',        text: 'text-blue-700',    dot: 'bg-blue-500 animate-pulse',    label: '🔵 Offline Mode Active', Icon: WifiOff },
};

const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({
  isOnline,
  syncStatus,
  pendingCount = 0,
  lastSyncTime,
  onSyncClick,
  compact = false,
}) => {
  const key = !isOnline ? 'offline'
    : syncStatus === 'syncing' ? 'online_syncing'
    : syncStatus === 'error' ? 'online_error'
    : 'online_idle';

  const cfg = BADGE_CONFIG[key];
  const Icon = cfg.Icon;

  if (compact) {
    return (
      <button
        onClick={onSyncClick}
        title={cfg.label}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all hover:opacity-80 ${cfg.bg} ${cfg.text}`}
      >
        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        <Icon className={`w-3 h-3 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
        {cfg.label.split(' ').slice(1).join(' ')}
        {pendingCount > 0 && (
          <span className="bg-current opacity-80 text-white rounded-full text-xs px-1.5 py-0.5 ml-1">
            {pendingCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className={`rounded-2xl border p-4 ${cfg.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.text} bg-white/60`}>
            <Icon className={`w-5 h-5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <p className={`font-semibold text-sm ${cfg.text}`}>{cfg.label}</p>
            {lastSyncTime && (
              <p className={`text-xs opacity-70 ${cfg.text}`}>
                Last sync: {new Date(lastSyncTime).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        {isOnline && (
          <button
            onClick={onSyncClick}
            disabled={syncStatus === 'syncing'}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg bg-white/60 hover:bg-white/90 transition-all disabled:opacity-50 ${cfg.text}`}
          >
            {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>

      {pendingCount > 0 && (
        <div className={`mt-3 text-xs ${cfg.text} opacity-80`}>
          {pendingCount} item{pendingCount > 1 ? 's' : ''} waiting to upload
        </div>
      )}

      {!isOnline && (
        <div className={`mt-3 text-xs ${cfg.text} opacity-80`}>
          Working from local cache. Will sync automatically when connected.
        </div>
      )}
    </div>
  );
};

export default ConnectionBadge;
