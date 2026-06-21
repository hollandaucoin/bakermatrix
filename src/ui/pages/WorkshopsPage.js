import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../util/api.js';
import { useNavigationGuard } from '../context/NavigationGuardContext.js';
import UnsavedChangesPopup from '../components/UnsavedChangesPopup.js';

const normalizeWorkshopRows = (rows) =>
  rows.map(({ name, workshop1, workshop2 }) => ({
    name: name.trim(),
    workshop1,
    workshop2,
  }));

const rowsAreEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const WorkshopsPage = () => {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([{ id: Date.now(), name: '', workshop1: '', workshop2: '' }]);
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
    return !rowsAreEqual(normalizeWorkshopRows(rows), savedSnapshot);
  }, [rows, savedSnapshot]);

  useEffect(() => {
    fetchWorkshops();
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
    setSavedSnapshot(normalizeWorkshopRows(nextRows));
  }, []);

  const applySubmissionFromData = useCallback((data) => {
    if (data?.assignments && data.assignments.length > 0) {
      const submissionRows = data.assignments.map((assignment, index) => ({
        id: Date.now() + index,
        name: assignment.name || '',
        workshop1: assignment.workshop1?._id || assignment.workshop1 || '',
        workshop2: assignment.workshop2?._id || assignment.workshop2 || '',
      }));
      applyRows(submissionRows);
      return;
    }
    applyRows([{ id: Date.now(), name: '', workshop1: '', workshop2: '' }]);
  }, [applyRows]);

  const fetchWorkshops = async () => {
    try {
      const { data } = await api.get('/api/workshops');
      setWorkshops(data);
    } catch (error) {
      console.error('Error fetching workshops:', error);
      setMessage({ type: 'error', text: 'Error loading workshops' });
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingSubmission = async ({ afterSync = false } = {}) => {
    try {
      const { data } = await api.get('/api/workshop-submissions');
      setExistingSubmission(data);

      // Populate rows with existing submission data
      if (data.assignments && data.assignments.length > 0) {
        const submissionRows = data.assignments.map((assignment, index) => ({
          id: Date.now() + index,
          name: assignment.name || '',
          workshop1: assignment.workshop1?._id || assignment.workshop1 || '',
          workshop2: assignment.workshop2?._id || assignment.workshop2 || '',
        }));
        applyRows(submissionRows);
      } else {
        applyRows([{ id: Date.now(), name: '', workshop1: '', workshop2: '' }]);
      }

      if (afterSync) {
        const count = data.assignments?.length || 0;
        setMessage({
          type: 'success',
          text: count > 0
            ? `Successfully uploaded ${count} workshop assignment(s)`
            : 'Successfully uploaded your saved changes.',
        });
      }
    } catch (error) {
      if (error.response?.status === 404) {
        setExistingSubmission(null);
        applyRows([{ id: Date.now(), name: '', workshop1: '', workshop2: '' }]);
        if (afterSync) {
          setMessage({ type: 'success', text: 'Successfully uploaded your saved changes.' });
        }
        return;
      }
      console.error('Error fetching existing submission:', error);
      setExistingSubmission(null);
      applyRows([{ id: Date.now(), name: '', workshop1: '', workshop2: '' }]);
    }
  };

  const handleAddRow = () => {
    setRows([...rows, { id: Date.now(), name: '', workshop1: '', workshop2: '' }]);
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
        const updated = { ...row, [field]: value };
        // If workshop1 changes and conflicts with workshop2, clear workshop2
        if (field === 'workshop1' && value === row.workshop2) {
          updated.workshop2 = '';
        }
        // If workshop2 changes and conflicts with workshop1, clear workshop1
        if (field === 'workshop2' && value === row.workshop1) {
          updated.workshop1 = '';
        }
        return updated;
      }
      return row;
    }));
    setMessage({ type: '', text: '' });
  };

  const submitAssignments = async () => {
    const validRows = rows.filter(row =>
      row.name.trim() && row.workshop1 && row.workshop2 && row.workshop1 !== row.workshop2
    );

    if (validRows.length === 0) {
      setMessage({ type: 'error', text: 'Please fill in all required fields for at least one row' });
      return false;
    }

    const incompleteRows = rows.filter(row =>
      (row.name.trim() || row.workshop1 || row.workshop2) &&
      (!row.name.trim() || !row.workshop1 || !row.workshop2)
    );

    if (incompleteRows.length > 0) {
      setMessage({ type: 'error', text: 'Please fill in all fields for each row, or remove incomplete rows' });
      return false;
    }

    const assignments = validRows.map(row => ({
      name: row.name.trim(),
      workshop1: row.workshop1,
      workshop2: row.workshop2,
    }));

    const url = existingSubmission
      ? `/api/workshop-submissions/${existingSubmission._id}`
      : '/api/workshop-submissions';

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
    setMessage({ type: 'success', text: `Successfully ${action} ${assignments.length} workshop assignment(s)` });
    await fetchExistingSubmission();
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      await submitAssignments();
    } catch (error) {
      console.error('Error submitting workshops:', error);
      setMessage({ type: 'error', text: error.message || 'Error submitting workshop assignments' });
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
      console.error('Error submitting workshops:', error);
      setMessage({ type: 'error', text: error.message || 'Error submitting workshop assignments' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingSubmission) {
      return;
    }

    if (!window.confirm('Are you sure you want to delete your workshop submission? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.delete(`/api/workshop-submissions/${existingSubmission._id}`);

      if (response.offline) {
        setMessage({ type: 'success', text: 'Deletion saved locally. Will sync when you\'re back online.' });
      } else {
        setMessage({ type: 'success', text: 'Workshop submission deleted successfully' });
      }
      setExistingSubmission(null);
      applyRows([{ id: Date.now(), name: '', workshop1: '', workshop2: '' }]);
    } catch (error) {
      console.error('Error deleting workshop submission:', error);
      setMessage({ type: 'error', text: error.message || 'Error deleting workshop submission' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={styles.container} className="workshops-page">
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
          .workshops-page .table-row-toolbar {
            display: none;
          }
          @media (max-width: 768px) {
            .workshops-page {
              padding: 1rem !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
            .workshops-page .page-content {
              max-width: 100% !important;
              overflow: hidden !important;
            }
            .workshops-page .page-title {
              font-size: 1.75rem !important;
            }
            .workshops-page .page-description {
              font-size: 1rem !important;
            }
            .workshops-page .page-header {
              margin-bottom: 1.25rem !important;
              padding: 0.5rem 0 !important;
            }
            .workshops-page .last-submitted {
              text-align: left !important;
            }
            .workshops-page .table-header {
              display: none !important;
            }
            .workshops-page .table-row {
              display: flex !important;
              flex-direction: column !important;
              gap: 0.75rem !important;
              padding: 1rem !important;
              align-items: stretch !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
            .workshops-page .table-row-toolbar {
              display: flex !important;
              align-items: center !important;
              justify-content: space-between !important;
              width: 100% !important;
              margin-bottom: 0.25rem !important;
              padding-bottom: 0.75rem !important;
              border-bottom: 1px solid #e2e8f0 !important;
              box-sizing: border-box !important;
            }
            .workshops-page .table-row-label {
              font-size: 0.8125rem;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .workshops-page .table-cell-actions-desktop {
              display: none !important;
            }
            .workshops-page .table-cell {
              flex-direction: column !important;
              align-items: stretch !important;
              width: 100% !important;
              min-width: 0 !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
            .workshops-page .table-cell::before {
              content: attr(data-label);
              font-size: 0.75rem;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #475569;
              margin-bottom: 0.375rem;
            }
            .workshops-page .table-actions {
              flex-direction: column !important;
              align-items: stretch !important;
              gap: 0.75rem !important;
              padding: 1rem !important;
            }
            .workshops-page .action-buttons {
              flex-direction: column !important;
              margin-left: 0 !important;
              width: 100% !important;
            }
            .workshops-page .action-buttons button,
            .workshops-page .add-row-button {
              width: 100% !important;
            }
            .workshops-page input,
            .workshops-page select {
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
        <h1 style={styles.title} className="page-title">Workshops</h1>
        <p style={styles.description} className="page-description">
          {existingSubmission 
            ? 'Edit your workshop assignments below. You can modify, add, or remove entries, or delete your entire submission.'
            : 'Add workshop assignments by entering a name and two workshops for each delegate.'}
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
            <div style={styles.tableHeaderCell}>Workshop 1 <span style={styles.required}>*</span></div>
            <div style={styles.tableHeaderCell}>Workshop 2 <span style={styles.required}>*</span></div>
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
              <div style={styles.tableCell} className="table-cell" data-label="Workshop 1">
                <select
                  value={row.workshop1}
                  onChange={(e) => handleUpdateRow(row.id, 'workshop1', e.target.value)}
                  style={styles.select}
                  disabled={loading}
                >
                  <option value="">Select...</option>
                  {workshops
                    .filter(workshop => workshop._id !== row.workshop2)
                    .map(workshop => (
                      <option key={workshop._id} value={workshop._id}>
                        {workshop.name}
                      </option>
                    ))}
                </select>
              </div>
              <div style={styles.tableCell} className="table-cell" data-label="Workshop 2">
                <select
                  value={row.workshop2}
                  onChange={(e) => handleUpdateRow(row.id, 'workshop2', e.target.value)}
                  style={styles.select}
                  disabled={loading}
                >
                  <option value="">Select...</option>
                  {workshops
                    .filter(workshop => workshop._id !== row.workshop1)
                    .map(workshop => (
                      <option key={workshop._id} value={workshop._id}>
                        {workshop.name}
                      </option>
                    ))}
                </select>
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
          title="Unsaved Workshop Assignments"
          message="You have unsaved workshop assignment changes. Would you like to save before leaving?"
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
    gridTemplateColumns: '2fr 2fr 2fr 0.5fr',
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
    gridTemplateColumns: '2fr 2fr 2fr 0.5fr',
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

export default WorkshopsPage; 