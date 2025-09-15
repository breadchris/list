import React from 'react';

export type ContentType = 'text' | 'js' | 'prompt';

interface ContentTypeSelectorProps {
  value: ContentType;
  onChange: (type: ContentType) => void;
  className?: string;
}

export const ContentTypeSelector: React.FC<ContentTypeSelectorProps> = ({
  value,
  onChange,
  className = ''
}) => {
  return (
    <div className={`flex space-x-2 ${className}`}>
      <button
        type="button"
        onClick={() => onChange('text')}
        className={`px-3 py-1 text-sm rounded-md transition-colors ${
          value === 'text'
            ? 'bg-blue-100 text-blue-700 border border-blue-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
        }`}
      >
        <div className="flex items-center space-x-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span>Text</span>
        </div>
      </button>
      
      <button
        type="button"
        onClick={() => onChange('js')}
        className={`px-3 py-1 text-sm rounded-md transition-colors ${
          value === 'js'
            ? 'bg-green-100 text-green-700 border border-green-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
        }`}
      >
        <div className="flex items-center space-x-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span>JavaScript</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onChange('prompt')}
        className={`px-3 py-1 text-sm rounded-md transition-colors ${
          value === 'prompt'
            ? 'bg-purple-100 text-purple-700 border border-purple-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
        }`}
      >
        <div className="flex items-center space-x-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span>AI Prompt</span>
        </div>
      </button>
    </div>
  );
};