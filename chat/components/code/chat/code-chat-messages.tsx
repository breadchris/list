"use client";

import { useRef, useEffect } from "react";
import { Code2, MessageSquare } from "lucide-react";
import { CodeMessageRenderer } from "./code-message-components";
import type { CodeMessage } from "@/components/code/types";

interface CodeChatMessagesProps {
  messages: CodeMessage[];
  isStreaming: boolean;
}

export function CodeChatMessages({ messages, isStreaming }: CodeChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 p-8">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
          <Code2 className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-lg font-medium text-neutral-300 mb-2">
          Start building
        </h3>
        <p className="text-center text-sm max-w-md">
          Describe the component you want to create. Claude will generate TSX
          code and you can preview it in real-time.
        </p>
        <div className="mt-6 space-y-2 text-sm text-left">
          <p className="text-neutral-400">Try something like:</p>
          <ul className="space-y-1 text-neutral-500">
            <li>&quot;Create a todo list with add and delete&quot;</li>
            <li>&quot;Build a weather card component&quot;</li>
            <li>&quot;Make a pricing table with 3 tiers&quot;</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="divide-y divide-neutral-800/50">
        {messages.map((message) => (
          <CodeMessageRenderer key={message.id} message={message} />
        ))}
      </div>

      {/* Streaming indicator at the end */}
      {isStreaming && messages.length > 0 && (
        <div className="p-4 text-neutral-500 text-sm flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
}
