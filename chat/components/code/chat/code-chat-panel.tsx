"use client";

import { CodeChatMessages } from "./code-chat-messages";
import { CodeChatInput } from "./code-chat-input";
import type { CodeMessage, TsxVersion } from "@/components/code/types";
import { useCodeChat } from "@/hooks/code/use-code-chat";

interface CodeChatPanelProps {
  sessionId: string;
  groupId: string;
  initialClaudeSessionId?: string;
  initialMessages?: CodeMessage[];
  onVersionDetected: (version: TsxVersion) => void;
  onClaudeSessionId?: (sessionId: string) => void;
  onMessagesChange?: (messages: CodeMessage[]) => void;
}

export function CodeChatPanel({
  sessionId,
  groupId,
  initialClaudeSessionId,
  initialMessages,
  onVersionDetected,
  onClaudeSessionId,
  onMessagesChange,
}: CodeChatPanelProps) {
  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    cancelRequest,
  } = useCodeChat({
    sessionId,
    initialClaudeSessionId,
    initialMessages,
    onVersionDetected,
    onClaudeSessionId,
    onMessagesChange,
  });

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-900/20 border-b border-red-800/50 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Messages */}
      <CodeChatMessages messages={messages} isStreaming={isStreaming} />

      {/* Input */}
      <CodeChatInput
        onSend={sendMessage}
        onCancel={cancelRequest}
        isStreaming={isStreaming}
        groupId={groupId}
        sessionId={sessionId}
      />
    </div>
  );
}
