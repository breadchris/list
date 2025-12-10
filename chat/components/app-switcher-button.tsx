"use client";

import { LayoutGrid } from "lucide-react";

interface AppSwitcherButtonProps {
  onClick: () => void;
  variant?: "default" | "subtle";
  readerPosition?: boolean;
}

export function AppSwitcherButton({
  onClick,
  variant = "default",
  readerPosition = false,
}: AppSwitcherButtonProps) {
  const styles = {
    default:
      "bg-neutral-900/80 backdrop-blur-sm border border-neutral-700 hover:bg-neutral-800/80 hover:border-neutral-600",
    subtle:
      "bg-transparent border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50",
  };

  // Reader position: to the right of TOC button (which is at left:10px, 32px wide)
  const positionClass = readerPosition
    ? "fixed top-[10px] left-[50px] z-50"
    : "fixed top-3 right-3 sm:left-3 sm:right-auto z-50";

  return (
    <button
      onClick={onClick}
      className={`${positionClass} w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${styles[variant]}`}
      aria-label="Open app switcher"
    >
      <LayoutGrid
        className={`w-4 h-4 ${variant === "subtle" ? "" : "text-neutral-300"}`}
      />
    </button>
  );
}
