"use client";

import { useState } from "react";
import {
  User,
  Bot,
  Wrench,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Brain,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type {
  CodeMessage,
  UserMessage,
  AssistantMessage,
  ThinkingMessage,
  ToolMessage,
  ToolResultMessage,
  SystemMessage,
  ErrorMessage,
} from "@/components/code/types";

interface MessageProps<T extends CodeMessage> {
  message: T;
}

// User message component
export function UserMessageComponent({ message }: MessageProps<UserMessage>) {
  return (
    <div className="flex gap-3 p-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
        <User className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-neutral-400 mb-1">You</div>
        {/* Attached images */}
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.images.map((img) => (
              <a
                key={img.id}
                href={img.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={img.url}
                  alt={img.filename || "Attached image"}
                  className="max-w-48 max-h-48 object-cover rounded-lg border border-neutral-700 hover:border-neutral-500 transition-colors"
                />
              </a>
            ))}
          </div>
        )}
        <div className="text-neutral-100 whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    </div>
  );
}

// Assistant message component with markdown-like rendering
export function AssistantMessageComponent({
  message,
}: MessageProps<AssistantMessage>) {
  return (
    <div className="flex gap-3 p-4 bg-neutral-900/50">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-neutral-400 mb-1">Claude</div>
        <div className="text-neutral-100 prose prose-invert prose-sm max-w-none">
          <MarkdownContent content={message.content} />
        </div>
      </div>
    </div>
  );
}

// Simple markdown-like content renderer
function MarkdownContent({ content }: { content: string }) {
  // Split content into code blocks and text
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        if (part.startsWith("```")) {
          // Code block
          const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
          if (match) {
            const language = match[1] || "";
            const code = match[2].trim();
            return (
              <CodeBlock key={index} language={language} code={code} />
            );
          }
        }

        // Regular text with inline formatting
        return (
          <div key={index} className="whitespace-pre-wrap break-words">
            {part.split("\n").map((line, lineIndex) => (
              <p key={lineIndex} className="mb-1">
                {formatInlineCode(line)}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Format inline code (`code`)
function formatInlineCode(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="px-1 py-0.5 bg-neutral-800 rounded text-indigo-300 font-mono text-sm"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// Code block component
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-lg overflow-hidden bg-neutral-900 border border-neutral-800">
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-800 border-b border-neutral-700">
        <span className="text-xs text-neutral-400 font-mono">{language || "code"}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto">
        <code className="text-sm font-mono text-neutral-300">{code}</code>
      </pre>
    </div>
  );
}

// Thinking message component (collapsible)
export function ThinkingMessageComponent({
  message,
}: MessageProps<ThinkingMessage>) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-4 py-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-400 transition-colors"
      >
        <Brain className="w-4 h-4" />
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <span>Thinking...</span>
      </button>
      {expanded && (
        <div className="mt-2 pl-6 text-sm text-neutral-500 whitespace-pre-wrap">
          {message.content}
        </div>
      )}
    </div>
  );
}

// Tool message component
export function ToolMessageComponent({ message }: MessageProps<ToolMessage>) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-4 py-2 bg-neutral-900/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-amber-500"
      >
        <Wrench className="w-4 h-4" />
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <span className="font-mono">{message.tool_name}</span>
      </button>
      {expanded && (
        <div className="mt-2 pl-6">
          <pre className="text-xs text-neutral-400 font-mono overflow-x-auto">
            {JSON.stringify(message.input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Tool result message component
export function ToolResultMessageComponent({
  message,
}: MessageProps<ToolResultMessage>) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-4 py-2 bg-neutral-900/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 text-sm ${
          message.is_error ? "text-red-400" : "text-green-400"
        }`}
      >
        {message.is_error ? (
          <XCircle className="w-4 h-4" />
        ) : (
          <CheckCircle className="w-4 h-4" />
        )}
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <span className="font-mono">{message.tool_name} result</span>
      </button>
      {expanded && (
        <div className="mt-2 pl-6">
          <pre className="text-xs text-neutral-400 font-mono overflow-x-auto max-h-48 overflow-y-auto">
            {message.output}
          </pre>
        </div>
      )}
    </div>
  );
}

// System message component
export function SystemMessageComponent({
  message,
}: MessageProps<SystemMessage>) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-500">
      <Info className="w-4 h-4" />
      <span>{message.content}</span>
    </div>
  );
}

// Error message component
export function ErrorMessageComponent({ message }: MessageProps<ErrorMessage>) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 bg-red-900/10">
      <AlertCircle className="w-4 h-4" />
      <span>{message.content}</span>
    </div>
  );
}

// Main message renderer
export function CodeMessageRenderer({ message }: { message: CodeMessage }) {
  switch (message.type) {
    case "user":
      return <UserMessageComponent message={message} />;
    case "assistant":
      return <AssistantMessageComponent message={message} />;
    case "thinking":
      return <ThinkingMessageComponent message={message} />;
    case "tool":
      return <ToolMessageComponent message={message} />;
    case "tool_result":
      return <ToolResultMessageComponent message={message} />;
    case "system":
      return <SystemMessageComponent message={message} />;
    case "error":
      return <ErrorMessageComponent message={message} />;
    default:
      return null;
  }
}
