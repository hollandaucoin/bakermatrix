import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>Mt. Baker goes digital??</h1>
        <p style={styles.subtitle}>*  ooooooo, ahhhhhhh  *</p>
        <p style={styles.description}>
          <b>It's time</b> (last year) - streamline camp organization with the powerful <br/>matrix generator and committee/workshop management system 🥳
        </p>
        <Link to="/login" style={styles.button}>
          Login
        </Link>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  content: {
    textAlign: 'center',
    maxWidth: '800px',
    padding: '2rem',
  },
  title: {
    fontSize: '4rem',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 1rem 0',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '0.8rem',
    fontStyle: 'italic',
    color: '#64748b',
    margin: '3rem 0 2rem 0',
    lineHeight: '1.6',
  },
  description: {
    fontSize: '1.125rem',
    color: '#64748b',
    margin: '0 0 2rem 0',
    lineHeight: '1.6',
  },
  button: {
    display: 'inline-block',
    padding: '1rem 2rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '1.1rem',
    transition: 'background-color 0.2s ease',
  },
};

export default LandingPage; 