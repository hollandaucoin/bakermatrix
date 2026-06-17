import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../util/api.js';
import { useNavigationGuard } from '../context/NavigationGuardContext.js';
import UnsavedChangesPopup from '../components/UnsavedChangesPopup.js';

const normalizeCommitteeRows = (rows) =>
  rows.map(({ name, committee }) => ({ name: name.trim(), committee }));

const rowsAreEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const CommitteesPage = () => {
  const [committees, setCommittees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([{ id: Date.now(), name: '', committee: '' }]);
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [existingSubmission, setExistingSubmission] = useState(null);

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
    fetchExistingSubmission();
  }, []);

  useEffect(() => {
    const handleSync = () => {
      fetchExistingSubmission({ afterSync: true });
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

  const submitAssignments = async () => {
    const validRows = rows.filter(row =>
      row.name.trim() && row.committee
    );

    if (validRows.length === 0) {
      setMessage({ type: 'error', text: 'Please fill in all required fields for at least one row' });
      return false;
    }

    const incompleteRows = rows.filter(row =>
      (row.name.trim() || row.committee) &&
      (!row.name.trim() || !row.committee)
    );

    if (incompleteRows.length > 0) {
      setMessage({ type: 'error', text: 'Please fill in all fields for each row, or remove incomplete rows' });
      return false;
    }

    const assignments = validRows.map(row => ({
      name: row.name.trim(),
      committee: row.committee,
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

  const handleDelete = async () => {
    if (!existingSubmission) {
      return;
    }

    if (!window.confirm('Are you sure you want to delete your committee submission? This action cannot be undone.')) {
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
    } catch (error) {
      console.error('Error deleting committee submission:', error);
      setMessage({ type: 'error', text: error.message || 'Error deleting committee submission' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={styles.container}>
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
        `}
      </style>
      <div style={styles.header}>
        <h1 style={styles.title}>Committees</h1>
        <p style={styles.description}>
          {existingSubmission
            ? 'Edit your committee assignments below. You can modify, add, or remove entries, or delete your entire submission.'
            : 'Add committee assignments by entering a name and selecting a committee for each delegate.'}
        </p>
      </div>

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
        <p style={styles.lastSubmitted}>
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

      <div style={styles.content}>
        <div style={styles.tableSection}>
          <div style={styles.tableHeader}>
            <div style={styles.tableHeaderCell}>Name <span style={styles.required}>*</span></div>
            <div style={styles.tableHeaderCell}>Committee <span style={styles.required}>*</span></div>
            <div style={styles.tableHeaderCell}></div>
          </div>

          {rows.map((row) => (
            <div key={row.id} style={styles.tableRow} className="table-row">
              <div style={styles.tableCell}>
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => handleUpdateRow(row.id, 'name', e.target.value)}
                  placeholder="Enter name"
                  style={styles.input}
                />
              </div>
              <div style={styles.tableCell}>
                <select
                  value={row.committee}
                  onChange={(e) => handleUpdateRow(row.id, 'committee', e.target.value)}
                  style={styles.select}
                  disabled={loading}
                >
                  <option value="">Select...</option>
                  {committees.map(committee => (
                    <option key={committee._id} value={committee._id}>
                      {committee.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.tableCell}>
                {rows.length > 1 && (
                  <button
                    onClick={() => handleRemoveRow(row.id)}
                    style={styles.removeButton}
                  >
                    X
                  </button>
                )}
              </div>
            </div>
          ))}

          <div style={styles.tableActions}>
            <button
              onClick={handleAddRow}
              style={styles.addRowButton}
              disabled={loading}
            >
              + Add Row
            </button>
            <div style={styles.actionButtons}>
              {existingSubmission && (
                <button
                  onClick={handleDelete}
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
  },
  input: {
    width: '100%',
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
    fontSize: '0.875rem',
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
