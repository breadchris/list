import React from 'react';
import { ChatMessage } from '@/hooks/list/useRealtimeChat';

interface ChatMessageItemProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  showHeader: boolean;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  isOwnMessage,
  showHeader,
}) => {
  return (
    <div className={`flex mt-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] w-fit flex flex-col gap-1 ${
          isOwnMessage ? 'items-end' : ''
        }`}
      >
        {showHeader && (
          <div
            className={`flex items-center gap-2 text-xs px-3 ${
              isOwnMessage ? 'justify-end flex-row-reverse' : ''
            }`}
          >
            <span className="font-medium text-gray-700">{message.user.name}</span>
            <span className="text-gray-400 text-xs">
              {new Date(message.created_at).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
            </span>
          </div>
        )}
        <div
          className={`py-2 px-3 rounded-xl text-sm w-fit ${
            isOwnMessage
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-900'
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
};
