import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../util/api.js';
import { useNavigationGuard } from '../context/NavigationGuardContext.js';
import UnsavedChangesPopup from '../components/UnsavedChangesPopup.js';
import ConfirmPopup from '../components/ConfirmPopup.js';
import { formatActivityWithLocation } from '../util/locations.js';

const normalizeCommitteeRows = (rows) =>
  rows.map(({ name, committee }) => ({ name: name.trim(), committee }));

const rowsAreEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const CommitteesPage = ({ canSubmit = true }) => {
  const [activeTab, setActiveTab] = useState(canSubmit ? 'submit' : 'locations');
  const [committees, setCommittees] = useState([]);
  const [myCommittees, setMyCommittees] = useState([]);
  const [myCommitteesLoading, setMyCommitteesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([{ id: Date.now(), name: '', committee: '' }]);
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [showAllCommittees, setShowAllCommittees] = useState(false);

  const {
    registerGuard,
    pendingNavigation,
    clearPendingNavigation,
    completePendingNavigation,
  } = useNavigationGuard();

  const hasUnsavedChanges = useMemo(() => {
    if (savedSnapshot === null) return false;
    return !rowsAreEqual(normalizeCommitteeRows(rows), savedSnapshot);
  }, [rows, savedSnapshot]);

  useEffect(() => {
    fetchCommittees();
    if (canSubmit) {
      fetchExistingSubmission();
      fetchMyCommittees();
    } else {
      setMyCommitteesLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleSync = () => {
      if (canSubmit) {
        fetchExistingSubmission({ afterSync: true });
        fetchMyCommittees();
      }
      fetchCommittees();
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

  const applyRows = useCallback((nextRows) => {
    setRows(nextRows);
    setSavedSnapshot(normalizeCommitteeRows(nextRows));
  }, []);

  const applySubmissionFromData = useCallback((data) => {
    if (data?.assignments && data.assignments.length > 0) {
      const submissionRows = data.assignments.map((assignment, index) => ({
        id: Date.now() + index,
        name: assignment.name || '',
        committee: assignment.committee?._id || assignment.committee || '',
      }));
      applyRows(submissionRows);
      return;
    }
    applyRows([{ id: Date.now(), name: '', committee: '' }]);
  }, [applyRows]);

  const fetchCommittees = async () => {
    try {
      const { data } = await api.get('/api/committees');
      setCommittees(data);
    } catch (error) {
      console.error('Error fetching committees:', error);
      setMessage({ type: 'error', text: 'Error loading committees' });
    } finally {
      setLoading(false);
    }
  };

  const fetchMyCommittees = async () => {
    try {
      const { data } = await api.get('/api/committees/mine');
      setMyCommittees(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching owned committees:', error);
      setMyCommittees([]);
    } finally {
      setMyCommitteesLoading(false);
    }
  };

  const fetchExistingSubmission = async ({ afterSync = false } = {}) => {
    try {
      const { data } = await api.get('/api/committee-submissions');
      setExistingSubmission(data);

      // Populate rows with existing submission data
      if (data.assignments && data.assignments.length > 0) {
        const submissionRows = data.assignments.map((assignment, index) => ({
          id: Date.now() + index,
          name: assignment.name || '',
          committee: assignment.committee?._id || assignment.committee || '',
        }));
        applyRows(submissionRows);
      } else {
        applyRows([{ id: Date.now(), name: '', committee: '' }]);
      }

      if (afterSync) {
        const count = data.assignments?.length || 0;
        setMessage({
          type: 'success',
          text: count > 0
            ? `Successfully uploaded ${count} committee assignment(s)`
            : 'Successfully uploaded your saved changes.',
        });
      }
    } catch (error) {
      if (error.response?.status === 404) {
        setExistingSubmission(null);
        applyRows([{ id: Date.now(), name: '', committee: '' }]);
        if (afterSync) {
          setMessage({ type: 'success', text: 'Successfully uploaded your saved changes.' });
        }
        return;
      }
      console.error('Error fetching existing submission:', error);
      setExistingSubmission(null);
      applyRows([{ id: Date.now(), name: '', committee: '' }]);
    }
  };

  const handleAddRow = () => {
    setRows([...rows, { id: Date.now(), name: '', committee: '' }]);
  };

  const handleRemoveRow = (id) => {
    if (rows.length > 1) {
      setRows(rows.filter(row => row.id !== id));
    } else {
      setMessage({ type: 'error', text: 'At least one row is required' });
    }
  };

  const handleUpdateRow = (id, field, value) => {
    setRows(rows.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    }));
    setMessage({ type: '', text: '' });
  };

  const partitionCommitteesForRow = (row) => {
    const selectedElsewhere = new Set(
      rows
        .filter((entry) => entry.id !== row.id && entry.committee)
        .map((entry) => String(entry.committee))
    );
    const currentId = String(row.committee || '');

    let available = committees.filter((committee) => {
      const id = String(committee._id);
      if (selectedElsewhere.has(id)) return false;
      return (committee.enrollmentCount || 0) === 0;
    });
    let occupied = committees.filter((committee) => {
      const id = String(committee._id);
      if (id === currentId) return false;
      return selectedElsewhere.has(id) || (committee.enrollmentCount || 0) > 0;
    });

    // Keep the current selection visible even when it's otherwise "taken".
    if (currentId && !available.some((committee) => String(committee._id) === currentId)) {
      const current = committees.find((committee) => String(committee._id) === currentId);
      if (current) available = [...available, current];
    }

    return { available, occupied };
  };

  const formatCommitteeOption = (committee, { selectedElsewhere = false } = {}) => {
    const base = formatActivityWithLocation(committee.name, committee.location);
    if (selectedElsewhere) return `${base} (already in your list)`;
    return base;
  };

  const submitAssignments = async () => {
    const validRows = rows.filter(row =>
      row.name.trim()
    );

    if (validRows.length === 0) {
      setMessage({ type: 'error', text: 'Please enter a name for at least one row' });
      return false;
    }

    const incompleteRows = rows.filter(row =>
      row.committee && !row.name.trim()
    );

    if (incompleteRows.length > 0) {
      setMessage({ type: 'error', text: 'Please enter a name for every row with a committee selected' });
      return false;
    }

    const assignments = validRows.map(row => ({
      name: row.name.trim(),
      ...(row.committee ? { committee: row.committee } : {}),
    }));

    const url = existingSubmission
      ? `/api/committee-submissions/${existingSubmission._id}`
      : '/api/committee-submissions';

    const response = existingSubmission
      ? await api.put(url, { assignments })
      : await api.post(url, { assignments });

    if (response.offline) {
      setExistingSubmission(response.data);
      applySubmissionFromData(response.data);
      setMessage({
        type: 'success',
        text: `Saved locally (${assignments.length} assignment(s)). Will upload when you're back online.`,
      });
      return true;
    }

    const action = existingSubmission ? 'updated' : 'submitted';
    setMessage({ type: 'success', text: `Successfully ${action} ${assignments.length} committee assignment(s)` });
    await fetchExistingSubmission();
    await fetchMyCommittees();
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      await submitAssignments();
    } catch (error) {
      console.error('Error submitting committees:', error);
      setMessage({ type: 'error', text: error.message || 'Error submitting committee assignments' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAndLeave = async () => {
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const saved = await submitAssignments();
      if (saved) {
        completePendingNavigation();
      }
    } catch (error) {
      console.error('Error submitting committees:', error);
      setMessage({ type: 'error', text: error.message || 'Error submitting committee assignments' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = () => {
    if (!existingSubmission) {
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!existingSubmission) {
      return;
    }

    setDeleting(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.delete(`/api/committee-submissions/${existingSubmission._id}`);

      if (response.offline) {
        setMessage({ type: 'success', text: 'Deletion saved locally. Will sync when you\'re back online.' });
      } else {
        setMessage({ type: 'success', text: 'Committee submission deleted successfully' });
      }
      setExistingSubmission(null);
      applyRows([{ id: Date.now(), name: '', committee: '' }]);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting committee submission:', error);
      setMessage({ type: 'error', text: error.message || 'Error deleting committee submission' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={styles.container} className="committees-page">
      <style>
        {`
          button:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          button:active:not(:disabled) {
            transform: translateY(0);
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          }
          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          input:focus,
          select:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }
          .table-row:hover {
            background-color: #f8fafc;
          }
          input::placeholder {
            color: #94a3b8;
          }
          select option {
            padding: 0.5rem;
          }
          .delete-button:hover:not(:disabled) {
            background-color: #ef4444 !important;
            color: white !important;
            border-color: #ef4444 !important;
          }
          .committees-page .table-row-toolbar {
            display: none;
          }
          @media (max-width: 768px) {
            .committees-page {
              padding: 1rem !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
            .committees-page .page-content {
              max-width: 100% !important;
              overflow: hidden !important;
            }
            .committees-page .page-title {
              font-size: 1.75rem !important;
            }
            .committees-page .page-description {
              font-size: 1rem !important;
            }
            .committees-page .page-header {
              margin-bottom: 1.25rem !important;
              padding: 0.5rem 0 !important;
            }
            .committees-page .last-submitted {
              text-align: left !important;
            }
            .committees-page .table-header {
              display: none !important;
            }
            .committees-page .table-row {
              display: flex !important;
              flex-direction: column !important;
              gap: 0.75rem !important;
              padding: 1rem !important;
              align-items: stretch !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
            .committees-page .table-row-toolbar {
              display: flex !important;
              align-items: center !important;
              justify-content: space-between !important;
              width: 100% !important;
              margin-bottom: 0.25rem !important;
              padding-bottom: 0.75rem !important;
              border-bottom: 1px solid #e2e8f0 !important;
              box-sizing: border-box !important;
            }
            .committees-page .table-row-label {
              font-size: 0.8125rem;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .committees-page .table-cell-actions-desktop {
              display: none !important;
            }
            .committees-page .table-cell {
              flex-direction: column !important;
              align-items: stretch !important;
              width: 100% !important;
              min-width: 0 !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
            .committees-page .table-cell::before {
              content: attr(data-label);
              font-size: 0.75rem;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #475569;
              margin-bottom: 0.375rem;
            }
            .committees-page .table-actions {
              flex-direction: column !important;
              align-items: stretch !important;
              gap: 0.75rem !important;
              padding: 1rem !important;
            }
            .committees-page .action-buttons {
              flex-direction: column !important;
              margin-left: 0 !important;
              width: 100% !important;
            }
            .committees-page .action-buttons button,
            .committees-page .add-row-button {
              width: 100% !important;
            }
            .committees-page input,
            .committees-page select {
              font-size: 16px !important;
              width: 100% !important;
              max-width: 100% !important;
              min-width: 0 !important;
              box-sizing: border-box !important;
            }
          }
        `}
      </style>
      <div style={styles.header} className="page-header">
        <h1 style={styles.title} className="page-title">Committees</h1>
        <p style={styles.description} className="page-description">
          {activeTab === 'submit'
            ? (existingSubmission
              ? 'Edit delegate names and committee assignments below. Committees can be left blank and added later.'
              : 'Enter delegate names now. Committee selections are optional and can be added later.')
            : activeTab === 'mine'
              ? 'See the delegates assigned to committees you lead.'
              : 'Find where every committee meets.'}
        </p>
      </div>

      <div style={styles.tabs}>
        {canSubmit && (
          <button
            type="button"
            onClick={() => setActiveTab('submit')}
            style={{ ...styles.tab, ...(activeTab === 'submit' ? styles.activeTab : {}) }}
          >
            Submit Assignments
          </button>
        )}
        {canSubmit && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('mine');
              fetchMyCommittees();
            }}
            style={{ ...styles.tab, ...(activeTab === 'mine' ? styles.activeTab : {}) }}
          >
            My Committee
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setActiveTab('locations');
            fetchCommittees();
          }}
          style={{ ...styles.tab, ...(activeTab === 'locations' ? styles.activeTab : {}) }}
        >
          Locations
        </button>
      </div>

      {activeTab === 'submit' ? (
        <>
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

      {existingSubmission && (existingSubmission.updatedAt || existingSubmission.pendingSync) && (
        <p style={styles.lastSubmitted} className="last-submitted">
          {existingSubmission.pendingSync ? (
            <span style={styles.pendingSyncIndicator}>Saved locally · waiting to upload</span>
          ) : (
            <>
              Last submitted: {new Date(existingSubmission.updatedAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </>
          )}
          {hasUnsavedChanges && <span style={styles.unsavedIndicator}> · Unsaved changes</span>}
        </p>
      )}
      {!existingSubmission?.updatedAt && hasUnsavedChanges && (
        <p style={styles.lastSubmitted}>
          <span style={styles.unsavedIndicator}>Unsaved changes</span>
        </p>
      )}

      <div style={styles.content} className="page-content">
        <div style={styles.tableSection} className="table-section">
          <div style={styles.tableHeader} className="table-header">
            <div style={styles.tableHeaderCell}>Name <span style={styles.required}>*</span></div>
            <div style={{ ...styles.tableHeaderCell, ...styles.committeeHeaderCell }}>
              <span>Committee (optional)</span>
              <button
                type="button"
                onClick={() => setShowAllCommittees((current) => !current)}
                style={styles.showAllCommitteesButton}
              >
                {showAllCommittees ? 'Hide assigned' : 'Show all'}
              </button>
            </div>
            <div style={styles.tableHeaderCell}></div>
          </div>

          {rows.map((row, rowIndex) => (
            <div key={row.id} style={styles.tableRow} className="table-row">
              {rows.length > 1 && (
                <div className="table-row-toolbar">
                  <span className="table-row-label">Entry {rowIndex + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(row.id)}
                    style={styles.removeRowButton}
                    className="remove-row-button"
                  >
                    X
                  </button>
                </div>
              )}
              <div style={styles.tableCell} className="table-cell" data-label="Name">
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => handleUpdateRow(row.id, 'name', e.target.value)}
                  placeholder="Enter name"
                  style={styles.input}
                />
              </div>
              <div style={styles.tableCell} className="table-cell" data-label="Committee">
                {(() => {
                  const selectedElsewhere = new Set(
                    rows
                      .filter((entry) => entry.id !== row.id && entry.committee)
                      .map((entry) => String(entry.committee))
                  );
                  const { available, occupied } = partitionCommitteesForRow(row);
                  return (
                    <select
                      value={row.committee}
                      onChange={(e) => handleUpdateRow(row.id, 'committee', e.target.value)}
                      style={styles.select}
                      disabled={loading}
                    >
                      <option value="">Select...</option>
                      <optgroup label="Available">
                        {available.map((committee) => (
                          <option key={committee._id} value={committee._id}>
                            {formatCommitteeOption(committee)}
                          </option>
                        ))}
                      </optgroup>
                      {showAllCommittees && occupied.length > 0 && (
                        <optgroup label="Already assigned">
                          {occupied.map((committee) => (
                            <option key={committee._id} value={committee._id}>
                              {formatCommitteeOption(committee, {
                                selectedElsewhere: selectedElsewhere.has(String(committee._id)),
                              })}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  );
                })()}
              </div>
              <div style={styles.tableCell} className="table-cell table-cell-actions table-cell-actions-desktop">
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(row.id)}
                    style={styles.removeButton}
                    aria-label="Remove row"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}

          <div style={styles.tableActions} className="table-actions">
            <button
              onClick={handleAddRow}
              style={styles.addRowButton}
              className="add-row-button"
              disabled={loading}
            >
              + Add Row
            </button>
            <div style={styles.actionButtons} className="action-buttons">
              {existingSubmission && (
                <button
                  onClick={handleDeleteClick}
                  style={styles.deleteButton}
                  className="delete-button"
                  disabled={deleting || loading}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
              <button
                onClick={handleSubmit}
                style={{
                  ...styles.submitButton,
                  ...(!hasUnsavedChanges ? styles.submitButtonIdle : {}),
                }}
                disabled={submitting || loading || !hasUnsavedChanges}
              >
                {submitting
                  ? (existingSubmission ? 'Updating...' : 'Submitting...')
                  : (existingSubmission ? 'Update' : 'Submit')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmPopup
          title="Delete Committee Submission?"
          message="Are you sure you want to delete your committee submission? This action cannot be undone."
          confirmLabel="DELETE"
          loadingLabel="DELETING..."
          loading={deleting}
          destructive
          onCancel={() => {
            if (!deleting) setShowDeleteConfirm(false);
          }}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {pendingNavigation && (
        <UnsavedChangesPopup
          title="Unsaved Committee Assignments"
          message="You have unsaved committee assignment changes. Would you like to save before leaving?"
          saving={submitting}
          saveLabel={existingSubmission ? 'UPDATE' : 'SUBMIT'}
          onCancel={clearPendingNavigation}
          onDiscard={completePendingNavigation}
          onSave={handleSaveAndLeave}
        />
      )}
        </>
      ) : activeTab === 'mine' ? (
        <div style={styles.myLists}>
          {myCommitteesLoading ? (
            <p style={styles.emptyState}>Loading your committee…</p>
          ) : myCommittees.length === 0 ? (
            <p style={styles.emptyState}>
              You are not assigned to a committee yet. An administrator can assign one from Committee Lists.
            </p>
          ) : (
            myCommittees.map(({ committee, names, count }) => (
              <section key={committee._id} style={styles.myListCard}>
                <div style={styles.myListHeader}>
                  <div>
                    <h2 style={styles.myListTitle}>{committee.name}</h2>
                    {committee.location && (
                      <p style={styles.locationLabel}>{committee.location}</p>
                    )}
                  </div>
                  <span style={styles.countBadge}>{count} {count === 1 ? 'delegate' : 'delegates'}</span>
                </div>
                <div style={styles.rosterCard}>
                  <h3 style={styles.rosterTitle}>
                    Delegates <span style={styles.rosterCount}>({count})</span>
                  </h3>
                  {names.length === 0 ? (
                    <p style={styles.emptyList}>No delegates assigned yet.</p>
                  ) : (
                    <div style={styles.nameGrid}>
                      {names.map((entry, index) => (
                        <div key={`${entry.name}-${index}`} style={styles.nameItem}>
                          <span>{entry.name}</span>
                          {entry.seniorCounselor?.name && (
                            <span style={styles.submittedBy}>Submitted by {entry.seniorCounselor.name}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ))
          )}
        </div>
      ) : (
        <div style={styles.directoryCard}>
          {loading ? (
            <p style={styles.emptyState}>Loading locations…</p>
          ) : committees.length === 0 ? (
            <p style={styles.emptyState}>No committees found.</p>
          ) : (
            <>
              <div style={styles.directoryHeader}>
                <span>Committee</span>
                <span>Location</span>
              </div>
              {committees.map((committee) => (
                <div key={committee._id} style={styles.directoryRow}>
                  <span style={styles.directoryName}>{committee.name}</span>
                  <span style={styles.directoryLocation}>{committee.location || '—'}</span>
                </div>
              ))}
            </>
          )}
        </div>
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
  tabs: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '2rem',
    borderBottom: '2px solid #e2e8f0',
  },
  tab: {
    padding: '0.75rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#64748b',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    marginBottom: '-2px',
  },
  activeTab: {
    color: '#3b82f6',
    borderBottomColor: '#3b82f6',
  },
  myLists: {
    display: 'grid',
    gap: '1.25rem',
  },
  myListCard: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  myListHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '1rem',
  },
  myListTitle: {
    margin: 0,
    color: '#1e293b',
    fontSize: '1.35rem',
  },
  locationLabel: {
    margin: '0.25rem 0 0',
    color: '#64748b',
    fontSize: '0.9rem',
    fontWeight: '500',
  },
  countBadge: {
    padding: '0.3rem 0.65rem',
    borderRadius: '999px',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    fontSize: '0.8rem',
    fontWeight: '700',
    whiteSpace: 'nowrap',
  },
  rosterCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '1rem',
  },
  rosterTitle: {
    margin: '0 0 0.75rem',
    color: '#334155',
    fontSize: '1rem',
  },
  rosterCount: {
    color: '#64748b',
    fontWeight: '500',
  },
  nameGrid: {
    display: 'grid',
    gap: '0.5rem',
  },
  nameItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    padding: '0.7rem',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
    color: '#1e293b',
    fontWeight: '600',
  },
  submittedBy: {
    color: '#64748b',
    fontSize: '0.75rem',
    fontWeight: '400',
  },
  emptyState: {
    padding: '2rem',
    textAlign: 'center',
    color: '#64748b',
    backgroundColor: 'white',
    borderRadius: '12px',
  },
  emptyList: {
    color: '#64748b',
    margin: 0,
  },
  directoryCard: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  directoryHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '1rem',
    padding: '0 0.75rem 0.75rem',
    marginBottom: '0.5rem',
    borderBottom: '1px solid #e2e8f0',
    color: '#64748b',
    fontSize: '0.75rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  directoryRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '1rem',
    padding: '0.85rem 0.75rem',
    borderBottom: '1px solid #f1f5f9',
    alignItems: 'center',
  },
  directoryName: {
    color: '#1e293b',
    fontWeight: '600',
  },
  directoryLocation: {
    color: '#334155',
    fontWeight: '500',
  },
  lastSubmitted: {
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
  pendingSyncIndicator: {
    color: '#1d4ed8',
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
    padding: '0',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
  },
  required: {
    color: '#ef4444',
    marginLeft: '2px',
  },
  tableSection: {
    width: '100%',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 2fr 0.5fr',
    gap: '1.5rem',
    padding: '1.25rem 1.5rem',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    fontWeight: '600',
    fontSize: '0.875rem',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tableHeaderCell: {
    display: 'flex',
    alignItems: 'center',
  },
  committeeHeaderCell: {
    flexWrap: 'wrap',
    gap: '0.5rem 0.75rem',
    justifyContent: 'space-between',
  },
  showAllCommitteesButton: {
    padding: 0,
    margin: 0,
    color: '#3b82f6',
    background: 'none',
    border: 'none',
    fontSize: '0.75rem',
    fontWeight: '600',
    textTransform: 'none',
    letterSpacing: 'normal',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 2fr 0.5fr',
    gap: '1.5rem',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #f1f5f9',
    alignItems: 'center',
    transition: 'background-color 0.2s ease-in-out',
  },
  tableCell: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  },
  input: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    transition: 'all 0.2s ease-in-out',
    backgroundColor: '#ffffff',
    color: '#1e293b',
  },
  select: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    color: '#1e293b',
    appearance: 'none',
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")',
    backgroundPosition: 'right 0.5rem center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '1.5em 1.5em',
    paddingRight: '2.5rem',
  },
  removeButton: {
    padding: '0.5rem 0.75rem',
    fontSize: '1.125rem',
    lineHeight: 1,
    fontWeight: '600',
    backgroundColor: 'transparent',
    color: '#ef4444',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    minWidth: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeRowButton: {
    padding: '0.5rem 0.75rem',
    fontSize: '0.8125rem',
    fontWeight: '600',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    flexShrink: 0,
  },
  tableActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    marginTop: '0',
    padding: '1.5rem',
    backgroundColor: '#f8fafc',
    borderTop: '1px solid #e2e8f0',
  },
  actionButtons: {
    display: 'flex',
    gap: '0.75rem',
    marginLeft: 'auto',
  },
  addRowButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  },
  deleteButton: {
    padding: '0.875rem 1.75rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    backgroundColor: '#ffffff',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  },
  submitButton: {
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
  submitButtonIdle: {
    background: '#e2e8f0',
    color: '#94a3b8',
    cursor: 'default',
    boxShadow: 'none',
  },
};

export default CommitteesPage;
