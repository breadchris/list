import React, { useRef } from 'react';
import { Content } from './ContentRepository';
import { useCreateContentMutation } from '../hooks/useContentQueries';
import { LexicalContentInput, LexicalContentInputRef } from './LexicalContentInput';

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
  const createContentMutation = useCreateContentMutation();
  const lexicalInputRef = useRef<LexicalContentInputRef>(null);

  const handleSubmit = async (text: string) => {
    if (!text || createContentMutation.isPending) return;

    try {
      const newContent = await createContentMutation.mutateAsync({
        type: 'text',
        data: text,
        group_id: groupId,
        parent_content_id: parentContentId,
      });

      onContentAdded(newContent);
      onClose();
    } catch (error) {
      console.error('Error creating content:', error);
      // Error is already handled by the mutation
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

      <div className="flex items-end space-x-3">
        <div className="flex-1">
          <LexicalContentInput
            ref={lexicalInputRef}
            onSubmit={handleSubmit}
            disabled={createContentMutation.isPending}
            parentContentId={parentContentId}
          />
          <p className="text-xs text-gray-500 mt-1">
            Press Enter to add, Shift+Enter for new line
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            lexicalInputRef.current?.submit();
          }}
          disabled={createContentMutation.isPending}
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
      </div>
    </div>
  );
};