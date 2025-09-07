import React, { useState } from 'react';
import { Content } from './ContentRepository';
import { useCreateContentMutation } from '../hooks/useContentQueries';
import { ContentTypeSelector, ContentType } from './ContentTypeSelector';

interface ContentInputProps {
  groupId: string;
  parentContentId?: string | null;
  onContentAdded: (content: Content) => void;
  isVisible: boolean;
  onClose: () => void;
}

export const ContentInput: React.FC<ContentInputProps> = ({ 
  groupId,
  parentContentId = null,
  onContentAdded,
  isVisible,
  onClose
}) => {
  const [inputText, setInputText] = useState('');
  const [contentType, setContentType] = useState<ContentType>('text');
  const createContentMutation = useCreateContentMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const text = inputText.trim();
    if (!text || createContentMutation.isPending) return;

    try {
      const newContent = await createContentMutation.mutateAsync({
        type: contentType,
        data: text,
        group_id: groupId,
        parent_content_id: parentContentId,
      });

      onContentAdded(newContent);
      setInputText('');
      setContentType('text');
      onClose();
    } catch (error) {
      console.error('Error creating content:', error);
      // Error is already handled by the mutation
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">
          {parentContentId ? "Add sub-item" : "Add new item"}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="mb-3">
        <ContentTypeSelector 
          value={contentType} 
          onChange={setContentType}
        />
      </div>
      
      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        <div className="flex-1">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              contentType === 'js' 
                ? "Enter JavaScript code..." 
                : parentContentId 
                  ? "Add a sub-item..." 
                  : "Add a new item to the list..."
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={1}
            style={{
              minHeight: '40px',
              maxHeight: '120px',
              resize: 'none',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
            disabled={createContentMutation.isPending}
            autoFocus
          />
          <p className="text-xs text-gray-500 mt-1">
            Press Enter to add, Shift+Enter for new line
          </p>
        </div>
        
        <button
          type="submit"
          disabled={!inputText.trim() || createContentMutation.isPending}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createContentMutation.isPending ? (
            <div className="flex items-center">
              <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Adding...
            </div>
          ) : (
            'Add'
          )}
        </button>
      </form>
    </div>
  );
};