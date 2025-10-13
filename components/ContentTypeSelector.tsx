import React from 'react';

export type ContentType = 'text' | 'ai-chat' | 'search' | 'image';

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

        <button
          onClick={() => onSelectType('search')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
            selectedType === 'search'
              ? 'bg-teal-50 border-teal-300 text-teal-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-sm font-medium">Search</span>
        </button>

        <button
          onClick={() => onSelectType('image')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
            selectedType === 'image'
              ? 'bg-green-50 border-green-300 text-green-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium">Image</span>
        </button>
      </div>
    </div>
  );
};
