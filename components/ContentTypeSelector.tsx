import React from 'react';

export type ContentType = 'text' | 'ai-chat';

interface ContentTypeSelectorProps {
  selectedType: ContentType;
  onSelectType: (type: ContentType) => void;
  isVisible: boolean;
}

export const ContentTypeSelector: React.FC<ContentTypeSelectorProps> = ({
  selectedType,
  onSelectType,
  isVisible
}) => {
  if (!isVisible) return null;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3 p-4 justify-center">
        <button
          onClick={() => onSelectType('text')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
            selectedType === 'text'
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span className="text-sm font-medium">Text</span>
        </button>

        <button
          onClick={() => onSelectType('ai-chat')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
            selectedType === 'ai-chat'
              ? 'bg-purple-50 border-purple-300 text-purple-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="text-sm font-medium">AI Chat</span>
        </button>
      </div>
    </div>
  );
};
