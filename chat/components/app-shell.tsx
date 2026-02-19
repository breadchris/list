"use client";

import { useState, type ReactNode } from "react";
import { LayoutGrid } from "lucide-react";
import { AppSwitcherPanel } from "./app-switcher-panel";
import { useRailActions } from "./AppSettingsContext";

interface AppShellProps {
  currentApp: string;
  actions?: ReactNode;
  children: ReactNode;
  bgColor?: string;
  hideShell?: boolean;
}

export function AppShell({
  currentApp,
  actions,
  children,
  bgColor = "bg-neutral-950",
  hideShell = false,
}: AppShellProps) {
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);
  const railActions = useRailActions();

  if (hideShell) {
    return <div className={`h-screen ${bgColor}`}>{children}</div>;
  }

  return (
    <div className={`h-screen ${bgColor} flex flex-col md:flex-row`}>
      {/* Mobile: top navbar */}
      <nav className="md:hidden flex-shrink-0 h-12 border-b border-neutral-800 bg-neutral-950 flex items-center px-2 gap-1">
        <button
          onClick={() => setAppSwitcherOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          aria-label="Open app switcher"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        {actions}
        {railActions}
      </nav>

      {/* Desktop: left sidebar rail */}
      <nav className="hidden md:flex flex-shrink-0 w-12 border-r border-neutral-800 bg-neutral-950 flex-col items-center py-2 gap-1">
        <button
          onClick={() => setAppSwitcherOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          aria-label="Open app switcher"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        {actions}
        {railActions}
      </nav>

      {/* Main content area */}
      <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
        {children}
      </main>

      <AppSwitcherPanel
        isOpen={appSwitcherOpen}
        onClose={() => setAppSwitcherOpen(false)}
        currentApp={currentApp}
      />
    </div>
  );
}
