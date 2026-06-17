import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const NavigationGuardContext = createContext(null);

export function NavigationGuardProvider({ children }) {
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const guardRef = useRef({ hasUnsavedChanges: false });

  const registerGuard = useCallback((guard) => {
    guardRef.current = guard;
    return () => {
      guardRef.current = { hasUnsavedChanges: false };
      setPendingNavigation(null);
    };
  }, []);

  const requestNavigation = useCallback((path, navigate) => {
    if (guardRef.current.hasUnsavedChanges) {
      setPendingNavigation({ path, navigate });
      return false;
    }
    navigate(path);
    return true;
  }, []);

  const clearPendingNavigation = useCallback(() => {
    setPendingNavigation(null);
  }, []);

  const completePendingNavigation = useCallback(() => {
    setPendingNavigation((pending) => {
      if (pending) {
        pending.navigate(pending.path);
      }
      return null;
    });
  }, []);

  return (
    <NavigationGuardContext.Provider
      value={{
        registerGuard,
        requestNavigation,
        pendingNavigation,
        clearPendingNavigation,
        completePendingNavigation,
      }}
    >
      {children}
    </NavigationGuardContext.Provider>
  );
}

export const useNavigationGuard = () => {
  const context = useContext(NavigationGuardContext);
  if (!context) {
    throw new Error('useNavigationGuard must be used within NavigationGuardProvider');
  }
  return context;
};
