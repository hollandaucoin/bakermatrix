import React, { useEffect, useState, useRef } from 'react';
import api from '../../util/api.js';

// Separate Form Component to isolate typing issues
const FormComponent = ({ formData, setFormData, schools, seniorCounselors, isEdit, onSubmit, onCancel, onDelete }) => {
  const [schoolSearchTerm, setSchoolSearchTerm] = useState('');
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const [filteredSchools, setFilteredSchools] = useState([]);
  const [previousSchoolsSearch, setPreviousSchoolsSearch] = useState('');
  const [showPreviousSchoolsDropdown, setShowPreviousSchoolsDropdown] = useState(false);
  const [filteredPreviousSchools, setFilteredPreviousSchools] = useState([]);
  const [previousPostingPartnerSearch, setPreviousPostingPartnerSearch] = useState('');
  const [showPreviousPostingPartnerDropdown, setShowPreviousPostingPartnerDropdown] = useState(false);
  const [filteredPreviousPostingPartners, setFilteredPreviousPostingPartners] = useState([]);

  // Initialize search terms when form opens
  useEffect(() => {
    if (formData._associatedSchool) {
      const selectedSchool = schools.find(school => school._id === formData._associatedSchool);
      if (selectedSchool) {
        setSchoolSearchTerm(selectedSchool.name);
      }
    }
    if (formData._previousPostingPartner) {
      const selectedPartner = seniorCounselors.find(sc => sc._id === formData._previousPostingPartner);
      if (selectedPartner) {
        setPreviousPostingPartnerSearch(selectedPartner.name);
      }
    }
  }, [formData._associatedSchool, formData._previousPostingPartner, schools, seniorCounselors]);

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

  const selectPreviousPostingPartner = (counselor) => {
    setFormData(prev => ({
      ...prev,
      _previousPostingPartner: counselor._id
    }));
    setPreviousPostingPartnerSearch(counselor.name);
    setShowPreviousPostingPartnerDropdown(false);
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

      <div style={styles.formGroup}>
        <div style={styles.formRow}>
          <div style={styles.formColumn}>
            <label style={styles.formLabel}>Gender *</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              style={styles.formInput}
              required
            >
              <option value="">Select gender...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div style={styles.formColumn}>
            <label style={styles.formLabel}>Previous Posting Partner</label>
            <div style={styles.searchContainer} className="previous-posting-partner-container">
              <input
                type="text"
                value={previousPostingPartnerSearch}
                onChange={(e) => {
                  const value = e.target.value;
                  setPreviousPostingPartnerSearch(value);
                  if (value.trim()) {
                    const filtered = seniorCounselors.filter(counselor => 
                      counselor.name.toLowerCase().includes(value.toLowerCase()) &&
                      counselor._id !== formData._id // Exclude self
                    );
                    setFilteredPreviousPostingPartners(filtered);
                    setShowPreviousPostingPartnerDropdown(filtered.length > 0);
                  } else {
                    setFilteredPreviousPostingPartners([]);
                    setShowPreviousPostingPartnerDropdown(false);
                  }
                }}
                style={styles.formInput}
                placeholder="Search for senior counselor..."
              />
              {showPreviousPostingPartnerDropdown && filteredPreviousPostingPartners.length > 0 && (
                <div style={styles.dropdownList}>
                  {filteredPreviousPostingPartners.map(counselor => (
                    <div
                      key={counselor._id}
                      style={styles.dropdownItem}
                      onClick={() => selectPreviousPostingPartner(counselor)}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      {counselor.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.formLabel}>Committee *</label>
        <div style={styles.committeeRow}>
          <select
            name="committee"
            value={formData.committee}
            onChange={handleInputChange}
            style={styles.formInput}
            required
          >
            <option value="">Select committee...</option>
            <option value="knowledge">Knowledge</option>
            <option value="compassion">Compassion</option>
            <option value="humor">Humor</option>
            <option value="other">Other</option>
          </select>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="committeeLead"
              checked={formData.committeeLead}
              onChange={handleInputChange}
              style={styles.checkbox}
            />
            Committee Lead
          </label>
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.formLabel}>Federal Way Assignment</label>
        <div style={styles.federalWayContainer}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="federalWay"
              checked={formData.federalWay}
              onChange={handleInputChange}
              style={styles.checkbox}
            />
            <img 
              src="/fwhs.png" 
              alt="Federal Way High School" 
              style={styles.federalWayLogo}
            />
            Assign to Federal Way HS
          </label>
        </div>
      </div>

      <div style={styles.formGroup}>
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

const SC_TABLE_COLUMNS = '1.5fr 1fr 1.25fr 1.1fr 1.1fr 50px';

const SeniorCounselorList = ({ goBack, goNext, isFirst, isLast }) => {
  const [seniorCounselors, setSeniorCounselors] = useState([]);
  const [juniorCounselors, setJuniorCounselors] = useState([]);
  const [schools, setSchools] = useState([]);
  const [localAssignments, setLocalAssignments] = useState({});
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Popup states
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [editingCounselor, setEditingCounselor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    committee: '',
    committeeLead: false,
    federalWay: false,
    _associatedSchool: '',
    _previousSchools: [],
    _previousPostingPartner: ''
  });

  // School search states
  const [schoolSearchTerm, setSchoolSearchTerm] = useState('');
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const [filteredSchools, setFilteredSchools] = useState([]);

  // Previous schools tag states
  const [previousSchoolsSearch, setPreviousSchoolsSearch] = useState('');
  const [showPreviousSchoolsDropdown, setShowPreviousSchoolsDropdown] = useState(false);
  const [filteredPreviousSchools, setFilteredPreviousSchools] = useState([]);

  const formRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [seniorResponse, juniorResponse, schoolsResponse] = await Promise.all([
          api.get(`/api/seniorcounselors`),
          api.get(`/api/juniorcounselors`),
          api.get(`/api/schools`)
        ]);
        
        setSeniorCounselors(seniorResponse.data);
        setJuniorCounselors(juniorResponse.data);
        setSchools(schoolsResponse.data);

        const initialAssignments = {};
        seniorResponse.data.forEach((sc) => {
          initialAssignments[sc._id] = { 
            _jcPairing: sc._jcPairing?._id || '', 
            _jcPairing2: sc._jcPairing2?._id || '' 
          };
        });
        setLocalAssignments(initialAssignments);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

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

  const handleAssignJC = (seniorCounselorId, jcId, dropdown) => {
    setLocalAssignments((prev) => ({
      ...prev,
      [seniorCounselorId]: {
        ...prev[seniorCounselorId],
        [dropdown]: jcId,
      },
    }));
  };

  const getFilteredJCs = (seniorCounselorId, dropdown) => {
    const currentSelection = localAssignments[seniorCounselorId]?.[dropdown];

    const allAssignedJCs = Object.entries(localAssignments)
      .flatMap(([scId, { _jcPairing, _jcPairing2 }]) => {
        const values = [];
        if (scId !== seniorCounselorId) {
          if (_jcPairing) values.push(_jcPairing);
          if (_jcPairing2) values.push(_jcPairing2);
        } else {
          // Avoid excluding the current dropdown's selected value
          if (dropdown === '_jcPairing2' && _jcPairing) values.push(_jcPairing);
          if (dropdown === '_jcPairing' && _jcPairing2) values.push(_jcPairing2);
        }
        return values;
      });

    const assignedSet = new Set(allAssignedJCs);

    return juniorCounselors.filter(
      (jc) => !assignedSet.has(jc._id) || jc._id === currentSelection
    );
  };

  const handleSaveAllAssignments = async () => {
    try {
      setIsSaving(true);
      const updates = Object.entries(localAssignments).map(([seniorCounselorId, { _jcPairing, _jcPairing2 }]) => ({
        seniorCounselorId,
        _jcPairing: _jcPairing && _jcPairing !== '' ? _jcPairing : null,
        _jcPairing2: _jcPairing2 && _jcPairing2 !== '' ? _jcPairing2 : null,
      }));
      await api.put(`/api/seniorcounselors/jcs`, { updates });
      setSaveSuccess(true);
      // Navigate to next page after successful save
      goNext();
    } catch (err) {
      console.error('Error saving assignments:', err);
      window.showToast('Failed to save assignments.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const getAssignmentCount = () => {
    const totalAssignments = Object.values(localAssignments).reduce((count, assignment) => {
      return count + (assignment._jcPairing ? 1 : 0) + (assignment._jcPairing2 ? 1 : 0);
    }, 0);
    
    // Calculate percentage of JCs assigned to SCs
    const percentage = juniorCounselors.length > 0 ? Math.round((totalAssignments / juniorCounselors.length) * 100) : 0;
    return { percentage: `${percentage}%`, isComplete: percentage === 100 };
  };

  const getFederalWayStatus = () => {
    const federalWayCount = seniorCounselors.filter(sc => sc.federalWay === true).length;
    return { 
      count: federalWayCount, 
      isComplete: federalWayCount === 1,
      status: federalWayCount === 1 ? '✓ Assigned' : federalWayCount === 0 ? 'Not Assigned' : 'Multiple Assigned'
    };
  };

  const getCommitteeColor = (committee) => {
    switch (committee?.toLowerCase()) {
      case 'compassion':
        return {
          background: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)',
          color: '#991b1b',
          boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)'
        };
      case 'knowledge':
        return {
          background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
          color: '#1e40af',
          boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
        };
      case 'humor':
        return {
          background: 'linear-gradient(135deg, #bbf7d0 0%, #86efac 100%)',
          color: '#166534',
          boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)'
        };
      case 'other':
        return {
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          color: '#92400e',
          boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)'
        };
      default:
        return {
          background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
          color: '#1e40af',
          boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
        };
    }
  };

  const handleCreateCounselor = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        _associatedSchool: formData._associatedSchool || undefined,
        _previousSchools: formData._previousSchools?.length || undefined,
        _previousPostingPartner: formData._previousPostingPartner || undefined
      };
      const response = await api.post(`/api/seniorcounselors`, dataToSend);
      if (formData.federalWay) {
        await api.put(`/api/seniorcounselors/federalway/${response.data._id}`);
      }
      const refreshedResponse = await api.get(`/api/seniorcounselors`);
      setSeniorCounselors(refreshedResponse.data);
      setLocalAssignments(prev => ({
        ...prev,
        [response.data._id]: { _jcPairing: '', _jcPairing2: '' }
      }));
      setShowCreatePopup(false);
      resetForm();
      window.showToast('Senior counselor created successfully!', 'success');
    } catch (err) {
      console.error('Error creating counselor:', err);
      window.showToast('Failed to create senior counselor.', 'error');
    }
  };

  const handleEditCounselor = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        _associatedSchool: formData._associatedSchool || undefined,
        _previousSchools: formData._previousSchools?.length ? formData._previousSchools : undefined,
        _previousPostingPartner: formData._previousPostingPartner || undefined,
        federalWay: formData.federalWay,
      };

      await api.put(`/api/seniorcounselors/${editingCounselor._id}`, dataToSend);

      if (!formData.federalWay && editingCounselor.federalWay) {
        await api.delete(`/api/seniorcounselors/federalway/${editingCounselor._id}`);
      }

      const updatedResponse = await api.get(`/api/seniorcounselors`);
      setSeniorCounselors(updatedResponse.data);
      
      setShowEditPopup(false);
      setEditingCounselor(null);
      resetForm();
      window.showToast('Senior counselor updated successfully!', 'success');
    } catch (err) {
      console.error('Error updating counselor:', err);
      window.showToast('Failed to update senior counselor.', 'error');
    }
  };

  const handleDeleteCounselor = async () => {
    if (!window.confirm(`Are you sure you want to delete ${editingCounselor.name}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await api.delete(`/api/seniorcounselors/${editingCounselor._id}`);
      setSeniorCounselors(prev => prev.filter(sc => sc._id !== editingCounselor._id));
      setLocalAssignments(prev => {
        const newAssignments = { ...prev };
        delete newAssignments[editingCounselor._id];
        return newAssignments;
      });
      setShowEditPopup(false);
      setEditingCounselor(null);
      resetForm();
      window.showToast('Senior counselor deleted successfully!', 'success');
    } catch (err) {
      console.error('Error deleting counselor:', err);
      window.showToast('Failed to delete senior counselor.', 'error');
    }
  };

  const openEditPopup = (counselor) => {
    setEditingCounselor(counselor);
    setFormData({
      name: counselor.name,
      gender: counselor.gender || '',
      committee: counselor.committee || '',
      committeeLead: counselor.committeeLead || false,
      federalWay: counselor.federalWay || false,
      _associatedSchool: counselor._associatedSchool?._id || '',
      _previousSchools: counselor._previousSchools?.map(school => school._id) || [],
      _previousPostingPartner: counselor._previousPostingPartner?._id || ''
    });
    setSchoolSearchTerm(counselor._associatedSchool?.name || '');
    setShowSchoolDropdown(false);
    setPreviousSchoolsSearch('');
    setShowPreviousSchoolsDropdown(false);
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
      gender: '',
      committee: '',
      committeeLead: false,
      federalWay: false,
      _associatedSchool: '',
      _previousSchools: [],
      _previousPostingPartner: ''
    });
    setSchoolSearchTerm('');
    setShowSchoolDropdown(false);
    setPreviousSchoolsSearch('');
    setShowPreviousSchoolsDropdown(false);
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading senior counselors...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Senior Counselors</h1>
        <p style={styles.subtitle}>Manage senior counselors and their assignments</p>
      </div>

      {/* Top Navigation */}
      <div style={styles.navigationTop}>
        <div style={styles.navigationButtons}>
          {!isFirst && (
            <button style={styles.navButton} onClick={goBack}>
              ← Back
            </button>
          )}
          <button 
            style={isSaving || saveSuccess ? styles.navButtonDisabled : styles.navButton} 
            onClick={handleSaveAllAssignments}
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

      {seniorCounselors.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>👥</div>
          <h3 style={styles.emptyTitle}>No Senior Counselors</h3>
          <p style={styles.emptyMessage}>No senior counselors are currently available.</p>
          <button style={styles.addButton} onClick={() => setShowCreatePopup(true)}>
            Add First Senior Counselor
          </button>
        </div>
      ) : (
        <>
          <div style={styles.statsContainer} className="stats-container">
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{seniorCounselors.length}</div>
              <div style={styles.statLabel}>Senior Counselors</div>
            </div>
            <div style={{
              ...styles.statCard,
              ...(getAssignmentCount().isComplete ? {} : styles.statCardIncomplete)
            }}>
              <div style={{
                ...styles.statNumber,
                ...(getAssignmentCount().isComplete ? {} : styles.statNumberIncomplete)
              }}>
                {getAssignmentCount().percentage}
              </div>
              <div style={{
                ...styles.statLabel,
                ...(getAssignmentCount().isComplete ? {} : styles.statLabelIncomplete)
              }}>
                JC's Assigned
              </div>
            </div>
            <div style={{
              ...styles.statCard,
              ...(getFederalWayStatus().isComplete ? {} : styles.statCardIncomplete)
            }}>
              <div style={{
                ...styles.statNumber,
                ...(getFederalWayStatus().isComplete ? {} : styles.statNumberIncomplete)
              }}>
                {getFederalWayStatus().status}
              </div>
              <div style={{
                ...styles.statLabel,
                ...(getFederalWayStatus().isComplete ? {} : styles.statLabelIncomplete)
              }}>
                Federal Way SC
              </div>
            </div>
          </div>

          <div style={styles.tableContent}>
            <div style={styles.tableSection}>
              <div style={{ ...styles.listTableHeader, gridTemplateColumns: SC_TABLE_COLUMNS }}>
                <div>Name</div>
                <div>Committee</div>
                <div>School</div>
                <div>JC #1</div>
                <div>JC #2</div>
                <div />
              </div>
              {seniorCounselors.map((seniorCounselor) => (
                <div
                  key={seniorCounselor._id}
                  className="sc-list-row"
                  style={{ ...styles.listTableRow, gridTemplateColumns: SC_TABLE_COLUMNS }}
                  onClick={() => openEditPopup(seniorCounselor)}
                >
                  <div style={styles.listTableCellName}>
                    <span style={styles.nameWithLogo}>
                      {seniorCounselor.name}
                      {seniorCounselor.federalWay && (
                        <img
                          src="/fwhs.png"
                          alt="Federal Way High School"
                          style={styles.federalWayLogoSmall}
                        />
                      )}
                    </span>
                  </div>
                  <div>
                    <span style={{
                      ...styles.committeeBadge,
                      ...styles.tableCommitteeBadge,
                      ...getCommitteeColor(seniorCounselor.committee)
                    }}>
                      {seniorCounselor.committee?.toUpperCase() || '—'}
                      {seniorCounselor.committeeLead && (
                        <span style={styles.leadStar}> ⭐</span>
                      )}
                    </span>
                  </div>
                  <div style={styles.listTableCell}>
                    {seniorCounselor._associatedSchool?.name || '—'}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <select
                      style={styles.tableDropdown}
                      onChange={(e) =>
                        handleAssignJC(seniorCounselor._id, e.target.value, '_jcPairing')
                      }
                      value={localAssignments[seniorCounselor._id]?._jcPairing || ''}
                    >
                      <option value="">—</option>
                      {getFilteredJCs(seniorCounselor._id, '_jcPairing').map((jc) => (
                        <option key={jc._id} value={jc._id}>
                          {jc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <select
                      style={styles.tableDropdown}
                      onChange={(e) =>
                        handleAssignJC(seniorCounselor._id, e.target.value, '_jcPairing2')
                      }
                      value={localAssignments[seniorCounselor._id]?._jcPairing2 || ''}
                      disabled={!localAssignments[seniorCounselor._id]?._jcPairing}
                    >
                      <option value="">—</option>
                      {getFilteredJCs(seniorCounselor._id, '_jcPairing2').map((jc) => (
                        <option key={jc._id} value={jc._id}>
                          {jc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.listTableActions}>
                    <button
                      style={styles.editButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditPopup(seniorCounselor);
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
          <button 
            style={isSaving || saveSuccess ? styles.navButtonDisabled : styles.navButton} 
            onClick={handleSaveAllAssignments}
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
              <h2 style={styles.popupTitle}>Add New Senior Counselor</h2>
              <button style={styles.closeButton} onClick={closePopup}>×</button>
            </div>
            <FormComponent 
              formData={formData} 
              setFormData={setFormData} 
              schools={schools}
              seniorCounselors={seniorCounselors}
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
              <h2 style={styles.popupTitle}>Edit Senior Counselor</h2>
              <button style={styles.closeButton} onClick={closePopup}>×</button>
            </div>
            <FormComponent 
              formData={formData} 
              setFormData={setFormData} 
              schools={schools}
              seniorCounselors={seniorCounselors}
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
  statCardIncomplete: {
    border: '2px solid #dc2626',
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
  listTableCellName: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#0f172a',
  },
  nameWithLogo: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  listTableActions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  tableCommitteeBadge: {
    fontSize: '0.7rem',
    padding: '0.25rem 0.5rem',
    whiteSpace: 'nowrap',
  },
  tableDropdown: {
    padding: '0.5rem',
    fontSize: '0.85rem',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    backgroundColor: 'white',
    color: '#374151',
    cursor: 'pointer',
    width: '100%',
    maxWidth: '100%',
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
    padding: '1.75rem',
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
  committeeBadge: {
    fontSize: '0.8rem',
    fontWeight: '600',
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
  },
  leadStar: {
    fontSize: '0.75rem',
    marginLeft: '0.25rem',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '0.75rem 0',
    gap: '1rem',
    minHeight: '3rem',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.25rem',
    flex: 1,
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
  assignmentsSection: {
    borderTop: '2px solid #f1f5f9',
    paddingTop: '1.5rem',
  },
  assignmentsTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0 0 1rem 0',
    letterSpacing: '-0.025em',
  },
  dropdownContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  dropdownRow: {
    display: 'flex',
    gap: '1rem',
  },
  dropdownGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    flex: 1,
  },
  dropdownLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  dropdown: {
    padding: '0.625rem',
    fontSize: '0.8rem',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    backgroundColor: 'white',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
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
  // Popup styles
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
    marginBottom: '2rem',
  },
  formLabel: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  formInput: {
    width: '100%',
    padding: '0.875rem',
    fontSize: '0.875rem',
    borderRadius: '10px',
    border: '2px solid #e2e8f0',
    backgroundColor: 'white',
    color: '#374151',
    transition: 'all 0.2s ease-in-out',
    boxSizing: 'border-box',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  committeeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '0.875rem',
    color: '#374151',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontWeight: '500',
  },
  checkbox: {
    width: '1.125rem',
    height: '1.125rem',
    cursor: 'pointer',
    accentColor: '#3b82f6',
  },
  popupFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '2.5rem',
  },
  popupFooterRight: {
    display: 'flex',
    gap: '1rem',
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
    right: 0,
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    maxHeight: '200px',
    overflow: 'auto',
  },
  dropdownItem: {
    padding: '0.75rem 1rem',
    cursor: 'pointer',
    transition: 'background 0.2s ease-in-out',
  },
  formRow: {
    display: 'flex',
    gap: '1.25rem',
  },
  formColumn: {
    flex: 1,
  },
  previousSchoolsContainer: {
    position: 'relative',
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
  detailDropdown: {
    padding: '0.625rem',
    fontSize: '0.8rem',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    backgroundColor: 'white',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    width: '100%',
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
  federalWayContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  federalWayLogo: {
    width: '30px',
    height: '24px',
  },
  federalWayLogoSmall: {
    width: '24px',
    height: '20px',
    objectFit: 'contain',
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

  .sc-list-row:hover {
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

export default SeniorCounselorList;