import React, { useEffect, useState } from 'react';
import api from '../../util/api.js';
import { councilHasPostingSeparationViolation } from '../../util/matrixCouncil.js';

// Separate Component for the discard confirmation popup
const DiscardConfirmComponent = ({ onDiscard, onSave, onCancel, matrixName, setMatrixName, pendingAction }) => {
  const getActionText = () => {
    if (pendingAction === 'generate') {
      return 'DISCARD & CONTINUE';
    } else if (pendingAction === 'back') {
      return 'DISCARD & LEAVE';
    } else if (pendingAction === 'next') {
      return 'DISCARD & CONTINUE';
    }
    return 'DISCARD & CONTINUE';
  };

  return (
    <div>
      <p style={styles.popupMessage}>
        You have an unsaved matrix. What would you like to do?
      </p>
      
      {/* Matrix Name Input */}
      <div style={styles.nameInputContainer}>
        <label style={styles.nameInputLabel}>Matrix Name:</label>
        <input
          type="text"
          value={matrixName}
          onChange={(e) => setMatrixName(e.target.value)}
          placeholder="Enter a name for this matrix..."
          style={styles.nameInput}
          required
        />
      </div>
      
      <div style={styles.popupFooter}>
        <div style={styles.popupFooterRight}>
          <button type="button" style={styles.cancelButton} onClick={onCancel}>
            CANCEL
          </button>
          <button type="button" style={styles.discardButton} onClick={onDiscard}>
            {getActionText()}
          </button>
          <button type="button" style={styles.saveButton} onClick={onSave}>
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
};

const MatrixView = ({ onSaveAndContinue, goBack, goNext, isFirst, isLast, setMatrixNavigationGuard, matrixNavigationGuard, handleSaveComplete }) => {
  const [currentMatrix, setCurrentMatrix] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDiscardPopup, setShowDiscardPopup] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [autoDiscard, setAutoDiscard] = useState(false);
  const [matrixName, setMatrixName] = useState('');
  const [showSavePopup, setShowSavePopup] = useState(false);

  useEffect(() => {
    fetchRecentMatrix();
  }, []);

  // Update navigation guard when matrix state changes
  useEffect(() => {
    if (setMatrixNavigationGuard) {
      setMatrixNavigationGuard(prev => ({
        ...prev,
        hasUnsavedMatrix: currentMatrix && !currentMatrix.saved,
        matrixName: currentMatrix?.name || ''
      }));
    }
  }, [currentMatrix, setMatrixNavigationGuard]);

  // Handle save request from navigation guard
  useEffect(() => {
    if (matrixNavigationGuard?.saveRequested && currentMatrix) {
      saveMatrix();
    }
  }, [matrixNavigationGuard?.saveRequested, currentMatrix]);

  const fetchRecentMatrix = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get(`/api/matrices/recent`);
      if (response.data) {
        setCurrentMatrix(response.data);
        setMatrixName(response.data.name || '');
      } else {
        setCurrentMatrix(null);
        setMatrixName('');
      }
    } catch (err) {
      // Check if it's a 404 (no matrices found) or other error
      if (err.response && err.response.status === 404) {
        // No matrices found - this is not an error, just an empty state
        setCurrentMatrix(null);
        setMatrixName('');
        setError(null);
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const generateNewMatrix = async () => {
    // If there's a current matrix that's not saved and auto-discard is not checked, show confirmation
    if (currentMatrix && !currentMatrix.saved && !autoDiscard) {
      openDiscardPopup();
      setPendingAction('generate');
      return;
    }

    try {
      setIsGenerating(true);
      const response = await api.get(`/api/matrices/generate`);
      if (response.data) {
        setCurrentMatrix(response.data);
        // Don't clear the name here - let the popup handle it if needed
        window.showToast('Matrix generated successfully!', 'success');
      } else {
        window.showToast('Failed to generate matrix - no data received.', 'error');
      }
    } catch (err) {
      console.error('Error generating matrix:', err);
      window.showToast('Failed to generate matrix.', 'error');
    } finally {
      setIsGenerating(false);
      setPendingAction(null);
    }
  };

  const handleDiscardConfirm = async (action) => {
    setShowDiscardPopup(false);
    
    if (action === 'save') {
      await saveMatrix();
    }
    
    // Proceed with the pending action
    if (pendingAction === 'generate') {
      try {
        setIsGenerating(true);
        const response = await api.get(`/api/matrices/generate`);
        if (response.data) {
          setCurrentMatrix(response.data);
          setMatrixName(''); // Clear name for new matrix after popup is closed
          window.showToast('Matrix generated successfully!', 'success');
        } else {
          window.showToast('Failed to generate matrix - no data received.', 'error');
        }
      } catch (err) {
        console.error('Error generating matrix:', err);
        window.showToast('Failed to generate matrix.', 'error');
      } finally {
        setIsGenerating(false);
        setPendingAction(null);
      }
    } else if (pendingAction === 'back') {
      if (goBack) {
        goBack();
      }
      setPendingAction(null);
    } else if (pendingAction === 'next') {
      if (onSaveAndContinue) {
        onSaveAndContinue();
      }
      setPendingAction(null);
    }
  };

  const handleDiscardCancel = () => {
    setShowDiscardPopup(false);
    setPendingAction(null);
  };

  const openDiscardPopup = () => {
    // Set the current matrix name in the input field
    setMatrixName(currentMatrix?.name || '');
    setShowDiscardPopup(true);
  };

  const handleNavigationAttempt = (navigationAction) => {
    // If there's a current matrix that's not saved and auto-discard is not checked, show confirmation
    if (currentMatrix && !currentMatrix.saved && !autoDiscard) {
      setPendingAction(navigationAction);
      openDiscardPopup();
      return;
    }
    
    // Otherwise proceed with navigation
    if (navigationAction === 'back' && goBack) {
      goBack();
    } else if (navigationAction === 'next' && onSaveAndContinue) {
      onSaveAndContinue();
    }
  };

  const saveMatrix = async () => {
    if (!currentMatrix) return;
    
    // Use matrix name from navigation guard if available, otherwise use local state
    const nameToSave = matrixNavigationGuard?.saveMatrixName?.trim() || 
                      matrixName.trim() || 
                      (currentMatrix?.name || 'Unnamed Matrix');
    
    try {
      setIsSaving(true);
      setSaveSuccess(false);
      
      await api.put(`/api/matrices/${currentMatrix._id}`, { 
        saved: true,
        name: nameToSave
      });
      
      setSaveSuccess(true);
      window.showToast('Matrix saved successfully!', 'success');
      
      // Update the current matrix with the new name
      setCurrentMatrix(prev => prev ? { ...prev, name: nameToSave, saved: true } : null);
      setMatrixName(nameToSave); // Update the input field with the saved name
      
      // Refresh the recent matrix
      await fetchRecentMatrix();
    
      // Call handleSaveComplete to trigger navigation if save was requested from popup
      if (handleSaveComplete) {
        handleSaveComplete();
      }
    } catch (err) {
      console.error('Error saving matrix:', err);
      window.showToast('Failed to save matrix.', 'error');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  // The Save button prompts for a name first (matching the navigation save flow).
  const handleSaveClick = () => {
    setMatrixName(currentMatrix?.name || matrixName || '');
    setShowSavePopup(true);
  };

  const handleSaveConfirm = async () => {
    setShowSavePopup(false);
    await saveMatrix();
  };

  const formatMatrixAsCSV = (matrix) => {
    if (!matrix || !matrix.councils) return '';

    const headers = [
      '#',
      'Council Room',
      'Council Schools',
      'Senior Counselor',
      'Council JC(s)',
      'JC Dorm(s)',
      'SC Posting Dorm'
    ];

    const csvRows = [headers.join(',')];

    matrix.councils.forEach(council => {
      const schools = council.schools?.map(school => school.replace(/High School/gi, 'HS')).join('\n') || '';
      const juniorCounselors = council.juniorCounselors?.map(jc => jc.name).join('\n') || '';
      const jcDorms = council.juniorCounselors?.map(jc => jc.dorm).join('\n') || '';
      const scPostingDorm = council.scPostingDorm ? `${council.scPostingDorm.name}\n(${council.scPostingDorm.jcs})` : '';
      
      // Add partner to senior counselor name if available
      const seniorCounselorWithPartner = council.scPostingDorm?.partner ? 
        `${council.seniorCounselor}\n(${council.scPostingDorm.partner})` : 
        council.seniorCounselor;
      
      const row = [
        council.number,
        council.room,
        `"${schools}"`,
        `"${seniorCounselorWithPartner}"`,
        `"${juniorCounselors}"`,
        `"${jcDorms}"`,
        `"${scPostingDorm}"`
      ];
      
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  };

  const downloadCSV = (matrix) => {
    const csv = formatMatrixAsCSV(matrix);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${matrix.name}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const copyToClipboard = (matrix) => {
    const csv = formatMatrixAsCSV(matrix);
    navigator.clipboard.writeText(csv).then(() => {
      window.showToast('CSV copied to clipboard!', 'success');
    }).catch(() => {
      window.showToast('Failed to copy to clipboard.', 'error');
    });
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading matrices...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Matrix Generator</h1>
        <p style={styles.subtitle}>Generate and manage matrices for counselor assignments</p>
      </div>

      {/* Top Navigation */}
      <div style={styles.navigationTop}>
        <div style={styles.navigationButtons}>
          {!isFirst && (
            <button style={styles.navButton} onClick={() => handleNavigationAttempt('back')}>
              ← Back
            </button>
          )}
          <div style={styles.navigationSpacer} />
          {!isLast && (
            <button 
              style={!currentMatrix ? styles.navButtonDisabled : styles.navButton} 
              onClick={() => handleNavigationAttempt('next')}
              disabled={!currentMatrix}
            >
              Continue →
            </button>
          )}
        </div>
        {currentMatrix && (
          <button style={styles.generateButtonTop} onClick={generateNewMatrix} disabled={isGenerating}>
            {isGenerating ? '⏳' : '🔄'}
          </button>
        )}
        {currentMatrix && (
          <div style={styles.autoDiscardContainer}>
            <label style={styles.autoDiscardLabel}>
              <input
                type="checkbox"
                checked={autoDiscard}
                onChange={(e) => setAutoDiscard(e.target.checked)}
                style={styles.autoDiscardCheckbox}
              />
              <span style={styles.autoDiscardText}>Auto-discard</span>
            </label>
          </div>
        )}
      </div>

      {/* Matrix Display */}
      {currentMatrix ? (
        <div style={styles.section}>
          <div style={styles.actionButtons}>
            <button
              style={styles.actionButton}
              onClick={handleSaveClick}
              disabled={isSaving || currentMatrix?.saved}
            >
              {isSaving ? 'Saving...' : saveSuccess ? '✓ Saved!' : currentMatrix?.saved ? '✓ Saved' : '💾 Save Matrix'}
            </button>
            <button 
              style={styles.actionButton}
              onClick={() => downloadCSV(currentMatrix)}
            >
              💾 Download CSV
            </button>
          </div>

          {currentMatrix.balance && (
            currentMatrix.balance.issues?.length > 0 ? (
              <div style={{ ...styles.balanceBanner, ...styles.balanceBannerWarning }}>
                <strong>⚠️ Distribution issues</strong>
                <ul style={styles.balanceList}>
                  {currentMatrix.balance.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                </ul>
              </div>
            ) : (
              <div style={{ ...styles.balanceBanner, ...styles.balanceBannerOk }}>
                ✓ Distribution is balanced across both halves.
              </div>
            )
          )}
          {currentMatrix.councils?.some((c) => c.conflictingSchools?.length > 0) && (
            <div style={styles.legend}>
              Schools in <span style={styles.legendConflict}>red</span> are assigned to an SC/JC they conflict with (previous or associated school).
            </div>
          )}
          {currentMatrix.councils?.some(councilHasPostingSeparationViolation) && (
            <div style={styles.legend}>
              SC posting dorms in <span style={styles.legendConflict}>red</span> house this council&apos;s own junior counselor.
            </div>
          )}

          {/* Table View */}
          <div style={styles.tableContainer}>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.tableHeaderCell}>#</th>
                    <th style={styles.tableHeaderCell}>Room</th>
                    <th style={styles.tableHeaderCell}>Schools</th>
                    <th style={styles.tableHeaderCell}>Senior Counselor</th>
                    <th style={styles.tableHeaderCell}>Junior Counselor(s)</th>
                    <th style={styles.tableHeaderCell}>JC Dorm(s)</th>
                    <th style={styles.tableHeaderCell}>SC Posting Dorm</th>
                  </tr>
                </thead>
                <tbody>
                  {currentMatrix.councils?.map((council, index) => (
                    <React.Fragment key={index}>
                    <tr
                      style={{
                        ...styles.tableRow,
                        ...(council.hasConflicts ? styles.tableRowConflict : {})
                      }}
                      className="table-row"
                    >
                      <td style={styles.tableCell}>{council.number}</td>
                      <td style={styles.tableCellRoom}>{council.room}</td>
                      <td style={styles.tableCell}>
                        <div style={styles.schoolsList}>
                          {council.schools?.map((school, i) => {
                            const isConflict = council.conflictingSchools?.includes(school);
                            return (
                              <div
                                key={i}
                                style={{ ...styles.schoolItem, ...(isConflict ? styles.schoolItemConflict : {}) }}
                                title={isConflict ? 'Conflict: SC/JC previous or associated school' : undefined}
                              >
                                {school.replace(/High School/gi, 'HS')}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td style={styles.tableCell}>
                        <div>
                          <div>{council.seniorCounselor}</div>
                          {council.scPostingDorm?.partner && (
                            <div style={styles.scPartner}>({council.scPostingDorm.partner})</div>
                          )}
                        </div>
                      </td>
                      <td style={styles.tableCell}>
                        <div style={styles.jcList}>
                          {council.juniorCounselors?.map((jc, i) => (
                            <div key={i} style={styles.jcName}>{jc.name}</div>
                          ))}
                        </div>
                      </td>
                      <td style={styles.tableCell}>
                        <div style={styles.jcList}>
                          {council.juniorCounselors?.map((jc, i) => (
                            <div key={i} style={styles.jcDorm}>{jc.dorm}</div>
                          ))}
                        </div>
                      </td>
                      <td style={styles.tableCell}>
                        {council.scPostingDorm ? (
                          <div
                            style={councilHasPostingSeparationViolation(council) ? styles.scPostingDormConflict : undefined}
                            title={councilHasPostingSeparationViolation(council)
                              ? 'SC is posting in their own JC\'s dorm'
                              : undefined}
                          >
                            <div style={styles.scDormName}>{council.scPostingDorm.name}</div>
                            <div style={styles.scDormJcs}>{council.scPostingDorm.jcs}</div>
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                    {currentMatrix.balance?.group1?.size === council.number && index < currentMatrix.councils.length - 1 && (
                      <tr><td colSpan={7} style={styles.halfDivider}>— Camp Split —</td></tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : !isLoading && !error ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>⚖️</div>
          <h3 style={styles.emptyTitle}>No Matrix Found</h3>
          <p style={styles.emptyMessage}>
            No matrix has been generated yet. Click the generate button below to create your first matrix.
          </p>
          <button style={styles.generateButton} onClick={generateNewMatrix} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      ) : null}

      {/* Discard Confirmation Popup */}
      {showDiscardPopup && (
        <div style={styles.popupOverlay} onClick={handleDiscardCancel}>
          <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
            <div style={styles.popupHeader}>
              <h2 style={styles.popupTitle}>Discard Current Matrix?</h2>
              <button style={styles.closeButton} onClick={handleDiscardCancel}>×</button>
            </div>
            <DiscardConfirmComponent
              onDiscard={() => handleDiscardConfirm('discard')}
              onSave={() => handleDiscardConfirm('save')}
              onCancel={handleDiscardCancel}
              matrixName={matrixName}
              setMatrixName={setMatrixName}
              pendingAction={pendingAction}
            />
          </div>
        </div>
      )}

      {/* Save Matrix Popup (prompts for a name) */}
      {showSavePopup && (
        <div style={styles.popupOverlay} onClick={() => setShowSavePopup(false)}>
          <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
            <div style={styles.popupHeader}>
              <h2 style={styles.popupTitle}>Save Matrix</h2>
              <button style={styles.closeButton} onClick={() => setShowSavePopup(false)}>×</button>
            </div>
            <p style={styles.popupMessage}>
              Give this matrix a name so you can find it later.
            </p>
            <div style={styles.nameInputContainer}>
              <label style={styles.nameInputLabel}>Matrix Name:</label>
              <input
                type="text"
                value={matrixName}
                onChange={(e) => setMatrixName(e.target.value)}
                placeholder="Enter a name for this matrix..."
                style={styles.nameInput}
                autoFocus
                required
              />
            </div>
            <div style={styles.popupFooter}>
              <div style={styles.popupFooterRight}>
                <button type="button" style={styles.cancelButton} onClick={() => setShowSavePopup(false)}>
                  CANCEL
                </button>
                <button type="button" style={styles.saveButton} onClick={handleSaveConfirm} disabled={isSaving}>
                  {isSaving ? 'SAVING...' : 'SAVE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>Error: {error}</p>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '2rem',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: '0rem',
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
  subtitle: {
    fontSize: '1.125rem',
    color: '#64748b',
    margin: '0',
    fontWeight: '400',
    lineHeight: '1.6',
  },
  navigationTop: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  navigationButtons: {
    display: 'flex',
    gap: '1rem',
  },
  navigationSpacer: {
    flex: 1,
  },
  navButton: {
    padding: '0.875rem 1.75rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    color: 'white',
    transition: 'all 0.2s ease-in-out',
  },
  navButtonDisabled: {
    padding: '0.875rem 1.75rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    borderRadius: '10px',
    border: 'none',
    cursor: 'not-allowed',
    background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
    color: 'white',
    opacity: '0.7',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '2rem',
    marginBottom: '2rem',
    marginTop: '4rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    border: '1px solid #e2e8f0',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0 0 0.25rem 0',
    letterSpacing: '-0.025em',
  },
  sectionDescription: {
    color: '#64748b',
    fontSize: '0.8rem',
    margin: 0,
    lineHeight: '1.4',
  },
  matrixControls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  generateButton: {
    padding: '0.875rem 1.75rem',
    fontSize: '0.875rem',
    fontWeight: '700',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)',
  },
  matrixSelector: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  selectorLabel: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
  },
  selector: {
    padding: '0.75rem 1rem',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '0.875rem',
    backgroundColor: 'white',
    color: '#374151',
    transition: 'all 0.2s ease-in-out',
  },
  matrixActions: {
    display: 'flex',
    gap: '0.75rem',
  },
  actionButton: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.8rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: '2px solid #d1d5db',
    background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  matrixInfo: {
    display: 'flex',
    gap: '2rem',
    marginBottom: '1.5rem',
    padding: '1.5rem',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  infoLabel: {
    fontSize: '0.75rem',
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  infoValue: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: '#1e293b',
  },
  tableContainer: {
    marginBottom: '1rem',
    marginTop: '1rem',
  },
  tableHeader: {
    marginBottom: '1rem',
  },
  tableTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
    letterSpacing: '-0.025em',
  },
  tableWrapper: {
    overflowX: 'auto',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'white',
  },
  tableHeaderCell: {
    backgroundColor: '#f8fafc',
    padding: '0.75rem',
    textAlign: 'left',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap',
  },
  tableRow: {
    borderBottom: '1px solid #f1f5f9',
  },
  tableRowConflict: {
    backgroundColor: '#fee2e2',
  },
  tableCell: {
    padding: '0.75rem',
    fontSize: '0.875rem',
    color: '#374151',
    verticalAlign: 'top',
  },
  tableCellRoom: {
    padding: '0.75rem',
    fontSize: '0.875rem',
    color: '#374151',
    verticalAlign: 'top',
    maxWidth: '120px',
    wordWrap: 'break-word',
    whiteSpace: 'normal',
  },
  schoolsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  schoolItem: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '500',
  },
  schoolItemConflict: {
    backgroundColor: '#fecaca',
    color: '#b91c1c',
    fontWeight: '700',
    border: '1px solid #ef4444',
  },
  scPostingDormConflict: {
    backgroundColor: '#fecaca',
    color: '#b91c1c',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    border: '1px solid #ef4444',
    fontWeight: '700',
  },
  balanceBanner: {
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    marginBottom: '1rem',
    fontSize: '0.875rem',
  },
  balanceBannerWarning: {
    backgroundColor: '#fffbeb',
    border: '1px solid #fcd34d',
    color: '#92400e',
  },
  balanceBannerOk: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #86efac',
    color: '#166534',
  },
  balanceList: {
    margin: '0.5rem 0 0 0',
    paddingLeft: '1.25rem',
  },
  legend: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginBottom: '0.75rem',
  },
  legendConflict: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  halfDivider: {
    padding: '0.4rem 0.75rem',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: '0.7rem',
    letterSpacing: '0.05em',
    color: '#475569',
    backgroundColor: '#e2e8f0',
    textTransform: 'uppercase',
  },
  jcList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  jcItem: {
    display: 'flex',
    flexDirection: 'column',
  },
  jcName: {
    fontWeight: '500',
  },
  jcDorm: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  scDormName: {
    fontWeight: '500',
  },
  scDormJcs: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  scDormPartner: {
    fontSize: '0.75rem',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  conflictBadge: {
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '500',
  },
  conflictBadgeSuccess: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  conflictBadgeError: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '50vh',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f4f6',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '1rem',
    color: '#6b7280',
    fontSize: '1rem',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '1rem',
    marginTop: '1rem',
  },
  errorText: {
    color: '#dc2626',
    margin: 0,
  },
  navigationBottom: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '2rem',
  },
  generateButtonTop: {
    position: 'absolute',
    right: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1.25rem',
    fontSize: '1.2rem',
    fontWeight: '600',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    transition: 'all 0.3s ease-in-out',
    boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)',
  },
  autoDiscardContainer: {
    position: 'absolute',
    right: '1.25rem',
    top: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '0.5rem 0',
    width: 'fit-content',
  },
  autoDiscardLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  autoDiscardCheckbox: {
    width: '1rem',
    height: '1rem',
  },
  autoDiscardText: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
  },
  popupOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  popup: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '16px',
    padding: '0',
    maxWidth: '500px',
    width: '90%',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  popupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem 1.5rem 0 1.5rem',
    borderBottom: '1px solid #e2e8f0',
    marginBottom: '1.5rem',
  },
  popupTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0',
    letterSpacing: '-0.025em',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#64748b',
    padding: '0.25rem',
    borderRadius: '4px',
    transition: 'all 0.2s ease-in-out',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupMessage: {
    color: '#64748b',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    margin: '0 0 1.5rem 0',
    padding: '0 1.5rem',
  },
  popupFooter: {
    padding: '1.5rem',
    borderTop: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  popupFooterRight: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
  },
  cancelButton: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.75rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    background: 'white',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  discardButton: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.75rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    boxShadow: '0 4px 14px 0 rgba(239, 68, 68, 0.39)',
  },
  saveButton: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.75rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)',
  },
  nameInputContainer: {
    marginBottom: '1.5rem',
    padding: '0 1.5rem',
  },
  nameInputLabel: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.5rem',
  },
  nameInput: {
    width: '100%',
    padding: '0.75rem 1rem',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '0.875rem',
    backgroundColor: 'white',
    color: '#374151',
    transition: 'all 0.2s ease-in-out',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  actionButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  scPartner: {
    fontSize: '0.75rem',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  emptyIcon: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
  emptyTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '0.5rem',
  },
  emptyMessage: {
    color: '#64748b',
    fontSize: '1rem',
    marginBottom: '3.5rem',
  },
};

export default MatrixView; 