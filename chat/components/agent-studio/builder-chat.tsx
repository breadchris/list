"use client";

/**
 * Builder Chat
 *
 * The main chat-first interface for Agent Studio.
 * Starts as a centered input, transitions to full chat on first message.
 */

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { useBuilderContext, BuilderContextProvider } from "./builder-context";
import { BuilderMessage } from "./builder-message";
import type { BuilderMessage as BuilderMessageType } from "@/types/agent-studio";

// ============================================================================
// Chat Input Component
// ============================================================================

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  centered?: boolean;
}

function ChatInput({
  onSubmit,
  isLoading,
  placeholder = "Describe the agent you want to build...",
  autoFocus = true,
  centered = false,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSubmit(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`w-full ${centered ? "max-w-2xl" : ""}`}
    >
      <div className="relative flex items-end gap-2 bg-neutral-900 rounded-xl border border-neutral-700 p-3 focus-within:border-neutral-500 transition-colors">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={isLoading}
          rows={1}
          className="flex-1 bg-transparent text-white placeholder-neutral-500 resize-none outline-none text-base leading-relaxed"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="flex-shrink-0 p-2 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 transition-colors"
        >
          {isLoading ? (
            <svg
              className="w-5 h-5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>
      {centered && (
        <p className="text-center text-neutral-500 text-sm mt-3">
          I can help you create agents, tools, workflows, and manage knowledge collections.
        </p>
      )}
    </form>
  );
}

// ============================================================================
// Main Builder Chat Component
// ============================================================================

interface BuilderChatInnerProps {
  groupId: string;
  userId: string;
}

function BuilderChatInner({ groupId, userId }: BuilderChatInnerProps) {
  const [messages, setMessages] = useState<BuilderMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const context = useBuilderContext();

  const hasMessages = messages.length > 0;

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (content: string) => {
      // Add user message
      const userMessage: BuilderMessageType = {
        id: crypto.randomUUID(),
        role: "user",
        type: "text",
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        // Create assistant message placeholder for streaming
        const assistantMessageId = crypto.randomUUID();
        const assistantMessage: BuilderMessageType = {
          id: assistantMessageId,
          role: "assistant",
          type: "text",
          content: "",
          timestamp: new Date(),
          is_streaming: true,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Call the builder chat API
        const response = await fetch("/api/agent-studio/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            context: {
              agent_draft: context.agent_draft,
              workflow_draft: context.workflow_draft,
              tool_draft: context.tool_draft,
              group_id: groupId,
              user_id: userId,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            accumulatedContent += chunk;

            // Update streaming message
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, content: accumulatedContent }
                  : m
              )
            );
          }
        }

        // Finalize message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: accumulatedContent, is_streaming: false }
              : m
          )
        );
      } catch (error) {
        console.error("Error sending message:", error);

        // Add error message
        const errorMessage: BuilderMessageType = {
          id: crypto.randomUUID(),
          role: "assistant",
          type: "error",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
          error: error instanceof Error ? error.message : "Unknown error",
        };

        setMessages((prev) => {
          // Remove streaming placeholder if exists
          const filtered = prev.filter((m) => !m.is_streaming);
          return [...filtered, errorMessage];
        });
      } finally {
        setIsLoading(false);
      }
    },
    [messages, context, groupId, userId]
  );

  // Centered initial state
  if (!hasMessages) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-white mb-2">
            Agent Builder
          </h1>
          <p className="text-neutral-400">
            Build AI agents, tools, and workflows through conversation
          </p>
        </div>
        <ChatInput
          onSubmit={sendMessage}
          isLoading={isLoading}
          centered
          autoFocus
        />
      </div>
    );
  }

  // Full chat interface
  return (
    <div className="flex flex-col h-screen bg-neutral-950">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-neutral-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-medium">Agent Builder</h1>
            <p className="text-xs text-neutral-500">
              {context.editing_agent_id
                ? "Editing agent"
                : context.is_dirty
                ? "Draft in progress"
                : "Ready to build"}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
          {messages.map((message) => (
            <BuilderMessage key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-neutral-800 p-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSubmit={sendMessage}
            isLoading={isLoading}
            placeholder="Type a message..."
            autoFocus={false}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Exported Component with Provider
// ============================================================================

interface BuilderChatProps {
  groupId: string;
  userId: string;
}

export function BuilderChat({ groupId, userId }: BuilderChatProps) {
  return (
    <BuilderContextProvider groupId={groupId} userId={userId}>
      <BuilderChatInner groupId={groupId} userId={userId} />
    </BuilderContextProvider>
  );
}
