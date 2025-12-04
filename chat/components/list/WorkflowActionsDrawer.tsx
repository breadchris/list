import React, { useState } from 'react';
import { Drawer } from './vaul/index';

export interface WorkflowAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  onClick: () => void;
  category?: string[];
}

interface WorkflowActionsDrawerProps {
  selectedCount: number;
  workflowActions: WorkflowAction[];
  onClearSelection: () => void;
}

/**
 * Swipeable drawer for workflow actions
 * Shows all available workflow actions when content is selected
 * Includes "Clear Selection" action at the top
 */
export const WorkflowActionsDrawer: React.FC<WorkflowActionsDrawerProps> = ({
  selectedCount,
  workflowActions,
  onClearSelection
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleActionClick = (action: WorkflowAction) => {
    action.onClick();
    setIsOpen(false);
  };

  const handleClearSelection = () => {
    onClearSelection();
    setIsOpen(false);
  };

  // Don't render if nothing is selected
  if (selectedCount === 0) {
    return null;
  }

  return (
    <Drawer.Root open={isOpen} onOpenChange={setIsOpen}>
      <div className="fixed bottom-14 left-0 right-0 z-50 flex justify-center">
        <Drawer.Trigger asChild>
          <button
            className="
              flex flex-col items-center justify-center relative
              px-6 py-2 rounded-t-xl
              bg-blue-600 text-white transition-all duration-200
              shadow-lg hover:scale-105 active:scale-95
              border-t-2 border-blue-400
            "
          >
            <div
              className="transition-transform duration-200"
              style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <span className="text-xs mt-0.5 font-medium">
              {selectedCount} selected - tap for actions
            </span>
          </button>
        </Drawer.Trigger>
      </div>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 md:left-auto md:right-auto md:w-[600px] md:mx-auto bg-gray-800 flex flex-col rounded-t-2xl max-h-[80vh] z-50">
          <Drawer.Title className="sr-only">Workflow Actions</Drawer.Title>
          <Drawer.Description className="sr-only">
            Select a workflow action to perform on {selectedCount} selected {selectedCount === 1 ? 'item' : 'items'}
          </Drawer.Description>

          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-4">
            <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
          </div>

          {/* Actions Content */}
          <div className="px-6 pb-6 overflow-auto">
            {/* Clear Selection Action - Prominent at top */}
            <button
              onClick={handleClearSelection}
              className="
                w-full flex items-center justify-center
                p-4 mb-4 rounded-xl
                bg-red-600 hover:bg-red-700
                transition-all duration-200
                shadow-md
              "
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-white font-medium">Clear Selection</span>
            </button>

            {/* Workflow Actions Grid */}
            <div className="grid grid-cols-2 gap-3">
              {workflowActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleActionClick(action)}
                  className="
                    flex flex-col items-start
                    p-4 rounded-xl
                    bg-gray-700 hover:bg-gray-600
                    transition-all duration-200
                    text-left
                  "
                >
                  <div className="flex items-center mb-2 w-full">
                    <span className="text-2xl mr-2">{action.icon}</span>
                    <span className="text-sm text-white font-medium flex-1">
                      {action.name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-300 line-clamp-2">
                    {action.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
