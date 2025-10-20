import React, { useEffect, useRef } from 'react';
import { Content, Tag } from './ContentRepository';
import { ContentInput } from './ContentInput';
import { ContentSelectionState } from '../hooks/useContentSelection';
import { useInfiniteContentByParent } from '../hooks/useContentQueries';
import { LinkifiedText } from './LinkifiedText';

interface ChatViewProps {
  chatContent: Content;
  groupId: string;
  onClose: () => void;
  onNavigate: (parentId: string | null) => void;
  searchQuery: string;
  isSearching: boolean;
  selection: ContentSelectionState;
  newContent?: Content;
  onContentAdded: (content: Content) => void;
  viewMode?: 'chronological' | 'random' | 'alphabetical' | 'oldest';
  availableTags?: Tag[];
}

export const ChatView: React.FC<ChatViewProps> = ({
  chatContent,
  groupId,
  onClose,
  newContent,
  onContentAdded,
  availableTags = []
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Load messages (children of chat content)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  } = useInfiniteContentByParent(groupId, chatContent.id);

  // Flatten all pages of messages
  const messages = data?.pages.flatMap(page => page.items) || [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, newContent]);

  // Format timestamp for display
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Render individual message bubble
  const renderMessage = (message: Content) => {
    const isAssistant = message.metadata?.role === 'assistant';
    const isStreaming = message.metadata?.streaming === true;
    const hasError = message.metadata?.error === true;

    return (
      <div
        key={message.id}
        className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} mb-4 px-4`}
      >
        <div
          className={`max-w-[85%] sm:max-w-[75%] md:max-w-[65%] rounded-2xl px-4 py-3 ${
            isAssistant
              ? hasError
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-gray-100 text-gray-900'
              : 'bg-blue-600 text-white'
          }`}
        >
          {/* Message content */}
          <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">
            {isAssistant ? (
              <LinkifiedText text={message.data} />
            ) : (
              message.data
            )}
          </div>

          {/* Streaming indicator */}
          {isStreaming && (
            <div className="flex items-center gap-1 mt-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          )}

          {/* Timestamp */}
          <div className={`text-xs mt-1 ${isAssistant ? 'text-gray-500' : 'text-blue-200'}`}>
            {formatTime(message.created_at)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to list"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {chatContent.data || 'AI Chat'}
            </h2>
            <p className="text-xs text-gray-500">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-white"
      >
        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-center items-center h-full">
            <div className="flex items-center gap-2 text-gray-500">
              <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
              <span>Loading messages...</span>
            </div>
          </div>
        )}

        {/* Load more button */}
        {hasNextPage && !isLoading && (
          <div className="flex justify-center py-4">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="py-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 px-4">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm mt-1">Type a message below to begin chatting with AI</p>
            </div>
          )}

          {messages.map(renderMessage)}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto">
          <ContentInput
            groupId={groupId}
            parentContentId={chatContent.id}
            onContentAdded={onContentAdded}
            availableTags={availableTags}
          />
        </div>
      </div>
    </div>
  );
};
