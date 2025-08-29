import React, { useState } from 'react';

interface WorkflowAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  onClick: () => void;
}

interface WorkflowFABProps {
  isVisible: boolean;
  actions: WorkflowAction[];
  selectedCount: number;
}

export const WorkflowFAB: React.FC<WorkflowFABProps> = ({
  isVisible,
  actions,
  selectedCount
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!isVisible) return null;

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <>
      {/* Workflow Actions Menu */}
      {isMenuOpen && (
        <div className="fixed bottom-32 right-6 z-40">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden min-w-64">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="text-sm font-medium text-gray-900">
                Actions ({selectedCount} item{selectedCount !== 1 ? 's' : ''})
              </div>
            </div>
            <div className="py-2">
              {actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    action.onClick();
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3"
                >
                  <span className="text-lg">{action.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {action.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {action.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Overlay to close menu when clicking outside */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-35"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Workflow FAB Button */}
      <button
        onClick={toggleMenu}
        className={`fixed bottom-24 right-6 w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-40 flex items-center justify-center ${
          isVisible ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
        }`}
        aria-label="Workflow actions"
      >
        {isMenuOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )}
      </button>
    </>
  );
};