import React, { useRef, useState } from 'react';
import { Content, Tag, contentRepository } from './ContentRepository';
import { useCreateContentMutation } from '../hooks/useContentQueries';
import { useAddTagToContentMutation, useCreateTagMutation } from '../hooks/useTagMutations';
import { LexicalContentInput, LexicalContentInputRef } from './LexicalContentInput';
import { ChatService } from './ChatService';
import { ClaudeCodeService } from './ClaudeCodeService';
import { useToast } from './ToastProvider';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from '../hooks/queryKeys';
import { ImageUploadInput } from './ImageUploadInput';
import { EpubUploadInput } from './EpubUploadInput';
import { PluginLoader } from './PluginLoader';
import { PluginEditor } from './PluginEditor';
import { ContentPieMenu, ContentAction } from './ContentPieMenu';
import { WorkflowActionsMenu } from './WorkflowActionsMenu';
import { WorkflowAction } from './WorkflowFAB';

interface ContentInputProps {
  groupId: string;
  parentContentId?: string | null;
  onContentAdded: (content: Content) => void;
  onNavigate?: (contentId: string) => void;
  onActionSelect?: (action: ContentAction) => void;
  // Workflow props
  workflowActions?: WorkflowAction[];
  selectedCount?: number;
  isSelectionMode?: boolean;
  availableTags?: Tag[];
}

