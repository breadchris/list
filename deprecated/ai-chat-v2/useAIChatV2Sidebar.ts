import { experimental_useObject as useObject } from "@ai-sdk/react";
import { useState } from "react";
import { z } from "zod";

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
  userMessage: string;
  assistantResponse: {
    answer: string;
    follow_up_questions: string[];
  } | null;
}>;

interface UseAIChatV2SidebarProps {
  pageContext: string;
}

/**
 * Hook for AI Chat V2 in the Chrome Extension sidebar with page context
 * Adapted from useAIChatV2.ts to work in the extension environment
 *
 * Differences from main app version:
 * - Includes pageContext in requests
 * - Uses chrome.storage for endpoint configuration
 * - Simplified history structure for sidebar UI
 */
export function useAIChatV2Sidebar({ pageContext }: UseAIChatV2SidebarProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatHistory>([]);
  const [lambdaEndpoint, setLambdaEndpoint] = useState("http://localhost:3002/lambda-proxy");

  // Load Lambda endpoint from chrome.storage on mount
  useState(() => {
    chrome.storage.sync.get(["lambdaEndpoint"], (result) => {
      if (result.lambdaEndpoint) {
        setLambdaEndpoint(result.lambdaEndpoint);
      }
    });
  });

  const { object, submit, isLoading, error } = useObject({
    api: `${lambdaEndpoint}/content`,
    schema: chatResponseSchema,
    body: {
      action: "chat-v2-stream",
      pageContext,
    },
    onFinish: ({ object: finishedObject }) => {
      // Add completed assistant response to latest history entry
      if (finishedObject) {
        setHistory((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (lastIndex >= 0) {
            updated[lastIndex] = {
              ...updated[lastIndex],
              assistantResponse: {
                answer: finishedObject.answer,
                follow_up_questions: finishedObject.follow_up_questions || [],
              },
            };
          }
          return updated;
        });
      }
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement> | { target: { value: string } }) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;

    // Add user message to history with null assistant response (will be filled on finish)
    setHistory((prev) => [
      ...prev,
      { userMessage, assistantResponse: null },
    ]);

    // Build messages array from history + current message
    const messages = history.flatMap((msg) => [
      { role: "user" as const, content: msg.userMessage },
      ...(msg.assistantResponse
        ? [{ role: "assistant" as const, content: msg.assistantResponse.answer }]
        : []),
    ]);

    messages.push({ role: "user" as const, content: userMessage });

    // Submit with messages array, action field, and page context
    submit({ action: "chat-v2-stream", messages, pageContext });

    setInput("");
  };

  return {
    input,
    handleInputChange,
    handleSubmit,
    history,
    currentResponse: object,
    isLoading,
    error,
  };
}
