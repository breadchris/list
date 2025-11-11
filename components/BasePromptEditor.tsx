import { ChevronLeft, ChevronRight, FileText, Trash2 } from 'lucide-react';

interface BasePromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

export function BasePromptEditor({
  value,
  onChange,
  isCollapsed = false,
  onToggleCollapse,
  className = '',
}: BasePromptEditorProps) {
  const handleClear = () => {
    onChange('');
  };

  return (
    <div
      className={`h-full bg-white border-l border-gray-200 flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-12' : 'w-full md:w-1/5 md:min-w-[250px]'
      } ${className}`}
    >
      {isCollapsed ? (
        // Collapsed state - matches content list styling with vertical text
        <div className="flex flex-col items-center h-full">
          <button
            onClick={onToggleCollapse}
            className="p-3 hover:bg-gray-100 transition-colors border-b border-gray-200"
            title="Expand base prompt editor"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 flex items-center justify-center">
            <div
              className="text-sm font-medium text-gray-600 whitespace-nowrap"
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                transform: 'rotate(180deg)'
              }}
            >
              Base Prompt
            </div>
          </div>
        </div>
      ) : (
        // Expanded state
        <>
          {/* Header */}
          <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-600" />
              <h2 className="text-sm font-medium text-gray-900">Base Prompt</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClear}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Clear prompt"
              >
                <Trash2 className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={onToggleCollapse}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Collapse base prompt editor"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 pb-2">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                System Prompt
              </label>
            </div>
            <div className="flex-1 px-4 pb-4 overflow-auto">
              <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Enter a custom system prompt for the AI assistant. This will be used for all messages in this chat session.

Example:
You are a helpful coding assistant specialized in React and TypeScript. Provide clear, concise answers with code examples when relevant."
                className="w-full h-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono"
                style={{ minHeight: '200px' }}
              />
            </div>

            {/* Info */}
            <div className="px-4 pb-4">
              <p className="text-xs text-gray-500">
                The base prompt applies to new messages only. Changing it won't affect existing chat history.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
