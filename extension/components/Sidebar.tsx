import React, { useState, useEffect } from 'react';
import { TabManager } from './TabManager';
import { SidebarChat } from './SidebarChat';

type SidebarMode = 'tabs' | 'chat';

export const Sidebar: React.FC = () => {
  const [mode, setMode] = useState<SidebarMode>('tabs');

  // Load mode preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-mode');
    if (saved === 'tabs' || saved === 'chat') {
      setMode(saved);
    }
  }, []);

  // Save mode preference to localStorage
  const handleModeChange = (newMode: SidebarMode) => {
    setMode(newMode);
    localStorage.setItem('sidebar-mode', newMode);
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Mode Toggle */}
      <div className="flex-shrink-0 flex border-b border-gray-200 bg-white">
        <button
          onClick={() => handleModeChange('tabs')}
          className={`
            flex-1 px-4 py-3 text-sm font-medium transition-colors
            ${mode === 'tabs'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }
          `}
        >
          <div className="flex items-center justify-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
            <span>Tabs</span>
          </div>
        </button>

        <button
          onClick={() => handleModeChange('chat')}
          className={`
            flex-1 px-4 py-3 text-sm font-medium transition-colors
            ${mode === 'chat'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }
          `}
        >
          <div className="flex items-center justify-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span>AI Chat</span>
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === 'tabs' ? <TabManager /> : <SidebarChat />}
      </div>
    </div>
  );
};
