import React, { useState, useEffect } from 'react';
import { exportCommitteeSubmissions, exportCommitteeEnrollments } from '../util/pdfExports.js';
import api from '../util/api.js';
import { fetchCouncilNumberByCounselorName, formatCounselorWithCouncil } from '../util/council.js';
import { fetchLocationAssignments, partitionSessionLocations } from '../util/locations.js';

const CommitteesAdminPage = () => {
  const [activeTab, setActiveTab] = useState('submissions'); // 'submissions' or 'committees'
  const [submissions, setSubmissions] = useState([]);
  const [seniorCounselors, setSeniorCounselors] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeTab === 'submissions') {
      fetchSubmissions();
      fetchSeniorCounselors();
    } else {
      fetchEnrollments();
      fetchSeniorCounselors();
    }
  }, [activeTab]);

  const fetchSubmissions = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/committee-submissions/admin/all');
      setSubmissions(data);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError('Failed to load committee submissions');
    } finally {
      setLoading(false);
    }
  };

  const fetchSeniorCounselors = async () => {
    try {
      const { data } = await api.get('/api/seniorcounselors');
      setSeniorCounselors(data);
    } catch (err) {
      console.error('Error fetching senior counselors:', err);
    }
  };

  const fetchEnrollments = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/committees/admin/enrollments');
      setEnrollments(data);
    } catch (err) {
      console.error('Error fetching enrollments:', err);
      setError('Failed to load committee enrollments');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSubmission = async (submissionId) => {
    try {
      const { data } = await api.get(`/api/committee-submissions/admin/${submissionId}`);
      setSelectedSubmission(data);
    } catch (err) {
      console.error('Error fetching submission details:', err);
      setError('Failed to load submission details');
    }
  };

  const handleCloseSubmission = () => {
    setSelectedSubmission(null);
  };

  const handleExportSubmissions = () => {
    exportCommitteeSubmissions(submissions);
  };

  const handleExportEnrollments = () => {
    exportCommitteeEnrollments(enrollments);
  };

  const handleUpdateCommitteeCounselor = async (committeeId, seniorCounselorId) => {
    const { data } = await api.put(`/api/committees/${committeeId}`, {
      _seniorCounselor: seniorCounselorId,
    });
    setEnrollments((current) => current.map((enrollment) => (
      String(enrollment.committee._id) === String(committeeId)
        ? { ...enrollment, committee: data }
        : enrollment
    )));
    return data;
  };

  const handleUpdateCommitteeLocation = async (committeeId, location) => {
    const { data } = await api.put(`/api/committees/${committeeId}`, { location });
    setEnrollments((current) => current.map((enrollment) => (
      String(enrollment.committee._id) === String(committeeId)
        ? { ...enrollment, committee: data }
        : enrollment
    )));
    return data;
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.container} className="committees-admin-page">
      <style>
        {`
          @media (max-width: 768px) {
            .committees-admin-page {
              padding: 1rem !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
            .committees-admin-page .page-header {
              margin-bottom: 1.25rem !important;
              padding: 0.5rem 0 !important;
            }
            .committees-admin-page .page-title {
              font-size: 1.75rem !important;
            }
            .committees-admin-page .page-description {
              font-size: 1rem !important;
            }
            .committees-admin-page .admin-tabs {
              margin-bottom: 1.25rem !important;
            }
            .committees-admin-page .admin-tab {
              flex: 1;
              padding: 0.75rem 0.5rem !important;
              text-align: center;
            }
            .committees-admin-page .admin-content {
              padding: 1rem !important;
            }
            .committees-admin-page .admin-stats-bar {
              flex-direction: column !important;
              align-items: stretch !important;
              gap: 0.75rem !important;
              padding: 1rem !important;
            }
            .committees-admin-page .admin-stats-group {
              flex-direction: column !important;
              gap: 0.75rem !important;
              width: 100% !important;
            }
            .committees-admin-page .admin-stat {
              justify-content: space-between !important;
              width: 100% !important;
            }
            .committees-admin-page .admin-stats-export {
              width: 100% !important;
              justify-content: center !important;
            }
            .committees-admin-page .admin-table-header {
              display: none !important;
            }
            .committees-admin-page .admin-submission-row {
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              gap: 0.75rem !important;
              padding: 0.875rem 1rem !important;
              grid-template-columns: none !important;
            }
            .committees-admin-page .admin-submission-row-clickable {
              cursor: pointer;
            }
            .committees-admin-page .admin-submission-row-clickable:active {
              background-color: #f8fafc;
            }
            .committees-admin-page .admin-table-cell-extra {
              display: none !important;
            }
            .committees-admin-page .admin-table-cell-name {
              flex: 1 !important;
              min-width: 0 !important;
              font-weight: 600 !important;
            }
            .committees-admin-page .admin-enrollment-row {
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              gap: 0.75rem !important;
              padding: 0.875rem 1rem !important;
              grid-template-columns: none !important;
              cursor: pointer;
            }
            .committees-admin-page .admin-enrollment-row:active {
              background-color: #f8fafc;
            }
            .committees-admin-page .admin-table-cell-count {
              font-weight: 700 !important;
              color: #1e293b !important;
              flex-shrink: 0 !important;
            }
            .committees-admin-page .admin-header-row {
              flex-direction: column !important;
              align-items: stretch !important;
            }
            .committees-admin-page .admin-back-button {
              width: 100% !important;
            }
            .committees-admin-page .admin-detail-table-header {
              display: none !important;
            }
            .committees-admin-page .admin-detail-row {
              display: flex !important;
              flex-direction: column !important;
              gap: 0.5rem !important;
              padding: 0.875rem 1rem !important;
              grid-template-columns: none !important;
            }
            .committees-admin-page .admin-detail-cell::before {
              content: attr(data-label);
              font-size: 0.75rem;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #64748b;
              margin-bottom: 0.25rem;
            }
            .committees-admin-page .admin-name-item {
              flex-direction: column !important;
              align-items: flex-start !important;
              gap: 0.25rem !important;
            }
          }
        `}
      </style>
      <div style={styles.header} className="page-header">
        <h1 style={styles.title} className="page-title">Committees</h1>
        <p style={styles.description} className="page-description">
          Manage and view committee assignment submissions from Senior Counselors.
        </p>
      </div>

      {error && (
        <div style={styles.errorMessage}>
          {error}
        </div>
      )}

      <div style={styles.tabs} className="admin-tabs">
        <button
          onClick={() => setActiveTab('submissions')}
          style={activeTab === 'submissions' ? { ...styles.tab, ...styles.activeTab } : styles.tab}
          className="admin-tab"
        >
          Submissions
        </button>
        <button
          onClick={() => setActiveTab('committees')}
          style={activeTab === 'committees' ? { ...styles.tab, ...styles.activeTab } : styles.tab}
          className="admin-tab"
        >
          Committee Lists
        </button>
      </div>

      {activeTab === 'submissions' ? (
        <SubmissionsView
          submissions={submissions}
          seniorCounselors={seniorCounselors}
          selectedSubmission={selectedSubmission}
          onViewSubmission={handleViewSubmission}
          onCloseSubmission={handleCloseSubmission}
          onExport={handleExportSubmissions}
        />
      ) : (
        <EnrollmentsView
          enrollments={enrollments}
          seniorCounselors={seniorCounselors}
          onUpdateCounselor={handleUpdateCommitteeCounselor}
          onUpdateLocation={handleUpdateCommitteeLocation}
          onExport={handleExportEnrollments}
        />
      )}
    </div>
  );
};

