"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface AppSettingsContextValue {
  settingsComponent: ReactNode | null;
  setSettingsComponent: (component: ReactNode | null) => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settingsComponent, setSettingsComponent] = useState<ReactNode | null>(
    null
  );

  return (
    <AppSettingsContext.Provider
      value={{ settingsComponent, setSettingsComponent }}
    >
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
