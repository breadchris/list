"use client";

/**
 * Embedded Playground
 *
 * A mini chat interface for testing agents inline within the builder chat.
 */

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User, AlertCircle, Trash2 } from "lucide-react";
import { useBuilderContext } from "../builder-context";
import { agentRepository } from "@/lib/agent-studio/AgentRepository";
import type { Agent, AgentMetadata, DEFAULT_AGENT_METADATA } from "@/types/agent-studio";

interface PlaygroundMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  error?: string;
}

interface EmbeddedPlaygroundProps {
  props: {
    agent_id?: string;
    use_draft?: boolean;
  };
  instanceId: string;
}

export function EmbeddedPlayground({ props, instanceId }: EmbeddedPlaygroundProps) {
  const { group_id, user_id, agent_draft, editing_agent_id } = useBuilderContext();
  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Determine which agent to use
  const agentId = props.agent_id || editing_agent_id;
  const useDraft = props.use_draft !== false; // Default to true

  // Load agent data
  useEffect(() => {
    const loadAgent = async () => {
      setLoadingAgent(true);
      setError(null);

      try {
        if (agentId) {
          // Try to load existing agent
          const data = await agentRepository.getAgent(agentId);
          if (data) {
            setAgent(data);
          } else if (useDraft && agent_draft) {
            // Agent doesn't exist yet (not saved), use draft configuration
            setAgent({
              id: "draft",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              type: "agent",
              data: agent_draft.model_config?.model || "Draft Agent",
              group_id,
              user_id,
              metadata: {
                model_config: agent_draft.model_config || {
                  provider: "openai",
                  model: "gpt-4o",
                  temperature: 0.7,
                },
                instructions: agent_draft.instructions || "You are a helpful AI assistant.",
                tool_ids: agent_draft.tool_ids || [],
                ...agent_draft,
              } as AgentMetadata,
            });
          } else {
            setError("Agent not found. Create or load an agent first.");
          }
        } else if (useDraft && agent_draft) {
          // Use draft configuration as a temporary agent
          setAgent({
            id: "draft",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            type: "agent",
            data: agent_draft.model_config?.model || "Draft Agent",
            group_id,
            user_id,
            metadata: {
              model_config: agent_draft.model_config || {
                provider: "openai",
                model: "gpt-4o",
                temperature: 0.7,
              },
              instructions: agent_draft.instructions || "You are a helpful AI assistant.",
              tool_ids: agent_draft.tool_ids || [],
              ...agent_draft,
            } as AgentMetadata,
          });
        } else {
          setError("No agent selected. Create or load an agent first.");
        }
      } catch (err) {
        console.error("Error loading agent:", err);
        setError("Failed to load agent");
      } finally {
        setLoadingAgent(false);
      }
    };

    loadAgent();
  }, [agentId, useDraft, agent_draft, group_id, user_id]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 100)}px`;
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !agent) return;

    const userMessage: PlaygroundMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
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
        isStreaming: true,
      },
    ]);

    try {
      const response = await fetch("/api/agent-studio/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agent.id === "draft" ? undefined : agent.id,
          message: userMessage.content,
          config: {
            name: agent.data,
            instructions: agent.metadata.instructions,
            model_config: agent.metadata.model_config,
            output_config: agent.metadata.output_config,
          },
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          group_id,
          user_id,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

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
                ? { ...m, content: fullContent }
                : m
            )
          );
        }
      }

      // Check if response is empty (likely an API error)
      if (!fullContent.trim()) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content: "",
                  isStreaming: false,
                  error: "No response received. Check that the model configuration is valid.",
                }
              : m
          )
        );
      } else {
        // Mark as done streaming
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, isStreaming: false }
              : m
          )
        );
      }
    } catch (err) {
      console.error("Error executing agent:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: "",
                isStreaming: false,
                error: err instanceof Error ? err.message : "Failed to execute agent",
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  if (loadingAgent) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-800">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-neutral-200">Agent Playground</span>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-neutral-600 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-800">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-neutral-200">Agent Playground</span>
        </div>
        <div className="text-center py-6">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-neutral-600" />
          <p className="text-sm text-neutral-400">{error || "No agent available"}</p>
          <p className="text-xs text-neutral-500 mt-1">
            Configure an agent first or select one to test
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-700 overflow-hidden bg-neutral-900/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-neutral-200">Test Agent</span>
          <span className="px-2 py-0.5 text-xs bg-neutral-800 rounded text-neutral-400">
            {agent.metadata.model_config.provider}/{agent.metadata.model_config.model}
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-500 hover:text-neutral-300 transition-colors"
            title="Clear messages"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="max-h-64 overflow-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-neutral-500">Send a message to test the agent</p>
            {agent.id === "draft" && (
              <p className="text-xs text-amber-500 mt-1">Using draft configuration</p>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === "user" ? "bg-neutral-700" : "bg-cyan-500/20"
                }`}
              >
                {message.role === "user" ? (
                  <User className="w-3 h-3 text-neutral-300" />
                ) : (
                  <Bot className="w-3 h-3 text-cyan-400" />
                )}
              </div>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                  message.role === "user"
                    ? "bg-cyan-600 text-white"
                    : message.error
                    ? "bg-red-900/50 text-red-200"
                    : "bg-neutral-800 text-neutral-100"
                }`}
              >
                {message.error ? (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{message.error}</span>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.isStreaming && !message.content && (
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    )}
                    {message.isStreaming && message.content && (
                      <span className="inline-block w-1.5 h-3 bg-current animate-pulse ml-0.5" />
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-neutral-800 bg-neutral-900">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message to test..."
            className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none min-h-[36px] max-h-[100px]"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
