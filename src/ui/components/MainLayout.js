import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useNavigationGuard } from '../context/NavigationGuardContext.js';
import OfflineStatusBar from './OfflineStatusBar.js';

const MainLayout = ({ children, onLogout, isAuthenticated = false, isAdmin = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { requestNavigation } = useNavigationGuard();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleNavigation = (event, path) => {
    if (location.pathname === path) {
      setMenuOpen(false);
      return;
    }
    event.preventDefault();
    setMenuOpen(false);
    requestNavigation(path, navigate);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    if (onLogout) {
      onLogout();
    }
  };

  const navigationItems = [
    { path: '/matrix', label: isAdmin ? 'Matrix Builder' : 'Matrix', icon: '⚖️' },
    ...(isAdmin ? [{ path: '/saved-matrices', label: 'Saved Matrices', icon: '💾' }] : []),
    { path: '/committees', label: 'Committees', icon: '👥' },
    { path: '/workshops', label: 'Workshops', icon: '🎨' },
    ...( !isAdmin ? [{ path: '/roll-call', label: 'Roll Call', icon: '📢' }] : []),
    { path: '/notes', label: 'Notes', icon: '📝' },
  ];

  return (
    <div style={styles.container} className="main-layout">
      <style>
        {`
          @media (max-width: 768px) {
            .main-layout .header-content {
              padding: 0 1rem !important;
              height: 56px !important;
            }
            .main-layout .logo-text {
              font-size: 1.125rem !important;
            }
            .main-layout .mobile-menu-button {
              display: flex !important;
            }
            .main-layout .nav-container {
              display: none !important;
              position: absolute;
              top: 100%;
              left: 0;
              right: 0;
              flex-direction: column;
              align-items: stretch;
              gap: 0;
              padding: 0.75rem;
              background: white;
              border-bottom: 1px solid #e2e8f0;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            .main-layout .nav-container-open {
              display: flex !important;
            }
            .main-layout .navigation {
              flex-direction: column;
              align-items: stretch;
              width: 100%;
              gap: 0.25rem;
            }
            .main-layout .nav-link {
              padding: 0.75rem 1rem !important;
              border-radius: 8px !important;
            }
            .main-layout .logout-button {
              width: 100%;
              margin-top: 0.5rem;
              padding: 0.75rem 1rem !important;
            }
            .main-layout .header {
              position: sticky;
            }
          }
        `}
      </style>
      {/* Top Navigation Header */}
      <header style={styles.header} className="header">
        <div style={styles.headerContent} className="header-content">
          <div style={styles.logo}>
            <Link to="/" style={styles.logoLink} onClick={(e) => handleNavigation(e, '/')}>
              <h1 style={styles.logoText} className="logo-text">⛰️ MT. BAKER</h1>
            </Link>
          </div>

          {isAuthenticated && (
            <>
              <button
                type="button"
                className="mobile-menu-button"
                style={styles.mobileMenuButton}
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              >
                {menuOpen ? '✕' : '☰'}
              </button>
              <div
                style={styles.navContainer}
                className={`nav-container${menuOpen ? ' nav-container-open' : ''}`}
              >
                <nav style={styles.navigation} className="navigation">
                  {navigationItems.map(item => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={(e) => handleNavigation(e, item.path)}
                      style={{
                        ...styles.navLink,
                        ...(location.pathname === item.path ? styles.navLinkActive : {}),
                      }}
                      className="nav-link"
                    >
                      <span style={styles.navIcon}>{item.icon}</span>
                      <span style={styles.navLabel}>{item.label}</span>
                    </Link>
                  ))}
                </nav>

                <button
                  type="button"
                  onClick={handleLogout}
                  style={styles.logoutButton}
                  className="logout-button"
                >
                  Sign Out
                </button>
              </div>
            </>
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
    position: 'relative',
  },
  mobileMenuButton: {
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    padding: 0,
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '1.125rem',
    cursor: 'pointer',
    flexShrink: 0,
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