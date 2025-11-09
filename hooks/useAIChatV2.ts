import { experimental_useObject as useObject } from "@ai-sdk/react";
import { useState } from "react";
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

type ChatHistory = Array<{
  role: "user" | "assistant";
  content: string;
  followUpQuestions?: string[];
}>;

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
export function useAIChatV2() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatHistory>([]);

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
          },
        ]);
      }
    },
  });

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
      { role: "user", content: userMessage },
    ]);

    // Build messages array from history + current message
    const messages = [
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user" as const, content: userMessage },
    ];

    // Submit with messages array and action field
    submit({ action: "chat-v2-stream", messages });

    setInput("");
  };

  const handleFollowUpClick = (question: string) => {
    // Add user message to history immediately for optimistic display
    setHistory((prev) => [
      ...prev,
      { role: "user", content: question },
    ]);

    // Build messages array from history + follow-up question
    const messages = [
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user" as const, content: question },
    ];

    submit({ action: "chat-v2-stream", messages });
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
  };
}
