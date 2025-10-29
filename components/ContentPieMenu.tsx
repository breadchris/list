import React, { useRef, useState } from 'react';
import { PieMenu, PieMenuItem } from './PieMenu';

export type ContentAction = 'ai-chat' | 'claude-code' | 'image' | 'epub' | 'plugin' | 'import';

interface ContentPieMenuProps {
  onActionSelect: (action: ContentAction) => void;
}

/**
 * Pie menu for content input actions
 * Displays 6 primary actions in a semi-circle above the trigger button
 */
export const ContentPieMenu: React.FC<ContentPieMenuProps> = ({
  onActionSelect
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Primary actions in semi-circle (left to right)
  const primaryActions: PieMenuItem[] = [
    {
      id: 'import',
      icon: '📥',
      label: 'Import',
      action: () => onActionSelect('import'),
    },
    {
      id: 'claude-code',
      icon: '💻',
      label: 'Claude Code',
      action: () => onActionSelect('claude-code'),
    },
    {
      id: 'ai-chat',
      icon: '💬',
      label: 'AI Chat',
      action: () => onActionSelect('ai-chat'),
    },
    {
      id: 'image',
      icon: '🖼️',
      label: 'Image',
      action: () => onActionSelect('image'),
    },
    {
      id: 'more',
      icon: '⋯',
      label: 'More',
      action: () => {
        setShowMoreMenu(true);
        setIsOpen(false);
      },
    },
  ];

  // Overflow actions in nested menu
  const moreActions: PieMenuItem[] = [
    {
      id: 'epub',
      icon: '📖',
      label: 'Book (EPUB)',
      action: () => {
        onActionSelect('epub');
        setShowMoreMenu(false);
      },
    },
    {
      id: 'plugin',
      icon: '🔌',
      label: 'Plugin',
      action: () => {
        onActionSelect('plugin');
        setShowMoreMenu(false);
      },
    },
  ];

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (showMoreMenu) {
      setShowMoreMenu(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowMoreMenu(false);
  };

  return (
    <>
      {/* FAB Container - fixed at bottom center, above input bar */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40">
        <button
          ref={triggerRef}
          onClick={handleToggle}
          className={`
            flex items-center justify-center
            w-14 h-14 rounded-full
            bg-gray-700 hover:bg-gray-600
            text-white transition-all duration-200
            shadow-lg hover:shadow-xl
            ${isOpen ? 'ring-2 ring-blue-400 scale-110' : ''}
          `}
          title="Content actions"
          aria-label="Open content actions menu"
        >
          <span className="text-2xl">
            {isOpen ? '✕' : '✨'}
          </span>
        </button>
      </div>

      {/* Primary pie menu */}
      <PieMenu
        items={primaryActions}
        isOpen={isOpen && !showMoreMenu}
        onClose={handleClose}
        triggerRef={triggerRef}
        radius={120}
        startAngle={180}
        endAngle={0}
      />

      {/* Nested "More" menu (smaller radius, fewer items) */}
      <PieMenu
        items={moreActions}
        isOpen={showMoreMenu}
        onClose={handleClose}
        triggerRef={triggerRef}
        radius={100}
        startAngle={160}
        endAngle={20}
      />
    </>
  );
};
