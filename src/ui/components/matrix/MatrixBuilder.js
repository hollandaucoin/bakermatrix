import React, { useState, useEffect } from 'react';
import SchoolList from './SchoolList.js';
import JuniorCounselorList from './JuniorCounselorList.js';
import SeniorCounselorList from './SeniorCounselorList.js';
import Validation from './Validation.js';
import MatrixView from './MatrixView.js';
import ToastContainer from '../ToastContainer.js';
import api from '../../util/api.js';

const MatrixBuilder = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [matrixNavigationGuard, setMatrixNavigationGuard] = useState({
    hasUnsavedMatrix: false,
    pendingNavigation: null,
    showDiscardPopup: false,
    matrixName: ''
  });
  const [validationStatus, setValidationStatus] = useState({
    isValid: false,
    lastChecked: null
  });

  // Run validation on app load
  useEffect(() => {
    const runValidation = async () => {
      try {
        const [seniorResponse, juniorResponse, dormsResponse] = await Promise.all([
          api.get(`/api/seniorcounselors`),
          api.get(`/api/juniorcounselors`),
          api.get(`/api/dorms`)
        ]);
        
        const seniorCounselors = seniorResponse.data;
        const juniorCounselors = juniorResponse.data;
        const dorms = dormsResponse.data;
        
        // Run validation logic
        const validation = getValidationStatus(seniorCounselors, juniorCounselors, dorms);
        
        setValidationStatus({
          isValid: validation.isValid,
          lastChecked: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error running validation on load:', error);
      }
    };

    runValidation();
  }, []);

  // Validation functions (copied from Validation component)
  const getValidationStatus = (seniorCounselors, juniorCounselors, dorms) => {
    const totalDelegates = juniorCounselors.length;
    const totalSCs = seniorCounselors.length;
    const totalDorms = dorms.length;
    
    // Count SCs with at least 1 JC
    const scsWithJC = seniorCounselors.filter(sc => 
      sc._jcPairing || sc._jcPairing2
    ).length;
    
    // Count JCs that are assigned to SCs
    const assignedJCs = new Set();
    seniorCounselors.forEach(sc => {
      if (sc._jcPairing) assignedJCs.add(sc._jcPairing);
      if (sc._jcPairing2) assignedJCs.add(sc._jcPairing2);
    });
    const unassignedJCs = totalDelegates - assignedJCs.size;
    
    // Count JCs with dorm assignments
    const jcsWithDorms = juniorCounselors.filter(jc => jc._dorm).length;
    const jcsWithoutDorms = totalDelegates - jcsWithDorms;
    
    // Count dorms with type assignments
    const dormsWithTypes = dorms.filter(dorm => dorm.type).length;
    const dormsWithoutTypes = totalDorms - dormsWithTypes;
    
    // Count SCs with committees
    const scsWithCommittees = seniorCounselors.filter(sc => sc.committee).length;
    const scsWithoutCommittees = totalSCs - scsWithCommittees;
    
    // Check if any SC has federalWay flag
    const hasFederalWaySC = seniorCounselors.some(sc => sc.federalWay === true);

    const issues = [];

    // Check if all dorms are assigned a type
    if (dormsWithoutTypes > 0) {
      issues.push(`${dormsWithoutTypes} dorm(s) not assigned a type`);
    }

    // Check if all junior counselors are assigned a dorm
    if (jcsWithoutDorms > 0) {
      issues.push(`${jcsWithoutDorms} junior counselor(s) not assigned a dorm`);
    }

    // Check if all junior counselors are paired to a senior counselor
    if (unassignedJCs > 0) {
      issues.push(`${unassignedJCs} junior counselor(s) not paired to a senior counselor`);
    }

    // Check if all senior counselors have a committee
    if (scsWithoutCommittees > 0) {
      issues.push(`${scsWithoutCommittees} senior counselor(s) without committee assignment`);
    }

    // Check if Federal Way SC is assigned
    if (!hasFederalWaySC) {
      issues.push('Federal Way High School senior counselor not assigned');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  };

  const flowSteps = [
    { id: 'schools', label: 'Schools & Dorms', icon: '🏫', description: 'Manage schools, delegate counts, and dorm types' },
    { id: 'juniorCounselors', label: 'Junior Counselors', icon: '👨‍🎓', description: 'Manage JC staff and assignments' },
    { id: 'seniorCounselors', label: 'Senior Counselors', icon: '👨‍🏫', description: 'Manage SC staff and JC pairings' },
    { id: 'validation', label: 'Validation', icon: '📊', description: 'Verify the information required for the matrix is present' },
    { id: 'matrixGenerator', label: 'Matrix Generator', icon: '⚖️', description: 'Generate optimal assignment matrices' },
  ];

  // Navigation guard for matrix page
  const handleNavigationAttempt = (targetPage) => {
    // Block matrix generator if validation hasn't passed
    if (targetPage === 'matrixGenerator' && !validationStatus.isValid) {
      // Show toast or alert that validation must pass first
      if (window.showToast) {
        window.showToast('Please complete validation first before generating a matrix.', 'error');
      }
      return;
    }

    if (currentPage === 'matrixGenerator' && matrixNavigationGuard.hasUnsavedMatrix) {
      // Show discard popup instead of navigating
      setMatrixNavigationGuard(prev => ({
        ...prev,
        pendingNavigation: targetPage,
        showDiscardPopup: true,
        matrixName: prev.matrixName || '' // Keep existing name or set empty
      }));
    } else {
      // Safe to navigate
      setCurrentPage(targetPage);
    }
  };

  const handleDiscardConfirm = (action) => {
    setMatrixNavigationGuard(prev => ({
      ...prev,
      showDiscardPopup: false
    }));

    if (action === 'discard' && matrixNavigationGuard.pendingNavigation) {
      // Navigate to the pending page
      setCurrentPage(matrixNavigationGuard.pendingNavigation);
      setMatrixNavigationGuard(prev => ({
        ...prev,
        pendingNavigation: null,
        hasUnsavedMatrix: false,
        matrixName: ''
      }));
    } else if (action === 'save') {
      // Set flag to indicate save was requested with the current matrix name
      setMatrixNavigationGuard(prev => ({
        ...prev,
        saveRequested: true,
        pendingNavigation: prev.pendingNavigation,
        saveMatrixName: prev.matrixName // Pass the name from the input
      }));
    }
  };

  // Handle navigation after save is complete
  const handleSaveComplete = () => {
    if (matrixNavigationGuard.saveRequested && matrixNavigationGuard.pendingNavigation) {
      setCurrentPage(matrixNavigationGuard.pendingNavigation);
      setMatrixNavigationGuard(prev => ({
        ...prev,
        saveRequested: false,
        pendingNavigation: null,
        hasUnsavedMatrix: false,
        matrixName: '',
        saveMatrixName: ''
      }));
    }
  };

  const handleDiscardCancel = () => {
    setMatrixNavigationGuard(prev => ({
      ...prev,
      showDiscardPopup: false,
      pendingNavigation: null
    }));
  };

  const renderLandingPage = () => (
    <div style={styles.landingPage}>
      <div style={styles.landingContent}>
        <div style={styles.landingHeader}>
          <h1 style={styles.landingTitle}>Matrix Builder</h1>
          <p style={styles.landingDescription}>
            An efficient and optimized way to generate the matrix, avoiding conflicts and ensuring balanced distributions.
          </p>
        </div>

        <div style={styles.stepsContainer}>
          <div style={styles.stepsGrid} className="steps-grid">
            <div style={styles.stepItem} className="step-item">
              <div style={styles.stepIcon}>🏫</div>
              <div style={styles.stepText}>Create schools, assign delegate <br/>counts and dorm types</div>
            </div>
            <div style={styles.stepArrow} className="step-arrow">
              →
            </div>
            <div style={styles.stepItem} className="step-item">
              <div style={styles.stepIcon}>👨‍🎓</div>
              <div style={styles.stepText}>Visualize the JC staff <br/>and set their dorms</div>
            </div>
            <div style={styles.stepArrow} className="step-arrow">
              →
            </div>
            <div style={styles.stepItem} className="step-item">
              <div style={styles.stepIcon}>👨‍🏫</div>
              <div style={styles.stepText}>Manage the SC staff <br/>and create pairings</div>
            </div>
            <div style={styles.stepArrow} className="step-arrow">
              →
            </div>
            <div style={styles.stepItem} className="step-item">
              <div style={styles.stepIcon}>📊</div>
              <div style={styles.stepText}>Validate all required <br/>information is present</div>
            </div>
            <div style={styles.stepArrow} className="step-arrow">
              →
            </div>
            <div style={styles.stepItem} className="step-item">
              <div style={styles.stepIcon}>⚖️</div>
              <div style={styles.stepText}>Generate a <br/>balanced matrix</div>
            </div>
          </div>
        </div>

        <div style={styles.buttonContainer}>
          <button
            style={styles.getStartedButton}
            onClick={() => handleNavigationAttempt('schools')}
            className="get-started-button"
          >
            Get Started →
          </button>
        </div>
      </div>
    </div>
  );

  const renderPageWithNavigation = (pageContent, pageId) => {
    const currentIndex = flowSteps.findIndex(step => step.id === pageId);
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === flowSteps.length - 1;
    
    const goBack = () => {
      if (!isFirst) {
        handleNavigationAttempt(flowSteps[currentIndex - 1].id);
      }
    };
    
    const goNext = () => {
      if (!isLast) {
        handleNavigationAttempt(flowSteps[currentIndex + 1].id);
      }
    };

    const onSaveAndContinue = () => {
      if (!isLast) {
        handleNavigationAttempt(flowSteps[currentIndex + 1].id);
      }
    };

    const navigationProps = {
      goBack,
      goNext,
      isFirst,
      isLast,
      onSaveAndContinue
    };

    // Add validation status to Validation component
    if (pageId === 'validation') {
      navigationProps.setValidationStatus = setValidationStatus;
      navigationProps.validationStatus = validationStatus;
    }

    // Add matrix-specific props for MatrixView
    if (pageId === 'matrixGenerator') {
      navigationProps.setMatrixNavigationGuard = setMatrixNavigationGuard;
      navigationProps.matrixNavigationGuard = matrixNavigationGuard;
      navigationProps.handleSaveComplete = handleSaveComplete;
    }

    return (
      <div style={styles.pageWithNavigation}>
        {/* Page Content */}
        <div style={styles.pageContent}>
          {React.cloneElement(pageContent, navigationProps)}
        </div>
      </div>
    );
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return renderLandingPage();
      case 'schools':
        return renderPageWithNavigation(<SchoolList />, 'schools');
      case 'juniorCounselors':
        return renderPageWithNavigation(<JuniorCounselorList />, 'juniorCounselors');
      case 'seniorCounselors':
        return renderPageWithNavigation(<SeniorCounselorList />, 'seniorCounselors');
      case 'validation':
        return renderPageWithNavigation(<Validation />, 'validation');
      case 'matrixGenerator':
        return renderPageWithNavigation(<MatrixView />, 'matrixGenerator');
      default:
        return renderLandingPage();
    }
  };

  return (
    <div style={styles.app}>
      {/* Sidebar - always visible in the builder */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h1
            style={styles.appTitle}
            onClick={() => handleNavigationAttempt('home')}
            className="clickable-title"
          >
            MT. BAKER MATRIX
          </h1>
        </div>

        <nav style={styles.nav}>
          <button
            style={{
              ...styles.navItem,
              ...(currentPage === 'home' ? styles.navItemActive : {})
            }}
            onClick={() => handleNavigationAttempt('home')}
          >
            <span style={styles.navIcon}>🏠</span>
            <span style={styles.navLabel}>Home</span>
          </button>
          {flowSteps.map((item) => {
            const isMatrixGenerator = item.id === 'matrixGenerator';
            const isDisabled = isMatrixGenerator && !validationStatus.isValid;

            return (
              <button
                key={item.id}
                style={{
                  ...styles.navItem,
                  ...(currentPage === item.id ? styles.navItemActive : {}),
                  ...(isDisabled ? styles.navItemDisabled : {})
                }}
                onClick={() => handleNavigationAttempt(item.id)}
                disabled={isDisabled}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                <span style={styles.navLabel}>{item.label}</span>
                {isDisabled && <span style={styles.disabledIndicator}>⚠️</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div style={{
        ...styles.mainContent,
        marginLeft: '280px'
      }}>
        {renderPage()}
      </div>

      {/* Navigation Guard Popup */}
      {matrixNavigationGuard.showDiscardPopup && (
        <div style={styles.popupOverlay} onClick={handleDiscardCancel}>
          <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
            <div style={styles.popupHeader}>
              <h2 style={styles.popupTitle}>Unsaved Matrix</h2>
              <button style={styles.closeButton} onClick={handleDiscardCancel}>×</button>
            </div>
            <p style={styles.popupMessage}>
              You have an unsaved matrix. What would you like to do?
            </p>
            
            {/* Matrix Name Input */}
            <div style={styles.nameInputContainer}>
              <label style={styles.nameInputLabel}>Matrix Name:</label>
              <input
                type="text"
                value={matrixNavigationGuard.matrixName || ''}
                onChange={(e) => setMatrixNavigationGuard(prev => ({ ...prev, matrixName: e.target.value }))}
                placeholder="Enter a name for this matrix..."
                style={styles.nameInput}
                required
              />
            </div>
            
            <div style={styles.popupFooter}>
              <div style={styles.popupFooterRight}>
                <button type="button" style={styles.cancelButton} onClick={handleDiscardCancel}>
                  CANCEL
                </button>
                <button type="button" style={styles.discardButton} onClick={() => handleDiscardConfirm('discard')}>
                  DISCARD & LEAVE
                </button>
                <button type="button" style={styles.saveButton} onClick={() => handleDiscardConfirm('save')}>
                  SAVE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container for notifications */}
      <ToastContainer />
    </div>
  );
};

const styles = {
  app: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  sidebar: {
    width: '280px',
    backgroundColor: 'white',
    color: '#1e293b',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    position: 'fixed',
    height: '100vh',
    zIndex: 100,
    borderRight: '1px solid #e2e8f0',
  },
  sidebarHeader: {
    padding: '2rem 1.5rem 1.5rem',
    borderBottom: '1px solid #f1f5f9',
    flexShrink: 0,
  },
  appTitle: {
    fontSize: '1.75rem',
    fontWeight: '700',
    margin: 0,
    color: '#1e293b',
    letterSpacing: '-0.025em',
  },
  nav: {
    padding: '1rem 0',
    flex: 1,
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    width: '100%',
    padding: '0.875rem 1.5rem',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    fontSize: '0.875rem',
    fontWeight: '500',
    textAlign: 'left',
    borderRadius: '0',
  },
  navItemActive: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    borderRight: '3px solid #3b82f6',
    fontWeight: '600',
  },
  navItemDisabled: {
    backgroundColor: '#f8fafc',
    color: '#64748b',
    borderRight: '3px solid #e2e8f0',
    fontWeight: '500',
  },
  navIcon: {
    fontSize: '1.125rem',
    width: '1.5rem',
    textAlign: 'center',
  },
  navLabel: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
    minHeight: 'calc(100vh - 64px)',
    transition: 'margin-left 0.3s ease-in-out',
  },
  placeholderPage: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    fontSize: '1.5rem',
    color: '#64748b',
    fontWeight: '500',
  },
  landingPage: {
    backgroundColor: '#f8fafc',
    height: 'calc(100vh - 64px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    boxSizing: 'border-box',
  },
  landingContent: {
    maxWidth: '1200px',
    width: '100%',
    textAlign: 'center',
  },
  landingHeader: {
    marginBottom: '4rem',
  },
  landingTitle: {
    fontSize: '4rem',
    fontWeight: '800',
    margin: 0,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.025em',
    marginBottom: '1.5rem',
  },
  landingDescription: {
    fontSize: '1.125rem',
    color: '#64748b',
    lineHeight: '1.6',
    margin: 0,
  },
  stepsContainer: {
    marginBottom: '4rem',
  },
  stepsGrid: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5rem',
    maxWidth: '1200px',
    margin: '0 auto',
    flexWrap: 'wrap',
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    minWidth: '100px',
    flex: '0 0 auto',
  },
  stepIcon: {
    marginBottom: '1rem',
  },
  stepArrow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 0.5rem',
    flexShrink: 0,
    flex: '0 0 auto',
    fontSize: '1.5rem',
    color: '#6b7280',
    fontWeight: '300',
  },
  stepText: {
    fontSize: '0.975rem',
    color: '#374151',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: '1.4',
  },
  buttonContainer: {
    marginTop: '3rem',
  },
  getStartedButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '1rem 2.5rem',
    fontSize: '1.125rem',
    fontWeight: '600',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3), 0 2px 4px -1px rgba(59, 130, 246, 0.2)',
  },
  savedMatricesLink: {
    marginTop: '4rem',
  },
  savedMatricesText: {
    color: '#64748b',
    fontWeight: '300',
  },
  savedMatricesButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#3b82f6',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    transition: 'color 0.2s ease-in-out',
    fontFamily: 'inherit',
  },
  sidebarFooter: {
    padding: '1rem 0',
    borderTop: '1px solid #f1f5f9',
    flexShrink: 0,
  },
  pageWithNavigation: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  pageContent: {
    flex: 1,
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
  disabledIndicator: {
    fontSize: '0.75rem',
    color: '#dc2626',
    marginLeft: '0.5rem',
  },
};

export default MatrixBuilder;