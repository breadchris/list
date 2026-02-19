"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { X, MessageSquare, Send, Square } from "lucide-react";
import { useWikiAIContext } from "./wiki-interface";
import ReactMarkdown from "react-markdown";

interface WikiChatPanelProps {
  id: string;
  isActive: boolean;
  index: number;
  onClose: () => void;
  onActivate: () => void;
  width?: number;
  onResize?: (width: number) => void;
  showResizeHandle?: boolean;
}

export function WikiChatPanel({
  id,
  isActive,
  index,
  onClose,
  onActivate,
  width,
  onResize,
  showResizeHandle = false,
}: WikiChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wikiAIContext = useWikiAIContext();

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } =
    useChat({
      api: "/api/wiki-chat",
      id,
      body: {},
      onFinish: () => {
        // Focus input after response
        textareaRef.current?.focus();
      },
      experimental_prepareRequestBody: async ({ messages }) => {
        const wiki_context =
          await wikiAIContext?.getSelectedAIContextMarkdown();
        return { messages, wiki_context };
      },
    });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input?.trim() && !isLoading) {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  return (
    <div
      className={`relative h-full flex flex-col bg-neutral-950 ${
        isActive ? "ring-1 ring-blue-500/30" : ""
      }`}
      style={{ width: width ? `${width}px` : undefined }}
      onClick={onActivate}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-400" />
          <span className="text-neutral-300 text-sm font-medium">Chat</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-8">
            <MessageSquare className="w-10 h-10 mb-3 text-neutral-600" />
            <p className="text-sm text-center">
              Ask questions about your wiki pages. Select pages for AI context
              using the brain icon on each panel.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`px-4 py-3 ${
                  message.role === "user"
                    ? "bg-neutral-900/50"
                    : "bg-neutral-950"
                }`}
              >
                <div className="text-xs text-neutral-500 mb-1">
                  {message.role === "user" ? "You" : "AI"}
                </div>
                <div className="text-sm text-neutral-200 prose prose-invert prose-sm max-w-none">
                  {message.role === "assistant" ? (
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading &&
              messages[messages.length - 1]?.role === "user" && (
                <div className="px-4 py-3">
                  <div className="flex gap-1">
                    <span
                      className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-neutral-800 p-3">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your wiki..."
            disabled={isLoading}
            rows={1}
            className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none disabled:opacity-50"
          />
          {isLoading ? (
            <button
              onClick={stop}
              className="flex-shrink-0 p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              title="Stop"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={(e) =>
                handleSubmit(
                  e as unknown as React.FormEvent<HTMLFormElement>
                )
              }
              disabled={!input?.trim()}
              className="flex-shrink-0 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              title="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="mt-1 text-xs text-neutral-600">
          Enter to send, Shift+Enter for new line
        </div>
      </div>

      {/* Resize handle */}
      {showResizeHandle && onResize && (
        <ResizeHandle currentWidth={width || 400} onResize={onResize} />
      )}
    </div>
  );
}

function ResizeHandle({
  currentWidth,
  onResize,
}: {
  currentWidth: number;
  onResize: (width: number) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const startWidth = currentWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.max(200, Math.min(800, startWidth + delta));
        onResize(newWidth);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [currentWidth, onResize]
  );

  return (
    <div
      className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors ${
        isDragging ? "bg-blue-500" : "bg-transparent"
      }`}
      onMouseDown={handleMouseDown}
    />
  );
}
