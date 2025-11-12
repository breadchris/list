import { experimental_useObject as useObject } from "@ai-sdk/react";
import { useState, useEffect, useRef } from "react";
import { z } from "zod";

// Build-time constant (injected by esbuild Define)
// For local development, this points to the standalone Lambda server
// For production, this points to the AWS Lambda function URL
const BUILD_TIME_LAMBDA_ENDPOINT = LAMBDA_ENDPOINT;

// Schema matching the Lambda's chatResponseSchema
const chatResponseSchema = z.object({
  answer: z.string().describe("The AI assistant response to the user message"),
  follow_up_questions: z
    .array(z.string())
    .describe(
      "3-5 relevant follow-up questions the user might want to ask next",
    ),
});

export type ChatHistory = Array<{
  role: "user" | "assistant";
  content: string;
  followUpQuestions?: string[];
  timestamp?: string;
}>;

export interface UseAIChatV2Options {
  initialHistory?: ChatHistory;
  onHistoryChange?: (history: ChatHistory) => void;
  basePrompt?: string; // Custom system prompt for this chat session
  onBasePromptChange?: (basePrompt: string) => void;
}

/**
 * Hook for AI Chat V2 with streaming support via Vercel AI SDK
 * Uses `useObject` hook to stream structured chat responses from Lambda
 *
 * The Lambda handler uses streamObject() to return structured responses with:
 * - answer: The AI response text
 * - follow_up_questions: Array of suggested follow-up questions
 *
 * The API endpoint is injected at build time via esbuild Define, allowing
 * different builds for dev (local Lambda) and production (AWS Lambda)
 *
 * For local standalone Lambda testing:
 * 1. Start standalone Lambda: go run . local --skip-supabase --standalone-lambda
 * 2. Lambda runs on http://localhost:9001
 * 3. Frontend sends to http://localhost:3002/lambda-proxy which proxies to Lambda
 */
export function useAIChatV2(options?: UseAIChatV2Options) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatHistory>(
    options?.initialHistory || [],
  );
  const [basePrompt, setBasePrompt] = useState<string>(
    options?.basePrompt || "",
  );

  // Ref to track latest history state (prevents stale closures)
  const historyRef = useRef<ChatHistory>([]);

  // Destructure callbacks to stable references (prevents unnecessary effect triggers)
  const { onHistoryChange, onBasePromptChange } = options || {};

  // Keep ref in sync with history state
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const { object, submit, isLoading, error } = useObject({
    api: `${BUILD_TIME_LAMBDA_ENDPOINT}/content`,
    schema: chatResponseSchema,
    body: {
      action: "chat-v2-stream",
    },
    onFinish: ({ object: finishedObject }) => {
      // Add completed assistant response to history
      if (finishedObject) {
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            content: finishedObject.answer,
            followUpQuestions: finishedObject.follow_up_questions,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    },
  });

  // Notify parent of history changes (using destructured callback for stable dependency)
  useEffect(() => {
    if (onHistoryChange && history.length > 0) {
      onHistoryChange(history);
    }
  }, [history, onHistoryChange]);

  // Notify parent of base prompt changes (using destructured callback for stable dependency)
  useEffect(() => {
    if (onBasePromptChange) {
      onBasePromptChange(basePrompt);
    }
  }, [basePrompt, onBasePromptChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;

    // Add user message to history immediately for optimistic display
    setHistory((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
      },
    ]);

    // Build messages array from history + current message
    const messages = [
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user" as const, content: userMessage },
    ];

    // Prepend system message if base prompt is provided
    const messagesWithSystem = basePrompt
      ? [{ role: "assistant" as const, content: basePrompt }, ...messages]
      : messages;

    // Submit with messages array and action field
    submit({
      action: "chat-v2-stream",
      messages: messagesWithSystem,
    });

    setInput("");
  };

  const handleFollowUpClick = (question: string) => {
    // Add user message to history immediately for optimistic display
    setHistory((prev) => [
      ...prev,
      {
        role: "user",
        content: question,
        timestamp: new Date().toISOString(),
      },
    ]);

    // Use historyRef to get latest history state (prevents stale closure)
    const messages = [
      ...historyRef.current.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user" as const, content: question },
    ];

    // Prepend system message if base prompt is provided
    const messagesWithSystem = basePrompt
      ? [{ role: "system" as const, content: basePrompt }, ...messages]
      : messages;

    // Submit with messages array and action field
    submit({
      action: "chat-v2-stream",
      messages: messagesWithSystem,
    });
    setInput("");
  };

  return {
    input,
    handleInputChange,
    handleSubmit,
    handleFollowUpClick,
    history,
    currentResponse: object,
    isLoading,
    error,
    basePrompt,
    setBasePrompt,
  };
}
