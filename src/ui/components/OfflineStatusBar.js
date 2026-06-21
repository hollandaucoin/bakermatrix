import React from 'react';
import { useOffline } from '../context/OfflineContext.js';

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const OfflineStatusBar = () => {
  const {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncAt,
    lastSyncError,
    syncNow,
  } = useOffline();

  const showBar = !isOnline || pendingCount > 0 || lastSyncError;

  if (!showBar) {
    return null;
  }

  let message = '';
  let tone = styles.offlineBar;

  if (!isOnline) {
    message = pendingCount > 0
      ? `Offline · ${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to upload`
      : 'Offline · Showing cached data';
    tone = { ...styles.offlineBar, ...styles.offlineBarOffline };
  } else if (pendingCount > 0) {
    message = isSyncing
      ? 'Uploading saved changes...'
      : `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to upload`;
    tone = { ...styles.offlineBar, ...styles.offlineBarPending };
  } else if (lastSyncError) {
    message = lastSyncError;
    tone = { ...styles.offlineBar, ...styles.offlineBarError };
  }

  return (
    <div style={tone} className="offline-status-bar">
      <style>
        {`
          @media (max-width: 768px) {
            .offline-status-bar {
              flex-direction: column !important;
              align-items: stretch !important;
              padding: 0.625rem 1rem !important;
              gap: 0.5rem !important;
            }
            .offline-status-bar .sync-button {
              width: 100%;
            }
          }
        `}
      </style>
      <div style={styles.offlineBarContent}>
        <span style={styles.offlineBarMessage}>{message}</span>
        {lastSyncAt && isOnline && pendingCount === 0 && !lastSyncError && (
          <span style={styles.offlineBarMeta}>Last sync: {formatTime(lastSyncAt)}</span>
        )}
      </div>
      {isOnline && pendingCount > 0 && !isSyncing && (
        <button type="button" style={styles.syncButton} className="sync-button" onClick={syncNow}>
          Sync now
        </button>
      )}
    </div>
  );
};

const styles = {
  offlineBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '0.625rem 1.5rem',
    fontSize: '0.8125rem',
    fontWeight: '500',
    borderBottom: '1px solid transparent',
  },
  offlineBarOffline: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderBottomColor: '#fde68a',
  },
  offlineBarPending: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    borderBottomColor: '#bfdbfe',
  },
  offlineBarError: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    borderBottomColor: '#fecaca',
  },
  offlineBarContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    minWidth: 0,
  },
  offlineBarMessage: {
    lineHeight: 1.4,
  },
  offlineBarMeta: {
    fontSize: '0.75rem',
    opacity: 0.85,
  },
  syncButton: {
    flexShrink: 0,
    padding: '0.375rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: '600',
    borderRadius: '6px',
    border: '1px solid currentColor',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
  },
};

export default OfflineStatusBar;
