import React, { useRef, useState } from 'react';
import { Content, contentRepository } from './ContentRepository';
import { useCreateContentMutation } from '../hooks/useContentQueries';
import { LexicalContentInput, LexicalContentInputRef } from './LexicalContentInput';
import { ChatService } from './ChatService';
import { useToast } from './ToastProvider';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from '../hooks/queryKeys';

interface ContentInputProps {
  groupId: string;
  parentContentId?: string | null;
  onContentAdded: (content: Content) => void;
  isVisible: boolean;
  onClose: () => void;
  contentType: 'text' | 'ai-chat' | 'search';
}

export const ContentInput: React.FC<ContentInputProps> = ({
  groupId,
  parentContentId = null,
  onContentAdded,
  isVisible,
  onClose,
  contentType
}) => {
  const createContentMutation = useCreateContentMutation();
  const lexicalInputRef = useRef<LexicalContentInputRef>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const pendingAISubmitRef = useRef(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (text: string) => {
    if (!text || (createContentMutation.isPending && !pendingAISubmitRef.current)) return;

    console.log('Submitting content:', { text, contentType, parentContentId });

    // If content type is AI chat, route to AI handler
    if (contentType === 'ai-chat') {
      handleAISubmit(text);
      return;
    }

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

      // Invalidate cache to show new assistant message
      queryClient.invalidateQueries({
        queryKey: QueryKeys.contentByParent(groupId, chatContentId)
      });

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

      // Invalidate cache to show new assistant message
      queryClient.invalidateQueries({
        queryKey: QueryKeys.contentByParent(groupId, chatContent.id)
      });

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
      <div className="flex items-end space-x-3">
        <div className="flex-1">
          <LexicalContentInput
            ref={lexicalInputRef}
            onSubmit={handleSubmit}
            disabled={createContentMutation.isPending || isGeneratingAI}
            parentContentId={parentContentId}
          />
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
        </div>
      </div>
    </div>
  );
};