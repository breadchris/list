import React, { useRef, useEffect, useState } from "react";
import { BranchingChatMessage } from "./BranchingChatMessage";
import { BranchingChatInput } from "./BranchingChatInput";
import { BranchList } from "./BranchList";
import { MessageCircle } from "lucide-react";
import { BranchingMessage } from "../hooks/useBranchingChat";
import { NotesEditorSidebar } from "./NotesEditorSidebar";

const BRANCH_COLORS = ["#E5E7EB", "#DBEAFE", "#D1FAE5", "#FEF3C7", "#E9D5FF"];

interface BranchingChatSidebarViewProps {
  isOpen: boolean;
  onClose: () => void;
  messages: BranchingMessage[];
  currentPath: string[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  sendMessage: (text: string) => Promise<void>;
  currentResponse: any;
  isLoading: boolean;
  isLoadingMessages: boolean;
  error: any;
  getSiblingsForMessage: (messageId: string) => BranchingMessage[];
  switchToBranch: (messageId: string) => void;
  editMessage: (messageId: string, newText: string) => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<BranchingMessage[]>>;
  notesEditorState?: any;
  onNotesChange: (serializedState: any) => void;
}

export const BranchingChatSidebarView: React.FC<
  BranchingChatSidebarViewProps
> = ({
  isOpen,
  onClose,
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
  notesEditorState,
  onNotesChange,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages or currentResponse updates
  useEffect(() => {
    const timeout = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
    return () => clearTimeout(timeout);
  }, [messages, currentResponse]);

  // Get visible messages for current path
  const getVisibleMessages = () => {
    return currentPath
      .filter((id) => id !== "root")
      .map((id) => messages.find((m) => m.id === id))
      .filter((m): m is BranchingMessage => m !== undefined);
  };

  const visibleMessages = getVisibleMessages();

  // Edit message state
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    text: string;
  } | null>(null);

  // Notes editor collapse state
  const [isNotesEditorCollapsed, setIsNotesEditorCollapsed] = useState(() => {
    const saved = localStorage.getItem("branchingChatNotesEditorCollapsed");
    return saved !== "false"; // Default to collapsed
  });

  // Persist notes editor collapse state
  useEffect(() => {
    localStorage.setItem(
      "branchingChatNotesEditorCollapsed",
      String(isNotesEditorCollapsed),
    );
  }, [isNotesEditorCollapsed]);

  const startEditingMessage = (messageId: string, messageText: string) => {
    setEditingMessage({ id: messageId, text: messageText });
  };

  const toggleMessageExpansion = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, isCollapsed: !m.isCollapsed } : m,
      ),
    );
  };

  const handleFollowUpClick = async (question: string) => {
    await sendMessage(question);
  };

  // Custom input change handler to update editingMessage state
  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (editingMessage) {
      setEditingMessage({ ...editingMessage, text: e.target.value });
    } else {
      handleInputChange(e);
    }
  };

  // Custom submit handler to handle edit mode
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (editingMessage) {
      // If editing, call editMessage instead
      await editMessage(editingMessage.id, input);
      setEditingMessage(null);
      return;
    }

    // Otherwise, use the normal submit handler
    handleSubmit(e);
  };

  // Loading state
  if (isLoadingMessages) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-xl font-medium mb-2">Loading chat...</div>
        </div>
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="flex flex-row bg-white h-full">
      {/* Chat area - takes remaining space */}
      <div className="flex-1 flex flex-col bg-white h-full min-h-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
          {visibleMessages.length === 0 && !isLoading ? (
            <div className="text-center text-gray-600 py-8">
              <p className="text-lg mb-2">Start a conversation</p>
              <p className="text-sm">Type a message below to begin</p>
            </div>
          ) : (
            <>
              {visibleMessages.map((message) => {
                const siblings = getSiblingsForMessage(message.id);
                const allVersions = [message, ...siblings].sort(
                  (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
                );

                return (
                  <div key={message.id} id={`message-${message.id}`}>
                    <BranchingChatMessage
                      message={message.text}
                      sender={message.sender}
                      timestamp={message.timestamp}
                      isStreaming={message.isStreaming}
                      isCollapsed={message.isCollapsed}
                      onToggle={() => toggleMessageExpansion(message.id)}
                      onEdit={() => startEditingMessage(message.id, message.text)}
                      disableAnimation={!message.isStreaming}
                    />

                    {/* Follow-up questions for assistant messages */}
                    {message.sender === "assistant" &&
                      message.followUpQuestions &&
                      message.followUpQuestions.length > 0 && (
                        <div className="flex justify-start mb-4">
                          <div className="max-w-[80%] space-y-2">
                            <div className="text-xs text-gray-600 px-2">
                              Suggested questions:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {message.followUpQuestions.map(
                                (question, qIdx) => (
                                  <button
                                    key={qIdx}
                                    onClick={() =>
                                      handleFollowUpClick(question)
                                    }
                                    className="text-xs px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-full transition-colors border border-gray-200"
                                  >
                                    {question}
                                  </button>
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Branch tabs for version switching */}
                    {allVersions.length > 1 && (
                      <div className="mb-4">
                        <BranchList
                          branches={allVersions.map((msg, i) => ({
                            id: msg.id,
                            label: msg.branchLabel || `Version ${i + 1}`,
                            color: BRANCH_COLORS[i % BRANCH_COLORS.length],
                          }))}
                          activeMessageId={
                            allVersions.find((v) => currentPath.includes(v.id))
                              ?.id || message.id
                          }
                          onSelectBranch={(msgId) => switchToBranch(msgId)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Current streaming response */}
              {isLoading && currentResponse?.answer && (
                <div key="streaming-message" id="message-streaming">
                  <BranchingChatMessage
                    message={currentResponse.answer}
                    sender="assistant"
                    timestamp={new Date().toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    isStreaming={true}
                    isCollapsed={false}
                    onToggle={() => {}}
                    disableAnimation={false}
                  />
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white">
          {editingMessage && (
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
              <span className="text-xs text-gray-600">Editing message...</span>
              <button
                onClick={() => setEditingMessage(null)}
                className="ml-auto text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          )}
          <form onSubmit={handleFormSubmit} className="p-4">
            <input
              type="text"
              value={editingMessage?.text || input}
              onChange={handleEditInputChange}
              placeholder={
                editingMessage ? "Edit your message..." : "Type a message..."
              }
              className="w-full px-4 py-2 border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
          </form>
        </div>
      </div>

      {/* Notes Editor Sidebar */}
      <NotesEditorSidebar
        isCollapsed={isNotesEditorCollapsed}
        onToggleCollapse={() =>
          setIsNotesEditorCollapsed(!isNotesEditorCollapsed)
        }
        editorState={notesEditorState}
        onEditorChange={onNotesChange}
      />
    </div>
  );
};
