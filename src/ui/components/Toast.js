import React, { useEffect, useState } from 'react';

const Toast = ({ message, type = 'success', duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onClose();
      }, 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getToastStyles = () => {
    const baseStyles = {
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      padding: '1rem 1.5rem',
      borderRadius: '12px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      maxWidth: '400px',
      transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
      opacity: isVisible ? 1 : 0,
      transition: 'all 0.3s ease-in-out',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontSize: '0.875rem',
      fontWeight: '500',
    };

    if (type === 'success') {
      return {
        ...baseStyles,
        background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
        color: '#065f46',
        border: '1px solid #10b981',
      };
    } else if (type === 'error') {
      return {
        ...baseStyles,
        background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
        color: '#991b1b',
        border: '1px solid #ef4444',
      };
    } else if (type === 'warning') {
      return {
        ...baseStyles,
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        color: '#92400e',
        border: '1px solid #f59e0b',
      };
    } else {
      return {
        ...baseStyles,
        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
        color: '#1e40af',
        border: '1px solid #3b82f6',
      };
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div style={getToastStyles()}>
      <span style={{ fontSize: '1.125rem' }}>{getIcon()}</span>
      <span>{message}</span>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => {
            onClose();
          }, 300);
        }}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '1.25rem',
          cursor: 'pointer',
          padding: '0',
          marginLeft: 'auto',
          opacity: '0.7',
          transition: 'opacity 0.2s ease-in-out',
        }}
        onMouseEnter={(e) => e.target.style.opacity = '1'}
        onMouseLeave={(e) => e.target.style.opacity = '0.7'}
      >
        ×
      </button>
    </div>
  );
};

export default Toast; 