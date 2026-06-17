import React, { useEffect, useState } from 'react';
import api from '../../util/api.js';

// Separate Form Component to isolate typing issues
const FormComponent = ({ formData, setFormData, inactiveSchools, onSubmit, onCancel }) => {
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const [filteredSchools, setFilteredSchools] = useState([]);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value
    }));
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      name: value,
      selectedSchoolId: null,
    }));

    if (value.trim()) {
      const filtered = inactiveSchools.filter(school =>
        school.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSchools(filtered);
      setShowSchoolDropdown(filtered.length > 0);
    } else {
      setFilteredSchools([]);
      setShowSchoolDropdown(false);
    }
  };

  const selectSchool = (school) => {
    setFormData(prev => ({
      ...prev,
      name: school.name,
      selectedSchoolId: school._id,
    }));
    setShowSchoolDropdown(false);
  };

  return (
    <form onSubmit={onSubmit}>
      <div style={styles.formGroup}>
        <label style={styles.formLabel}>School Name *</label>
        <div style={styles.searchContainer}>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleNameChange}
            style={styles.formInput}
            required
            placeholder="Search inactive schools or enter a new name"
            autoComplete="off"
          />
          {showSchoolDropdown && filteredSchools.length > 0 && (
            <div style={styles.dropdownList}>
              {filteredSchools.map(school => (
                <div
                  key={school._id}
                  style={styles.dropdownItem}
                  onClick={() => selectSchool(school)}
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#f3f4f6'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; }}
                >
                  {school.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.formLabel}>Delegate Count *</label>
        <input
          type="number"
          name="delegateCount"
          value={formData.delegateCount}
          onChange={handleInputChange}
          style={styles.formInput}
          required
          min="0"
          placeholder="Enter number of delegates"
        />
      </div>

      <div style={styles.popupFooter}>
        <div style={styles.popupFooterRight}>
          <button type="button" style={styles.cancelButton} onClick={onCancel}>
            CANCEL
          </button>
          <button type="submit" style={styles.submitButton}>
            CREATE
          </button>
        </div>
      </div>
    </form>
  );
};

const SchoolList = ({ onSaveAndContinue, goBack, goNext, isFirst, isLast }) => {
  const [schools, setSchools] = useState([]);
  const [dorms, setDorms] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Popup states
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    delegateCount: 0,
    selectedSchoolId: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [schoolsResponse, dormsResponse] = await Promise.all([
          api.get(`/api/schools`),
          api.get(`/api/dorms`)
        ]);
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

  const handleDelegateChange = (schoolId, value) => {
    setSchools(prev => prev.map(school =>
      school._id === schoolId ? { ...school, delegateCount: Number(value) } : school
    ));
  };

  const activeSchools = schools.filter(school => school.delegateCount > 0);
  const inactiveSchools = schools.filter(school => !school.delegateCount);

  const handleDormTypeChange = (dormId, type) => {
    setDorms(prev => prev.map(dorm => 
      dorm._id === dormId ? { ...dorm, type } : dorm
    ));
  };

  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      setSaveSuccess(false);
      
      // Save school delegate counts
      const schoolUpdates = schools.map(({ _id, delegateCount }) => ({ schoolId: _id, delegateCount }));
      await api.put(`/api/schools/updateAll`, { updateArray: schoolUpdates });
      
      // Save dorm type assignments
      const dormUpdates = dorms.map(({ _id, type }) => ({ dormId: _id, type }));
      await api.put(`/api/dorms/updateAll`, { updateArray: dormUpdates });

      // Show success state briefly
      setSaveSuccess(true);
      setIsSaving(false);
      
      // Wait a moment to show success, then continue
      setTimeout(() => {
        if (onSaveAndContinue) {
          onSaveAndContinue();
        }
      }, 300);
    } catch (err) {
      console.error('Error saving data:', err);
      window.showToast('Failed to update data.', 'error');
      setIsSaving(false);
      setSaveSuccess(false);
    }
  };

  const getActiveSchoolsCount = () => {
    return schools.filter(school => school.delegateCount > 0).length;
  };

  const getTotalDelegateCount = () => {
    return schools.reduce((total, school) => total + (school.delegateCount || 0), 0);
  };

  const getDormTypeStats = () => {
    const maleDorms = dorms.filter(dorm => dorm.type === 'male').length;
    const femaleDorms = dorms.filter(dorm => dorm.type === 'female').length;
    const staffDorms = dorms.filter(dorm => dorm.type === 'staff').length;
    const unassignedDorms = dorms.filter(dorm => !dorm.type).length;
    
    return { maleDorms, femaleDorms, staffDorms, unassignedDorms };
  };

  const getDormAssignmentPercentage = () => {
    const percentage = dorms.length > 0 
      ? Math.round(((dormStats.maleDorms + dormStats.femaleDorms + dormStats.staffDorms) / dorms.length) * 100)
      : 0;
    return { percentage: `${percentage}%`, isComplete: percentage === 100 };
  };

  const handleCreateSchool = async (e) => {
    e.preventDefault();
    try {
      let school;
      if (formData.selectedSchoolId) {
        const response = await api.put(`/api/schools/${formData.selectedSchoolId}`, {
          delegateCount: formData.delegateCount,
        });
        school = response.data;
        setSchools(prev => prev.map(s => s._id === school._id ? school : s));
      } else {
        const response = await api.post(`/api/schools`, {
          name: formData.name,
          delegateCount: formData.delegateCount,
        });
        school = response.data;
        setSchools(prev => [...prev, school]);
      }
      setShowCreatePopup(false);
      resetForm();
      window.showToast('School added successfully!', 'success');
    } catch (err) {
      console.error('Error creating school:', err);
      window.showToast('Failed to add school.', 'error');
    }
  };

  const closePopup = () => {
    setShowCreatePopup(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      delegateCount: 0,
      selectedSchoolId: null,
    });
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading schools and dorms...</p>
        </div>
      </div>
    );
  }

  const dormStats = getDormTypeStats();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Schools & Dorm Types</h1>
        <p style={styles.subtitle}>Manage schools, delegate counts, and dorm types</p>
      </div>

      {/* Top Navigation */}
      <div style={styles.navigationTop}>
        <div style={styles.navigationButtons}>
          <button style={styles.navButtonDisabled} disabled>
            ← Back
          </button>
          <button 
            style={isSaving || saveSuccess ? styles.navButtonDisabled : styles.navButton} 
            onClick={handleSaveAll}
            disabled={isSaving || saveSuccess}
          >
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Next →'}
          </button>
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

      {/* Stats Section */}
      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{getActiveSchoolsCount()}</div>
          <div style={styles.statLabel}>Active Schools</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{getTotalDelegateCount()}</div>
          <div style={styles.statLabel}>Total Delegates</div>
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
            Dorms Assigned
          </div>
        </div>
      </div>

      {/* Schools Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Schools</h2>
          <p style={styles.sectionDescription}>Manage delegate counts for each school</p>
        </div>
        
        {activeSchools.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🏫</div>
            <h3 style={styles.emptyTitle}>No Active Schools</h3>
            <p style={styles.emptyMessage}>Add a school and set its delegate count to get started.</p>
            <button style={styles.addButton} onClick={() => setShowCreatePopup(true)}>
              Add First School
            </button>
          </div>
        ) : (
          <div style={styles.schoolsList}>
            {activeSchools.map((school) => (
              <div 
                key={school._id} 
                style={styles.schoolItem}
              >
                <div style={styles.schoolInfo}>
                  <h3 style={styles.schoolName}>{school.name.replace(/High School/gi, 'HS')}</h3>
                </div>
                <div style={styles.schoolActions}>
                  <div style={styles.delegateInputContainer}>
                    <input
                      type="number"
                      min="0"
                      value={school.delegateCount || 0}
                      onChange={(e) => handleDelegateChange(school._id, e.target.value)}
                      style={styles.delegateInput}
                    />
                    <span style={styles.delegateLabel}>delegates</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dorm Types Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Dorm Types</h2>
          <p style={styles.sectionDescription}>Assign each dorm building as male, female, or staff</p>
        </div>
        
        <div style={styles.dormProgress}>
          <div style={styles.dormProgressText}>
            {dormStats.maleDorms + dormStats.femaleDorms + dormStats.staffDorms} of {dorms.length} dorms assigned
          </div>
          <div style={styles.dormProgressBar}>
            <div 
              style={{
                ...styles.dormProgressFill,
                width: `${((dormStats.maleDorms + dormStats.femaleDorms + dormStats.staffDorms) / dorms.length) * 100}%`
              }}
            ></div>
          </div>
        </div>

        <div style={styles.dormGrid}>
          {dorms.map(dorm => (
            <div key={dorm._id} style={styles.dormCard}>
              <div style={styles.dormName}>{dorm.name}</div>
              <div style={styles.dormSelectContainer}>
                <select
                  style={styles.dormSelect}
                  value={dorm.type || ''}
                  onChange={(e) => handleDormTypeChange(dorm._id, e.target.value)}
                >
                  <option value="">Select type...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div style={styles.navigationBottom}>
        <div style={styles.navigationButtons}>
          <button style={styles.navButtonDisabled} disabled>
            ← Back
          </button>
          <button 
            style={isSaving || saveSuccess ? styles.navButtonDisabled : styles.navButton} 
            onClick={handleSaveAll}
            disabled={isSaving || saveSuccess}
          >
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Next →'}
          </button>
        </div>
      </div>

      {/* Popups */}
      {showCreatePopup && (
        <div style={styles.popupOverlay} onClick={closePopup}>
          <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
            <div style={styles.popupHeader}>
              <h2 style={styles.popupTitle}>Add New School</h2>
              <button style={styles.closeButton} onClick={closePopup}>×</button>
            </div>
            <FormComponent 
              formData={formData} 
              setFormData={setFormData}
              inactiveSchools={inactiveSchools}
              onSubmit={handleCreateSchool} 
              onCancel={closePopup}
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
  statCardIncomplete: {
    border: '2px solid #dc2626',
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
  statNumberIncomplete: {
    color: '#dc2626',
    WebkitTextFillColor: '#dc2626',
    background: 'none',
    WebkitBackgroundClip: 'initial',
    backgroundClip: 'initial',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  statLabelIncomplete: {
    color: '#dc2626',
  },
  section: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '16px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    boxShadow: '0 8px 20px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
  },
  sectionHeader: {
    marginBottom: '1rem',
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
    margin: '0',
    lineHeight: '1.4',
  },
  schoolsList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '0.75rem',
  },
  schoolItem: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem',
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0',
    transition: 'all 0.2s ease-in-out',
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#0f172a',
    margin: '0',
    letterSpacing: '-0.025em',
  },
  schoolActions: {
    display: 'flex',
    alignItems: 'center',
  },
  delegateInputContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  delegateInput: {
    width: '50px',
    padding: '0.375rem',
    fontSize: '0.8rem',
    borderRadius: '4px',
    border: '1px solid #e2e8f0',
    backgroundColor: 'white',
    color: '#374151',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
  },
  delegateLabel: {
    fontSize: '0.65rem',
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  dormProgress: {
    marginBottom: '1.5rem',
  },
  dormProgressText: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#64748b',
    marginBottom: '0.5rem',
  },
  dormProgressBar: {
    height: '8px',
    backgroundColor: '#e2e8f0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '1rem',
  },
  dormProgressFill: {
    height: '100%',
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    transition: 'width 0.3s ease-in-out',
  },
  dormGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '0.75rem',
  },
  dormCard: {
    background: 'white',
    padding: '0.75rem',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0',
  },
  dormName: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: '0.5rem',
  },
  dormSelectContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  dormSelect: {
    width: '100%',
    padding: '0.375rem 0.5rem',
    fontSize: '0.8rem',
    borderRadius: '4px',
    border: '1px solid #e2e8f0',
    backgroundColor: 'white',
    color: '#374151',
    transition: 'all 0.2s ease-in-out',
    boxSizing: 'border-box',
  },
  footer: {
    textAlign: 'center',
    padding: '3rem 0',
  },
  saveButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 2.5rem',
    fontSize: '1rem',
    fontWeight: '700',
    borderRadius: '14px',
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    color: 'white',
    transition: 'all 0.3s ease-in-out',
    boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.4)',
  },
  saveButtonDisabled: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 2.5rem',
    fontSize: '1rem',
    fontWeight: '700',
    borderRadius: '14px',
    border: 'none',
    cursor: 'not-allowed',
    background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
    color: 'white',
    opacity: '0.7',
  },
  buttonSpinner: {
    width: '18px',
    height: '18px',
    border: '2px solid transparent',
    borderTop: '2px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  successIcon: {
    fontSize: '1.25rem',
    marginRight: '0.5rem',
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
    maxHeight: '200px',
    overflowY: 'auto',
    border: '1px solid #e2e8f0',
  },
  dropdownItem: {
    padding: '0.75rem 1rem',
    cursor: 'pointer',
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
    gap: '1rem',
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
};

// Add CSS animation for spinner and responsive stats
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  .delete-button:hover {
    background: #ef4444 !important;
    color: white !important;
    box-shadow: 0 4px 14px 0 rgba(239, 68, 68, 0.39) !important;
  }
  
  @media (max-width: 1200px) {
    .stats-container {
      grid-template-columns: repeat(2, 1fr) !important;
    }
  }
  
  @media (max-width: 768px) {
    .stats-container {
      grid-template-columns: repeat(1, 1fr) !important;
    }
  }
`;
document.head.appendChild(styleSheet);

export default SchoolList;