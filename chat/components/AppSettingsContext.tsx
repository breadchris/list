"use client";

import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from "react";

interface AppSettingsContextValue {
  settingsComponent: ReactNode | null;
  setSettingsComponent: (component: ReactNode | null) => void;
  closeAppSwitcher: () => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

interface AppSettingsProviderProps {
  children: ReactNode;
  onCloseAppSwitcher?: () => void;
}

export function AppSettingsProvider({ children, onCloseAppSwitcher }: AppSettingsProviderProps) {
  const [settingsComponent, setSettingsComponent] = useState<ReactNode | null>(
    null
  );

  const closeAppSwitcher = useCallback(() => {
    onCloseAppSwitcher?.();
  }, [onCloseAppSwitcher]);

  // Memoize context value to prevent unnecessary consumer re-renders
  const value = useMemo(
    () => ({ settingsComponent, setSettingsComponent, closeAppSwitcher }),
    [settingsComponent, setSettingsComponent, closeAppSwitcher]
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  return context?.settingsComponent ?? null;
}

export function useSetAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error(
      "useSetAppSettings must be used within an AppSettingsProvider"
    );
  }
  return context.setSettingsComponent;
}

export function useCloseAppSwitcher() {
  const context = useContext(AppSettingsContext);
  return context?.closeAppSwitcher ?? (() => {});
}
