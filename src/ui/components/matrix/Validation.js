import React, { useEffect, useState } from 'react';
import api from '../../util/api.js';

const ValidationList = ({ goBack, goNext, isFirst, isLast, setValidationStatus, validationStatus }) => {
  const [seniorCounselors, setSeniorCounselors] = useState([]);
  const [juniorCounselors, setJuniorCounselors] = useState([]);
  const [dorms, setDorms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [seniorResponse, juniorResponse, dormsResponse] = await Promise.all([
          api.get(`/api/seniorcounselors`),
          api.get(`/api/juniorcounselors`),
          api.get(`/api/dorms`)
        ]);
        
        setSeniorCounselors(seniorResponse.data);
        setJuniorCounselors(juniorResponse.data);
        setDorms(dormsResponse.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Update validation status when validation changes
  useEffect(() => {
    if (setValidationStatus) {
      const stats = getValidationStats();
      const validation = getValidationStatus();
      
      setValidationStatus({
        isValid: validation.isValid,
        lastChecked: new Date().toISOString()
      });
    }
  }, [seniorCounselors, juniorCounselors, dorms, setValidationStatus]);

  // Validation functions
  const getValidationStats = () => {
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

    return {
      totalDelegates,
      totalSCs,
      totalDorms,
      scsWithJC,
      unassignedJCs,
      jcsWithDorms,
      jcsWithoutDorms,
      dormsWithTypes,
      dormsWithoutTypes,
      scsWithCommittees,
      scsWithoutCommittees,
      hasFederalWaySC
    };
  };

  const getValidationStatus = () => {
    const stats = getValidationStats();
    const issues = [];

    // Check if all dorms are assigned a type
    if (stats.dormsWithoutTypes > 0) {
      issues.push(`${stats.dormsWithoutTypes} dorm(s) not assigned a type`);
    }

    // Check if all junior counselors are assigned a dorm
    if (stats.jcsWithoutDorms > 0) {
      issues.push(`${stats.jcsWithoutDorms} junior counselor(s) not assigned a dorm`);
    }

    // Check if all junior counselors are paired to a senior counselor
    if (stats.unassignedJCs > 0) {
      issues.push(`${stats.unassignedJCs} junior counselor(s) not paired to a senior counselor`);
    }

    // Check if all senior counselors have a committee
    if (stats.scsWithoutCommittees > 0) {
      issues.push(`${stats.scsWithoutCommittees} senior counselor(s) without committee assignment`);
    }

    // Check if Federal Way SC is assigned
    if (!stats.hasFederalWaySC) {
      issues.push('Federal Way High School senior counselor not assigned');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading validation...</p>
        </div>
      </div>
    );
  }

  const stats = getValidationStats();
  const validation = getValidationStatus();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Validation</h1>
        <p style={styles.subtitle}>Ensure all required information is present and valid prior to generating a matrix</p>
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
            style={!validation.isValid ? styles.navButtonDisabled : styles.navButton} 
            onClick={goNext}
            disabled={!validation.isValid}
          >
            Next →
          </button>
        </div>
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

      {/* Validation Section - Moved to bottom */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Validation</h2>
        <div style={styles.validationContainer}>

          {/* Failing Validations */}
          {!validation.isValid && (
            <div style={{
              ...styles.validationStatus,
              ...styles.validationError
            }}>
              <div style={styles.validationIcon}>❌</div>
              <div style={styles.validationContent}>
                <h3 style={styles.validationTitle}>Failing Validations</h3>
                <ul style={styles.validationIssues}>
                  {stats.dormsWithoutTypes > 0 && (
                    <li style={styles.validationIssue}>All dorms are NOT assigned a type</li>
                  )}
                  {stats.jcsWithoutDorms > 0 && (
                    <li style={styles.validationIssue}>All junior counselors are NOT assigned a dorm</li>
                  )}
                  {stats.unassignedJCs > 0 && (
                    <li style={styles.validationIssue}>All junior counselors are NOT paired to a senior counselor</li>
                  )}
                  {stats.scsWithoutCommittees > 0 && (
                    <li style={styles.validationIssue}>All senior counselors do NOT have a committee</li>
                  )}
                  {!stats.hasFederalWaySC && (
                    <li style={styles.validationIssue}>Federal Way is NOT set to a senior counselor</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Passing Validations */}
          <div style={{
            ...styles.validationStatus,
            ...styles.validationSuccess
          }}>
            <div style={styles.validationIcon}>✅</div>
            <div style={styles.validationContent}>
              <h3 style={styles.validationTitle}>Passing Validations</h3>
              <ul style={styles.validationIssues}>
                {stats.dormsWithTypes === stats.totalDorms && (
                  <li style={styles.validationIssuePassing}>All dorms are assigned a type</li>
                )}
                {stats.jcsWithDorms === stats.totalDelegates && (
                  <li style={styles.validationIssuePassing}>All junior counselors are assigned a dorm</li>
                )}
                {stats.unassignedJCs === 0 && (
                  <li style={styles.validationIssuePassing}>All junior counselors are paired to a senior counselor</li>
                )}
                {stats.scsWithCommittees === stats.totalSCs && (
                  <li style={styles.validationIssuePassing}>All senior counselors have a committee</li>
                )}
                {stats.hasFederalWaySC && (
                  <li style={styles.validationIssuePassing}>Federal Way is set to a senior counselor</li>
                )}
              </ul>
            </div>
          </div>

          {/* Matrix Generator Explanation */}
          <div style={styles.explanationSection}>
            <div style={styles.explanationHeader}>
              <div style={styles.explanationIcon}>⚙️</div>
              <h3 style={styles.explanationTitle}>What does the Matrix Generator do?</h3>
            </div>
            <div style={styles.explanationContent}>
              <p style={styles.explanationText}>
                Before you get started, it may be helpful to understand how the matrix generator works. The matrix generator analyzes the information provided - schools, delegate counts, senior and junior counselor pairings, and more 
                - to create the optimal set of councils and staff assignments for the current year. Below is a list of the factors and constraints that are followed:
              </p>

              <div style={styles.explanationSubsection}>
                <div style={styles.subsectionHeader}>
                  <div style={styles.subsectionIcon}>🏫</div>
                  <h4 style={styles.explanationSubtitle}>School Conflict Avoidance</h4>
                </div>
                <ul style={styles.explanationList}>
                  <li style={styles.explanationListItem}>
                    <span style={styles.bulletPoint}>•</span>
                    <strong style={styles.strong}>Prior Pairings: </strong>Prevents each school from being assigned to a senior or junior counselor that they have had in the last 2 years
                  </li>
                  <li style={styles.explanationListItem}>
                    <span style={styles.bulletPoint}>•</span>
                    <strong style={styles.strong}>Staff Members: </strong>Ensures each school is not assigned to a senior counselor that is associated to their school
                  </li>
                  <li style={styles.explanationListItem}>
                    <span style={styles.bulletPoint}>•</span>
                    <strong style={styles.strong}>Former Students: </strong>Ensures each school is not assigned to a junior counselor that attended that school
                  </li>
                </ul>
              </div>

              <div style={styles.explanationSubsection}>
                <div style={styles.subsectionHeader}>
                  <div style={styles.subsectionIcon}>👥</div>
                  <h4 style={styles.explanationSubtitle}>Senior Counselor Spacing</h4>
                </div>
                <ul style={styles.explanationList}>
                  <li style={styles.explanationListItem}>
                    <span style={styles.bulletPoint}>•</span>
                    <strong style={styles.strong}>Committee Distribution: </strong>Creates a balance of committee members and leads into each half of camp
                  </li>
                  <li style={styles.explanationListItem}>
                    <span style={styles.bulletPoint}>•</span>
                    <strong style={styles.strong}>Gender Balance: </strong>Ensures each half of camp isn't too heavy on one gender of senior counselors
                  </li>
                  <li style={styles.explanationListItem}>
                    <span style={styles.bulletPoint}>•</span>
                    <strong style={styles.strong}>Posting Separation: </strong>Assigns SCs to a different posting dorm than one with their council junior counselor
                  </li>
                  <li style={styles.explanationListItem}>
                    <span style={styles.bulletPoint}>•</span>
                    <strong style={styles.strong}>Posting Partners: </strong>Pairs SCs with posting partners that they were not paired with the prior year
                  </li>
                </ul>
              </div>
              
              <div style={styles.explanationSubsection}>
                <div style={styles.subsectionHeader}>
                  <div style={styles.subsectionIcon}>🎯</div>
                  <h4 style={styles.explanationSubtitle}>Council Optimization</h4>
                </div>
                <ul style={styles.explanationList}>
                  <li style={styles.explanationListItem}>
                    <span style={styles.bulletPoint}>•</span>
                    <strong style={styles.strong}>Size Balance: </strong>Averages out the number of delegates per council when combining schools, so none are smaller than they have to be
                  </li>
                  <li style={styles.explanationListItem}>
                    <span style={styles.bulletPoint}>•</span>
                    <strong style={styles.strong}>Room Sizing: </strong>Assigns rooms based on council size, ensuring larger rooms are given to larger councils
                  </li>
                </ul>
              </div>

              <div style={styles.explanationSubsection}>
                <div style={styles.subsectionHeader}>
                  <div style={styles.subsectionIcon}>⭐</div>
                  <h4 style={styles.explanationSubtitle}>Special Considerations</h4>
                </div>
                <ul style={styles.explanationList}>
                  <li style={styles.explanationListItem}>
                    <span style={styles.bulletPoint}>•</span>
                    <strong style={styles.strong}>Federal Way: </strong>Ensures Federal Way High School students are properly assigned to the selected senior counselor
                  </li>
                  <li style={styles.explanationListItem}>
                    <span style={styles.bulletPoint}>•</span>
                    <strong style={styles.strong}>Tribe 1: </strong>Always assigns SC Chief to council #1
                  </li>
                </ul>
              </div>
              
              <div style={{
                ...styles.finalNote,
                ...(validation.isValid ? styles.finalNoteSuccess : styles.finalNoteWarning)
              }}>
                <div style={styles.noteIcon}>
                  {validation.isValid ? '✅' : '⚠️'}
                </div>
                <p style={{
                  ...styles.noteText,
                  color: validation.isValid ? '#166534' : '#991b1b'
                }}>
                  {validation.isValid 
                    ? 'All validation requirements have been met! You can now proceed by pressing the "Next" button to generate your matrix.'
                    : 'Please complete all validation requirements above before proceeding to the matrix generator.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div style={styles.navigationBottom}>
        <div style={styles.navigationButtons}>
          {!isFirst && (
            <button style={styles.navButton} onClick={goBack}>
              ← Back
            </button>
          )}
          <button 
            style={!validation.isValid ? styles.navButtonDisabled : styles.navButton} 
            onClick={goNext}
            disabled={!validation.isValid}
          >
            Next →
          </button>
        </div>
      </div>
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
  section: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '20px',
    padding: '2rem',
    marginBottom: '2rem',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0 0 1.5rem 0',
    letterSpacing: '-0.025em',
  },
  validationContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  validationStatus: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '1.5rem',
    borderRadius: '16px',
    gap: '1rem',
  },
  validationSuccess: {
    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    border: '1px solid #bbf7d0',
  },
  validationError: {
    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
    border: '1px solid #fecaca',
  },
  validationIcon: {
    fontSize: '1.5rem',
    marginTop: '0.25rem',
  },
  validationContent: {
    flex: 1,
  },
  validationTitle: {
    margin: '0 0 0.75rem 0',
    fontSize: '1.125rem',
    fontWeight: '600',
  },
  validationIssues: {
    margin: '0',
    paddingLeft: '1.25rem',
  },
  validationIssue: {
    color: '#991b1b',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    marginBottom: '0.25rem',
  },
  validationIssuePassing: {
    color: '#166534',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    marginBottom: '0.25rem',
  },
  explanationSection: {
    marginTop: '1.5rem',
    padding: '1.5rem',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
  explanationHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.5rem',
    paddingBottom: '1rem',
    borderBottom: '2px solid #e2e8f0',
  },
  explanationIcon: {
    fontSize: '2rem',
    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))',
  },
  explanationTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0',
    letterSpacing: '-0.025em',
    background: 'linear-gradient(135deg, #1e293b 0%, #3b82f6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  explanationContent: {
    flex: 1,
  },
  explanationText: {
    margin: '0 0 1.5rem 0',
    color: '#475569',
    fontSize: '0.95rem',
    lineHeight: '1.6',
    fontWeight: '400',
  },
  explanationList: {
    margin: '0',
    paddingLeft: '0',
    listStyle: 'none',
  },
  explanationListItem: {
    color: '#475569',
    fontSize: '0.9rem',
    lineHeight: '1.6',
    marginBottom: '0.25rem',
    display: 'flex',
    alignItems: 'flex-start',
    padding: '0.5rem',
    borderRadius: '8px',
    transition: 'all 0.2s ease-in-out',
    flexWrap: 'wrap',
    gap: '0.25rem',
  },
  explanationSubsection: {
    marginBottom: '1.5rem',
    padding: '1.25rem',
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    transition: 'all 0.2s ease-in-out',
  },
  explanationSubtitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0',
    letterSpacing: '-0.025em',
  },
  subsectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  subsectionIcon: {
    fontSize: '1.25rem',
    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))',
  },
  bulletPoint: {
    color: '#3b82f6',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    lineHeight: '1',
    flexShrink: '0',
  },
  strong: {
    flexShrink: '0',
    whiteSpace: 'nowrap',
  },
  finalNote: {
    marginTop: '1.5rem',
    padding: '1.25rem',
    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    borderRadius: '12px',
    border: '1px solid #bfdbfe',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  },
  noteIcon: {
    fontSize: '1.25rem',
    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))',
    flexShrink: '0',
  },
  noteText: {
    margin: '0',
    color: '#1e40af',
    fontSize: '0.9rem',
    lineHeight: '1.6',
    fontWeight: '500',
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
  navigationBottom: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '2rem',
  },
  finalNoteSuccess: {
    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    border: '1px solid #bbf7d0',
  },
  finalNoteWarning: {
    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
    border: '1px solid #fecaca',
  },
};

// Add CSS animation for spinner
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @media (max-width: 768px) {
    .stats-container {
      grid-template-columns: repeat(2, 1fr) !important;
    }
  }
  
  @media (max-width: 480px) {
    .stats-container {
      grid-template-columns: repeat(1, 1fr) !important;
    }
  }
`;
document.head.appendChild(styleSheet);

export default ValidationList; 