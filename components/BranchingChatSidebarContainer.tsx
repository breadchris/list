import React, { useCallback } from "react";
import { BranchingChatSidebarView } from "./BranchingChatSidebarView";
import { useBranchingChat, BranchingMessage } from "../hooks/useBranchingChat";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";
import { contentRepository } from "./ContentRepository";
import { useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "../hooks/queryKeys";

export interface Content {
  id: string;
  type: string;
  data: string;
  metadata?: {
    chat_tree?: BranchingMessage[];
    created_via?: string;
    last_updated?: string;
  };
  group_id: string;
  user_id?: string;
  parent_content_id?: string;
}

interface BranchingChatSidebarContainerProps {
  isOpen: boolean;
  onClose: () => void;
  chatContent: Content;
  groupId: string;
  onMessagesUpdate?: (contentId: string, messages: BranchingMessage[]) => void;
}

/**
 * Container component that manages branching chat state internally.
 * Prevents parent rerenders during streaming by keeping chat state local.
 */
export const BranchingChatSidebarContainer: React.FC<
  BranchingChatSidebarContainerProps
> = ({
  isOpen,
  onClose,
  chatContent,
  groupId,
  onMessagesUpdate,
}) => {
  const queryClient = useQueryClient();

  // Stable callback reference to prevent unnecessary rerenders
  const handleMessagesChange = useCallback(
    (messages: BranchingMessage[]) => {
      if (onMessagesUpdate) {
        onMessagesUpdate(chatContent.id, messages);
      }
    },
    [chatContent.id, onMessagesUpdate],
  );

  // Debounced save handler for notes editor
  const handleNotesChange = useDebouncedCallback(async (serializedState: any) => {
    try {
      await contentRepository.updateContent(chatContent.id, {
        metadata: {
          ...chatContent.metadata,
          notes_editor_state: serializedState,
          last_updated: new Date().toISOString()
        }
      });
      // Invalidate queries to refresh content
      queryClient.invalidateQueries({
        queryKey: QueryKeys.contentByParent(groupId, chatContent.parent_content_id || null)
      });
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  }, 1000);

  // Chat state managed locally - streaming updates don't affect parent
  const {
    messages,
    currentPath,
    input,
    handleInputChange,
    handleSubmit,
    sendMessage,
    currentResponse,
    isLoading,
    isLoadingMessages,
    error,
    getSiblingsForMessage,
    switchToBranch,
    editMessage,
    setMessages,
  } = useBranchingChat({
    groupId,
    chatRootId: chatContent.id,
    basePrompt: chatContent.metadata?.base_prompt || "",
  });

  return (
    <div style={{ display: isOpen ? 'block' : 'none' }} className="h-full">
      <BranchingChatSidebarView
        isOpen={isOpen}
        onClose={onClose}
        messages={messages}
        currentPath={currentPath}
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        sendMessage={sendMessage}
        currentResponse={currentResponse}
        isLoading={isLoading}
        isLoadingMessages={isLoadingMessages}
        error={error}
        getSiblingsForMessage={getSiblingsForMessage}
        switchToBranch={switchToBranch}
        editMessage={editMessage}
        setMessages={setMessages}
        notesEditorState={chatContent.metadata?.notes_editor_state}
        onNotesChange={handleNotesChange}
      />
    </div>
  );
};
