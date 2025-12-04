import { useState, useRef, useEffect } from 'react';
import { BranchingChatMessage } from './BranchingChatMessage';
import { BranchingChatInput } from './BranchingChatInput';
import { MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  isStreaming?: boolean;
  isCollapsed?: boolean;
}

interface ChatSidebarProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onToggleMessage: (messageId: string) => void;
  onEditMessage?: (messageId: string) => void;
  editingMessage?: { id: string; text: string } | null;
  onCancelEdit?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  activeVariant?: string;
  variants?: { id: string; name: string; description: string }[];
  onSelectVariant?: (variantId: string) => void;
}

export function BranchingChatSidebar({
  messages,
  onSendMessage,
  onToggleMessage,
  onEditMessage,
  editingMessage,
  onCancelEdit,
  isCollapsed = false,
  onToggleCollapse,
  activeVariant,
  variants,
  onSelectVariant,
}: ChatSidebarProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={`h-full bg-[#E8DCC8] border-r-2 border-[#9a8a6a] flex flex-col transition-all duration-300 ${
      isCollapsed ? 'w-12' : 'w-96'
    }`}>
      {isCollapsed ? (
        // Collapsed state
        <div className="flex flex-col items-center h-full">
          <button
            onClick={onToggleCollapse}
            className="p-3 hover:bg-[#D4C4A8] transition-colors border-b-2 border-[#9a8a6a]"
            title="Expand chat"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 opacity-40" />
          </div>
        </div>
      ) : (
        // Expanded state
        <>
          {/* Header */}
          <div className="bg-[#F4D03F] border-b-2 border-[#9a8a6a] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5" />
              <h2 className="text-sm">Chat Assistant</h2>
            </div>
            <button
              onClick={onToggleCollapse}
              className="p-1 hover:bg-[#e4c02f] transition-colors"
              title="Collapse chat"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full opacity-60">
                <div className="text-center">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Start a conversation</p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <BranchingChatMessage
                    key={message.id}
                    message={message.text}
                    sender={message.sender}
                    timestamp={message.timestamp}
                    isStreaming={message.isStreaming}
                    isCollapsed={message.isCollapsed}
                    onToggle={() => onToggleMessage(message.id)}
                    onEdit={
                      message.sender === 'user' && onEditMessage
                        ? () => onEditMessage(message.id)
                        : undefined
                    }
                    disableAnimation={!message.isStreaming}
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="border-t-2 border-[#9a8a6a]">
            <BranchingChatInput
              onSend={onSendMessage}
              initialValue={editingMessage?.text}
              isEditing={!!editingMessage}
              onCancelEdit={onCancelEdit}
            />
          </div>
        </>
      )}
    </div>
  );
}