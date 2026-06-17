import React, { useState, useEffect } from 'react';
import api from '../util/api.js';

const MatrixPage = () => {
  const [currentMatrix, setCurrentMatrix] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null);

  const fetchSelectedMatrix = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get('/api/matrices/selected');
      setCurrentMatrix(response.data || null);
      setCacheInfo(response.meta || null);
    } catch (err) {
      if (err.response?.status === 404) {
        setCurrentMatrix(null);
        setError(null);
        setCacheInfo(err.fromCache ? {
          fromCache: true,
          cachedAt: err.cachedAt,
          offline: !navigator.onLine,
        } : null);
      } else {
        setError(err.message || 'Failed to load selected matrix');
        setCacheInfo(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSelectedMatrix();
  }, []);

  useEffect(() => {
    const handleSync = () => fetchSelectedMatrix();
    window.addEventListener('offline-sync-complete', handleSync);
    return () => window.removeEventListener('offline-sync-complete', handleSync);
  }, []);

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

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading matrix...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Matrix</h1>
        <p style={styles.subtitle}>View the selected matrix</p>
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

      {/* Download Button */}
      {currentMatrix && (
        <div style={styles.downloadButtonContainer}>
          <button 
            style={styles.actionButton}
            onClick={() => downloadCSV(currentMatrix)}
          >
            💾 Download
          </button>
        </div>
      )}

      {/* Matrix Display */}
      {currentMatrix ? (
        <div style={styles.section}>
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
                      style={styles.tableRow}
                      className="table-row"
                    >
                      <td style={styles.tableCell}>{council.number}</td>
                      <td style={styles.tableCellRoom}>{council.room}</td>
                      <td style={styles.tableCell}>
                        <div style={styles.schoolsList}>
                          {council.schools?.map((school, i) => (
                              <div
                                key={i}
                                style={styles.schoolItem}
                              >
                                {school.replace(/High School/gi, 'HS')}
                              </div>
                            ))}
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
                          <div>
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
          <h3 style={styles.emptyTitle}>No Matrix Selected</h3>
          <p style={styles.emptyMessage}>
            No matrix has been selected yet. Please check back in later for the finalized matrix.
          </p>
        </div>
      ) : null}

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
  downloadButtonContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '1rem',
    marginTop: '0rem',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '2rem',
    marginBottom: '2rem',
    marginTop: '0',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    border: '1px solid #e2e8f0',
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
  tableContainer: {
    marginBottom: '1rem',
    marginTop: '1rem',
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
  jcName: {
    fontWeight: '500',
  },
  jcDorm: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  scPartner: {
    fontSize: '0.75rem',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  scDormName: {
    fontWeight: '500',
  },
  scDormJcs: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  emptyState: {
    textAlign: 'center',
    padding: '4rem 2rem',
    backgroundColor: 'white',
    borderRadius: '12px',
    marginTop: '4rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    border: '1px solid #e2e8f0',
  },
  emptyIcon: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
  emptyTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 0.5rem 0',
  },
  emptyMessage: {
    fontSize: '1rem',
    color: '#64748b',
    margin: '0',
    lineHeight: '1.6',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    minHeight: '400px',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #e2e8f0',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '1rem',
    color: '#64748b',
    fontSize: '1rem',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '1rem',
    marginTop: '2rem',
  },
  errorText: {
    color: '#991b1b',
    margin: 0,
  },
};

export default MatrixPage;
