import React, { useEffect, useState } from 'react';
import api from '../../util/api.js';

// Separate Form Component to isolate typing issues
const FormComponent = ({ formData, setFormData, schools, availableDorms, isEdit, onSubmit, onCancel, onDelete }) => {
  const [schoolSearchTerm, setSchoolSearchTerm] = useState('');
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const [filteredSchools, setFilteredSchools] = useState([]);
  const [previousSchoolsSearch, setPreviousSchoolsSearch] = useState('');
  const [showPreviousSchoolsDropdown, setShowPreviousSchoolsDropdown] = useState(false);
  const [filteredPreviousSchools, setFilteredPreviousSchools] = useState([]);

  // Initialize search terms when form opens
  useEffect(() => {
    if (formData._associatedSchool) {
      const selectedSchool = schools.find(school => school._id === formData._associatedSchool);
      if (selectedSchool) {
        setSchoolSearchTerm(selectedSchool.name);
      }
    }
  }, [formData._associatedSchool, schools]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const selectSchool = (school) => {
    setFormData(prev => ({
      ...prev,
      _associatedSchool: school._id
    }));
    setSchoolSearchTerm(school.name);
    setShowSchoolDropdown(false);
  };

  const addPreviousSchool = (school) => {
    if (!formData._previousSchools.includes(school._id)) {
      setFormData(prev => ({
        ...prev,
        _previousSchools: [...prev._previousSchools, school._id]
      }));
    }
    setPreviousSchoolsSearch('');
    setShowPreviousSchoolsDropdown(false);
  };

  const removePreviousSchool = (schoolId) => {
    setFormData(prev => ({
      ...prev,
      _previousSchools: prev._previousSchools.filter(id => id !== schoolId)
    }));
  };

  const getPreviousSchoolName = (schoolId) => {
    const school = schools.find(s => s._id === schoolId);
    return school ? school.name : schoolId;
  };

  return (
    <form onSubmit={onSubmit}>
      <div style={styles.formGroup}>
        <div style={styles.formRow}>
          <div style={styles.formColumn}>
            <label style={styles.formLabel}>Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              style={styles.formInput}
              required
              placeholder="Enter counselor name"
            />
          </div>
          <div style={styles.formColumn}>
            <label style={styles.formLabel}>Year *</label>
            <select
              name="year"
              value={formData.year}
              onChange={handleInputChange}
              style={styles.formInput}
              required
            >
              <option value="">Select year...</option>
              <option value={1}>1st Year</option>
              <option value={2}>2nd Year</option>
              <option value={3}>3rd Year</option>
            </select>
          </div>
        </div>
      </div>

      <div style={styles.formGroup}>
        <div style={styles.formRow}>
          <div style={styles.formColumn}>
            <label style={styles.formLabel}>Dorm *</label>
            <select
              name="_dorm"
              value={formData._dorm}
              onChange={handleInputChange}
              style={styles.formInput}
              required
            >
              <option value="">Select dorm...</option>
              {availableDorms.map(dorm => (
                <option key={dorm._id} value={dorm._id}>{dorm.name}</option>
              ))}
            </select>
          </div>
          <div style={styles.formColumn}>
            <label style={styles.formLabel}>Associated School</label>
            <div style={styles.searchContainer} className="search-container">
              <input
                type="text"
                value={schoolSearchTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  setSchoolSearchTerm(value);
                  if (value.trim()) {
                    const filtered = schools.filter(school => 
                      school.name.toLowerCase().includes(value.toLowerCase())
                    );
                    setFilteredSchools(filtered);
                    setShowSchoolDropdown(filtered.length > 0);
                  } else {
                    setFilteredSchools([]);
                    setShowSchoolDropdown(false);
                  }
                }}
                style={styles.formInput}
                placeholder="Search for a school..."
              />
              {showSchoolDropdown && filteredSchools.length > 0 && (
                <div style={styles.dropdownList}>
                  {filteredSchools.map(school => (
                    <div
                      key={school._id}
                      style={styles.dropdownItem}
                      onClick={() => selectSchool(school)}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      {school.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.formLabel}>Previous Schools</label>
        <div style={styles.previousSchoolsContainer} className="previous-schools-container">
          <div style={styles.tagsInputContainer}>
            {formData._previousSchools.map(schoolId => (
              <div key={schoolId} style={styles.tag}>
                <span style={styles.tagText}>{getPreviousSchoolName(schoolId)}</span>
                <button
                  type="button"
                  style={styles.tagRemove}
                  onClick={() => removePreviousSchool(schoolId)}
                >
                  ×
                </button>
              </div>
            ))}
            <input
              type="text"
              value={previousSchoolsSearch}
              onChange={(e) => {
                const value = e.target.value;
                setPreviousSchoolsSearch(value);
                if (value.trim()) {
                  const availableSchools = schools.filter(school => 
                    !formData._previousSchools.includes(school._id) &&
                    school.name.toLowerCase().includes(value.toLowerCase())
                  );
                  setFilteredPreviousSchools(availableSchools);
                  setShowPreviousSchoolsDropdown(availableSchools.length > 0);
                } else {
                  setFilteredPreviousSchools([]);
                  setShowPreviousSchoolsDropdown(false);
                }
              }}
              style={styles.tagsInput}
              placeholder={formData._previousSchools.length === 0 ? "Search for schools..." : ""}
            />
          </div>
          {showPreviousSchoolsDropdown && filteredPreviousSchools.length > 0 && (
            <div style={styles.dropdownList}>
              {filteredPreviousSchools.map(school => (
                <div
                  key={school._id}
                  style={styles.dropdownItem}
                  onClick={() => addPreviousSchool(school)}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  {school.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={styles.popupFooter}>
        {isEdit && onDelete && (
          <button type="button" style={styles.deleteButton} className="delete-button" onClick={onDelete}>
            DELETE
          </button>
        )}
        <div style={styles.popupFooterRight}>
          <button type="button" style={styles.cancelButton} onClick={onCancel}>
            CANCEL
          </button>
          <button type="submit" style={styles.submitButton}>
            {isEdit ? 'UPDATE' : 'CREATE'}
          </button>
        </div>
      </div>
    </form>
  );
};

const JuniorCounselorList = ({ goBack, goNext, isFirst, isLast }) => {
  const [juniorCounselors, setJuniorCounselors] = useState([]);
  const [schools, setSchools] = useState([]);
  const [dorms, setDorms] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Popup states
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [editingCounselor, setEditingCounselor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    year: '',
    _dorm: '',
    _associatedSchool: '',
    _previousSchools: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [juniorResponse, schoolsResponse, dormsResponse] = await Promise.all([
          api.get(`/api/juniorcounselors`),
          api.get(`/api/schools`),
          api.get(`/api/dorms`)
        ]);
        
        setJuniorCounselors(juniorResponse.data);
        setSchools(schoolsResponse.data);
        setDorms(dormsResponse.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter out staff dorms
  const availableDorms = dorms.filter(dorm => dorm.type !== 'staff');

  // SVG Edit Icon Component
  const EditIcon = () => (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );

  const handleCreateCounselor = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        year: parseInt(formData.year, 10),
        _associatedSchool: formData._associatedSchool || undefined,
        _previousSchools: formData._previousSchools?.length ? formData._previousSchools : undefined
      };
      const response = await api.post(`/api/juniorcounselors`, dataToSend);
      setJuniorCounselors(prev => [...prev, response.data]);
      setShowCreatePopup(false);
      resetForm();
      window.showToast('Junior counselor created successfully!', 'success');
    } catch (err) {
      console.error('Error creating counselor:', err);
      window.showToast('Failed to create junior counselor.', 'error');
    }
  };

  const handleEditCounselor = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        year: parseInt(formData.year, 10),
        _associatedSchool: formData._associatedSchool || undefined,
        _previousSchools: formData._previousSchools?.length ? formData._previousSchools : undefined
      };
      const response = await api.put(`/api/juniorcounselors/${editingCounselor._id}`, dataToSend);
      setJuniorCounselors(prev => prev.map(jc => 
        jc._id === editingCounselor._id ? response.data : jc
      ));
      setShowEditPopup(false);
      setEditingCounselor(null);
      resetForm();
      window.showToast('Junior counselor updated successfully!', 'success');
    } catch (err) {
      console.error('Error updating counselor:', err);
      window.showToast('Failed to update junior counselor.', 'error');
    }
  };

  const handleDeleteCounselor = async () => {
    if (!window.confirm(`Are you sure you want to delete ${editingCounselor.name}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await api.delete(`/api/juniorcounselors/${editingCounselor._id}`);
      setJuniorCounselors(prev => prev.filter(jc => jc._id !== editingCounselor._id));
      setShowEditPopup(false);
      setEditingCounselor(null);
      resetForm();
      window.showToast('Junior counselor deleted successfully!', 'success');
    } catch (err) {
      console.error('Error deleting counselor:', err);
      window.showToast('Failed to delete junior counselor.', 'error');
    }
  };

  const openEditPopup = (counselor) => {
    setEditingCounselor(counselor);
    setFormData({
      name: counselor.name,
      year: counselor.year || '',
      _dorm: counselor._dorm?._id || '',
      _associatedSchool: counselor._associatedSchool?._id || '',
      _previousSchools: counselor._previousSchools?.map(school => school._id) || []
    });
    setShowEditPopup(true);
  };

  const closePopup = () => {
    setShowCreatePopup(false);
    setShowEditPopup(false);
    setEditingCounselor(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      year: '',
      _dorm: '',
      _associatedSchool: '',
      _previousSchools: []
    });
  };

  const getDormAssignmentPercentage = () => {
    const percentage = juniorCounselors.length > 0 
      ? Math.round((juniorCounselors.filter(jc => jc._dorm).length / juniorCounselors.length) * 100)
      : 0;
    return { percentage: `${percentage}%`, isComplete: percentage === 100 };
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading junior counselors...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Junior Counselors</h1>
        <p style={styles.subtitle}>Manage junior counselors and their assignments</p>
      </div>

      {/* Top Navigation */}
      <div style={styles.navigationTop}>
        <div style={styles.navigationButtons}>
          {!isFirst && (
            <button style={styles.navButton} onClick={goBack}>
              ← Back
            </button>
          )}
          {!isLast && (
            <button style={styles.navButton} onClick={goNext}>
              Next →
            </button>
          )}
        </div>
        <button style={styles.addButtonTop} onClick={() => setShowCreatePopup(true)}>
          +
        </button>
      </div>

      {error && (
        <div style={styles.errorContainer}>
          <div style={styles.errorIcon}>⚠️</div>
          <div style={styles.errorContent}>
            <h3 style={styles.errorTitle}>Error</h3>
            <p style={styles.errorMessage}>{error}</p>
          </div>
        </div>
      )}

      {juniorCounselors.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>👨‍🎓</div>
          <h3 style={styles.emptyTitle}>No Junior Counselors</h3>
          <p style={styles.emptyMessage}>No junior counselors are currently available.</p>
          <button style={styles.addButton} onClick={() => setShowCreatePopup(true)}>
            Add First Junior Counselor
          </button>
        </div>
      ) : (
        <>
          <div style={styles.statsContainer} className="stats-container">
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{juniorCounselors.length}</div>
              <div style={styles.statLabel}>Junior Counselors</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>
                {juniorCounselors.filter(jc => jc.year === 1).length}
              </div>
              <div style={styles.statLabel}>1st Year Junior Counselors</div>
            </div>
            <div style={{
              ...styles.statCard,
              ...(getDormAssignmentPercentage().isComplete ? {} : styles.statCardIncomplete)
            }}>
              <div style={{
                ...styles.statNumber,
                ...(getDormAssignmentPercentage().isComplete ? {} : styles.statNumberIncomplete)
              }}>
                {getDormAssignmentPercentage().percentage}
              </div>
              <div style={{
                ...styles.statLabel,
                ...(getDormAssignmentPercentage().isComplete ? {} : styles.statLabelIncomplete)
              }}>
                JCs Assigned to Dorms
              </div>
            </div>
          </div>

          <div style={styles.tableContent}>
            <div style={styles.tableSection}>
              <div style={{ ...styles.listTableHeader, gridTemplateColumns: JC_TABLE_COLUMNS }}>
                <div>Name</div>
                <div>Year</div>
                <div>School</div>
                <div>Dorm</div>
                <div />
              </div>
              {juniorCounselors.map((juniorCounselor, index) => (
                <div
                  key={juniorCounselor._id || index}
                  className="jc-list-row"
                  style={{ ...styles.listTableRow, gridTemplateColumns: JC_TABLE_COLUMNS }}
                  onClick={() => openEditPopup(juniorCounselor)}
                >
                  <div style={styles.listTableCellName}>{juniorCounselor.name}</div>
                  <div>
                    <span style={{
                      ...styles.yearBadge,
                      ...styles.tableYearBadge,
                      ...getYearColor(juniorCounselor.year)
                    }}>
                      {getYearLabel(juniorCounselor.year)}
                    </span>
                  </div>
                  <div style={styles.listTableCell}>
                    {juniorCounselor._associatedSchool?.name || '—'}
                  </div>
                  <div style={styles.listTableCell}>
                    {renderDormCell(juniorCounselor, juniorCounselors)}
                  </div>
                  <div style={styles.listTableActions}>
                    <button
                      style={styles.editButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditPopup(juniorCounselor);
                      }}
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom Navigation */}
      <div style={styles.navigationBottom}>
        <div style={styles.navigationButtons}>
          {!isFirst && (
            <button style={styles.navButton} onClick={goBack}>
              ← Back
            </button>
          )}
          {!isLast && (
            <button style={styles.navButton} onClick={goNext}>
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Popups */}
      {showCreatePopup && (
        <div style={styles.popupOverlay} onClick={closePopup}>
          <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
            <div style={styles.popupHeader}>
              <h2 style={styles.popupTitle}>Add New Junior Counselor</h2>
              <button style={styles.closeButton} onClick={closePopup}>×</button>
            </div>
            <FormComponent 
              formData={formData} 
              setFormData={setFormData} 
              schools={schools}
              availableDorms={availableDorms}
              isEdit={false} 
              onSubmit={handleCreateCounselor} 
              onCancel={closePopup} 
              onDelete={handleDeleteCounselor}
            />
          </div>
        </div>
      )}
      {showEditPopup && (
        <div style={styles.popupOverlay} onClick={closePopup}>
          <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
            <div style={styles.popupHeader}>
              <h2 style={styles.popupTitle}>Edit Junior Counselor</h2>
              <button style={styles.closeButton} onClick={closePopup}>×</button>
            </div>
            <FormComponent 
              formData={formData} 
              setFormData={setFormData} 
              schools={schools}
              availableDorms={availableDorms}
              isEdit={true} 
              onSubmit={handleEditCounselor} 
              onCancel={closePopup} 
              onDelete={handleDeleteCounselor}
            />
          </div>
        </div>
      )}
    </div>
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
  actionsContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '1.5rem',
  },
  addButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1.25rem',
    fontSize: '0.8rem',
    fontWeight: '600',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    transition: 'all 0.3s ease-in-out',
    boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)',
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
    margin: '0 0 2.5rem 0',
    fontSize: '1.125rem',
    lineHeight: '1.6',
  },
  statsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 280px)',
    gap: '1.25rem',
    marginBottom: '2rem',
    justifyContent: 'center',
  },
  statCard: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    padding: '1.5rem',
    borderRadius: '16px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    textAlign: 'center',
    border: '2px solid #3b82f6',
    transition: 'all 0.3s ease-in-out',
  },
  statNumber: {
    fontSize: '2rem',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    marginBottom: '0.5rem',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  tableContent: {
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    marginBottom: '2.5rem',
  },
  tableSection: {},
  listTableHeader: {
    display: 'grid',
    padding: '1rem 1.5rem',
    backgroundColor: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  listTableRow: {
    display: 'grid',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #e2e8f0',
    alignItems: 'center',
    transition: 'background-color 0.15s ease',
    cursor: 'pointer',
  },
  listTableCell: {
    fontSize: '0.95rem',
    color: '#334155',
  },
  dormRoommateNote: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  listTableCellName: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#0f172a',
  },
  listTableActions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  tableYearBadge: {
    fontSize: '0.7rem',
    padding: '0.25rem 0.5rem',
    whiteSpace: 'nowrap',
  },
  yearBadge: {
    fontSize: '0.8rem',
    fontWeight: '600',
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
    gap: '1.75rem',
    marginBottom: '2.5rem',
  },
  card: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '16px',
    padding: '1.5rem',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    border: '1px solid #e2e8f0',
    transition: 'all 0.3s ease-in-out',
    position: 'relative',
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
  },
  nameContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  name: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0',
    letterSpacing: '-0.025em',
  },
  cardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  editButton: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.7rem',
    fontWeight: '600',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  dormBadge: {
    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    color: '#92400e',
    fontSize: '0.8rem',
    fontWeight: '600',
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(251, 191, 36, 0.2)',
  },
  details: {
    marginBottom: '0.5rem',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 0',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.25rem',
  },
  detailLabel: {
    fontSize: '0.75rem',
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  detailValue: {
    fontSize: '0.875rem',
    color: '#1e293b',
    fontWeight: '600',
  },
  popupOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  popup: {
    backgroundColor: 'white',
    borderRadius: '20px',
    padding: '2.5rem',
    width: '90%',
    maxWidth: '550px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    border: '1px solid #e2e8f0',
  },
  popupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2.5rem',
  },
  popupTitle: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
    letterSpacing: '-0.025em',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.75rem',
    cursor: 'pointer',
    color: '#64748b',
    padding: '0.5rem',
    borderRadius: '8px',
    transition: 'all 0.2s ease-in-out',
  },
  popupFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '1.5rem',
  },
  popupFooterRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  deleteButton: {
    padding: '0.875rem 1.75rem',
    fontSize: '0.875rem',
    fontWeight: '700',
    borderRadius: '10px',
    border: '2px solid #ef4444',
    background: 'white',
    color: '#ef4444',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  cancelButton: {
    padding: '0.875rem 1.75rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    borderRadius: '10px',
    border: '2px solid #d1d5db',
    background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  submitButton: {
    padding: '0.875rem 1.75rem',
    fontSize: '0.875rem',
    fontWeight: '700',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)',
  },
  searchContainer: {
    position: 'relative',
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    width: '100%',
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    zIndex: 10,
  },
  dropdownItem: {
    padding: '0.75rem 1rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
  },
  tagsInputContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    padding: '0.75rem',
    borderRadius: '10px',
    border: '2px solid #e2e8f0',
    backgroundColor: 'white',
    minHeight: '3rem',
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  tag: {
    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    padding: '0.25rem 0.5rem',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.75rem',
  },
  tagText: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#1e40af',
  },
  tagRemove: {
    background: 'none',
    border: 'none',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#64748b',
    cursor: 'pointer',
    padding: '0',
    lineHeight: '1',
  },
  tagsInput: {
    flex: 1,
    minWidth: '120px',
    border: 'none',
    outline: 'none',
    fontSize: '0.875rem',
    color: '#374151',
    backgroundColor: 'transparent',
  },
  formGroup: {
    marginBottom: '1.5rem',
  },
  formLabel: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.5rem',
  },
  formInput: {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    backgroundColor: 'white',
    color: '#374151',
    transition: 'all 0.2s ease-in-out',
    boxSizing: 'border-box',
  },
  formRow: {
    display: 'flex',
    gap: '1rem',
  },
  formColumn: {
    flex: 1,
  },
  previousSchoolsContainer: {
    position: 'relative',
  },
  deleteButton: {
    padding: '0.875rem 1.75rem',
    fontSize: '0.875rem',
    fontWeight: '700',
    borderRadius: '10px',
    border: '2px solid #ef4444',
    background: 'white',
    color: '#ef4444',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  cancelButton: {
    padding: '0.875rem 1.75rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    borderRadius: '10px',
    border: '2px solid #d1d5db',
    background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  submitButton: {
    padding: '0.875rem 1.75rem',
    fontSize: '0.875rem',
    fontWeight: '700',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)',
  },
  popup: {
    backgroundColor: 'white',
    borderRadius: '20px',
    padding: '2.5rem',
    width: '90%',
    maxWidth: '550px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    border: '1px solid #e2e8f0',
  },
  popupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2.5rem',
  },
  popupTitle: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
    letterSpacing: '-0.025em',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.75rem',
    cursor: 'pointer',
    color: '#64748b',
    padding: '0.5rem',
    borderRadius: '8px',
    transition: 'all 0.2s ease-in-out',
  },
  popupOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
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
  addButtonTop: {
    position: 'absolute',
    right: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1.25rem',
    fontSize: '0.8rem',
    fontWeight: '600',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    transition: 'all 0.3s ease-in-out',
    boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)',
  },
  navigationBottom: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '2rem',
  },
  statCardIncomplete: {
    border: '2px solid #dc2626',
  },
  statNumberIncomplete: {
    color: '#dc2626',
    WebkitTextFillColor: '#dc2626',
    background: 'none',
    WebkitBackgroundClip: 'initial',
    backgroundClip: 'initial',
  },
  statLabelIncomplete: {
    color: '#dc2626',
  },
};

// Add CSS animation for spinner
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  .delete-button:hover {
    background: #ef4444 !important;
    color: white !important;
    box-shadow: 0 4px 14px 0 rgba(239, 68, 68, 0.39) !important;
  }

  .jc-list-row:hover {
    background-color: #f8fafc;
  }
  
  @media (max-width: 768px) {
    .stats-container {
      grid-template-columns: repeat(2, 180px) !important;
    }
  }
  
  @media (max-width: 480px) {
    .stats-container {
      grid-template-columns: repeat(1, 180px) !important;
    }
  }
`;
document.head.appendChild(styleSheet);

const JC_TABLE_COLUMNS = '1.4fr 1.15fr 1.4fr 1.4fr 50px';

const getFirstName = (name) => name?.split(' ')[0] || '';

const renderDormCell = (counselor, allCounselors) => {
  if (!counselor._dorm?.name) return '—';

  const dormId = counselor._dorm._id
    ? counselor._dorm._id.toString()
    : counselor._dorm.toString();

  const roommates = allCounselors.filter((jc) => {
    if (jc._id === counselor._id || !jc._dorm) return false;
    const jcDormId = jc._dorm._id ? jc._dorm._id.toString() : jc._dorm.toString();
    return jcDormId === dormId;
  });

  if (roommates.length === 0) return counselor._dorm.name;

  const roommateFirstNames = roommates.map((jc) => getFirstName(jc.name)).join(', ');
  return (
    <>
      {counselor._dorm.name}{' '}
      <span style={styles.dormRoommateNote}>({roommateFirstNames})</span>
    </>
  );
};

const getYearLabel = (year) => {
  const yearNum = parseInt(year, 10);
  if (yearNum === 1) return 'FIRST YEAR';
  if (yearNum === 2) return 'SECOND YEAR';
  if (yearNum === 3) return 'THIRD YEAR';
  return 'N/A';
};

const getYearColor = (year) => {
  const yearNum = parseInt(year, 10);
  switch (yearNum) {
    case 1:
      return {
        background: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)',
        color: '#991b1b',
        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)',
      };
    case 2:
      return {
        background: 'linear-gradient(135deg, #e9d5ff 0%, #d8b4fe 100%)',
        color: '#7e22ce',
        boxShadow: '0 2px 4px rgba(168, 85, 247, 0.2)',
      };
    case 3:
      return {
        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
        color: '#1e40af',
        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
      };
    default:
      return {
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        color: '#64748b',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      };
  }
};

export default JuniorCounselorList;