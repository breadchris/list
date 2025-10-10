import React, { useRef, useState } from 'react';
import { Content, contentRepository } from './ContentRepository';
import { useCreateContentMutation } from '../hooks/useContentQueries';
import { LexicalContentInput, LexicalContentInputRef } from './LexicalContentInput';
import { ChatService } from './ChatService';
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
      // Check if parent is a chat - if so, route to chat handler
      if (parentContentId) {
        const parentContent = await contentRepository.getContentById(parentContentId);
        if (parentContent && parentContent.type === 'chat') {
          handleChatSubmit(text, parentContentId);
          return;
        }
      }

      // Normal content creation
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

  const handleChatSubmit = async (text: string, chatContentId: string) => {
    if (!text || createContentMutation.isPending || isGeneratingAI) return;

    setIsGeneratingAI(true);

    try {
      // Create user message as child of chat
      const userMessage = await createContentMutation.mutateAsync({
        type: 'text',
        data: text,
        group_id: groupId,
        parent_content_id: chatContentId,
        metadata: { role: 'user' }
      });

      // Call chat service to get AI response
      const chatResponse = await ChatService.sendMessage({
        chat_content_id: chatContentId,
        message: text,
        group_id: groupId
      });

      if (!chatResponse.success) {
        throw new Error(chatResponse.error || 'Chat failed');
      }

      toast.success('AI Responded', 'Message sent and AI has responded');

      onContentAdded(userMessage);
      onClose();

    } catch (error) {
      console.error('Error in chat:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Chat Failed', errorMessage);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAISubmit = async (text: string) => {
    if (!text || createContentMutation.isPending || isGeneratingAI) return;

    setIsGeneratingAI(true);

    try {
      // Step 1: Create the chat container
      const chatContent = await createContentMutation.mutateAsync({
        type: 'chat',
        data: `Chat: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
        group_id: groupId,
        parent_content_id: parentContentId,
      });

      // Step 2: Create first user message as child of chat
      const userMessage = await createContentMutation.mutateAsync({
        type: 'text',
        data: text,
        group_id: groupId,
        parent_content_id: chatContent.id,
        metadata: { role: 'user' }
      });

      // Step 3: Call chat service to get AI response
      const chatResponse = await ChatService.sendMessage({
        chat_content_id: chatContent.id,
        message: text,
        group_id: groupId
      });

      if (!chatResponse.success) {
        throw new Error(chatResponse.error || 'Chat failed');
      }

      toast.success(
        'Chat Started!',
        'AI has responded to your message'
      );

      onContentAdded(chatContent);
      onClose();

    } catch (error) {
      console.error('Error starting chat:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Chat Failed', errorMessage);
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