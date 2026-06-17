import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useNavigationGuard } from '../context/NavigationGuardContext.js';
import OfflineStatusBar from './OfflineStatusBar.js';

const MainLayout = ({ children, onLogout, isAuthenticated = false, isAdmin = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { requestNavigation } = useNavigationGuard();

  const handleNavigation = (event, path) => {
    if (location.pathname === path) return;
    event.preventDefault();
    requestNavigation(path, navigate);
  };

  const navigationItems = [
    { path: '/matrix', label: isAdmin ? 'Matrix Builder' : 'Matrix', icon: '⚖️' },
    ...(isAdmin ? [{ path: '/saved-matrices', label: 'Saved Matrices', icon: '💾' }] : []),
    { path: '/committees', label: 'Committees', icon: '👥' },
    { path: '/workshops', label: 'Workshops', icon: '🎨' },
    ...( !isAdmin ? [{ path: '/roll-call', label: 'Roll Call', icon: '📢' }] : []),
    { path: '/notes', label: 'Notes', icon: '📝' },
  ];

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Navigation Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logo}>
            <Link to="/" style={styles.logoLink} onClick={(e) => handleNavigation(e, '/')}>
              <h1 style={styles.logoText}>⛰️ MT. BAKER</h1>
            </Link>
          </div>
          
          {isAuthenticated && (
            <div style={styles.navContainer}>
              <nav style={styles.navigation}>
                {navigationItems.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={(e) => handleNavigation(e, item.path)}
                    style={{
                      ...styles.navLink,
                      ...(location.pathname === item.path ? styles.navLinkActive : {})
                    }}
                  >
                    <span style={styles.navIcon}>{item.icon}</span>
                    <span style={styles.navLabel}>{item.label}</span>
                  </Link>
                ))}
              </nav>
              
              <button onClick={handleLogout} style={styles.logoutButton}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {isAuthenticated && <OfflineStatusBar />}

      {/* Main Content */}
      <main style={styles.main}>
        {children}
      </main>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  header: {
    backgroundColor: 'white',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '0 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '64px',
  },
  logo: {
    flexShrink: 0,
  },
  logoLink: {
    textDecoration: 'none',
  },
  logoText: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1e293b',
    margin: 0,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  navContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  navigation: {
    display: 'flex',
    gap: '0.25rem',
    alignItems: 'center',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    textDecoration: 'none',
    color: '#64748b',
    borderRadius: '6px',
    transition: 'all 0.15s ease-in-out',
    fontSize: '0.875rem',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    border: 'none',
  },
  navLinkActive: {
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: '600',
  },
  navIcon: {
    fontSize: '0.875rem',
  },
  navLabel: {
    fontSize: '0.875rem',
  },
  logoutButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s ease-in-out',
  },
  main: {
    flex: 1,
  },
};

export default MainLayout; 