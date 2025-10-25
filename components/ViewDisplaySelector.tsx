import React, { useState, useRef, useEffect } from 'react';
import { LayoutList, Layers, Grid3x3, Layers2 } from 'lucide-react';

export type DisplayMode = 'list' | 'stack' | 'masonry' | 'deck';

interface ViewDisplaySelectorProps {
  currentMode: DisplayMode;
  onSelect: (mode: DisplayMode) => void;
}

interface DisplayOption {
  mode: DisplayMode;
  label: string;
  icon: React.ReactNode;
  description: string;
}

export const ViewDisplaySelector: React.FC<ViewDisplaySelectorProps> = ({
  currentMode,
  onSelect
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayOptions: DisplayOption[] = [
    {
      mode: 'list',
      label: 'List',
      icon: <LayoutList className="w-4 h-4" />,
      description: 'Traditional vertical list'
    },
    {
      mode: 'stack',
      label: 'Stack',
      icon: <Layers className="w-4 h-4" />,
      description: 'Card stack view'
    },
    {
      mode: 'masonry',
      label: 'Masonry',
      icon: <Grid3x3 className="w-4 h-4" />,
      description: 'Pinterest-style grid'
    },
    {
      mode: 'deck',
      label: 'Deck',
      icon: <Layers2 className="w-4 h-4" />,
      description: 'Playing cards spread'
    }
  ];

  const currentOption = displayOptions.find(opt => opt.mode === currentMode);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (mode: DisplayMode) => {
    onSelect(mode);
    setIsOpen(false);
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Toggle Button */}
      <button
        onClick={toggleOpen}
        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        title={`Current view: ${currentOption?.label}. Click to change view`}
        aria-label={`Current view: ${currentOption?.label}. Click to change view`}
      >
        {currentOption?.icon}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Display Mode
            </h3>
          </div>

          {/* Options */}
          <div className="py-1">
            {displayOptions.map((option) => {
              const isActive = option.mode === currentMode;

              return (
                <button
                  key={option.mode}
                  onClick={() => handleSelect(option.mode)}
                  className={`w-full px-3 py-2.5 flex items-start gap-3 transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className={`mt-0.5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                    {option.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <div className={`text-sm font-medium ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {option.description}
                    </div>
                  </div>
                  {isActive && (
                    <svg className="w-4 h-4 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
