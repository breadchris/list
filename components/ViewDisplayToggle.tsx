import React from 'react';
import { LayoutList, Layers, Grid3x3 } from 'lucide-react';

export type DisplayMode = 'list' | 'stack' | 'masonry';

interface ViewDisplayToggleProps {
  currentMode: DisplayMode;
  onToggle: (mode: DisplayMode) => void;
}

export const ViewDisplayToggle: React.FC<ViewDisplayToggleProps> = ({
  currentMode,
  onToggle
}) => {
  const handleToggle = () => {
    // Cycle through: list → stack → masonry → list
    let newMode: DisplayMode;
    if (currentMode === 'list') {
      newMode = 'stack';
    } else if (currentMode === 'stack') {
      newMode = 'masonry';
    } else {
      newMode = 'list';
    }
    onToggle(newMode);
  };

  const getNextMode = (): string => {
    if (currentMode === 'list') return 'stack';
    if (currentMode === 'stack') return 'masonry';
    return 'list';
  };

  return (
    <button
      onClick={handleToggle}
      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
      title={`Switch to ${getNextMode()} view`}
      aria-label={`Current view: ${currentMode}. Click to switch to ${getNextMode()} view`}
    >
      {currentMode === 'list' ? (
        <LayoutList className="w-4 h-4" />
      ) : currentMode === 'stack' ? (
        <Layers className="w-4 h-4" />
      ) : (
        <Grid3x3 className="w-4 h-4" />
      )}
    </button>
  );
};
