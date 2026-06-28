import React, { useState, useEffect } from 'react';
import api from '../../util/api.js';
import ToastContainer from '../ToastContainer.js';
import UnsavedChangesPopup from '../UnsavedChangesPopup.js';
import { useNavigationGuard } from '../../context/NavigationGuardContext.js';
import { useOffline } from '../../context/OfflineContext.js';
import { councilHasPostingSeparationViolation, parseSeniorCounselorName, swapCouncilPairings, swapCouncilRooms, updateCouncilPostingDorm } from '../../util/matrixCouncil.js';
import { computeMatrixBalance } from '../../util/matrixBalance.js';

const SavedMatrices = () => {
  const { isOnline } = useOffline();
  const [matrices, setMatrices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('saved');
  const [selectedMatrix, setSelectedMatrix] = useState(null);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [archiveConfirmMatrix, setArchiveConfirmMatrix] = useState(null);
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    fetchMatrices();
  }, [isOnline]);

  const fetchSelectedMatrixOffline = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setCacheInfo(null);
      const response = await api.get('/api/matrices/selected');
      if (response.data) {
        setSelectedMatrix(response.data);
        setMatrices([response.data]);
        setCacheInfo(response.meta || null);
      } else {
        setSelectedMatrix(null);
        setMatrices([]);
        setError('No selected matrix is cached yet. Connect to Wi‑Fi once while a matrix is selected.');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setSelectedMatrix(null);
        setMatrices([]);
        setError('No selected matrix is cached yet. Connect to Wi‑Fi once while a matrix is selected.');
      } else {
        setError(err.message || 'Failed to load cached matrix');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMatrices = async () => {
    if (!isOnline) {
      await fetchSelectedMatrixOffline();
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setCacheInfo(null);
      const response = await api.get(`/api/matrices`);
      if (response.data) {
        setMatrices(response.data);
      } else {
        setMatrices([]);
      }
      api.get('/api/matrices/selected').catch(() => {});
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setMatrices([]);
        setError(null);
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const savedMatrices = matrices.filter(matrix => matrix.saved);
  const archivedMatrices = matrices.filter(matrix => !matrix.saved);

  const sortMatrices = (list) => {
    return [...list].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt) - new Date(b.createdAt);
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const sortedSavedMatrices = sortMatrices(savedMatrices);
  const sortedArchivedMatrices = sortMatrices(archivedMatrices);

  const handleMatrixClick = (matrix) => {
    setSelectedMatrix(matrix);
  };

  const handleCloseMatrix = () => {
    setSelectedMatrix(null);
  };

  const handleBackFromMatrix = () => {
    if (!isOnline) {
      return;
    }
    setSelectedMatrix(null);
  };

  const handleUpdateMatrix = async (matrixId, updates) => {
    const id = String(matrixId);
    try {
      const response = await api.put(`/api/matrices/${id}`, updates);
      const updated = response.data;
      setMatrices(prev => prev.map(m => {
        if (String(m._id) === String(updated._id)) return updated;
        if (updates.selected) return { ...m, selected: false };
        return m;
      }));
      if (selectedMatrix && String(selectedMatrix._id) === String(updated._id)) {
        setSelectedMatrix(updated);
      }
      return updated;
    } catch (err) {
      console.error('Error updating matrix:', err);
      window.showToast?.('Failed to update matrix.', 'error');
      throw err;
    }
  };

  const handleSetSelected = async (matrixId, e) => {
    e?.stopPropagation();
    e?.preventDefault();
    try {
      await handleUpdateMatrix(matrixId, { selected: true });
      api.get('/api/matrices/selected').catch(() => {});
      window.showToast?.('Matrix selected.', 'success');
    } catch {
      // Error toast already shown
    }
  };

  const handleSaveMatrix = async (matrixId, e) => {
    e?.stopPropagation();
    e?.preventDefault();
    try {
      await handleUpdateMatrix(matrixId, { saved: true });
      window.showToast('Matrix saved successfully!', 'success');
    } catch {
      // Error toast already shown
    }
  };

  const handleArchiveRequest = (matrix, e) => {
    e?.stopPropagation();
    e?.preventDefault();
    setArchiveConfirmMatrix(matrix);
  };

  const handleArchiveCancel = () => {
    setArchiveConfirmMatrix(null);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveConfirmMatrix) return;

    try {
      setIsArchiving(true);
      const updates = { saved: false };
      if (archiveConfirmMatrix.selected) {
        updates.selected = false;
      }
      await handleUpdateMatrix(archiveConfirmMatrix._id, updates);
      window.showToast('Matrix archived.', 'success');
      setArchiveConfirmMatrix(null);
    } catch {
      // Error toast already shown
    } finally {
      setIsArchiving(false);
    }
  };

  let content;

  if (isLoading) {
    content = (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading matrices...</p>
        </div>
      </div>
    );
  } else if (error) {
    content = (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <div style={styles.errorIcon}>⚠️</div>
          <div style={styles.errorContent}>
            <h3 style={styles.errorTitle}>Error</h3>
            <p style={styles.errorMessage}>{error}</p>
          </div>
        </div>
      </div>
    );
  } else if (selectedMatrix) {
    content = (
      <MatrixDetailView 
        matrix={selectedMatrix} 
        onClose={handleCloseMatrix}
        onBack={handleBackFromMatrix}
        onUpdateMatrix={handleUpdateMatrix}
        onSaveMatrix={handleSaveMatrix}
        readOnly={!isOnline}
        cacheInfo={cacheInfo}
      />
    );
  } else if (!isOnline) {
    content = (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Saved Matrices</h1>
          <p style={styles.subtitle}>Offline — selected matrix only</p>
        </div>
        <div style={styles.errorContainer}>
          <div style={styles.errorIcon}>📡</div>
          <div style={styles.errorContent}>
            <h3 style={styles.errorTitle}>No cached matrix</h3>
            <p style={styles.errorMessage}>
              Connect to Wi‑Fi once while a matrix is selected to view it offline here.
            </p>
          </div>
        </div>
      </div>
    );
  } else {
    content = (
    <div style={styles.container}>
      <style>
        {`
          .matrix-list-row-selected {
            background-color: #f0fdf4;
          }
          .matrix-list-row:not(.matrix-list-row-selected):hover:not(:has(.matrix-row-icon-btn:hover)) {
            background-color: #f8fafc;
          }
          .matrix-row-icon-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 2rem;
            height: 2rem;
            border: none;
            border-radius: 8px;
            background: transparent;
            cursor: pointer;
            line-height: 1;
            padding: 0;
            transition: background-color 0.15s ease;
          }
          .matrix-row-icon-btn:hover:not(:disabled) {
            background-color: #e2e8f0;
          }
          .matrix-archive-btn:hover {
            background-color: #fee2e2;
          }
          .matrix-select-check {
            font-size: 1.35rem;
            font-weight: 700;
            color: #0f172a;
          }
          .matrix-select-check-selected {
            color: #16a34a;
            cursor: default;
          }
          .matrix-select-check:disabled:hover {
            background-color: transparent;
          }
          .matrix-archive-btn {
            font-size: 1rem;
          }
          .matrix-select-button:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          .matrix-select-button:active:not(:disabled) {
            transform: translateY(0);
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          }
          .matrix-select-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .matrix-sort-header:hover {
            color: #1e293b;
          }
        `}
      </style>
      <div style={styles.header}>
        <h1 style={styles.title}>Saved Matrices</h1>
        <p style={styles.subtitle}>View and manage your saved and archived matrices</p>
      </div>

      {/* Tabs */}
      <div style={styles.tabsContainer}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'saved' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('saved')}
        >
          Saved Matrices ({sortedSavedMatrices.length})
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'archived' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('archived')}
        >
          Archived ({sortedArchivedMatrices.length})
        </button>
      </div>

      {/* Matrix List */}
      <div style={styles.content}>
        {matrices.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📊</div>
            <h3 style={styles.emptyTitle}>No Matrices Found</h3>
            <p style={styles.emptyMessage}>
              You haven't created any matrices yet. Head to the <strong>Matrix Builder</strong> to generate and save your first one.
            </p>
          </div>
        ) : activeTab === 'saved' ? (
          sortedSavedMatrices.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>💾</div>
              <h3 style={styles.emptyTitle}>No Saved Matrices</h3>
              <p style={styles.emptyMessage}>
                You haven't saved any matrices yet. Head to the <strong>Matrix Builder</strong> to generate and save one.
              </p>
            </div>
          ) : (
            <MatrixListTable
              matrices={sortedSavedMatrices}
              onRowClick={handleMatrixClick}
              onSetSelected={handleSetSelected}
              onArchiveRequest={handleArchiveRequest}
              showSelect
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          )
        ) : (
          sortedArchivedMatrices.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📁</div>
              <h3 style={styles.emptyTitle}>No Archived Matrices</h3>
              <p style={styles.emptyMessage}>
                Archived matrices will appear here when you archive saved matrices.
              </p>
            </div>
          ) : (
            <MatrixListTable
              matrices={sortedArchivedMatrices}
              onRowClick={handleMatrixClick}
              onSaveMatrix={handleSaveMatrix}
              showSave
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          )
        )}
      </div>
    </div>
    );
  }

  return (
    <>
      {content}
      {archiveConfirmMatrix && (
        <div style={styles.popupOverlay} onClick={handleArchiveCancel}>
          <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
            <div style={styles.popupHeader}>
              <h2 style={styles.popupTitle}>Archive Matrix?</h2>
              <button type="button" style={styles.closeButton} onClick={handleArchiveCancel}>×</button>
            </div>
            <p style={styles.popupMessage}>
              Archive <strong>{archiveConfirmMatrix.name || 'Unnamed Matrix'}</strong>? You can restore it later from the Archived tab.
            </p>
            <div style={styles.popupFooter}>
              <div style={styles.popupFooterRight}>
                <button type="button" style={styles.cancelButton} onClick={handleArchiveCancel}>
                  Cancel
                </button>
                <button
                  type="button"
                  style={styles.archiveConfirmButton}
                  onClick={handleArchiveConfirm}
                  disabled={isArchiving}
                >
                  {isArchiving ? 'Archiving...' : 'Archive'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ToastContainer />
    </>
  );
};

const formatMatrixDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const MatrixListTable = ({ matrices, onRowClick, onSetSelected, onSaveMatrix, onArchiveRequest, showSelect = false, showSave = false, sortField, sortDirection, onSort }) => {
  const gridColumns = (showSelect || showSave)
    ? '2fr 1.5fr 0.8fr 0.8fr 180px'
    : '2fr 1.5fr 0.8fr 0.8fr';

  const sortIndicator = (field) => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div style={styles.tableSection}>
      <div style={{ ...styles.listTableHeader, gridTemplateColumns: gridColumns }}>
        <button type="button" className="matrix-sort-header" style={styles.sortableHeaderCell} onClick={() => onSort('name')}>
          Name{sortIndicator('name')}
        </button>
        <button type="button" className="matrix-sort-header" style={styles.sortableHeaderCell} onClick={() => onSort('createdAt')}>
          Created{sortIndicator('createdAt')}
        </button>
        <div style={styles.listTableHeaderCell}>Councils</div>
        <div style={styles.listTableHeaderCell}>Delegates</div>
        {showSelect && <div style={styles.listTableActionHeader} />}
        {showSave && <div style={styles.listTableActionHeader} />}
      </div>
      {matrices.map((matrix) => (
        <MatrixListRow
          key={matrix._id}
          matrix={matrix}
          gridColumns={gridColumns}
          onClick={() => onRowClick(matrix)}
          onSetSelected={onSetSelected}
          onSaveMatrix={onSaveMatrix}
          onArchiveRequest={onArchiveRequest}
          showSelect={showSelect}
          showSave={showSave}
        />
      ))}
    </div>
  );
};

const MatrixListRow = ({ matrix, gridColumns, onClick, onSetSelected, onSaveMatrix, onArchiveRequest, showSelect, showSave }) => {
  const delegateCount = matrix.councils?.reduce((sum, council) => sum + (council.delegateCount || 0), 0) || 0;

  return (
    <div
      className={`matrix-list-row${matrix.selected ? ' matrix-list-row-selected' : ''}`}
      style={{
        ...styles.listTableRow,
        gridTemplateColumns: gridColumns,
      }}
      onClick={onClick}
    >
      <div style={styles.listTableCell}>
        <span style={styles.matrixName}>{matrix.name || 'Unnamed Matrix'}</span>
      </div>
      <div style={styles.listTableCell}>
        <span style={styles.tableCellText}>{formatMatrixDate(matrix.createdAt)}</span>
      </div>
      <div style={styles.listTableCell}>
        <span style={styles.tableCellText}>{matrix.councils?.length || 0}</span>
      </div>
      <div style={styles.listTableCell}>
        <span style={styles.tableCellText}>{delegateCount}</span>
      </div>
      {showSelect && (
        <div style={styles.listTableActionsCell} onClick={(e) => e.stopPropagation()}>
          <div style={styles.listTableActions}>
            <button
              type="button"
              className={`matrix-row-icon-btn matrix-select-check${matrix.selected ? ' matrix-select-check-selected' : ''}`}
              onClick={(e) => onSetSelected(matrix._id, e)}
              disabled={matrix.selected}
              title={matrix.selected ? 'Selected matrix' : 'Select this matrix'}
              aria-label={matrix.selected ? 'Selected' : 'Select matrix'}
            >
              ✓
            </button>
            <button
              type="button"
              className="matrix-row-icon-btn matrix-archive-btn"
              onClick={(e) => onArchiveRequest(matrix, e)}
              title="Archive matrix"
              aria-label="Archive matrix"
            >
              🗑️
            </button>
          </div>
        </div>
      )}
      {showSave && (
        <div style={styles.listTableCell} onClick={(e) => e.stopPropagation()}>
          <div style={styles.listTableActions}>
            <button
              type="button"
              className="matrix-select-button"
              style={styles.saveButton}
              onClick={(e) => onSaveMatrix(matrix._id, e)}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MatrixDetailView = ({ matrix, onBack, onUpdateMatrix, onSaveMatrix, readOnly = false, cacheInfo = null }) => {
  const [matrixName, setMatrixName] = useState(matrix.name || '');
  const [isEditingSchools, setIsEditingSchools] = useState(false);
  const [editedCouncils, setEditedCouncils] = useState(matrix.councils || []);
  const [isSavingCouncils, setIsSavingCouncils] = useState(false);
  const [isStartingEdit, setIsStartingEdit] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [pendingLocalBack, setPendingLocalBack] = useState(false);
  const [maleDormOptions, setMaleDormOptions] = useState([]);
  const [femaleDormOptions, setFemaleDormOptions] = useState([]);
  const [postingDormIssues, setPostingDormIssues] = useState([]);
  const [seniorCounselorsById, setSeniorCounselorsById] = useState(() => new Map());

  const {
    registerGuard,
    pendingNavigation,
    clearPendingNavigation,
    completePendingNavigation,
  } = useNavigationGuard();

  const nameChanged = matrixName.trim() !== matrix.name && matrixName.trim();
  const displayCouncils = isEditingSchools ? editedCouncils : matrix.councils;
  const group1Size = matrix.balance?.group1?.size ?? Math.ceil((displayCouncils?.length || 0) / 2);
  const displayBalance = isEditingSchools
    ? computeMatrixBalance(displayCouncils, group1Size)
    : matrix.balance;
  const councilsChanged = JSON.stringify(editedCouncils) !== JSON.stringify(matrix.councils);
  const editDirty = isEditingSchools && (councilsChanged || nameChanged);
  const hasUnsavedChanges = editDirty;

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

  useEffect(() => {
    setMatrixName(matrix.name || '');
  }, [matrix.name]);

  useEffect(() => {
    setEditedCouncils(matrix.councils || []);
    setIsEditingSchools(false);
  }, [matrix._id, matrix.councils]);

  const validateCouncils = async (councils) => {
    const { data } = await api.post('/api/matrices/validate-councils', { councils });
    setPostingDormIssues(data.postingDormIssues || []);
    return data.councils;
  };

  const getSeniorCounselorForCouncil = (council) => {
    if (council.seniorCounselorId && seniorCounselorsById.has(council.seniorCounselorId)) {
      return seniorCounselorsById.get(council.seniorCounselorId);
    }
    const targetName = parseSeniorCounselorName(council.seniorCounselor).toLowerCase();
    return [...seniorCounselorsById.values()].find(
      (sc) => sc.name.trim().toLowerCase() === targetName
    );
  };

  const getPostingDormOptionsForCouncil = (council) => {
    const sc = getSeniorCounselorForCouncil(council);
    if (sc?.gender === 'male') return femaleDormOptions;
    if (sc?.gender === 'female') return maleDormOptions;
    return [...femaleDormOptions, ...maleDormOptions];
  };

  const getPostingDormSelectValue = (council) => {
    const name = council.scPostingDorm?.name;
    if (!name || name === 'No Dorm Assigned') return '';
    return name;
  };

  const moveSchoolToCouncil = async (fromCouncilIdx, schoolIdx, toCouncilIdx) => {
    const fromCouncil = editedCouncils[fromCouncilIdx];
    const toCouncil = editedCouncils[toCouncilIdx];
    if (!fromCouncil || !toCouncil || fromCouncilIdx === toCouncilIdx) return;

    const school = fromCouncil.schools[schoolIdx];
    const next = editedCouncils.map((council) => ({ ...council, schools: [...council.schools] }));
    next[fromCouncilIdx].schools = next[fromCouncilIdx].schools.filter((_, i) => i !== schoolIdx);
    next[toCouncilIdx].schools.push(school);
    const validated = await validateCouncils(next);
    setEditedCouncils(validated);
  };

  const swapPairingAt = async (fromCouncilIdx, toCouncilIdx) => {
    if (fromCouncilIdx === toCouncilIdx) return;

    const swapped = swapCouncilPairings(editedCouncils, fromCouncilIdx, toCouncilIdx);
    const validated = await validateCouncils(swapped);
    setEditedCouncils(validated);
  };

  const swapRoomAt = (fromCouncilIdx, toCouncilIdx) => {
    if (fromCouncilIdx === toCouncilIdx) return;
    setEditedCouncils(swapCouncilRooms(editedCouncils, fromCouncilIdx, toCouncilIdx));
  };

  const clearDragState = () => {
    setActiveDrag(null);
    setDropTarget(null);
  };

  const readDragPayload = (e) => {
    try {
      return JSON.parse(e.dataTransfer.getData('application/json'));
    } catch {
      return null;
    }
  };

  const handleSchoolDragStart = (e, fromCouncilIdx, schoolIdx) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ type: 'school', fromCouncilIdx, schoolIdx })
    );
    setActiveDrag({ type: 'school', fromCouncilIdx, schoolIdx });
  };

  const handlePairingDragStart = (e, fromCouncilIdx) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'pairing', fromCouncilIdx }));

    const council = editedCouncils[fromCouncilIdx];
    if (council) {
      const ghost = document.createElement('div');
      ghost.style.position = 'absolute';
      ghost.style.top = '-9999px';
      ghost.style.left = '-9999px';
      ghost.style.padding = '8px 12px';
      ghost.style.background = '#ede9fe';
      ghost.style.border = '2px solid #7c3aed';
      ghost.style.borderRadius = '6px';
      ghost.style.fontSize = '12px';
      ghost.style.color = '#5b21b6';
      ghost.style.lineHeight = '1.45';
      ghost.style.maxWidth = '280px';
      ghost.style.boxShadow = '0 4px 14px rgba(124, 58, 237, 0.25)';
      ghost.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      const jcLines = (council.juniorCounselors || [])
        .map((jc) => `${jc.name} · ${jc.dorm}`)
        .join('\n');
      const postingLine = council.scPostingDorm?.name
        ? `Posting: ${council.scPostingDorm.name}`
        : '';

      ghost.innerHTML = [
        `<div style="font-weight:600;margin-bottom:2px">${council.seniorCounselor}</div>`,
        jcLines ? `<div style="color:#6d28d9">${jcLines.replace(/\n/g, '<br>')}</div>` : '',
        postingLine ? `<div style="margin-top:4px;opacity:0.9">${postingLine}</div>` : '',
      ].join('');

      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 16);
      setTimeout(() => ghost.remove(), 0);
    }

    setActiveDrag({ type: 'pairing', fromCouncilIdx });
  };

  const handleRoomDragStart = (e, fromCouncilIdx) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'room', fromCouncilIdx }));
    setActiveDrag({ type: 'room', fromCouncilIdx });
  };

  const handleSchoolDragOver = (e, councilIdx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ type: 'school', councilIdx });
  };

  const handlePairingDragOver = (e, councilIdx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ type: 'pairing', councilIdx });
  };

  const handleRoomDragOver = (e, councilIdx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ type: 'room', councilIdx });
  };

  const handleSchoolDrop = async (e, toCouncilIdx) => {
    e.preventDefault();
    const payload = readDragPayload(e);
    clearDragState();
    if (!payload || payload.type !== 'school') return;
    await moveSchoolToCouncil(payload.fromCouncilIdx, payload.schoolIdx, toCouncilIdx);
  };

  const handlePairingDrop = async (e, toCouncilIdx) => {
    e.preventDefault();
    const payload = readDragPayload(e);
    clearDragState();
    if (!payload || payload.type !== 'pairing') return;
    await swapPairingAt(payload.fromCouncilIdx, toCouncilIdx);
  };

  const handleRoomDrop = (e, toCouncilIdx) => {
    e.preventDefault();
    const payload = readDragPayload(e);
    clearDragState();
    if (!payload || payload.type !== 'room') return;
    swapRoomAt(payload.fromCouncilIdx, toCouncilIdx);
  };

  const handleStartEditSchools = async () => {
    try {
      setIsStartingEdit(true);
      const [validated, dormsResponse, scResponse] = await Promise.all([
        validateCouncils(matrix.councils || []),
        api.get('/api/dorms'),
        api.get('/api/seniorCounselors'),
      ]);
      const dorms = dormsResponse.data || [];
      setMaleDormOptions(
        dorms.filter((dorm) => dorm.type === 'male').map((dorm) => dorm.name).sort()
      );
      setFemaleDormOptions(
        dorms.filter((dorm) => dorm.type === 'female').map((dorm) => dorm.name).sort()
      );
      setSeniorCounselorsById(
        new Map((scResponse.data || []).map((sc) => [sc._id, sc]))
      );
      setEditedCouncils(validated);
      setIsEditingSchools(true);
    } catch {
      window.showToast?.('Could not start editing.', 'error');
    } finally {
      setIsStartingEdit(false);
    }
  };

  const handlePostingDormChange = async (councilIdx, dormName) => {
    if (!dormName) return;
    try {
      const updated = updateCouncilPostingDorm(editedCouncils, councilIdx, dormName);
      const validated = await validateCouncils(updated);
      setEditedCouncils(validated);
    } catch {
      window.showToast?.('Could not update posting dorm.', 'error');
    }
  };

  const handleCancelEditSchools = () => {
    setMatrixName(matrix.name || '');
    setEditedCouncils(matrix.councils || []);
    setIsEditingSchools(false);
    setMaleDormOptions([]);
    setFemaleDormOptions([]);
    setPostingDormIssues([]);
    setSeniorCounselorsById(new Map());
    clearDragState();
  };

  const handleSaveCouncils = async () => {
    const trimmedName = matrixName.trim();
    if (!trimmedName) return false;

    try {
      setIsSavingCouncils(true);
      const updates = { councils: editedCouncils };
      if (trimmedName !== matrix.name) {
        updates.name = trimmedName;
      }
      await onUpdateMatrix(matrix._id, updates);
      window.showToast?.('Matrix updated.', 'success');
      setIsEditingSchools(false);
      return true;
    } catch {
      // Error toast already shown
      return false;
    } finally {
      setIsSavingCouncils(false);
    }
  };

  const requestBack = () => {
    if (hasUnsavedChanges) {
      setPendingLocalBack(true);
      return;
    }
    onBack();
  };

  const handleUnsavedCancel = () => {
    clearPendingNavigation();
    setPendingLocalBack(false);
  };

  const handleUnsavedDiscard = () => {
    handleCancelEditSchools();
    if (pendingNavigation) {
      completePendingNavigation();
    }
    if (pendingLocalBack) {
      setPendingLocalBack(false);
      onBack();
    }
  };

  const handleUnsavedSave = async () => {
    const saved = await handleSaveCouncils();
    if (!saved) return;

    if (pendingNavigation) {
      completePendingNavigation();
    }
    if (pendingLocalBack) {
      setPendingLocalBack(false);
      onBack();
    }
  };

  const downloadCSV = (matrix) => {
    const csv = formatMatrixAsCSV(matrix);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${matrix.name || 'matrix'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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
      const scPostingDorm = council.scPostingDorm ? 
        `${council.scPostingDorm.name}\n(${council.scPostingDorm.jcs})` : '';
      
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

  const pairingDropHandlers = (councilIdx) => ({
    onDragOver: (e) => {
      if (!isEditingSchools || activeDrag?.type !== 'pairing') return;
      handlePairingDragOver(e, councilIdx);
    },
    onDrop: (e) => {
      if (!isEditingSchools) return;
      handlePairingDrop(e, councilIdx);
    },
  });

  const roomDropHandlers = (councilIdx) => ({
    onDragOver: (e) => {
      if (!isEditingSchools || activeDrag?.type !== 'room') return;
      handleRoomDragOver(e, councilIdx);
    },
    onDrop: (e) => {
      if (!isEditingSchools) return;
      handleRoomDrop(e, councilIdx);
    },
  });

  const roomCellStyle = (councilIdx) => {
    const isDragging = isEditingSchools
      && activeDrag?.type === 'room'
      && activeDrag.fromCouncilIdx === councilIdx;
    const isDropTarget = isEditingSchools
      && dropTarget?.type === 'room'
      && dropTarget.councilIdx === councilIdx
      && activeDrag?.type === 'room'
      && activeDrag.fromCouncilIdx !== councilIdx;

    return {
      ...styles.tableCellRoom,
      ...(isDragging ? styles.draggableItemDragging : {}),
      ...(isDropTarget ? styles.roomDropZoneActive : {}),
    };
  };

  const pairingBundleCellStyle = (councilIdx, segment) => {
    const isSource = isEditingSchools
      && activeDrag?.type === 'pairing'
      && activeDrag.fromCouncilIdx === councilIdx;
    const isTarget = isEditingSchools
      && dropTarget?.type === 'pairing'
      && dropTarget.councilIdx === councilIdx
      && activeDrag?.type === 'pairing'
      && activeDrag.fromCouncilIdx !== councilIdx;

    const base = {
      ...styles.tableCell,
      ...(segment === 'sc' && isEditingSchools ? styles.pairingTabCellSc : {}),
      ...(segment === 'jc' && isEditingSchools ? styles.pairingTabCellJc : {}),
    };

    if (!isSource && !isTarget) return base;

    const edgeStyles = {
      sc: styles.pairingBundleLeft,
      jc: styles.pairingBundleMid,
      dorm: styles.pairingBundleMid,
      posting: styles.pairingBundleRight,
    };

    return {
      ...base,
      ...(isSource ? styles.pairingBundleSource : styles.pairingBundleDropTarget),
      ...edgeStyles[segment],
    };
  };

  return (
    <>
    <div style={styles.container}>
      {readOnly && (
        <div style={styles.cacheBanner}>
          Offline view — editing requires Wi‑Fi
          {cacheInfo?.cachedAt && (
            <> · cached {new Date(cacheInfo.cachedAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}</>
          )}
        </div>
      )}
      <div style={styles.detailHeader}>
        {!readOnly && (
          <button type="button" style={styles.backButton} onClick={requestBack}>
            ← Back to List
          </button>
        )}
        <div style={styles.detailTitle}>
          {isEditingSchools && !readOnly ? (
            <input
              type="text"
              value={matrixName}
              onChange={(e) => setMatrixName(e.target.value)}
              style={styles.detailTitleInput}
              placeholder="Matrix name"
            />
          ) : (
            <h2 style={styles.detailTitleText}>{matrix.name}</h2>
          )}
          <p style={styles.detailSubtitle}>Created {new Date(matrix.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
        </div>
        <div style={styles.detailActions}>
          {!readOnly && !matrix.saved && (
            <button
              type="button"
              style={styles.actionButton}
              onClick={() => onSaveMatrix(matrix._id)}
            >
              💾 Save
            </button>
          )}
          <button
            type="button"
            style={styles.actionButton}
            onClick={() => downloadCSV({ ...matrix, councils: displayCouncils })}
          >
            💾 Download CSV
          </button>
          {!readOnly && !isEditingSchools ? (
            <button
              type="button"
              style={styles.actionButton}
              onClick={handleStartEditSchools}
              disabled={isStartingEdit}
            >
              {isStartingEdit ? 'Loading...' : '✏️ Edit Matrix'}
            </button>
          ) : !readOnly && isEditingSchools ? (
            <>
              <button
                type="button"
                style={styles.actionButton}
                onClick={handleSaveCouncils}
                disabled={!editDirty || isSavingCouncils || !matrixName.trim() || postingDormIssues.length > 0}
              >
                {isSavingCouncils ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                style={styles.secondaryActionButton}
                onClick={handleCancelEditSchools}
                disabled={isSavingCouncils}
              >
                Cancel
              </button>
            </>
          ) : null}
        </div>
      </div>

      {displayBalance && (
        displayBalance.issues?.length > 0 ? (
          <div style={{ ...styles.balanceBanner, ...styles.balanceBannerWarning }}>
            <strong>⚠️ Distribution issues</strong>
            <ul style={styles.balanceList}>
              {displayBalance.issues.map((issue, i) => <li key={i}>{issue}</li>)}
            </ul>
          </div>
        ) : (
          <div style={{ ...styles.balanceBanner, ...styles.balanceBannerOk }}>
            ✓ Distribution is balanced across both halves.
          </div>
        )
      )}
      {displayCouncils?.some((c) => c.conflictingSchools?.length > 0) && (
        <div style={styles.legend}>
          Schools in <span style={styles.legendConflict}>red</span> are assigned to an SC/JC they conflict with (previous or associated school).
        </div>
      )}
      {displayCouncils?.some(councilHasPostingSeparationViolation) && (
        <div style={styles.legend}>
          SC posting dorms in <span style={styles.legendConflict}>red</span> house this council&apos;s own junior counselor.
        </div>
      )}
      {postingDormIssues.length > 0 && (
        <div style={{ ...styles.balanceBanner, ...styles.balanceBannerWarning }}>
          <strong>Posting dorm coverage</strong>
          <ul style={styles.balanceList}>
            {postingDormIssues.map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
        </div>
      )}
      {isEditingSchools && (
        <div style={styles.editHint}>
          Drag schools between councils, rooms between rows, or SC/JC pairings between rows. Use the posting dorm dropdown to change where each SC posts. Every dorm needs at least one posting SC; male dorms allow up to two.
        </div>
      )}

      {/* Table View */}
      <div style={styles.tableContainer}>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.tableHeaderCell}>#</th>
                <th style={styles.tableHeaderCell}>
                  Room
                </th>
                <th style={styles.tableHeaderCell}>Schools</th>
                <th style={styles.tableHeaderCell}>
                  Senior Counselor
                </th>
                <th style={styles.tableHeaderCell}>Junior Counselor(s)</th>
                <th style={styles.tableHeaderCell}>JC Dorm(s)</th>
                <th style={styles.tableHeaderCell}>SC Posting Dorm</th>
              </tr>
            </thead>
            <tbody>
              {displayCouncils?.map((council, index) => (
                <React.Fragment key={council.number ?? index}>
                  <tr
                    style={{
                      ...styles.tableRow,
                      ...(council.hasConflicts ? styles.tableRowConflict : {}),
                    }}
                    className="table-row"
                  >
                    <td style={styles.tableCell}>{council.number}</td>
                    <td
                      style={roomCellStyle(index)}
                      {...(isEditingSchools ? roomDropHandlers(index) : {})}
                    >
                      {isEditingSchools ? (
                        <div
                          draggable
                          onDragStart={(e) => handleRoomDragStart(e, index)}
                          onDragEnd={clearDragState}
                          style={{
                            ...styles.roomItem,
                            ...styles.draggableItem,
                            ...styles.dragChip,
                            ...(activeDrag?.type === 'room' && activeDrag.fromCouncilIdx === index
                              ? styles.draggableItemDragging
                              : {}),
                          }}
                          title="Drag onto another council's room to swap"
                        >
                          <span style={styles.dragGrip} aria-hidden="true">⠿</span>
                          <span>{council.room}</span>
                        </div>
                      ) : (
                        council.room
                      )}
                    </td>
                    <td
                      style={{
                        ...styles.tableCell,
                        ...(isEditingSchools
                          && dropTarget?.type === 'school'
                          && dropTarget.councilIdx === index
                          && activeDrag?.type === 'school'
                          && activeDrag.fromCouncilIdx !== index
                          ? styles.dropZoneActive
                          : {}),
                      }}
                      onDragOver={(e) => {
                        if (!isEditingSchools || activeDrag?.type !== 'school') return;
                        handleSchoolDragOver(e, index);
                      }}
                      onDrop={(e) => {
                        if (!isEditingSchools) return;
                        handleSchoolDrop(e, index);
                      }}
                    >
                      <div style={styles.schoolsList}>
                        {council.schools?.map((school, i) => {
                          const isConflict = council.conflictingSchools?.includes(school);
                          const isDragging = activeDrag?.type === 'school'
                            && activeDrag.fromCouncilIdx === index
                            && activeDrag.schoolIdx === i;
                          return (
                            <div
                              key={`${council.number}-${school}-${i}`}
                              draggable={isEditingSchools}
                              onDragStart={(e) => handleSchoolDragStart(e, index, i)}
                              onDragEnd={clearDragState}
                              style={
                                isEditingSchools
                                  ? {
                                      ...styles.schoolEditRow,
                                      ...styles.draggableItem,
                                      ...styles.dragChip,
                                      ...(isDragging ? styles.draggableItemDragging : {}),
                                      ...(isConflict ? styles.schoolItemConflict : styles.schoolItem),
                                    }
                                  : {
                                      ...styles.schoolItem,
                                      ...(isConflict ? styles.schoolItemConflict : {}),
                                    }
                              }
                              title={
                                isEditingSchools
                                  ? (isConflict
                                    ? 'Conflict: SC/JC previous or associated school — drag to another council'
                                    : 'Drag to another council\'s school list')
                                  : (isConflict ? 'Conflict: SC/JC previous or associated school' : undefined)
                              }
                            >
                              {isEditingSchools && (
                                <span style={styles.dragGrip} aria-hidden="true">⠿</span>
                              )}
                              <span>{school.replace(/High School/gi, 'HS')}</span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td
                      style={isEditingSchools ? pairingBundleCellStyle(index, 'sc') : styles.tableCell}
                      {...(isEditingSchools ? pairingDropHandlers(index) : {})}
                    >
                      {isEditingSchools ? (
                        <>
                          <div
                            draggable
                            onDragStart={(e) => handlePairingDragStart(e, index)}
                            onDragEnd={clearDragState}
                            style={{
                              ...styles.pairingTab,
                              ...styles.pairingTabLeft,
                            }}
                            title="Drag to swap pairing — SC, JCs, dorms, and posting move together"
                          >
                            <span style={styles.dragGrip} aria-hidden="true">⠿</span>
                            <span style={styles.pairingChipSc}>{council.seniorCounselor}</span>
                          </div>
                          {council.scPostingDorm?.partner && (
                            <div style={styles.scPartner}>({council.scPostingDorm.partner})</div>
                          )}
                        </>
                      ) : (
                        <>
                          <div>{council.seniorCounselor}</div>
                          {council.scPostingDorm?.partner && (
                            <div style={styles.scPartner}>({council.scPostingDorm.partner})</div>
                          )}
                        </>
                      )}
                    </td>
                    <td
                      style={isEditingSchools ? pairingBundleCellStyle(index, 'jc') : styles.tableCell}
                      {...(isEditingSchools ? pairingDropHandlers(index) : {})}
                    >
                      <div style={styles.jcList}>
                        {council.juniorCounselors?.map((jc, i) => (
                          <div key={i} style={styles.jcName}>{jc.name}</div>
                        ))}
                      </div>
                    </td>
                    <td
                      style={isEditingSchools ? pairingBundleCellStyle(index, 'dorm') : styles.tableCell}
                      {...(isEditingSchools ? pairingDropHandlers(index) : {})}
                    >
                      <div style={styles.jcList}>
                        {council.juniorCounselors?.map((jc, i) => (
                          <div key={i} style={styles.jcDorm}>{jc.dorm}</div>
                        ))}
                      </div>
                    </td>
                    <td style={styles.tableCell}>
                      {isEditingSchools ? (
                        <div
                          style={councilHasPostingSeparationViolation(council)
                            ? styles.scPostingDormConflict
                            : undefined}
                        >
                          <select
                            value={getPostingDormSelectValue(council)}
                            onChange={(e) => handlePostingDormChange(index, e.target.value)}
                            style={styles.postingDormSelect}
                            title="Change SC posting dorm"
                            required
                          >
                            {!getPostingDormSelectValue(council) && (
                              <option value="" disabled>Select posting dorm</option>
                            )}
                            {getPostingDormOptionsForCouncil(council).map((dormName) => (
                              <option key={dormName} value={dormName}>{dormName}</option>
                            ))}
                            {getPostingDormSelectValue(council)
                              && !getPostingDormOptionsForCouncil(council).includes(getPostingDormSelectValue(council)) && (
                              <option value={getPostingDormSelectValue(council)}>
                                {getPostingDormSelectValue(council)}
                              </option>
                            )}
                          </select>
                          {council.scPostingDorm?.jcs && (
                            <div style={styles.scDormJcs}>{council.scPostingDorm.jcs}</div>
                          )}
                        </div>
                      ) : council.scPostingDorm ? (
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
                  {displayBalance?.group1?.size === council.number && index < displayCouncils.length - 1 && (
                    <tr><td colSpan={7} style={styles.halfDivider}>— Camp Split —</td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    {(pendingNavigation || pendingLocalBack) && (
      <UnsavedChangesPopup
        title="Unsaved Matrix Changes"
        message="You have unsaved edits to this matrix. Save before leaving?"
        saving={isSavingCouncils}
        onCancel={handleUnsavedCancel}
        onDiscard={handleUnsavedDiscard}
        onSave={handleUnsavedSave}
      />
    )}
    </>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
  subtitle: {
    fontSize: '1.125rem',
    color: '#64748b',
    margin: '0',
    fontWeight: '400',
    lineHeight: '1.6',
  },
  cacheBanner: {
    margin: '0 0 1rem 0',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fde68a',
    fontSize: '0.875rem',
    textAlign: 'center',
  },
  tabsContainer: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '2rem',
    justifyContent: 'center',
  },
  tab: {
    padding: '0.75rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    borderRadius: '10px',
    border: '2px solid #e2e8f0',
    background: 'white',
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
  },
  tabActive: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    color: 'white',
    borderColor: '#3b82f6',
    boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)',
  },
  content: {
    backgroundColor: 'white',
    padding: '0',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
  },
  tableSection: {
    width: '100%',
  },
  listTableHeader: {
    display: 'grid',
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
  listTableHeaderCell: {
    display: 'flex',
    alignItems: 'center',
  },
  listTableActionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sortableHeaderCell: {
    display: 'flex',
    alignItems: 'center',
    padding: 0,
    border: 'none',
    background: 'none',
    font: 'inherit',
    fontWeight: '600',
    fontSize: '0.875rem',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    cursor: 'pointer',
    textAlign: 'left',
  },
  listTableRow: {
    display: 'grid',
    gap: '1.5rem',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #f1f5f9',
    alignItems: 'center',
    transition: 'background-color 0.2s ease-in-out',
    cursor: 'pointer',
  },
  listTableCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    minWidth: 0,
  },
  matrixName: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#1e293b',
  },
  tableCellText: {
    fontSize: '0.875rem',
    color: '#64748b',
  },
  saveButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.8rem',
    fontWeight: '600',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  },
  listTableActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    justifyContent: 'flex-end',
    width: '100%',
  },
  listTableActionsCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    minWidth: 0,
    cursor: 'default',
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
    background: 'white',
    borderRadius: '12px',
    padding: '1.5rem',
    maxWidth: '440px',
    width: '90%',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    border: '1px solid #e2e8f0',
  },
  popupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  popupTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#64748b',
    padding: '0.25rem',
    lineHeight: 1,
  },
  popupMessage: {
    fontSize: '0.9rem',
    color: '#64748b',
    lineHeight: '1.5',
    margin: '0 0 1.5rem 0',
  },
  popupFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  popupFooterRight: {
    display: 'flex',
    gap: '0.75rem',
  },
  cancelButton: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: '2px solid #d1d5db',
    background: 'white',
    color: '#374151',
    cursor: 'pointer',
  },
  archiveConfirmButton: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: 'white',
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: '5rem 2rem',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '20px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
  },
  emptyIcon: {
    fontSize: '4rem',
    marginBottom: '1.5rem',
    opacity: '0.7',
  },
  emptyTitle: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 0.75rem 0',
  },
  emptyMessage: {
    color: '#64748b',
    margin: '0',
    fontSize: '1.125rem',
    lineHeight: '1.6',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #e2e8f0',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '1.5rem',
    color: '#64748b',
    fontSize: '1.125rem',
    fontWeight: '500',
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
    border: '1px solid #fecaca',
    borderRadius: '16px',
    padding: '1.75rem',
    marginBottom: '2rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  errorIcon: {
    fontSize: '1.75rem',
    marginRight: '1rem',
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    margin: '0 0 0.5rem 0',
    color: '#dc2626',
    fontSize: '1.25rem',
    fontWeight: '600',
  },
  errorMessage: {
    margin: '0',
    color: '#991b1b',
    fontSize: '0.875rem',
    lineHeight: '1.5',
  },
  // Detail view styles
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '2rem',
    padding: '1.5rem 0',
  },
  backButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    background: 'white',
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
  },
  detailTitle: {
    flex: 1,
    textAlign: 'center',
  },
  detailTitleText: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 0.25rem 0',
  },
  detailTitleInput: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: '#1e293b',
    border: '2px solid #e2e8f0',
    backgroundColor: 'white',
    textAlign: 'center',
    padding: '0.25rem 0.5rem',
    borderRadius: '8px',
    minWidth: '200px',
    maxWidth: '100%',
    boxSizing: 'border-box',
    margin: '0 0 0.25rem 0',
    outline: 'none',
  },
  detailSubtitle: {
    fontSize: '0.875rem',
    color: '#64748b',
    margin: 0,
    fontWeight: '400',
  },
  detailActions: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-start',
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
  secondaryActionButton: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.8rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: '2px solid #cbd5e1',
    background: '#f8fafc',
    color: '#475569',
    cursor: 'pointer',
  },
  editHint: {
    margin: '0 0 1rem 0',
    padding: '0.75rem 1rem',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    color: '#1e40af',
    fontSize: '0.875rem',
    lineHeight: 1.5,
  },
  schoolEditRow: {
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '500',
  },
  draggableItem: {
    cursor: 'grab',
    userSelect: 'none',
  },
  draggableItemDragging: {
    opacity: 0.45,
    cursor: 'grabbing',
  },
  dragGrip: {
    opacity: 0.55,
    fontSize: '0.85rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  dragChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
  pairingTab: {
    backgroundColor: '#ede9fe',
    color: '#5b21b6',
    padding: '0.35rem 0.5rem',
    fontSize: '0.75rem',
    fontWeight: '500',
  },
  pairingTabLeft: {
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'flex-start',
    gap: '0.35rem',
    cursor: 'grab',
    userSelect: 'none',
  },
  pairingTabCellSc: {
    paddingRight: '0',
    verticalAlign: 'top',
  },
  pairingTabCellJc: {
    paddingLeft: '0.35rem',
    verticalAlign: 'top',
  },
  pairingBundleSource: {
    backgroundColor: 'rgba(237, 233, 254, 0.5)',
    opacity: 0.72,
  },
  pairingBundleDropTarget: {
    backgroundColor: '#f5f3ff',
  },
  pairingBundleLeft: {
    boxShadow: 'inset 2px 0 0 #7c3aed, inset 0 2px 0 #7c3aed, inset 0 -2px 0 #7c3aed',
  },
  pairingBundleMid: {
    boxShadow: 'inset 0 2px 0 #7c3aed, inset 0 -2px 0 #7c3aed',
  },
  pairingBundleRight: {
    boxShadow: 'inset -2px 0 0 #7c3aed, inset 0 2px 0 #7c3aed, inset 0 -2px 0 #7c3aed',
  },
  pairingChipSc: {
    fontWeight: '600',
    fontSize: '0.75rem',
  },
  columnEditHint: {
    fontSize: '0.65rem',
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: '0.2rem',
  },
  dropZoneActive: {
    backgroundColor: '#eff6ff',
    outline: '2px dashed #3b82f6',
    outlineOffset: '-2px',
  },
  roomDropZoneActive: {
    backgroundColor: '#f8fafc',
    outline: '2px dashed #94a3b8',
    outlineOffset: '-2px',
  },
  tableContainer: {
    marginBottom: '1rem',
    marginTop: '0',
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
  roomItem: {
    backgroundColor: '#e2e8f0',
    color: '#475569',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '500',
    display: 'inline-flex',
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
  jcList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
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
  postingDormSelect: {
    width: '100%',
    maxWidth: '120px',
    padding: '0.35rem 0.25rem',
    fontSize: '0.75rem',
    fontWeight: '500',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    backgroundColor: '#fff',
    color: '#1e293b',
    cursor: 'pointer',
  },
  scPartner: {
    fontSize: '0.75rem',
    color: '#6b7280',
    fontStyle: 'italic',
  },
};

export default SavedMatrices; 