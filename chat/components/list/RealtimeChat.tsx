import React, { useState } from 'react';
import { useRealtimeChat } from '@/hooks/list/useRealtimeChat';
import { useChatScroll } from '@/hooks/list/useChatScroll';
import { ChatMessageItem } from './ChatMessage';

interface RealtimeChatProps {
  roomName: string;
  username: string;
  onMessage?: (messages: any[]) => void;
  messages?: any[];
}

export const RealtimeChat: React.FC<RealtimeChatProps> = ({
  roomName,
  username,
  onMessage,
  messages: initialMessages = [],
}) => {
  const { messages, sendMessage } = useRealtimeChat(roomName, username);
  const [input, setInput] = useState('');
  const scrollRef = useChatScroll(messages.length);

  const allMessages = initialMessages.length > 0 ? initialMessages : messages;

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input);
    setInput('');
    onMessage?.(allMessages);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto"
      >
        <div className="space-y-2">
          {allMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Start the conversation...
            </div>
          ) : (
            allMessages.map((msg, idx) => (
              <ChatMessageItem
                key={msg.id}
                message={msg}
                isOwnMessage={msg.user.name === username}
                showHeader={
                  idx === 0 || allMessages[idx - 1]?.user.name !== msg.user.name
                }
              />
            ))
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
};
