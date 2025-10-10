import React from 'react';
import { LayoutList, Layers } from 'lucide-react';

export type DisplayMode = 'list' | 'stack';

interface ViewDisplayToggleProps {
  currentMode: DisplayMode;
  onToggle: (mode: DisplayMode) => void;
}

export const ViewDisplayToggle: React.FC<ViewDisplayToggleProps> = ({
  currentMode,
  onToggle
}) => {
  const handleToggle = () => {
    const newMode: DisplayMode = currentMode === 'list' ? 'stack' : 'list';
    onToggle(newMode);
  };

  return (
    <button
      onClick={handleToggle}
      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
      title={currentMode === 'list' ? 'Switch to stack view' : 'Switch to list view'}
      aria-label={`Current view: ${currentMode}. Click to switch to ${currentMode === 'list' ? 'stack' : 'list'} view`}
    >
      {currentMode === 'list' ? (
        <Layers className="w-4 h-4" />
      ) : (
        <LayoutList className="w-4 h-4" />
      )}
    </button>
  );
};
