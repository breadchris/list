import React, { useCallback, useEffect } from "react";
import { AIChatV2Sidebar, Content } from "./AIChatV2Sidebar";
import { useAIChatV2, ChatHistory } from "../hooks/useAIChatV2";

interface AIChatV2SidebarContainerProps {
  isOpen: boolean;
  onClose: () => void;
  chatContent: Content;
  groupId: string;
  onHistoryUpdate: (contentId: string, history: ChatHistory) => void;
  // Callbacks to expose chat controls to parent
  onInputChange?: (input: string) => void;
  onIsLoadingChange?: (isLoading: boolean) => void;
  onHandleInputChangeExpose?: (
    handler: (e: React.ChangeEvent<HTMLInputElement>) => void,
  ) => void;
  onHandleSubmitExpose?: (handler: (e: React.FormEvent) => void) => void;
}

/**
 * Container component that manages AI chat state internally.
 * Prevents parent rerenders during streaming by keeping chat state local.
 */
export const AIChatV2SidebarContainer: React.FC<
  AIChatV2SidebarContainerProps
> = ({
  isOpen,
  onClose,
  chatContent,
  groupId,
  onHistoryUpdate,
  onInputChange,
  onIsLoadingChange,
  onHandleInputChangeExpose,
  onHandleSubmitExpose,
}) => {
  // Stable callback reference to prevent unnecessary rerenders
  const handleHistoryChange = useCallback(
    (history: ChatHistory) => {
      onHistoryUpdate(chatContent.id, history);
    },
    [chatContent.id, onHistoryUpdate],
  );

  // Chat state managed locally - streaming updates don't affect parent
  const {
    input,
    handleInputChange,
    handleSubmit,
    handleFollowUpClick,
    history,
    currentResponse,
    isLoading,
    error,
    basePrompt,
    setBasePrompt,
  } = useAIChatV2({
    initialHistory: chatContent.metadata?.chat_history || [],
    onHistoryChange: handleHistoryChange,
  });

  // Expose input value to parent
  useEffect(() => {
    if (onInputChange) {
      onInputChange(input);
    }
  }, [input, onInputChange]);

  // Expose isLoading state to parent
  useEffect(() => {
    if (onIsLoadingChange) {
      onIsLoadingChange(isLoading);
    }
  }, [isLoading, onIsLoadingChange]);

  // Expose handleInputChange handler to parent (stable reference)
  useEffect(() => {
    if (onHandleInputChangeExpose) {
      onHandleInputChangeExpose(handleInputChange);
    }
  }, [handleInputChange, onHandleInputChangeExpose]);

  // Expose handleSubmit handler to parent (stable reference)
  useEffect(() => {
    if (onHandleSubmitExpose) {
      onHandleSubmitExpose(handleSubmit);
    }
  }, [handleSubmit, onHandleSubmitExpose]);

  return (
    <div style={{ display: isOpen ? 'block' : 'none' }} className="h-full">
      <AIChatV2Sidebar
        isOpen={isOpen}
        onClose={onClose}
        chatContent={chatContent}
        groupId={groupId}
        history={history}
        currentResponse={currentResponse}
        isLoading={isLoading}
        error={error}
        onFollowUpClick={handleFollowUpClick}
        basePrompt={basePrompt}
        onBasePromptChange={setBasePrompt}
      />
    </div>
  );
};
