"use client";

import { LayoutGrid } from "lucide-react";

interface AppSwitcherButtonProps {
  onClick: () => void;
}

export function AppSwitcherButton({ onClick }: AppSwitcherButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed top-3 left-3 z-50 w-8 h-8 flex items-center justify-center bg-neutral-900/80 backdrop-blur-sm border border-neutral-700 rounded-lg hover:bg-neutral-800/80 hover:border-neutral-600 transition-colors"
      aria-label="Open app switcher"
    >
      <LayoutGrid className="w-4 h-4 text-neutral-300" />
    </button>
  );
}
