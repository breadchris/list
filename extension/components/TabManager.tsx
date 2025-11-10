import React from 'react';
import { useTabs } from '../hooks/useTabs';

export function TabManager() {
  const { tabs, loading, switchToTab, closeTab } = useTabs();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading tabs...</div>
      </div>
    );
  }

  if (tabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">No tabs open</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">
          Open Tabs ({tabs.length})
        </h2>
      </div>

      {/* Tab List */}
      <div className="flex-1 overflow-y-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`
              tab-item
              flex items-center gap-3 px-4 py-3 border-b border-gray-100
              hover:bg-gray-50 cursor-pointer transition-colors
              ${tab.active ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}
            `}
            onClick={() => switchToTab(tab.id)}
          >
            {/* Favicon */}
            <div className="flex-shrink-0 w-4 h-4">
              {tab.favIconUrl ? (
                <img
                  src={tab.favIconUrl}
                  alt=""
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback to globe icon if favicon fails to load
                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
                  }}
                />
              ) : (
                <svg
                  className="w-full h-full text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              )}
            </div>

            {/* Tab Title */}
            <div className="flex-1 min-w-0">
              <div
                className={`
                  text-sm truncate
                  ${tab.active ? 'font-semibold text-blue-700' : 'text-gray-700'}
                `}
                title={tab.title}
              >
                {tab.title}
              </div>
              {tab.url && (
                <div className="text-xs text-gray-500 truncate" title={tab.url}>
                  {new URL(tab.url).hostname}
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              className="
                tab-close-button
                flex-shrink-0 w-5 h-5 rounded
                flex items-center justify-center
                text-gray-400 hover:text-gray-600 hover:bg-gray-200
                transition-colors
                opacity-0 group-hover:opacity-100
              "
              onClick={(e) => {
                e.stopPropagation(); // Prevent tab switch when clicking close
                closeTab(tab.id);
              }}
              title="Close tab"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