const SubmissionsView = ({ submissions, seniorCounselors, selectedSubmission, onViewSubmission, onCloseSubmission, onExport }) => {
  if (selectedSubmission) {
    return (
      <div style={styles.content} className="admin-content">
        <div style={styles.headerRow} className="admin-header-row">
          <h2 style={styles.subtitle}>
            {selectedSubmission._seniorCounselor?.name || selectedSubmission._seniorCounselor?.username || 'Unknown'}
          </h2>
          <button onClick={onCloseSubmission} style={styles.backButton} className="admin-back-button">
            ← Back to List
          </button>
        </div>
        <p style={styles.meta}>
          Last updated: {new Date(selectedSubmission.updatedAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}
        </p>
        
        <div style={styles.tableSection}>
          <div style={{...styles.tableHeader, gridTemplateColumns: '1fr 1fr'}} className="admin-detail-table-header">
            <div style={styles.tableHeaderCell}>Name</div>
            <div style={styles.tableHeaderCell}>Committee</div>
          </div>
          
          {selectedSubmission.assignments.map((assignment, index) => (
            <div key={index} style={{...styles.tableRow, gridTemplateColumns: '1fr 1fr'}} className="admin-detail-row">
              <div style={styles.tableCell} className="admin-detail-cell" data-label="Name">{assignment.name}</div>
              <div style={styles.tableCell} className="admin-detail-cell" data-label="Committee">
                {assignment.committee?.name || 'N/A'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Create a map of submissions by senior counselor ID
  const submissionsByCounselor = {};
  submissions.forEach(submission => {
    if (submission._seniorCounselor) {
      submissionsByCounselor[submission._seniorCounselor._id.toString()] = submission;
    }
  });

  // Get counts
  const submittedCount = Object.keys(submissionsByCounselor).length;
  const totalCount = seniorCounselors.length;
  const missingCount = totalCount - submittedCount;
  const canExport = submissions.length > 0;

  return (
    <div style={styles.content} className="admin-content">
      <div style={styles.statsBar} className="admin-stats-bar">
        <div style={styles.statsGroup} className="admin-stats-group">
          <div style={styles.stat} className="admin-stat">
            <span style={styles.statLabel}>Total Senior Counselors:</span>
            <span style={styles.statValue}>{totalCount}</span>
          </div>
          <div style={styles.stat} className="admin-stat">
            <span style={styles.statLabel}>Submitted:</span>
            <span style={{...styles.statValue, color: '#10b981'}}>{submittedCount}</span>
          </div>
          <div style={styles.stat} className="admin-stat">
            <span style={styles.statLabel}>Missing:</span>
            <span style={{...styles.statValue, color: '#ef4444'}}>{missingCount}</span>
          </div>
        </div>
        <button
          onClick={onExport}
          disabled={!canExport}
          style={{
            ...styles.statsExportButton,
            ...(!canExport ? styles.exportButtonDisabled : {}),
          }}
          className="admin-stats-export"
          title={!canExport ? 'No submissions to export' : 'Export all submissions as PDF'}
        >
          📄 Export PDF
        </button>
      </div>

      <div style={styles.tableSection}>
        <div style={styles.tableHeader} className="admin-table-header">
          <div style={styles.tableHeaderCell}>Senior Counselor</div>
          <div style={styles.tableHeaderCell}>Status</div>
          <div style={styles.tableHeaderCell}>Assignments</div>
          <div style={styles.tableHeaderCell}>Last Updated</div>
          <div style={styles.tableHeaderCell}>Actions</div>
        </div>
        
        {seniorCounselors.map(counselor => {
          const submission = submissionsByCounselor[counselor._id.toString()];
          const hasSubmitted = !!submission;
          
          return (
            <div
              key={counselor._id}
              style={styles.tableRow}
              className={`admin-submission-row${hasSubmitted ? ' admin-submission-row-clickable' : ''}`}
              onClick={hasSubmitted ? () => onViewSubmission(submission._id) : undefined}
              role={hasSubmitted ? 'button' : undefined}
              tabIndex={hasSubmitted ? 0 : undefined}
              onKeyDown={hasSubmitted ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onViewSubmission(submission._id);
                }
              } : undefined}
            >
              <div style={styles.tableCell} className="admin-table-cell-name">
                {counselor.name || counselor.username || 'Unknown'}
              </div>
              <div style={styles.tableCell}>
                {hasSubmitted ? (
                  <span style={styles.statusBadgeSubmitted}>Submitted</span>
                ) : (
                  <span style={styles.statusBadgeMissing}>Missing</span>
                )}
              </div>
              <div style={{...styles.tableCell, ...styles.tableCellExtra}} className="admin-table-cell-extra">
                {hasSubmitted ? (submission.assignments?.length || 0) + ' assignment(s)' : '-'}
              </div>
              <div style={{...styles.tableCell, ...styles.tableCellExtra}} className="admin-table-cell-extra">
                {hasSubmitted ? new Date(submission.updatedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                }) : '-'}
              </div>
              <div style={{...styles.tableCell, ...styles.tableCellExtra}} className="admin-table-cell-extra">
                {hasSubmitted ? (
                  <div style={styles.actionButtons}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewSubmission(submission._id);
                      }}
                      style={styles.viewButton}
                      title="View Details"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 2px 4px 0 rgba(0, 0, 0, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                      }}
                    >
                      👀
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        exportCommitteeSubmissions(submission);
                      }}
                      style={styles.exportButton}
                      title="Export PDF"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 2px 4px 0 rgba(0, 0, 0, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                      }}
                    >
                      📄
                    </button>
                  </div>
                ) : (
                  <span style={styles.noAction}>-</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CommitteeCounselorEditor = ({ committee, seniorCounselors, enrollments, onSave }) => {
  const [seniorCounselorId, setSeniorCounselorId] = useState(
    String(committee._seniorCounselor?._id || '')
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setSeniorCounselorId(String(committee._seniorCounselor?._id || ''));
  }, [committee]);

  const currentId = String(committee._seniorCounselor?._id || '');
  const assignedElsewhere = new Map();
  enrollments.forEach((enrollment) => {
    const assignedId = String(enrollment.committee._seniorCounselor?._id || '');
    if (!assignedId || String(enrollment.committee._id) === String(committee._id)) return;
    assignedElsewhere.set(assignedId, enrollment.committee.name);
  });

  const available = seniorCounselors.filter((sc) => !assignedElsewhere.has(String(sc._id)));
  const occupied = seniorCounselors
    .filter((sc) => assignedElsewhere.has(String(sc._id)))
    .map((sc) => ({
      ...sc,
      assignedTo: assignedElsewhere.get(String(sc._id)),
    }));

  // Keep the current counselor selectable even if assignment data is briefly stale.
  if (currentId && !available.some((sc) => String(sc._id) === currentId) && !occupied.some((sc) => String(sc._id) === currentId)) {
    const current = seniorCounselors.find((sc) => String(sc._id) === currentId);
    if (current) available.push(current);
  }

  const handleSave = async () => {
    if (!seniorCounselorId) {
      setMessage('Choose a senior counselor.');
      return;
    }
    try {
      setSaving(true);
      setMessage('');
      await onSave(committee._id, seniorCounselorId);
      setMessage('Senior counselor updated.');
    } catch (err) {
      setMessage(err.message || 'Failed to update senior counselor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.counselorEditor}>
      <h3 style={styles.sessionTitle}>Committee Senior Counselor</h3>
      <div style={styles.counselorFields}>
        <label style={styles.counselorField}>
          <span style={styles.counselorLabel}>Senior Counselor</span>
          <select
            value={seniorCounselorId}
            onChange={(event) => setSeniorCounselorId(event.target.value)}
            style={styles.counselorSelect}
          >
            <option value="">Select…</option>
            <optgroup label="Available">
              {available.map((seniorCounselor) => (
                <option key={String(seniorCounselor._id)} value={String(seniorCounselor._id)}>
                  {seniorCounselor.name}
                </option>
              ))}
            </optgroup>
            {showAll && occupied.length > 0 && (
              <optgroup label="Already assigned">
                {occupied.map((seniorCounselor) => (
                  <option key={String(seniorCounselor._id)} value={String(seniorCounselor._id)}>
                    {seniorCounselor.name} — {seniorCounselor.assignedTo}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <button type="button" onClick={handleSave} disabled={saving} style={styles.saveCounselorButton}>
          {saving ? 'Saving…' : 'Save Senior Counselor'}
        </button>
      </div>
      {occupied.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          style={styles.showAllLocationsButton}
        >
          {showAll ? 'Hide assigned counselors' : 'Show all counselors (for swaps)'}
        </button>
      )}
      {message && <p style={styles.counselorMessage}>{message}</p>}
    </div>
  );
};

const CommitteeLocationEditor = ({ committee, onSave }) => {
  const [location, setLocation] = useState(committee.location || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    setLocation(committee.location || '');
  }, [committee]);

  useEffect(() => {
    let cancelled = false;
    fetchLocationAssignments().then((data) => {
      if (!cancelled) setAssignments(data);
    });
    return () => { cancelled = true; };
  }, [committee._id, committee.location]);

  const { available, occupied } = partitionSessionLocations(
    committee.location || '',
    assignments,
    `committee:${committee._id}`
  );

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');
      await onSave(committee._id, location || null);
      setMessage('Location updated.');
      setAssignments(await fetchLocationAssignments());
    } catch (err) {
      setMessage(err.message || 'Failed to update location.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.counselorEditor}>
      <h3 style={styles.sessionTitle}>Committee Location</h3>
      <div style={styles.counselorFields}>
        <label style={styles.counselorField}>
          <span style={styles.counselorLabel}>Location</span>
          <select
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            style={styles.counselorSelect}
          >
            <option value="">None</option>
            <optgroup label="Available">
              {available.map((room) => (
                <option key={room} value={room}>{room}</option>
              ))}
            </optgroup>
            {showAll && occupied.length > 0 && (
              <optgroup label="Already assigned">
                {occupied.map(({ location: room, label }) => (
                  <option key={room} value={room}>{room} — {label}</option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <button type="button" onClick={handleSave} disabled={saving} style={styles.saveCounselorButton}>
          {saving ? 'Saving…' : 'Save Location'}
        </button>
      </div>
      {occupied.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          style={styles.showAllLocationsButton}
        >
          {showAll ? 'Hide assigned locations' : 'Show all locations (for swaps)'}
        </button>
      )}
      {message && <p style={styles.counselorMessage}>{message}</p>}
    </div>
  );
};

const EnrollmentsView = ({ enrollments, seniorCounselors, onUpdateCounselor, onUpdateLocation, onExport }) => {
  const [selectedCommittee, setSelectedCommittee] = useState(null);
  const [councilByName, setCouncilByName] = useState({});

  useEffect(() => {
    fetchCouncilNumberByCounselorName().then(setCouncilByName);
  }, []);

  if (enrollments.length === 0) {
    return (
      <div style={styles.content}>
        <p style={styles.emptyMessage}>No committee enrollments found</p>
      </div>
    );
  }

  if (selectedCommittee) {
    const committee = enrollments.find(e => e.committee._id === selectedCommittee);
    return (
      <div style={styles.content} className="admin-content">
        <div style={styles.headerRow} className="admin-header-row">
          <h2 style={styles.subtitle}>{committee.committee.name}</h2>
          <button onClick={() => setSelectedCommittee(null)} style={styles.backButton} className="admin-back-button">
            ← Back to List
          </button>
        </div>

        <CommitteeLocationEditor
          committee={committee.committee}
          onSave={onUpdateLocation}
        />
        <CommitteeCounselorEditor
          committee={committee.committee}
          seniorCounselors={seniorCounselors}
          enrollments={enrollments}
          onSave={onUpdateCounselor}
        />

        <div style={styles.enrollmentSection}>
          <div style={styles.sessionSection}>
            <h3 style={styles.sessionTitle}>
              Members ({committee.count} {committee.count === 1 ? 'person' : 'people'})
            </h3>
            {committee.names.length === 0 ? (
              <p style={styles.emptyMessage}>No enrollments</p>
            ) : (
              <div style={styles.nameList}>
                {committee.names.map((item, index) => (
                  <div key={index} style={styles.nameItem} className="admin-name-item">
                    <span style={styles.name}>{item.name}</span>
                    {item.seniorCounselor && (
                      <span style={styles.counselor}>
                        ({formatCounselorWithCouncil(item.seniorCounselor, councilByName)})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.content} className="admin-content">
      <div style={styles.statsBar} className="admin-stats-bar">
        <div style={{ flex: 1 }}></div>
        <button
          onClick={onExport}
          style={styles.statsExportButton}
          className="admin-stats-export"
          title="Export all enrollments as PDF"
        >
          📄 Export PDF
        </button>
      </div>
      <div style={styles.tableSection}>
        <div style={{...styles.tableHeader, gridTemplateColumns: '2fr 1.25fr 1.25fr 1fr 1fr'}} className="admin-table-header">
          <div style={styles.tableHeaderCell}>Committee</div>
          <div style={styles.tableHeaderCell}>Leader</div>
          <div style={styles.tableHeaderCell}>Location</div>
          <div style={styles.tableHeaderCell}>Members</div>
          <div style={styles.tableHeaderCell}>Actions</div>
        </div>
        
        {enrollments.map(enrollment => (
          <div
            key={enrollment.committee._id}
            style={{...styles.tableRow, gridTemplateColumns: '2fr 1.25fr 1.25fr 1fr 1fr'}}
            className="admin-enrollment-row"
            onClick={() => setSelectedCommittee(enrollment.committee._id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedCommittee(enrollment.committee._id);
              }
            }}
          >
            <div style={styles.tableCell} className="admin-table-cell-name">
              <strong>{enrollment.committee.name}</strong>
            </div>
            <div style={{...styles.tableCell, ...styles.tableCellExtra}} className="admin-table-cell-extra">
              {enrollment.committee._seniorCounselor?.name || enrollment.committee._seniorCounselor?.username || '—'}
            </div>
            <div style={{...styles.tableCell, ...styles.tableCellExtra}} className="admin-table-cell-extra">
              {enrollment.committee.location || '—'}
            </div>
            <div style={styles.tableCell} className="admin-table-cell-count">
              <strong>{enrollment.count}</strong>
            </div>
            <div style={{...styles.tableCell, ...styles.tableCellExtra}} className="admin-table-cell-extra">
              <div style={styles.actionButtons}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCommittee(enrollment.committee._id);
                  }}
                  style={styles.viewButton}
                  title="View Details"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 4px 0 rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                  }}
                >
                  👀
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportCommitteeEnrollments(enrollment);
                  }}
                  style={styles.exportButton}
                  title="Export PDF"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 4px 0 rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                  }}
                >
                  📄
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
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
  errorMessage: {
    padding: '1rem 1.25rem',
    borderRadius: '10px',
    marginBottom: '2rem',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    fontWeight: '500',
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
    transition: 'all 0.2s ease-in-out',
    marginBottom: '-2px',
  },
  activeTab: {
    color: '#3b82f6',
    borderBottomColor: '#3b82f6',
  },
  loading: {
    textAlign: 'center',
    padding: '3rem',
    color: '#64748b',
    fontSize: '1.125rem',
  },
  content: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    gap: '1rem',
  },
  subtitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#1e293b',
    margin: 0,
  },
  meta: {
    fontSize: '0.875rem',
    color: '#94a3b8',
    margin: '0 0 1.5rem 0',
    fontStyle: 'italic',
  },
  backButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
  },
  tableSection: {
    width: '100%',
    marginTop: '0',
  },
  statsBar: {
    display: 'flex',
    padding: '1rem 1.5rem',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    marginBottom: '1.5rem',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsGroup: {
    display: 'flex',
    gap: '2rem',
    alignItems: 'center',
  },
  stat: {
    display: 'flex',
    flexDirection: 'row',
    gap: '1.25rem',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: '600',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1e293b',
  },
  statsExportButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  exportButton: {
    padding: '0.5rem 0.75rem',
    fontSize: '0.975rem',
    fontWeight: '500',
    backgroundColor: '#f8fafc',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '2.5rem',
  },
  exportButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
    background: '#e2e8f0',
    color: '#94a3b8',
    boxShadow: 'none',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1.5fr 1fr',
    gap: '1rem',
    padding: '1rem 1.5rem',
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
    gridTemplateColumns: '2fr 1fr 1fr 1.5fr 1fr',
    gap: '1rem',
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
  tableCellExtra: {},
  actionButtons: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  viewButton: {
    padding: '0.5rem 0.75rem',
    fontSize: '1rem',
    fontWeight: '500',
    backgroundColor: '#f8fafc',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '2.5rem',
  },
  statusBadgeSubmitted: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: '600',
    backgroundColor: '#d1fae5',
    color: '#065f46',
    borderRadius: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statusBadgeMissing: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: '600',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    borderRadius: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  noAction: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  emptyMessage: {
    textAlign: 'center',
    padding: '2rem',
    color: '#94a3b8',
    fontSize: '1rem',
  },
  counselorEditor: {
    padding: '1.25rem',
    marginBottom: '1.5rem',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
  },
  counselorFields: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: '1rem',
  },
  counselorField: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 260px',
    gap: '0.4rem',
  },
  counselorLabel: {
    color: '#475569',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  counselorSelect: {
    width: '100%',
    padding: '0.7rem',
    color: '#1e293b',
    backgroundColor: 'white',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '0.9rem',
  },
  saveCounselorButton: {
    padding: '0.75rem 1rem',
    color: 'white',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  counselorMessage: {
    margin: '0.75rem 0 0',
    color: '#475569',
    fontSize: '0.85rem',
  },
  showAllLocationsButton: {
    marginTop: '0.75rem',
    padding: 0,
    color: '#3b82f6',
    background: 'none',
    border: 'none',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'left',
  },
  enrollmentSection: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '2rem',
    marginTop: '1.5rem',
  },
  sessionSection: {
    backgroundColor: '#f8fafc',
    padding: '1.5rem',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
  },
  sessionTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: '#1e293b',
    margin: '0 0 1rem 0',
    paddingBottom: '0.75rem',
    borderBottom: '1px solid #e2e8f0',
  },
  nameList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  nameItem: {
    padding: '0.75rem',
    backgroundColor: 'white',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontWeight: '500',
    color: '#1e293b',
  },
  counselor: {
    fontSize: '0.875rem',
    color: '#64748b',
    fontStyle: 'italic',
  },
};

export default CommitteesAdminPage;
