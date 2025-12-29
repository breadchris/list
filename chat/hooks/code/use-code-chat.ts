import { useState, useCallback, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  CodeMessage,
  CodeChatState,
  UserMessage,
  AssistantMessage,
  TsxVersion,
  AttachedImage,
} from "@/components/code/types";

interface UseCodeChatOptions {
  sessionId: string;
  initialClaudeSessionId?: string; // Load from metadata on page mount
  initialMessages?: CodeMessage[]; // Load from metadata on page mount
  onVersionDetected?: (version: TsxVersion) => void;
  onClaudeSessionId?: (sessionId: string) => void; // Called when session ID is received
  onMessagesChange?: (messages: CodeMessage[]) => void; // Called when messages stabilize
}

export function useCodeChat({
  sessionId,
  initialClaudeSessionId,
  initialMessages,
  onVersionDetected,
  onClaudeSessionId,
  onMessagesChange,
}: UseCodeChatOptions) {
  const [state, setState] = useState<CodeChatState>({
    messages: initialMessages || [],
    isStreaming: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const claudeSessionIdRef = useRef<string | null>(initialClaudeSessionId ?? null);

  // Use ref for callback to avoid dependency cycles
  const onMessagesChangeRef = useRef(onMessagesChange);
  onMessagesChangeRef.current = onMessagesChange;

  // Track if we've made local changes (not just loaded initial messages)
  const hasLocalChangesRef = useRef(false);
  const prevStreamingRef = useRef(false);

  // Persist messages when streaming completes (transition from true → false)
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = state.isStreaming;

    // Only save when streaming just completed AND we have local changes
    if (wasStreaming && !state.isStreaming && hasLocalChangesRef.current) {
      onMessagesChangeRef.current?.(state.messages);
    }
  }, [state.isStreaming, state.messages]);

  // Parse TSX code blocks from assistant messages
  const parseTsxFromContent = useCallback(
    (content: string): { filename: string; code: string } | null => {
      // Match code blocks with tsx/typescript language
      const codeBlockRegex = /```(?:tsx|typescript|jsx)\n([\s\S]*?)```/g;
      const matches = [...content.matchAll(codeBlockRegex)];

      if (matches.length === 0) return null;

      // Get the last code block (usually the final version)
      const lastMatch = matches[matches.length - 1];
      const code = lastMatch[1].trim();

      // Try to extract filename from comments or default
      const filenameMatch = code.match(/\/\/\s*(\w+\.tsx)/);
      const filename = filenameMatch ? filenameMatch[1] : "Component.tsx";

      return { filename, code };
    },
    []
  );

  // Send a message to Claude Code
  const sendMessage = useCallback(
    async (prompt: string, images?: AttachedImage[]) => {
      if ((!prompt.trim() && (!images || images.length === 0)) || state.isStreaming) return;

      // Create user message
      const userMessage: UserMessage = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        type: "user",
        content: prompt,
        images,
      };

      // Mark that we have local changes to persist
      hasLocalChangesRef.current = true;

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isStreaming: true,
        error: null,
      }));

      // Create abort controller
      abortControllerRef.current = new AbortController();
      requestIdRef.current = uuidv4();

      try {
        const response = await fetch("/api/code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            image_ids: images?.map((img) => img.id),
            content_id: sessionId, // Supabase content ID for directory paths
            claude_session_id: claudeSessionIdRef.current, // Claude session for resume
            request_id: requestIdRef.current,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        console.log("SSE response received, starting to read stream...");

        // Read SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentAssistantContent = "";
        let currentAssistantMessageId: string | null = null;

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6);
            if (!jsonStr.trim()) continue;

            try {
              const event = JSON.parse(jsonStr);

              switch (event.type) {
                case "connected":
                  // Stream connected successfully
                  console.log("Claude Code stream connected:", event.data);
                  break;

                case "message":
                  if (event.data.type === "assistant") {
                    // Accumulate assistant content
                    currentAssistantContent += event.data.content;

                    if (!currentAssistantMessageId) {
                      currentAssistantMessageId = uuidv4();
                    }

                    // Update assistant message
                    const assistantMessage: AssistantMessage = {
                      id: currentAssistantMessageId!, // Non-null - we just assigned above
                      timestamp: new Date().toISOString(),
                      type: "assistant",
                      content: currentAssistantContent,
                    };

                    setState((prev) => {
                      const filtered = prev.messages.filter(
                        (m) => m.id !== currentAssistantMessageId
                      );
                      return {
                        ...prev,
                        messages: [...filtered, assistantMessage],
                      };
                    });
                  } else {
                    // System message
                    setState((prev) => ({
                      ...prev,
                      messages: [...prev.messages, event.data as CodeMessage],
                    }));
                  }
                  break;

                case "thinking":
                  setState((prev) => ({
                    ...prev,
                    messages: [...prev.messages, event.data as CodeMessage],
                  }));
                  break;

                case "tool":
                case "tool_result":
                  setState((prev) => ({
                    ...prev,
                    messages: [...prev.messages, event.data as CodeMessage],
                  }));
                  break;

                case "batch":
                  // Handle batch of messages
                  for (const msg of event.data) {
                    if (msg.data.type === "assistant") {
                      currentAssistantContent += msg.data.content;

                      if (!currentAssistantMessageId) {
                        currentAssistantMessageId = uuidv4();
                      }

                      setState((prev) => {
                        const filtered = prev.messages.filter(
                          (m) => m.id !== currentAssistantMessageId
                        );
                        const assistantMessage: AssistantMessage = {
                          id: currentAssistantMessageId!,
                          timestamp: new Date().toISOString(),
                          type: "assistant",
                          content: currentAssistantContent,
                        };
                        return {
                          ...prev,
                          messages: [...filtered, assistantMessage],
                        };
                      });
                    } else {
                      setState((prev) => ({
                        ...prev,
                        messages: [...prev.messages, msg.data as CodeMessage],
                      }));
                    }
                  }
                  break;

                case "done":
                  // Store Claude session ID for continuation
                  if (event.data.session_id) {
                    claudeSessionIdRef.current = event.data.session_id;
                    onClaudeSessionId?.(event.data.session_id);
                  }

                  // Check for TSX in final assistant content
                  if (currentAssistantContent) {
                    const tsx = parseTsxFromContent(currentAssistantContent);
                    if (tsx && onVersionDetected) {
                      // Simple transpilation using Sucrase (done in preview panel)
                      onVersionDetected({
                        id: uuidv4(),
                        timestamp: new Date().toISOString(),
                        prompt,
                        tsx_code: tsx.code,
                        compiled_js: "", // Will be compiled in preview panel
                        filename: tsx.filename,
                      });
                    }
                  }
                  break;

                case "file_change":
                  // File changed in the session directory (Component.tsx)
                  if (event.data.filename === "Component.tsx" && onVersionDetected) {
                    console.log("Component.tsx file change detected");
                    onVersionDetected({
                      id: uuidv4(),
                      timestamp: event.data.timestamp,
                      prompt: "File change detected",
                      tsx_code: event.data.content,
                      compiled_js: "", // Will be compiled in preview panel
                      filename: "Component.tsx",
                    });
                  }
                  break;

                case "error":
                  setState((prev) => ({
                    ...prev,
                    error: event.data.error,
                  }));
                  break;
              }
            } catch (parseError) {
              console.error("Failed to parse SSE event:", parseError);
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          // Request was cancelled
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                id: uuidv4(),
                timestamp: new Date().toISOString(),
                type: "system",
                content: "Request cancelled",
              },
            ],
          }));
        } else {
          console.error("Chat error:", error);
          setState((prev) => ({
            ...prev,
            error: error instanceof Error ? error.message : "Unknown error",
          }));
        }
      } finally {
        setState((prev) => ({
          ...prev,
          isStreaming: false,
        }));
        abortControllerRef.current = null;
        requestIdRef.current = null;
      }
    },
    [state.isStreaming, parseTsxFromContent, onVersionDetected]
  );

  // Cancel current request
  const cancelRequest = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Also notify server to stop the Claude process
    if (requestIdRef.current) {
      try {
        await fetch(`/api/code?request_id=${requestIdRef.current}`, {
          method: "DELETE",
        });
      } catch (error) {
        console.error("Failed to cancel request on server:", error);
      }
    }
  }, []);

  // Clear messages
  const clearMessages = useCallback(() => {
    setState({
      messages: [],
      isStreaming: false,
      error: null,
    });
    claudeSessionIdRef.current = null;
    hasLocalChangesRef.current = true;
    onMessagesChangeRef.current?.([]);
  }, []);

  return {
    messages: state.messages,
    isStreaming: state.isStreaming,
    error: state.error,
    claudeSessionId: claudeSessionIdRef.current,
    sendMessage,
    cancelRequest,
    clearMessages,
  };
}
