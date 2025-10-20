import React, { useState, useRef, useEffect } from 'react';
import { WorkflowAction } from './WorkflowFAB';

interface WorkflowActionsMenuProps {
  actions: WorkflowAction[];
  selectedCount: number;
  onActionSelect: (action: WorkflowAction) => void;
}

export const WorkflowActionsMenu: React.FC<WorkflowActionsMenuProps> = ({
  actions,
  selectedCount,
  onActionSelect
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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

  const handleActionClick = (action: WorkflowAction) => {
    console.log(`🚀 WorkflowActionsMenu action clicked: ${action.id} (${action.name})`);
    onActionSelect(action);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center px-3 h-9 rounded-full bg-orange-600 hover:bg-orange-700 text-white transition-colors"
        title={`Run workflows on ${selectedCount} selected item${selectedCount !== 1 ? 's' : ''}`}
      >
        <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="text-sm font-medium">{selectedCount}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden max-h-96 overflow-y-auto">
          <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-4 py-2">
            <h3 className="text-sm font-semibold text-gray-900">Workflow Actions</h3>
            <p className="text-xs text-gray-600">
              {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
            </p>
          </div>

          <div className="py-1">
            {actions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <div className="text-3xl mb-2">⚡</div>
                <p className="text-sm text-gray-600">
                  No workflow actions available for the selected items.
                </p>
              </div>
            ) : (
              actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleActionClick(action)}
                  className="w-full flex items-start px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <span className="text-xl flex-shrink-0 mr-3 mt-0.5">{action.icon}</span>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900">{action.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {action.description}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
