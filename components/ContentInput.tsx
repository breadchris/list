import React, { useRef, useState } from 'react';
import { Content } from './ContentRepository';
import { useCreateContentMutation } from '../hooks/useContentQueries';
import { LexicalContentInput, LexicalContentInputRef } from './LexicalContentInput';
import { LLMService } from './LLMService';
import { useToast } from './ToastProvider';

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
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const pendingAISubmitRef = useRef(false);
  const toast = useToast();

  const handleSubmit = async (text: string) => {
    if (!text || (createContentMutation.isPending && !pendingAISubmitRef.current)) return;

    // If AI submit is pending, route to AI handler
    if (pendingAISubmitRef.current) {
      pendingAISubmitRef.current = false;
      handleAISubmit(text);
      return;
    }

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

  const handleAISubmit = async (text: string) => {
    if (!text || createContentMutation.isPending || isGeneratingAI) return;

    setIsGeneratingAI(true);

    try {
      // Step 1: Create the prompt content item
      const promptContent = await createContentMutation.mutateAsync({
        type: 'text',
        data: text,
        group_id: groupId,
        parent_content_id: parentContentId,
      });

      // Step 2: Call LLM service to generate children
      const llmResponse = await LLMService.generateContent({
        system_prompt: `You are a helpful assistant that generates relevant child items based on a user's prompt.
The user has entered: "${text}"

Generate a list of relevant items that would be useful as sub-items. For example:
- If the prompt is "Methods of preparing carrots", generate items like "steaming", "boiling", "blanching", "roasting", etc.
- If the prompt is "Things to do in Paris", generate items like "Visit Eiffel Tower", "Explore Louvre Museum", etc.
- Keep each item concise and actionable
- Generate between 3-8 items depending on the topic`,
        selected_content: [promptContent],
        group_id: groupId,
        parent_content_id: promptContent.id // Children should be under the prompt
      });

      if (!llmResponse.success) {
        throw new Error(llmResponse.error || 'AI generation failed');
      }

      const generatedCount = llmResponse.generated_content?.length || 0;
      toast.success(
        'AI Content Generated!',
        `Created prompt and ${generatedCount} AI-generated item${generatedCount !== 1 ? 's' : ''}`
      );

      onContentAdded(promptContent);
      onClose();

    } catch (error) {
      console.error('Error with AI generation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('AI Generation Failed', errorMessage);
    } finally {
      setIsGeneratingAI(false);
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
            disabled={createContentMutation.isPending || isGeneratingAI}
            parentContentId={parentContentId}
          />
          <p className="text-xs text-gray-500 mt-1">
            Press Enter to add, Shift+Enter for new line
          </p>
        </div>

        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => {
              lexicalInputRef.current?.submit();
            }}
            disabled={createContentMutation.isPending || isGeneratingAI}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createContentMutation.isPending && !isGeneratingAI ? (
              <div className="flex items-center">
                <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Adding...
              </div>
            ) : (
              'Add'
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              pendingAISubmitRef.current = true;
              lexicalInputRef.current?.submit();
            }}
            disabled={createContentMutation.isPending || isGeneratingAI}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingAI ? (
              <div className="flex items-center">
                <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                AI...
              </div>
            ) : (
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <span>AI</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};