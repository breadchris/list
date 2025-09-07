import React, { useRef, useEffect } from 'react';

export interface ConsoleEntry {
  id: string;
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: Date;
}

interface JsConsoleProps {
  entries: ConsoleEntry[];
  onClear: () => void;
  className?: string;
}

export const JsConsole: React.FC<JsConsoleProps> = ({
  entries,
  onClear,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries]);

  const getEntryStyle = (type: ConsoleEntry['type']) => {
    switch (type) {
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'warn':
        return 'text-orange-600 bg-orange-50';
      case 'info':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-800 bg-gray-50';
    }
  };

  const getEntryPrefix = (type: ConsoleEntry['type']) => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warn':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📝';
    }
  };

  return (
    <div className={`flex flex-col border rounded-lg bg-gray-900 ${className}`}>
      {/* Console Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 text-gray-200 rounded-t-lg border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">JavaScript Console</span>
          <span className="text-xs text-gray-400">({entries.length} entries)</span>
        </div>
        <button
          onClick={onClear}
          className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-200 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Console Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto max-h-48 min-h-[120px] p-2 space-y-1"
      >
        {entries.length === 0 ? (
          <div className="text-gray-500 text-sm italic text-center py-4">
            Run JavaScript code to see console output here
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={`px-2 py-1 rounded text-sm font-mono ${getEntryStyle(entry.type)}`}
            >
              <div className="flex items-start space-x-2">
                <span className="flex-shrink-0 text-xs mt-0.5">
                  {getEntryPrefix(entry.type)}
                </span>
                <div className="flex-1 whitespace-pre-wrap break-words">
                  {entry.message}
                </div>
                <span className="flex-shrink-0 text-xs opacity-70">
                  {entry.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};