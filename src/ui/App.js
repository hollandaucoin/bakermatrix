import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import api, { restoreCachedAuth } from './util/api.js';
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

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication status on app load
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const { data } = await api.get('/api/auth/status');

      if (data.success && data.authenticated) {
        setIsAuthenticated(true);
        setIsAdmin(Boolean(data.admin || data.user?.admin));
      } else {
        setIsAuthenticated(false);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      const cached = await restoreCachedAuth();
      if (cached?.authenticated) {
        setIsAuthenticated(true);
        setIsAdmin(Boolean(cached.admin));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (userData) => {
    setIsAuthenticated(true);
    setIsAdmin(userData?.admin || false);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsAdmin(false);
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
            <LandingPage />
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
                <CommitteesPage />
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
                <WorkshopsPage />
              )}
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/roll-call" element={
          <ProtectedRoute>
            <MainLayout onLogout={handleLogout} isAuthenticated={true} isAdmin={isAdmin}>
              {!isAdmin ? (
                <OnlineOnly pageName="Roll Call">
                  <RollCallPage />
                </OnlineOnly>
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
