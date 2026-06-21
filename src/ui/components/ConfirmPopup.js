import React from 'react';
import { POPUP_MOBILE_STYLES } from './popupMobileStyles.js';

const ConfirmPopup = ({
  title,
  message,
  confirmLabel = 'CONFIRM',
  cancelLabel = 'CANCEL',
  loading = false,
  loadingLabel = '...',
  destructive = false,
  onCancel,
  onConfirm,
}) => (
  <div style={styles.popupOverlay} className="app-popup-overlay" onClick={loading ? undefined : onCancel}>
    <style>{POPUP_MOBILE_STYLES}</style>
    <div style={styles.popup} className="app-popup" onClick={(e) => e.stopPropagation()}>
      <div style={styles.popupHeader} className="popup-header">
        <h2 style={styles.popupTitle} className="popup-title">{title}</h2>
        <button type="button" style={styles.closeButton} onClick={onCancel} disabled={loading}>×</button>
      </div>
      <div style={styles.popupMessage} className="popup-message">{message}</div>
      <div style={styles.popupFooter} className="popup-footer">
        <div style={styles.popupFooterRight} className="popup-footer-right">
          <button type="button" style={styles.cancelButton} onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            style={destructive ? styles.destructiveButton : styles.confirmButton}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  </div>
);

const styles = {
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
  confirmButton: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.75rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)',
  },
  destructiveButton: {
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
};

export default ConfirmPopup;