export const ContentInput: React.FC<ContentInputProps> = ({
  groupId,
  parentContentId = null,
  onContentAdded,
  onNavigate,
  onActionSelect,
  workflowActions = [],
  selectedCount = 0,
  isSelectionMode = false,
  availableTags = []
}) => {
  // Internal state for active content action
  const [activeAction, setActiveAction] = useState<ContentAction | null>(null);

  // Handle action selection
  const handleActionSelect = (action: ContentAction) => {
    // If import action and parent wants to handle it, delegate to parent
    if (action === 'import' && onActionSelect) {
      onActionSelect(action);
      return;
    }
    // Otherwise handle internally
    setActiveAction(action);
  };
  const createContentMutation = useCreateContentMutation();
  const addTagMutation = useAddTagToContentMutation();
  const createTagMutation = useCreateTagMutation();
  const lexicalInputRef = useRef<LexicalContentInputRef>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showPluginEditor, setShowPluginEditor] = useState(false);
  const [pluginContentId, setPluginContentId] = useState<string | null>(null);
  const pendingAISubmitRef = useRef(false);
  const hasCreatedPluginRef = useRef(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (text: string, mentions: string[] = []) => {
    if (!text || (createContentMutation.isPending && !pendingAISubmitRef.current)) return;

    console.log('Submitting content:', { text, mentions, activeAction, parentContentId });

    // If active action is AI chat, route to AI handler
    if (activeAction === 'ai-chat') {
      handleAISubmit(text);
      return;
    }

    // If active action is Claude Code, route to Claude Code start handler
    if (activeAction === 'claude-code') {
      handleClaudeCodeStart(text);
      return;
    }

    // If AI submit is pending, route to AI handler
    if (pendingAISubmitRef.current) {
      pendingAISubmitRef.current = false;
      handleAISubmit(text);
      return;
    }

    try {
      // Check if parent is a chat or claude-code - if so, route to appropriate handler
      if (parentContentId) {
        const parentContent = await contentRepository.getContentById(parentContentId);
        if (parentContent && parentContent.type === 'chat') {
          handleChatSubmit(text, parentContentId);
          return;
        }
        if (parentContent && parentContent.type === 'claude-code') {
          handleClaudeCodeSubmit(text, parentContentId);
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

      // Apply tags from mentions
      if (mentions.length > 0) {
        for (const mentionName of mentions) {
          try {
            // Find tag by name (case-insensitive)
            let tag = availableTags.find(t => t.name.toLowerCase() === mentionName.toLowerCase());

            // If tag doesn't exist, create it
            if (!tag) {
              tag = await createTagMutation.mutateAsync({
                name: mentionName.toLowerCase(),
                group_id: groupId
              });
            }

            // Apply tag to content
            await addTagMutation.mutateAsync({
              contentId: newContent.id,
              tagId: tag.id
            });
          } catch (tagError) {
            console.error(`Error applying tag "${mentionName}":`, tagError);
            // Continue with other tags even if one fails
          }
        }
      }

      onContentAdded(newContent);
      // Clear the Lexical editor content
      lexicalInputRef.current?.clear();
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
      setActiveAction(null);
      lexicalInputRef.current?.clear();

    } catch (error) {
      console.error('Error in chat:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Chat Failed', errorMessage);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleClaudeCodeSubmit = async (text: string, claudeCodeContentId: string) => {
    if (!text || createContentMutation.isPending || isGeneratingAI) return;

    setIsGeneratingAI(true);

    try {
      // Get session info from parent claude-code content
      const session = await contentRepository.getClaudeCodeSession(claudeCodeContentId);

      // Create user prompt as child of claude-code
      const userPrompt = await createContentMutation.mutateAsync({
        type: 'text',
        data: text,
        group_id: groupId,
        parent_content_id: claudeCodeContentId,
        metadata: { role: 'user', type: 'claude-code-prompt' }
      });

      toast.success('Executing Claude Code', 'Running your prompt...');

      // Execute Claude Code with session resume
      const response = await ClaudeCodeService.executeClaudeCode(
        text,
        groupId,
        session?.session_id, // Resume existing session if available
        [], // No selected content when resuming
        claudeCodeContentId, // Parent is the original claude-code item
        (status) => {
          console.log('Claude Code progress:', status);
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Claude Code execution failed');
      }

      // Update session metadata if we got a new session_id
      if (response.session_id) {
        await contentRepository.storeClaudeCodeSession(claudeCodeContentId, {
          session_id: response.session_id,
          s3_url: response.s3_url,
          initial_prompt: session?.initial_prompt || text,
          last_updated_at: new Date().toISOString()
        });
      }

      toast.success('Claude Code Complete', 'New iteration generated successfully');

      // Invalidate cache to show new results
      queryClient.invalidateQueries({
        queryKey: QueryKeys.contentByParent(groupId, claudeCodeContentId)
      });

      onContentAdded(userPrompt);
      setActiveAction(null);
      lexicalInputRef.current?.clear();

    } catch (error) {
      console.error('Error in Claude Code execution:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Claude Code Failed', errorMessage);
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
      setActiveAction(null);
      lexicalInputRef.current?.clear();

      // Navigate to the new chat
      if (onNavigate) {
        onNavigate(chatContent.id);
      }

    } catch (error) {
      console.error('Error starting chat:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Chat Failed', errorMessage);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleClaudeCodeStart = async (text: string) => {
    if (!text || createContentMutation.isPending || isGeneratingAI) return;

    setIsGeneratingAI(true);

    try {
      // Step 1: Create the claude-code container
      const claudeCodeContent = await createContentMutation.mutateAsync({
        type: 'claude-code',
        data: `Code: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
        group_id: groupId,
        parent_content_id: parentContentId,
      });

      // Step 2: Create first user prompt as child
      const userPrompt = await createContentMutation.mutateAsync({
        type: 'text',
        data: text,
        group_id: groupId,
        parent_content_id: claudeCodeContent.id,
        metadata: { role: 'user', type: 'claude-code-prompt' }
      });

      toast.success('Executing Claude Code', 'Running your prompt...');

      // Step 3: Execute Claude Code
      const response = await ClaudeCodeService.executeClaudeCode(
        text,
        groupId,
        undefined, // No session_id for new session
        [], // No selected content for initial start
        claudeCodeContent.id,
        (status) => {
          console.log('Claude Code progress:', status);
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Claude Code execution failed');
      }

      // Step 4: Store session metadata if we got a session_id
      if (response.session_id) {
        await contentRepository.storeClaudeCodeSession(claudeCodeContent.id, {
          session_id: response.session_id,
          s3_url: response.s3_url,
          initial_prompt: text,
          created_at: new Date().toISOString(),
          last_updated_at: new Date().toISOString()
        });
      }

      toast.success('Claude Code Complete', 'Session started successfully');

      // Invalidate cache to show new results
      queryClient.invalidateQueries({
        queryKey: QueryKeys.contentByParent(groupId, claudeCodeContent.id)
      });

      onContentAdded(claudeCodeContent);
      setActiveAction(null);
      lexicalInputRef.current?.clear();

      // Navigate to the new Claude Code session
      if (onNavigate) {
        onNavigate(claudeCodeContent.id);
      }

    } catch (error) {
      console.error('Error starting Claude Code session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Claude Code Failed', errorMessage);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleImageUploaded = async (imageUrl: string, contentId: string) => {
    try {
      // Fetch the created content to pass to parent
      const content = await contentRepository.getContentById(contentId);
      if (content) {
        onContentAdded(content);
        toast.success('Image Uploaded', 'Your image has been uploaded successfully');
      }
      setActiveAction(null);
    } catch (error) {
      console.error('Error fetching uploaded content:', error);
      toast.error('Error', 'Failed to fetch uploaded image');
    }
  };

  const handleEpubUploaded = async (epubUrl: string, contentId: string) => {
    try {
      // Fetch the created content to pass to parent
      const content = await contentRepository.getContentById(contentId);
      if (content) {
        onContentAdded(content);
        toast.success('Book Uploaded', 'Your book has been uploaded successfully');
      }
      setActiveAction(null);
    } catch (error) {
      console.error('Error fetching uploaded content:', error);
      toast.error('Error', 'Failed to fetch uploaded book');
    }
  };

  // Auto-create plugin content when plugin action is selected
  React.useEffect(() => {
    // Reset flag when action changes away from plugin
    if (activeAction !== 'plugin') {
      hasCreatedPluginRef.current = false;
      return;
    }

    // Only create once per plugin action selection
    if (activeAction === 'plugin' && !pluginContentId && !hasCreatedPluginRef.current) {
      hasCreatedPluginRef.current = true; // Set flag immediately to prevent duplicates

      const createPluginContent = async () => {
        try {
          // Create plugin content with default template
          const newContent = await createContentMutation.mutateAsync({
            type: 'plugin',
            data: PluginLoader.getDefaultTemplate(),
            group_id: groupId,
            parent_content_id: parentContentId,
          });

          setPluginContentId(newContent.id);
          setShowPluginEditor(true);
          onContentAdded(newContent);
        } catch (error) {
          console.error('Error creating plugin content:', error);
          toast.error('Error', 'Failed to create plugin');
          hasCreatedPluginRef.current = false; // Reset flag on error to allow retry
          setActiveAction(null);
        }
      };

      createPluginContent();
    }
  }, [activeAction, pluginContentId, groupId, parentContentId, onContentAdded, createContentMutation, toast]);

  // Show plugin editor as modal when active
  if (activeAction === 'plugin' && showPluginEditor && pluginContentId) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden">
          <PluginEditor
            contentId={pluginContentId}
            groupId={groupId}
            initialValue={PluginLoader.getDefaultTemplate()}
            onClose={() => {
              setShowPluginEditor(false);
              setPluginContentId(null);
              setActiveAction(null);
            }}
          />
        </div>
      </div>
    );
  }

  // Always show the new content input UI
  return (
    <>
      {/* Floating Action Button (FAB) - centered above input bar */}
      {!isSelectionMode && (
        <ContentPieMenu
          onActionSelect={handleActionSelect}
        />
      )}

      <div className="bg-gray-800 px-4 py-3">
        <div className="flex items-center space-x-3 max-w-4xl mx-auto">
          {/* Workflow Actions Menu (shown when items are selected) */}
          {isSelectionMode && selectedCount > 0 && (
            <WorkflowActionsMenu
              actions={workflowActions}
              selectedCount={selectedCount}
              onActionSelect={(action) => action.onClick()}
            />
          )}

          {/* Text Input - full width when not in selection mode */}
          <div className="flex-1">
            <LexicalContentInput
              ref={lexicalInputRef}
              onSubmit={handleSubmit}
              disabled={createContentMutation.isPending || isGeneratingAI}
              parentContentId={parentContentId}
              availableTags={availableTags}
              activeAction={activeAction}
            />
          </div>
        </div>
      </div>

      {/* Modal overlays for special actions */}
      {activeAction === 'image' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <ImageUploadInput
              groupId={groupId}
              parentContentId={parentContentId}
              onImageUploaded={handleImageUploaded}
              onClose={() => setActiveAction(null)}
            />
          </div>
        </div>
      )}

      {activeAction === 'epub' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <EpubUploadInput
              groupId={groupId}
              parentContentId={parentContentId}
              onEpubUploaded={handleEpubUploaded}
              onClose={() => setActiveAction(null)}
            />
          </div>
        </div>
      )}
    </>
  );
};