import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../util/api.js';
import { useNavigationGuard } from '../context/NavigationGuardContext.js';
import UnsavedChangesPopup from '../components/UnsavedChangesPopup.js';

const EMPTY_NOTES = {
  day0: '',
  day1: '',
  day2: '',
  day3: '',
  day4: '',
  day5: '',
};

const NOTE_KEYS = Object.keys(EMPTY_NOTES);

const normalizeNotes = (data = {}) => ({
  day0: data.day0 || '',
  day1: data.day1 || '',
  day2: data.day2 || '',
  day3: data.day3 || '',
  day4: data.day4 || '',
  day5: data.day5 || '',
});

const notesAreEqual = (a, b) => NOTE_KEYS.every((key) => a[key] === b[key]);

const NotesPage = () => {
  const [notes, setNotes] = useState(EMPTY_NOTES);
  const [savedNotes, setSavedNotes] = useState(EMPTY_NOTES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [lastSaved, setLastSaved] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null);

  const {
    registerGuard,
    pendingNavigation,
    clearPendingNavigation,
    completePendingNavigation,
  } = useNavigationGuard();

  const hasUnsavedChanges = useMemo(
    () => !notesAreEqual(notes, savedNotes),
    [notes, savedNotes]
  );

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    const handleSync = () => {
      fetchNotes({ afterSync: true });
    };
    window.addEventListener('offline-sync-complete', handleSync);
    return () => window.removeEventListener('offline-sync-complete', handleSync);
  }, []);

  useEffect(() => {
    return registerGuard({ hasUnsavedChanges });
  }, [hasUnsavedChanges, registerGuard]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const fetchNotes = async ({ afterSync = false } = {}) => {
    try {
      const { data, meta } = await api.get('/api/notes');
      const loadedNotes = normalizeNotes(data);
      setNotes(loadedNotes);
      setSavedNotes(loadedNotes);
      setCacheInfo(meta || null);
      if (data.updatedAt) {
        setLastSaved(new Date(data.updatedAt));
      } else {
        setLastSaved(null);
      }

      if (afterSync) {
        setMessage({ type: 'success', text: 'Successfully uploaded your saved notes.' });
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
      setMessage({ type: 'error', text: 'Error loading notes' });
      setCacheInfo(error.fromCache ? {
        fromCache: true,
        cachedAt: error.cachedAt,
        offline: !navigator.onLine,
      } : null);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (day, value) => {
    setNotes((prev) => ({
      ...prev,
      [day]: value,
    }));
    setMessage({ type: '', text: '' });
  };

  const saveNotes = useCallback(async () => {
    const response = await api.put('/api/notes', notes);
    setSavedNotes({ ...notes });
    setLastSaved(new Date(response.data?.updatedAt || Date.now()));
    setCacheInfo(response.meta || null);

    if (response.offline) {
      setMessage({
        type: 'success',
        text: 'Saved locally. Will upload when you\'re back online.',
      });
      return;
    }

    setMessage({ type: 'success', text: 'Notes saved successfully' });
  }, [notes]);

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await saveNotes();
    } catch (error) {
      console.error('Error saving notes:', error);
      setMessage({ type: 'error', text: error.message || 'Error saving notes' });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardCancel = () => {
    clearPendingNavigation();
  };

  const handleDiscardConfirm = () => {
    completePendingNavigation();
  };

  const handleSaveAndLeave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await saveNotes();
      completePendingNavigation();
    } catch (error) {
      console.error('Error saving notes:', error);
      setMessage({ type: 'error', text: error.message || 'Error saving notes' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container} className="notes-page">
        <div style={styles.header} className="page-header">
          <h1 style={styles.title} className="page-title">Notes</h1>
        </div>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container} className="notes-page">
      <style>
        {`
          @media (max-width: 768px) {
            .notes-page {
              padding: 1rem !important;
            }
            .notes-page .page-title {
              font-size: 1.75rem !important;
            }
            .notes-page .page-description {
              font-size: 1rem !important;
            }
            .notes-page .page-header {
              margin-bottom: 1.25rem !important;
              padding: 0.5rem 0 !important;
            }
            .notes-page .last-saved {
              text-align: left !important;
            }
            .notes-page .page-content {
              padding: 1rem !important;
            }
            .notes-page .day-section {
              margin-bottom: 1.25rem !important;
            }
            .notes-page textarea {
              font-size: 16px !important;
              min-height: 120px;
            }
            .notes-page .page-actions {
              justify-content: stretch !important;
            }
            .notes-page .save-button {
              width: 100% !important;
            }
          }
        `}
      </style>
      <div style={styles.header} className="page-header">
        <h1 style={styles.title} className="page-title">Notes</h1>
        <p style={styles.description} className="page-description">
          Write and edit notes for each day. Save works offline and uploads when you reconnect.
        </p>
      </div>

      {cacheInfo?.fromCache && (
        <div style={styles.cacheBanner}>
          {cacheInfo.offline ? 'Offline' : 'Cached'} view
          {cacheInfo.cachedAt && (
            <> · last updated {new Date(cacheInfo.cachedAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}</>
          )}
        </div>
      )}

      {message.text && (
        <div style={{
          ...styles.message,
          backgroundColor: message.type === 'error' ? '#fee2e2' : '#d1fae5',
          color: message.type === 'error' ? '#991b1b' : '#065f46',
          borderColor: message.type === 'error' ? '#fecaca' : '#a7f3d0',
        }}>
          {message.text}
        </div>
      )}

      {lastSaved && (
        <p style={styles.lastSaved} className="last-saved">
          Last saved: {lastSaved.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}
          {hasUnsavedChanges && <span style={styles.unsavedIndicator}> · Unsaved changes</span>}
        </p>
      )}
      {!lastSaved && hasUnsavedChanges && (
        <p style={styles.lastSaved}>
          <span style={styles.unsavedIndicator}>Unsaved changes</span>
        </p>
      )}

      <div style={styles.content} className="page-content">
        {[0, 1, 2, 3, 4, 5].map((dayNum) => (
          <div key={dayNum} style={styles.daySection} className="day-section">
            <label style={styles.dayLabel}>Day {dayNum}</label>
            <textarea
              value={notes[`day${dayNum}`]}
              onChange={(e) => handleChange(`day${dayNum}`, e.target.value)}
              placeholder={`Enter notes for Day ${dayNum}...`}
              style={styles.textarea}
              rows={8}
            />
          </div>
        ))}

        <div style={styles.actions} className="page-actions">
          <button
            onClick={handleSave}
            style={{
              ...styles.saveButton,
              ...(hasUnsavedChanges ? {} : styles.saveButtonIdle),
            }}
            className="save-button"
            disabled={saving || !hasUnsavedChanges}
          >
            {saving ? 'Saving...' : hasUnsavedChanges ? 'Save All Notes' : 'All Notes Saved'}
          </button>
        </div>
      </div>

      {pendingNavigation && (
        <UnsavedChangesPopup
          title="Unsaved Notes"
          message="You have unsaved note changes. Would you like to save before leaving?"
          saving={saving}
          onCancel={handleDiscardCancel}
          onDiscard={handleDiscardConfirm}
          onSave={handleSaveAndLeave}
        />
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '2rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
    padding: '1.5rem 0',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: '#0f172a',
    margin: '0 0 0.5rem 0',
    letterSpacing: '-0.025em',
    background: 'linear-gradient(135deg, #1e293b 0%, #3b82f6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  description: {
    fontSize: '1.125rem',
    color: '#64748b',
    margin: '0',
    fontWeight: '400',
    lineHeight: '1.6',
  },
  cacheBanner: {
    marginBottom: '1rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: '0.875rem',
    fontWeight: '500',
    textAlign: 'center',
  },
  lastSaved: {
    fontSize: '0.875rem',
    color: '#94a3b8',
    margin: '0 0 0.75rem 0',
    fontStyle: 'italic',
    textAlign: 'right',
  },
  unsavedIndicator: {
    color: '#d97706',
    fontStyle: 'normal',
    fontWeight: '600',
  },
  message: {
    padding: '1rem 1.25rem',
    borderRadius: '10px',
    marginBottom: '2rem',
    border: '1px solid',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    fontWeight: '500',
  },
  content: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
  },
  daySection: {
    marginBottom: '2rem',
  },
  dayLabel: {
    display: 'block',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '0.5rem',
  },
  textarea: {
    width: '100%',
    padding: '1rem',
    fontSize: '0.875rem',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    transition: 'all 0.2s ease-in-out',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '1.5rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid #f1f5f9',
  },
  saveButton: {
    padding: '0.875rem 2rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  },
  saveButtonIdle: {
    background: '#e2e8f0',
    color: '#94a3b8',
    cursor: 'default',
    boxShadow: 'none',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    gap: '1rem',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: '#64748b',
    fontSize: '1rem',
  },
};

export default NotesPage;
