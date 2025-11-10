import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, AlertCircle, FileText } from 'lucide-react';
import { useAIChatV2Sidebar } from '../hooks/useAIChatV2Sidebar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const SidebarChat: React.FC = () => {
  const [pageContext, setPageContext] = useState<string>('');
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { input, handleInputChange, handleSubmit, history, currentResponse, isLoading } =
    useAIChatV2Sidebar({ pageContext });

  // Extract page text from current tab
  useEffect(() => {
    setIsLoadingContext(true);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        setError('No active tab found');
        setIsLoadingContext(false);
        return;
      }

      chrome.tabs.sendMessage(
        activeTab.id,
        { action: 'get-page-text' },
        (response) => {
          if (chrome.runtime.lastError) {
            setError('Could not access page content');
            setIsLoadingContext(false);
            return;
          }

          if (response?.text) {
            // Truncate to first 10K characters to avoid token limits
            const truncated = response.text.substring(0, 10000);
            setPageContext(truncated);
          }
          setIsLoadingContext(false);
        }
      );
    });
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, currentResponse]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    handleSubmit(e);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          <div>
            <h1 className="text-lg font-semibold">AI Page Chat</h1>
            <p className="text-xs text-blue-100">
              {isLoadingContext ? 'Loading page...' :
               pageContext ? `${Math.round(pageContext.length / 1000)}K chars loaded` :
               'No content loaded'}
            </p>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoadingContext && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        )}

        {!isLoadingContext && history.length === 0 && !currentResponse && (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm font-medium mb-1">Page content loaded</p>
            <p className="text-xs">Ask me anything about this page!</p>
          </div>
        )}

        {/* Chat History */}
        {history.map((msg, index) => (
          <div key={index} className="space-y-2">
            {/* User Message */}
            <div className="flex justify-end">
              <div className="max-w-[85%] px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">
                {msg.userMessage}
              </div>
            </div>

            {/* Assistant Response */}
            {msg.assistantResponse && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-3 py-2 bg-gray-100 rounded-lg text-sm">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    className="prose prose-sm max-w-none"
                  >
                    {msg.assistantResponse.answer}
                  </ReactMarkdown>

                  {/* Follow-up Questions */}
                  {msg.assistantResponse.follow_up_questions &&
                   msg.assistantResponse.follow_up_questions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5">
                      <p className="text-xs font-medium text-gray-600 mb-2">
                        Suggested questions:
                      </p>
                      {msg.assistantResponse.follow_up_questions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => handleInputChange({ target: { value: q } } as any)}
                          className="block w-full text-left px-2 py-1.5 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 hover:border-gray-300 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Current Streaming Response */}
        {currentResponse && (
          <div className="space-y-2">
            {/* User's latest message */}
            <div className="flex justify-end">
              <div className="max-w-[85%] px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">
                {input}
              </div>
            </div>

            {/* Streaming assistant response */}
            <div className="flex justify-start">
              <div className="max-w-[85%] px-3 py-2 bg-gray-100 rounded-lg text-sm">
                {currentResponse.answer ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    className="prose prose-sm max-w-none"
                  >
                    {currentResponse.answer}
                  </ReactMarkdown>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-xs">Thinking...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={onSubmit}
        className="flex-shrink-0 border-t border-gray-200 p-3 bg-white"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e)}
            placeholder="Ask about this page..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading || isLoadingContext}
          />
          <button
            type="submit"
            disabled={isLoading || isLoadingContext || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm font-medium"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
