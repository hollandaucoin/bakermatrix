import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import api, { restoreCachedAuth, setAuthExpiredHandler } from './util/api.js';
import MainLayout from './components/MainLayout.js';
import LandingPage from './pages/LandingPage.js';
import Login from './pages/LoginPage.js';
import MatrixPage from './pages/MatrixPage.js';
import MatrixBuilder from './components/matrix/MatrixBuilder.js';
import SavedMatrices from './components/matrix/SavedMatrices.js';
import CommitteesPage from './pages/CommitteesPage.js';
import CommitteesAdminPage from './pages/CommitteesAdminPage.js';
import WorkshopsPage from './pages/WorkshopsPage.js';
import WorkshopAdminPage from './pages/WorkshopAdminPage.js';
import NotesPage from './pages/NotesPage.js';
import RollCallPage from './pages/RollCallPage.js';
import OnlineOnly from './components/OnlineOnly.js';
import DesktopOnly from './components/DesktopOnly.js';
import SeniorCounselorOnly from './components/SeniorCounselorOnly.js';

const App = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userType, setUserType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const isSeniorCounselor = userType === 'seniorCounselor';

  const clearAuthState = useCallback(() => {
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUserType(null);
  }, []);

  useEffect(() => {
    setAuthExpiredHandler(() => {
      clearAuthState();
      navigate('/login', { replace: true });
    });
    return () => setAuthExpiredHandler(null);
  }, [clearAuthState, navigate]);

  useEffect(() => {
    // Check authentication status on app load
    checkAuthStatus();
  }, []);

  const applyCachedAuth = async () => {
    const cached = await restoreCachedAuth();
    if (cached?.authenticated) {
      setIsAuthenticated(true);
      setIsAdmin(Boolean(cached.admin || cached.user?.admin));
      setUserType(cached.user?.userType || null);
      return true;
    }
    clearAuthState();
    return false;
  };

  const checkAuthStatus = async () => {
    try {
      const { data } = await api.get('/api/auth/status');

      // Cached offline sessions (and login saves) may omit `success`.
      // Only `authenticated` matters for staying logged in.
      if (data?.authenticated) {
        setIsAuthenticated(true);
        setIsAdmin(Boolean(data.admin || data.user?.admin));
        setUserType(data.user?.userType || null);
      } else {
        await applyCachedAuth();
      }
    } catch (error) {
      // Couldn't reach the server (offline, dead Wi-Fi, captive portal...).
      // That is NOT a logout — fall back to the saved login.
      console.error('Auth check failed:', error);
      await applyCachedAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (userData) => {
    setIsAuthenticated(true);
    setIsAdmin(userData?.admin || false);
    setUserType(userData?.userType || null);
  };

  const handleLogout = () => {
    clearAuthState();
    // Call logout API (fire-and-forget)
    api.post('/api/auth/logout').catch(() => {});
  };

  // Protected Route component
  const ProtectedRoute = ({ children }) => {
    if (isLoading) {
      return <div style={styles.loading}>Loading...</div>;
    }
    
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    
    return children;
  };

  if (isLoading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div style={styles.app}>
      <Routes>
        {/* Public routes (no authentication required) */}
        <Route path="/" element={
          <MainLayout onLogout={handleLogout} isAuthenticated={isAuthenticated}>
            <LandingPage isAuthenticated={isAuthenticated} />
          </MainLayout>
        } />
        <Route path="/login" element={
          isAuthenticated ? 
          <Navigate to="/matrix" replace /> : 
          <Login onLogin={handleLogin} />
        } />
        
        {/* Protected routes (authentication required) */}
        <Route path="/committees" element={
          <ProtectedRoute>
            <MainLayout onLogout={handleLogout} isAuthenticated={true} isAdmin={isAdmin}>
              {isAdmin ? (
                <OnlineOnly pageName="Committees admin" isAdmin>
                  <CommitteesAdminPage />
                </OnlineOnly>
              ) : (
                <CommitteesPage canSubmit={isSeniorCounselor} />
              )}
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/workshops" element={
          <ProtectedRoute>
            <MainLayout onLogout={handleLogout} isAuthenticated={true} isAdmin={isAdmin}>
              {isAdmin ? (
                <OnlineOnly pageName="Workshops admin" isAdmin>
                  <WorkshopAdminPage />
                </OnlineOnly>
              ) : (
                <WorkshopsPage canSubmit={isSeniorCounselor} />
              )}
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/roll-call" element={
          <ProtectedRoute>
            <MainLayout onLogout={handleLogout} isAuthenticated={true} isAdmin={isAdmin}>
              {!isAdmin ? (
                <SeniorCounselorOnly isSeniorCounselor={isSeniorCounselor} pageName="Roll Call">
                  <OnlineOnly pageName="Roll Call">
                    <RollCallPage />
                  </OnlineOnly>
                </SeniorCounselorOnly>
              ) : (
                <Navigate to="/matrix" replace />
              )}
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/notes" element={
          <ProtectedRoute>
            <MainLayout onLogout={handleLogout} isAuthenticated={true} isAdmin={isAdmin}>
              <NotesPage />
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/matrix" element={
          <ProtectedRoute>
            <MainLayout onLogout={handleLogout} isAuthenticated={true} isAdmin={isAdmin}>
              {isAdmin ? (
                <OnlineOnly pageName="Matrix Builder" isAdmin>
                  <DesktopOnly pageName="Matrix Builder">
                    <MatrixBuilder />
                  </DesktopOnly>
                </OnlineOnly>
              ) : (
                <MatrixPage />
              )}
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/matrix/*" element={
          <ProtectedRoute>
            <MainLayout onLogout={handleLogout} isAuthenticated={true} isAdmin={isAdmin}>
              {isAdmin ? (
                <OnlineOnly pageName="Matrix Builder" isAdmin>
                  <DesktopOnly pageName="Matrix Builder">
                    <MatrixBuilder />
                  </DesktopOnly>
                </OnlineOnly>
              ) : (
                <MatrixPage />
              )}
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/saved-matrices" element={
          <ProtectedRoute>
            <MainLayout onLogout={handleLogout} isAuthenticated={true} isAdmin={isAdmin}>
              {isAdmin ? (
                <DesktopOnly pageName="Saved Matrices">
                  <SavedMatrices />
                </DesktopOnly>
              ) : (
                <Navigate to="/matrix" replace />
              )}
            </MainLayout>
          </ProtectedRoute>
        } />
      </Routes>
    </div>
  );
};

const styles = {
  app: {
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    fontSize: '1.125rem',
    color: '#64748b',
  },
};

export default App;
