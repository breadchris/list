"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Trash2, Loader2, User, Bot, AlertCircle } from "lucide-react";
import type { Agent, AgentModelConfig, AgentOutputConfig, LLMProvider } from "@/types/agent-studio";
import { StructuredMessage, isStructuredContent } from "./structured-output";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  error?: string;
  // Structured output fields
  isStructured?: boolean;
  schema?: Record<string, unknown>;
  formSubmitted?: boolean;
}

interface AgentPlaygroundProps {
  agent: Agent;
  currentConfig: {
    name: string;
    instructions: string;
    model_config: {
      provider: LLMProvider;
      model: string;
      temperature: number;
    };
    output_config?: AgentOutputConfig;
  };
}

export function AgentPlayground({ agent, currentConfig }: AgentPlaygroundProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check if structured output is enabled
  const hasStructuredOutput =
    currentConfig.output_config?.enabled &&
    currentConfig.output_config?.schema &&
    Object.keys(currentConfig.output_config.schema).length > 0;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSend = async (formSubmission?: { schema_id: string; values: Record<string, unknown> }) => {
    if ((!input.trim() && !formSubmission) || isLoading) return;

    const userContent = formSubmission
      ? `[Form Submitted]\n${JSON.stringify(formSubmission.values, null, 2)}`
      : input.trim();

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userContent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Add streaming placeholder
    const assistantMessageId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
        isStructured: hasStructuredOutput,
        schema: hasStructuredOutput ? currentConfig.output_config?.schema : undefined,
      },
    ]);

    try {
      // Call the agent execution API
      const response = await fetch("/api/agent-studio/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agent.id,
          message: formSubmission ? input.trim() || "Process the submitted form" : userMessage.content,
          config: currentConfig,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          // Include trace data
          group_id: agent.group_id,
          user_id: agent.user_id,
          form_submission: formSubmission,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Check if response is structured
      const outputMode = response.headers.get("X-Output-Mode");
      const isStructuredResponse = outputMode === "structured";

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          fullContent += chunk;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: fullContent,
                    isStructured: isStructuredResponse,
                    schema: isStructuredResponse ? currentConfig.output_config?.schema : undefined,
                  }
                : m
            )
          );
        }
      }

      // Mark as done streaming
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, isStreaming: false }
            : m
        )
      );
    } catch (error) {
      console.error("Error executing agent:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: "",
                isStreaming: false,
                isStructured: false,
                error: error instanceof Error ? error.message : "Failed to execute agent",
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission from structured message
  const handleFormSubmit = useCallback(
    (messageId: string, values: Record<string, unknown>) => {
      // Mark the form as submitted
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, formSubmitted: true } : m
        )
      );

      // Send the form values back to the agent
      handleSend({
        schema_id: currentConfig.output_config?.schema?.title as string || "form",
        values,
      });
    },
    [currentConfig.output_config?.schema]
  );

  // Handle AI autofill request
  const handleAutofillRequest = useCallback(
    async (fieldName: string, fieldContext: string): Promise<unknown> => {
      try {
        const response = await fetch("/api/agent-studio/autofill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field_name: fieldName,
            field_context: fieldContext,
            conversation_context: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            model_config: currentConfig.model_config,
          }),
        });

        if (!response.ok) {
          throw new Error("Autofill request failed");
        }

        const { suggestion } = await response.json();
        return suggestion;
      } catch (error) {
        console.error("Autofill error:", error);
        return undefined;
      }
    },
    [messages, currentConfig.model_config]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-300">
            Test Playground
          </span>
          <span className="px-2 py-0.5 text-xs bg-neutral-800 rounded text-neutral-400">
            {currentConfig.model_config.provider}/{currentConfig.model_config.model}
          </span>
        </div>
        <button
          onClick={clearMessages}
          className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200"
          title="Clear messages"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500">
            <Bot className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">Send a message to test your agent</p>
            <p className="text-xs mt-1">
              Using: {currentConfig.model_config.model}
            </p>
            {hasStructuredOutput && (
              <p className="text-xs mt-1 text-cyan-400">
                Structured output enabled
              </p>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              formConfig={currentConfig.output_config?.form_config}
              onFormSubmit={
                message.isStructured && message.schema && !message.formSubmitted
                  ? (values) => handleFormSubmit(message.id, values)
                  : undefined
              }
              onAutofillRequest={handleAutofillRequest}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-neutral-800">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none min-h-[40px] max-h-[150px]"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  formConfig?: import("@/types/agent-studio").FormConfig;
  onFormSubmit?: (values: Record<string, unknown>) => void;
  onAutofillRequest?: (fieldName: string, fieldContext: string) => Promise<unknown>;
}

function MessageBubble({ message, formConfig, onFormSubmit, onAutofillRequest }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const showStructuredOutput =
    !isUser && message.isStructured && message.schema && message.content;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? "bg-neutral-700" : "bg-cyan-500/20"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-neutral-300" />
        ) : (
          <Bot className="w-4 h-4 text-cyan-400" />
        )}
      </div>
      <div
        className={`max-w-[80%] ${
          showStructuredOutput
            ? "" // StructuredMessage has its own styling
            : `px-4 py-2 rounded-lg ${
                isUser
                  ? "bg-cyan-600 text-white"
                  : message.error
                  ? "bg-red-900/50 text-red-200"
                  : "bg-neutral-800 text-neutral-100"
              }`
        }`}
      >
        {message.error ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-900/50 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span>{message.error}</span>
          </div>
        ) : showStructuredOutput ? (
          <StructuredMessage
            content={message.content}
            schema={message.schema!}
            isStreaming={message.isStreaming || false}
            formConfig={formConfig}
            onSubmit={onFormSubmit}
            onAutofillRequest={onAutofillRequest}
          />
        ) : (
          <>
            <p className="whitespace-pre-wrap">{message.content}</p>
            {message.isStreaming && (
              <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
            )}
          </>
        )}
        {message.formSubmitted && (
          <p className="text-xs text-neutral-500 mt-2 italic">Form submitted</p>
        )}
      </div>
    </div>
  );
}
