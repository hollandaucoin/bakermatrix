import React, { useState, useEffect } from 'react';
import { exportWorkshopSubmissions, exportWorkshopEnrollments } from '../util/pdfExports.js';
import api from '../util/api.js';
import { fetchCouncilNumberByCounselorName, formatCounselorWithCouncil } from '../util/council.js';

const WorkshopAdminPage = () => {
  const [activeTab, setActiveTab] = useState('submissions');
  const [submissions, setSubmissions] = useState([]);
  const [seniorCounselors, setSeniorCounselors] = useState([]);
  const [leaderOptions, setLeaderOptions] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [myEnrollments, setMyEnrollments] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeTab === 'submissions') {
      fetchSubmissions();
    } else if (activeTab === 'workshops') {
      fetchEnrollments();
      fetchLeaderOptions();
    } else {
      fetchMyEnrollments();
      fetchLeaderOptions();
    }
  }, [activeTab]);

  useEffect(() => {
    fetchSeniorCounselors();
  }, []);

  const fetchSubmissions = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/workshop-submissions/admin/all');
      setSubmissions(data);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError('Failed to load workshop submissions');
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
      // Don't set error here, just log it - submissions are more important
    }
  };

  const fetchEnrollments = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/workshops/admin/enrollments');
      setEnrollments(data);
    } catch (err) {
      console.error('Error fetching enrollments:', err);
      setError('Failed to load workshop enrollments');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderOptions = async () => {
    try {
      const { data } = await api.get('/api/workshops/leader-options');
      setLeaderOptions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching workshop leader options:', err);
      setError('Failed to load workshop leader options');
    }
  };

  const fetchMyEnrollments = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/workshops/mine');
      setMyEnrollments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching assigned workshops:', err);
      setError('Failed to load your workshops');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSubmission = async (submissionId) => {
    try {
      const { data } = await api.get(`/api/workshop-submissions/admin/${submissionId}`);
      setSelectedSubmission(data);
    } catch (err) {
      console.error('Error fetching submission details:', err);
      setError('Failed to load submission details');
    }
  };

  const handleExportSubmissions = () => {
    exportWorkshopSubmissions(submissions);
  };

  const handleExportEnrollments = () => {
    exportWorkshopEnrollments(enrollments);
  };

  const handleUpdateWorkshopLeaders = async (workshopId, leaders) => {
    const { data } = await api.put(`/api/workshops/${workshopId}`, {
      leaders,
    });
    setEnrollments((current) => current.map((enrollment) => (
      enrollment.workshop._id === workshopId
        ? { ...enrollment, workshop: data }
        : enrollment
    )));
    setMyEnrollments((current) => current.map((enrollment) => (
      enrollment.workshop._id === workshopId
        ? { ...enrollment, workshop: data }
        : enrollment
    )));
    return data;
  };

  return (
    <div style={styles.container} className="workshops-admin-page">
      <style>
        {`
          @media (max-width: 768px) {
            .workshops-admin-page {
              padding: 1rem !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
            .workshops-admin-page .page-header {
              margin-bottom: 1.25rem !important;
              padding: 0.5rem 0 !important;
            }
            .workshops-admin-page .page-title {
              font-size: 1.75rem !important;
            }
            .workshops-admin-page .page-description {
              font-size: 1rem !important;
            }
            .workshops-admin-page .admin-tabs {
              margin-bottom: 1.25rem !important;
            }
            .workshops-admin-page .admin-tab {
              flex: 1;
              padding: 0.75rem 0.5rem !important;
              text-align: center;
            }
            .workshops-admin-page .admin-content {
              padding: 1rem !important;
            }
            .workshops-admin-page .admin-stats-bar {
              flex-direction: column !important;
              align-items: stretch !important;
              gap: 0.75rem !important;
              padding: 1rem !important;
            }
            .workshops-admin-page .admin-stats-group {
              flex-direction: column !important;
              gap: 0.75rem !important;
              width: 100% !important;
            }
            .workshops-admin-page .admin-stat {
              justify-content: space-between !important;
              width: 100% !important;
            }
            .workshops-admin-page .admin-stats-export {
              width: 100% !important;
              justify-content: center !important;
            }
            .workshops-admin-page .admin-table-header {
              display: none !important;
            }
            .workshops-admin-page .admin-submission-row {
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              gap: 0.75rem !important;
              padding: 0.875rem 1rem !important;
              grid-template-columns: none !important;
            }
            .workshops-admin-page .admin-submission-row-clickable {
              cursor: pointer;
            }
            .workshops-admin-page .admin-submission-row-clickable:active {
              background-color: #f8fafc;
            }
            .workshops-admin-page .admin-table-cell-extra {
              display: none !important;
            }
            .workshops-admin-page .admin-table-cell-name {
              flex: 1 !important;
              min-width: 0 !important;
              font-weight: 600 !important;
            }
            .workshops-admin-page .admin-enrollment-row {
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              gap: 0.75rem !important;
              padding: 0.875rem 1rem !important;
              grid-template-columns: none !important;
              cursor: pointer;
            }
            .workshops-admin-page .admin-enrollment-row:active {
              background-color: #f8fafc;
            }
            .workshops-admin-page .admin-table-cell-count {
              font-weight: 700 !important;
              color: #1e293b !important;
              flex-shrink: 0 !important;
            }
            .workshops-admin-page .admin-header-row {
              flex-direction: column !important;
              align-items: stretch !important;
            }
            .workshops-admin-page .admin-back-button {
              width: 100% !important;
            }
            .workshops-admin-page .admin-enrollment-section {
              grid-template-columns: 1fr !important;
            }
            .workshops-admin-page .admin-detail-table-header {
              display: none !important;
            }
            .workshops-admin-page .admin-detail-row {
              display: flex !important;
              flex-direction: column !important;
              gap: 0.5rem !important;
              padding: 0.875rem 1rem !important;
              grid-template-columns: none !important;
            }
            .workshops-admin-page .admin-detail-cell::before {
              content: attr(data-label);
              font-size: 0.75rem;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #64748b;
              margin-bottom: 0.25rem;
            }
            .workshops-admin-page .admin-name-item {
              flex-direction: column !important;
              align-items: flex-start !important;
              gap: 0.25rem !important;
            }
          }
        `}
      </style>
      <div style={styles.header} className="page-header">
        <h1 style={styles.title} className="page-title">Workshops</h1>
        <p style={styles.description} className="page-description">
          Manage and view workshop submissions from Senior Counselors.
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
          style={{
            ...styles.tab,
            ...(activeTab === 'submissions' ? styles.activeTab : {})
          }}
          className="admin-tab"
        >
          Submissions
        </button>
        <button
          onClick={() => setActiveTab('workshops')}
          style={{
            ...styles.tab,
            ...(activeTab === 'workshops' ? styles.activeTab : {})
          }}
          className="admin-tab"
        >
          Workshop Lists
        </button>
        <button
          onClick={() => setActiveTab('mine')}
          style={{
            ...styles.tab,
            ...(activeTab === 'mine' ? styles.activeTab : {})
          }}
          className="admin-tab"
        >
          My Workshops
        </button>
      </div>

      {loading ? (
        <div style={styles.loading}>Loading...</div>
      ) : activeTab === 'submissions' ? (
        <SubmissionsView
          submissions={submissions}
          seniorCounselors={seniorCounselors}
          selectedSubmission={selectedSubmission}
          onViewSubmission={handleViewSubmission}
          onCloseSubmission={() => setSelectedSubmission(null)}
          onExport={handleExportSubmissions}
        />
      ) : activeTab === 'workshops' ? (
        <EnrollmentsView
          enrollments={enrollments}
          leaderOptions={leaderOptions}
          onUpdateLeaders={handleUpdateWorkshopLeaders}
          onExport={handleExportEnrollments}
        />
      ) : (
        <EnrollmentsView
          enrollments={myEnrollments}
          leaderOptions={leaderOptions}
          onUpdateLeaders={handleUpdateWorkshopLeaders}
          onExport={() => exportWorkshopEnrollments(myEnrollments)}
          emptyMessage="No workshops are assigned to this admin account."
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
          <div style={{...styles.tableHeader, gridTemplateColumns: '1fr 1fr 1fr'}} className="admin-detail-table-header">
            <div style={styles.tableHeaderCell}>Name</div>
            <div style={styles.tableHeaderCell}>Workshop 1</div>
            <div style={styles.tableHeaderCell}>Workshop 2</div>
          </div>
          
          {selectedSubmission.assignments.map((assignment, index) => (
            <div key={index} style={{...styles.tableRow, gridTemplateColumns: '1fr 1fr 1fr'}} className="admin-detail-row">
              <div style={styles.tableCell} className="admin-detail-cell" data-label="Name">{assignment.name}</div>
              <div style={styles.tableCell} className="admin-detail-cell" data-label="Workshop 1">
                {assignment.workshop1?.name || 'N/A'}
              </div>
              <div style={styles.tableCell} className="admin-detail-cell" data-label="Workshop 2">
                {assignment.workshop2?.name || 'N/A'}
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
                        exportWorkshopSubmissions(submission);
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

const leaderValue = (leader) => (
  leader?.account?._id && leader?.accountModel
    ? `${leader.accountModel}:${leader.account._id}`
    : ''
);

const workshopLeaderValues = (workshop) => {
  if (workshop.leaders?.length) {
    return workshop.leaders.map(leaderValue);
  }
  return [
    workshop._seniorCounselor?._id
      ? `SeniorCounselor:${workshop._seniorCounselor._id}`
      : '',
    workshop._seniorCounselor2?._id
      ? `SeniorCounselor:${workshop._seniorCounselor2._id}`
      : '',
  ];
};

const parseLeaderValue = (value) => {
  const [accountModel, account] = value.split(':');
  return { account, accountModel };
};

const WorkshopLeadersEditor = ({ workshop, leaderOptions, onSave }) => {
  const initialLeaders = workshopLeaderValues(workshop);
  const [leader1, setLeader1] = useState(initialLeaders[0] || '');
  const [leader2, setLeader2] = useState(initialLeaders[1] || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const values = workshopLeaderValues(workshop);
    setLeader1(values[0] || '');
    setLeader2(values[1] || '');
  }, [workshop]);

  const handleSave = async () => {
    if (!leader1) {
      setMessage('Choose the first workshop leader.');
      return;
    }
    if (leader1 === leader2) {
      setMessage('Choose two different workshop leaders.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      await onSave(
        workshop._id,
        [leader1, leader2].filter(Boolean).map(parseLeaderValue)
      );
      setMessage('Workshop leaders updated.');
    } catch (err) {
      setMessage(err.message || 'Failed to update senior counselors.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.counselorEditor}>
      <h3 style={styles.sessionTitle}>Workshop Leaders</h3>
      <div style={styles.counselorFields}>
        <label style={styles.counselorField}>
          <span style={styles.counselorLabel}>Leader 1</span>
          <select
            value={leader1}
            onChange={(event) => setLeader1(event.target.value)}
            style={styles.counselorSelect}
          >
            <option value="">Select…</option>
            {leaderOptions
              .filter((option) => `${option.accountModel}:${option._id}` !== leader2)
              .map((option) => (
                <option key={`${option.accountModel}:${option._id}`} value={`${option.accountModel}:${option._id}`}>
                  {option.name} ({option.admin ? 'Admin' : option.accountModel === 'SeniorCounselor' ? 'SC' : 'User'})
                </option>
              ))}
          </select>
        </label>
        <label style={styles.counselorField}>
          <span style={styles.counselorLabel}>Leader 2 (optional)</span>
          <select
            value={leader2}
            onChange={(event) => setLeader2(event.target.value)}
            style={styles.counselorSelect}
          >
            <option value="">None</option>
            {leaderOptions
              .filter((option) => `${option.accountModel}:${option._id}` !== leader1)
              .map((option) => (
                <option key={`${option.accountModel}:${option._id}`} value={`${option.accountModel}:${option._id}`}>
                  {option.name} ({option.admin ? 'Admin' : option.accountModel === 'SeniorCounselor' ? 'SC' : 'User'})
                </option>
              ))}
          </select>
        </label>
        <button type="button" onClick={handleSave} disabled={saving} style={styles.saveCounselorsButton}>
          {saving ? 'Saving…' : 'Save Leaders'}
        </button>
      </div>
      {message && <p style={styles.counselorMessage}>{message}</p>}
    </div>
  );
};

const EnrollmentsView = ({
  enrollments,
  leaderOptions,
  onUpdateLeaders,
  onExport,
  emptyMessage = 'No workshop enrollments found',
}) => {
  const [selectedWorkshop, setSelectedWorkshop] = useState(null);
  const [councilByName, setCouncilByName] = useState({});

  useEffect(() => {
    fetchCouncilNumberByCounselorName().then(setCouncilByName);
  }, []);

  if (enrollments.length === 0) {
    return (
      <div style={styles.content}>
        <p style={styles.emptyMessage}>{emptyMessage}</p>
      </div>
    );
  }

  if (selectedWorkshop) {
    const workshop = enrollments.find(e => e.workshop._id === selectedWorkshop);
    return (
      <div style={styles.content} className="admin-content">
        <div style={styles.headerRow} className="admin-header-row">
          <h2 style={styles.subtitle}>{workshop.workshop.name}</h2>
          <button onClick={() => setSelectedWorkshop(null)} style={styles.backButton} className="admin-back-button">
            ← Back to List
          </button>
        </div>

        <WorkshopLeadersEditor
          workshop={workshop.workshop}
          leaderOptions={leaderOptions}
          onSave={onUpdateLeaders}
        />

        <div style={styles.enrollmentSection} className="admin-enrollment-section">
          <div style={styles.sessionSection}>
            <h3 style={styles.sessionTitle}>
              Session 1 ({workshop.session1Count} {workshop.session1Count === 1 ? 'person' : 'people'})
            </h3>
            {workshop.session1.length === 0 ? (
              <p style={styles.emptyMessage}>No enrollments</p>
            ) : (
              <div style={styles.nameList}>
                {workshop.session1.map((item, index) => (
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

          <div style={styles.sessionSection}>
            <h3 style={styles.sessionTitle}>
              Session 2 ({workshop.session2Count} {workshop.session2Count === 1 ? 'person' : 'people'})
            </h3>
            {workshop.session2.length === 0 ? (
              <p style={styles.emptyMessage}>No enrollments</p>
            ) : (
              <div style={styles.nameList}>
                {workshop.session2.map((item, index) => (
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
        <div style={{...styles.tableHeader, gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr'}} className="admin-table-header">
          <div style={styles.tableHeaderCell}>Workshop</div>
          <div style={styles.tableHeaderCell}>Session 1</div>
          <div style={styles.tableHeaderCell}>Session 2</div>
          <div style={styles.tableHeaderCell}>Total</div>
          <div style={styles.tableHeaderCell}>Actions</div>
        </div>
        
        {enrollments.map(enrollment => (
          <div
            key={enrollment.workshop._id}
            style={{...styles.tableRow, gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr'}}
            className="admin-enrollment-row"
            onClick={() => setSelectedWorkshop(enrollment.workshop._id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedWorkshop(enrollment.workshop._id);
              }
            }}
          >
            <div style={styles.tableCell} className="admin-table-cell-name">
              <strong>{enrollment.workshop.name}</strong>
            </div>
            <div style={{...styles.tableCell, ...styles.tableCellExtra}} className="admin-table-cell-extra">
              {enrollment.session1Count}
            </div>
            <div style={{...styles.tableCell, ...styles.tableCellExtra}} className="admin-table-cell-extra">
              {enrollment.session2Count}
            </div>
            <div style={styles.tableCell} className="admin-table-cell-count">
              <strong>{enrollment.totalCount}</strong>
            </div>
            <div style={{...styles.tableCell, ...styles.tableCellExtra}} className="admin-table-cell-extra">
              <div style={styles.actionButtons}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedWorkshop(enrollment.workshop._id);
                  }}
                  style={styles.viewButton}
                  title="View Details"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#c7d2fe';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 4px 0 rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#e0e7ff';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                  }}
                >
                  👀
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportWorkshopEnrollments(enrollment);
                  }}
                  style={styles.exportButton}
                  title="Export PDF"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#bbf7d0';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 4px 0 rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#dcfce7';
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
  exportButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
    background: '#e2e8f0',
    color: '#94a3b8',
    boxShadow: 'none',
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
  exportButton: {
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
    flex: '1 1 220px',
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
  saveCounselorsButton: {
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
  enrollmentSection: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
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

export default WorkshopAdminPage;
