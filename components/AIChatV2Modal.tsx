import React, { useRef, useEffect, useState } from 'react';
import { useAIChatV2 } from '../hooks/useAIChatV2';
import type { Message } from '@ai-sdk/react';

interface AIChatV2ModalProps {
  isVisible: boolean;
  onClose: () => void;
}

/**
 * AI Chat V2 Modal with Vercel AI SDK streaming
 * Uses useChat hook to stream chat responses from Lambda
 */
export const AIChatV2Modal: React.FC<AIChatV2ModalProps> = ({
  isVisible,
  onClose,
}) => {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useAIChatV2();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle clicking on a follow-up question
  const handleFollowUpClick = (question: string) => {
    // Create a synthetic form submit event with the question as input
    const syntheticEvent = {
      preventDefault: () => {},
      target: { message: { value: question } }
    } as any;

    // Temporarily set the input value
    const inputElement = document.querySelector<HTMLInputElement>('input[name="message"]');
    if (inputElement) {
      inputElement.value = question;
      handleSubmit(syntheticEvent);
      inputElement.value = ''; // Clear after submit
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">AI Chat V2 (Streaming)</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Start a conversation with AI...
            </div>
          ) : (
            <>
              {messages.map((message, idx) => (
                <div key={idx} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-teal-500 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 text-gray-800 rounded-lg px-4 py-2">
                    <div className="text-sm">Thinking...</div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t">
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
              disabled={isLoading || !input.trim()}
              className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
