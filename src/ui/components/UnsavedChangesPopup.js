import React from 'react';

const UnsavedChangesPopup = ({
  title,
  message,
  saving = false,
  saveLabel = 'SAVE',
  onCancel,
  onDiscard,
  onSave,
}) => (
  <div style={styles.popupOverlay} onClick={onCancel}>
    <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
      <div style={styles.popupHeader}>
        <h2 style={styles.popupTitle}>{title}</h2>
        <button type="button" style={styles.closeButton} onClick={onCancel}>×</button>
      </div>
      <p style={styles.popupMessage}>{message}</p>
      <div style={styles.popupFooter}>
        <div style={styles.popupFooterRight}>
          <button type="button" style={styles.cancelButton} onClick={onCancel}>
            CANCEL
          </button>
          <button type="button" style={styles.discardButton} onClick={onDiscard}>
            DISCARD & LEAVE
          </button>
          <button
            type="button"
            style={styles.popupSaveButton}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'SAVING...' : saveLabel}
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
  popupSaveButton: {
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
};

export default UnsavedChangesPopup;
