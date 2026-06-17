import React from 'react';
import { Link } from 'react-router-dom';
import { useOffline } from '../context/OfflineContext.js';

const OnlineOnly = ({ children, pageName = 'This page', isAdmin = false }) => {
  const { isOnline } = useOffline();

  if (isOnline) {
    return children;
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>📡</div>
        <h1 style={styles.title}>Not available offline</h1>
        <p style={styles.message}>
          {isAdmin
            ? `${pageName} requires an internet connection. Connect to Wi‑Fi to use it.`
            : `${pageName} requires an internet connection. Connect to Wi‑Fi to use it, or visit Matrix, Committees, or Workshops — those work offline.`}
        </p>
        {!isAdmin && (
          <div style={styles.links}>
            <Link to="/matrix" style={styles.link}>Matrix</Link>
            <Link to="/committees" style={styles.link}>Committees</Link>
            <Link to="/workshops" style={styles.link}>Workshops</Link>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '50vh',
    padding: '2rem',
  },
  card: {
    maxWidth: '480px',
    textAlign: 'center',
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '2.5rem 2rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    border: '1px solid #e2e8f0',
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 0.75rem 0',
  },
  message: {
    fontSize: '1rem',
    color: '#64748b',
    lineHeight: 1.6,
    margin: '0 0 1.5rem 0',
  },
  links: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '0.75rem',
  },
  link: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#1d4ed8',
    backgroundColor: '#eff6ff',
    borderRadius: '6px',
    textDecoration: 'none',
  },
};

export default OnlineOnly;
