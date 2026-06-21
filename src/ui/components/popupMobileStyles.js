export const POPUP_MOBILE_STYLES = `
  @media (max-width: 768px) {
    .app-popup-overlay {
      padding: 1rem !important;
      box-sizing: border-box !important;
    }
    .app-popup {
      width: 100% !important;
      max-width: none !important;
      max-height: calc(100vh - 2rem) !important;
      overflow-y: auto !important;
    }
    .app-popup .popup-header {
      padding: 1rem 1rem 0 1rem !important;
      margin-bottom: 1rem !important;
      gap: 0.75rem !important;
    }
    .app-popup .popup-title {
      font-size: 1.125rem !important;
      line-height: 1.3 !important;
      padding-right: 0.25rem !important;
    }
    .app-popup .popup-message {
      padding: 0 1rem !important;
      margin-bottom: 1rem !important;
    }
    .app-popup .popup-footer {
      padding: 1rem !important;
    }
    .app-popup .popup-footer-right {
      flex-direction: column !important;
      align-items: stretch !important;
    }
    .app-popup .popup-footer-right button {
      width: 100% !important;
      min-height: 44px !important;
      padding-top: 0.75rem !important;
      padding-bottom: 0.75rem !important;
    }
  }
`;
