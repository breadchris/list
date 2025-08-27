import React, { useState, useRef, useEffect } from 'react';
import { Group } from './ContentRepository';

interface GroupDropdownProps {
  currentGroup: Group | null;
  groups: Group[];
  onGroupChange: (group: Group) => void;
  isLoading?: boolean;
}

export const GroupDropdown: React.FC<GroupDropdownProps> = ({
  currentGroup,
  groups,
  onGroupChange,
  isLoading = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  const handleGroupSelect = (group: Group) => {
    onGroupChange(group);
    setIsOpen(false);
  };

  if (!currentGroup) {
    return (
      <div className="text-xl font-semibold text-gray-900">
        List App
      </div>
    );
  }

  // If only one group or loading, show simple title without dropdown
  if (groups.length <= 1 || isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <span className="text-xl font-semibold text-gray-900">
          {currentGroup.name}
        </span>
        {isLoading && (
          <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors focus:outline-none focus:text-blue-600"
        disabled={isLoading}
      >
        <span>{currentGroup.name}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : 'rotate-0'
          } ${isLoading ? 'opacity-50' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="py-2">
            <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
              Switch Group
            </div>
            <div className="max-h-64 overflow-y-auto">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleGroupSelect(group)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    currentGroup.id === group.id
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                      : 'text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{group.name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Code: {group.join_code}
                      </div>
                    </div>
                    {currentGroup.id === group.id && (
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};