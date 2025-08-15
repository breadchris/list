import React, { useState } from 'react';
import { Content, contentRepository } from '../data/ContentRepository';

interface ContentInputProps {
  groupId: string;
  onContentAdded: (content: Content) => void;
}

export const ContentInput: React.FC<ContentInputProps> = ({ 
  groupId, 
  onContentAdded 
}) => {
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const text = inputText.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const newContent = await contentRepository.createContent({
        type: 'text',
        data: text,
        group_id: groupId,
      });

      onContentAdded(newContent);
      setInputText('');
    } catch (error) {
      console.error('Error creating content:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-white border-t border-gray-200 px-4 py-3">
      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        <div className="flex-1">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a new item to the list..."
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
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-500 mt-1">
            Press Enter to add, Shift+Enter for new line
          </p>
        </div>
        
        <button
          type="submit"
          disabled={!inputText.trim() || isSubmitting}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
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