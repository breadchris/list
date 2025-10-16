import React, { useState } from 'react';

export interface WorkflowAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  onClick: () => void;
  category?: string[];
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
    console.log(`🎯 WorkflowFAB drawer toggle: ${!isMenuOpen ? 'opening' : 'closing'}`);
    console.log('Actions available:', actions.length);
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Right-Side Drawer */}
      {isMenuOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-gray-900 bg-opacity-10 z-40 transition-opacity duration-300 ease-in-out"
            onClick={closeMenu}
          />

          {/* Drawer */}
          <div className="fixed inset-y-0 right-0 z-50 w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Workflow Actions</h2>
                  <p className="text-sm text-gray-600">
                    {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
                  </p>
                </div>
                <button
                  onClick={closeMenu}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close drawer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Actions List */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-2">
                  {actions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => {
                        console.log(`🚀 WorkflowFAB action clicked: ${action.id} (${action.name})`);
                        action.onClick();
                        closeMenu();
                      }}
                      className="w-full px-4 py-3 mb-2 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors rounded-lg border border-gray-200 hover:border-gray-300 flex items-start space-x-3"
                    >
                      <span className="text-2xl flex-shrink-0 mt-0.5">{action.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 mb-0.5">
                          {action.name}
                        </div>
                        <div className="text-xs text-gray-500 leading-relaxed">
                          {action.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Empty State */}
                {actions.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="text-4xl mb-3">⚡</div>
                    <p className="text-sm text-gray-600">
                      No workflow actions available for the selected items.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer (optional - for future use) */}
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                <p className="text-xs text-gray-500 text-center">
                  Select workflows to perform bulk operations
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Workflow FAB Button - Now in bottom right corner */}
      <button
        onClick={toggleMenu}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-40 flex items-center justify-center ${
          isVisible ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
        }`}
        aria-label="Open workflow actions"
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
