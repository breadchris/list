import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAIChatV2, ChatHistory } from '../hooks/useAIChatV2';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface Content {
  id: string;
  type: string;
  data: string;
  metadata?: {
    chat_history?: ChatHistory;
    created_via?: string;
    last_updated?: string;
  };
  group_id: string;
  user_id?: string;
  parent_content_id?: string;
}

interface AIChatV2SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  chatContent: Content;
  groupId: string;
  onHistoryUpdate: (history: ChatHistory) => void;
}

export const AIChatV2Sidebar: React.FC<AIChatV2SidebarProps> = ({
  isOpen,
  onClose,
  chatContent,
  groupId,
  onHistoryUpdate,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [initialHistory] = useState<ChatHistory>(
    chatContent.metadata?.chat_history || []
  );

  // Debounced history update callback
  const debouncedHistoryUpdate = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (history: ChatHistory) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          onHistoryUpdate(history);
        }, 2000); // 2 second debounce
      };
    })(),
    [onHistoryUpdate]
  );

  const {
    input,
    handleInputChange,
    handleSubmit,
    handleFollowUpClick,
    history,
    currentResponse,
    isLoading,
    error,
  } = useAIChatV2({
    initialHistory,
    onHistoryChange: debouncedHistoryUpdate,
  });

  // Auto-scroll to bottom when history or currentResponse updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, currentResponse]);

  if (!isOpen) return null;

  return (
    <div className="flex flex-col bg-white h-full">{/* AI Chat Interface */}
        {/* Header */}
        <div className="bg-white border-b shadow-sm">
          <div className="flex items-center justify-between p-4">
            <h1 className="text-xl font-semibold text-gray-800">AI Chat V2 (Streaming)</h1>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-800 transition-colors"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {history.length === 0 && !currentResponse ? (
            <div className="text-center text-gray-500 py-8">
              Start a conversation with AI...
            </div>
          ) : (
            <>
              {/* Render conversation history */}
              {history.map((message, idx) => (
                <div key={idx}>
                  {/* User or assistant message */}
                  <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-2`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-teal-500 text-white'
                          : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                      }`}
                    >
                      <div className="text-sm prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>

                  {/* Follow-up questions for assistant messages */}
                  {message.role === 'assistant' && message.followUpQuestions && message.followUpQuestions.length > 0 && (
                    <div className="flex justify-start mb-4">
                      <div className="max-w-[80%] space-y-2">
                        <div className="text-xs text-gray-500 px-2">Suggested questions:</div>
                        <div className="flex flex-wrap gap-2">
                          {message.followUpQuestions.map((question, qIdx) => (
                            <button
                              key={qIdx}
                              onClick={() => handleFollowUpClick(question)}
                              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors border border-gray-300"
                            >
                              {question}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Current streaming response */}
              {currentResponse && isLoading && (
                <div>
                  <div className="flex justify-start mb-2">
                    <div className="max-w-[80%] bg-white text-gray-800 rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                      <div className="text-sm prose prose-sm max-w-none">
                        {currentResponse?.answer ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {currentResponse.answer}
                          </ReactMarkdown>
                        ) : (
                          isLoading && <span className="text-gray-500">Thinking...</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Streaming follow-up questions */}
                  {currentResponse.follow_up_questions && currentResponse.follow_up_questions.length > 0 && (
                    <div className="flex justify-start mb-4">
                      <div className="max-w-[80%] space-y-2">
                        <div className="text-xs text-gray-500 px-2">Suggested questions:</div>
                        <div className="flex flex-wrap gap-2">
                          {currentResponse.follow_up_questions.map((question, qIdx) => (
                            <button
                              key={qIdx}
                              onClick={() => handleFollowUpClick(question)}
                              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors border border-gray-300"
                            >
                              {question}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t shadow-sm">
          <form onSubmit={handleSubmit} className="p-4">
            <div className="flex gap-2">
              <input
                type="text"
                name="message"
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={isLoading || !input?.trim()}
                className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
            {error && (
              <div className="mt-2 text-sm text-red-600">
                Error: {error.message || 'An error occurred'}
              </div>
            )}
          </form>
        </div>
    </div>
  );
};
