"use client";

import React, { memo } from "react";
import { Check } from "lucide-react";

interface PaletteColorProps {
  color: string;
  isSelected: boolean;
  onClick: () => void;
}

export const PaletteColor = memo(function PaletteColor({
  color,
  isSelected,
  onClick,
}: PaletteColorProps) {
  return (
    <button
      onClick={onClick}
      className={`w-6 h-6 rounded-sm transition-all relative ${
        isSelected
          ? "ring-2 ring-white ring-offset-1 ring-offset-neutral-900 scale-110 z-10"
          : "hover:scale-105"
      }`}
      style={{ backgroundColor: color }}
      title={color}
    >
      {isSelected && (
        <Check
          className="absolute inset-0 m-auto w-3 h-3"
          style={{
            color: isLightColor(color) ? "#000" : "#fff",
          }}
        />
      )}
    </button>
  );
});

// Helper to determine if a color is light
function isLightColor(color: string): boolean {
  // Parse rgba string
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return false;

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}
