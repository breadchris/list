/**
 * useAgentStream Hook
 *
 * Unified hook for streaming agent responses, supporting both text and
 * structured output modes. Detects the output mode from response headers
 * and handles parsing appropriately.
 */

import { useState, useCallback, useRef } from "react";
import type { Agent, AgentOutputConfig, StructuredContent } from "@/types/agent-studio";

interface AgentStreamConfig {
  name: string;
  instructions: string;
  model_config: {
    provider: string;
    model: string;
    temperature: number;
  };
  output_config?: AgentOutputConfig;
}

interface UseAgentStreamOptions {
  agent: Agent;
  config: AgentStreamConfig;
  onTextChunk?: (chunk: string) => void;
  onObjectUpdate?: (partial: Record<string, unknown>) => void;
  onComplete?: (result: AgentStreamResult) => void;
  onError?: (error: Error) => void;
}

export interface AgentStreamResult {
  type: "text" | "structured";
  content: string;
  structuredData?: Record<string, unknown>;
  schema?: Record<string, unknown>;
}

interface FormSubmissionData {
  schema_id: string;
  values: Record<string, unknown>;
}

export function useAgentStream(options: UseAgentStreamOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [streamedObject, setStreamedObject] = useState<Record<string, unknown> | null>(null);
  const [outputMode, setOutputMode] = useState<"text" | "structured" | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(
    async (
      message: string,
      history: Array<{ role: "user" | "assistant"; content: string }>,
      formSubmission?: FormSubmissionData
    ) => {
      setIsLoading(true);
      setStreamedText("");
      setStreamedObject(null);
      setOutputMode(null);
      setError(null);

      abortRef.current = new AbortController();

      try {
        const response = await fetch("/api/agent-studio/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: options.agent.id,
            message,
            config: options.config,
            history,
            group_id: options.agent.group_id,
            user_id: options.agent.user_id,
            form_submission: formSubmission,
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Request failed: ${response.status} - ${errorText}`);
        }

        const mode = response.headers.get("X-Output-Mode");
        const isStructured = mode === "structured";
        setOutputMode(isStructured ? "structured" : "text");

        if (isStructured) {
          await handleStructuredStream(response, options.onObjectUpdate, setStreamedObject);
        } else {
          await handleTextStream(response, options.onTextChunk, setStreamedText);
        }

        // Build result
        const result: AgentStreamResult = isStructured
          ? {
              type: "structured",
              content: JSON.stringify(streamedObject),
              structuredData: streamedObject || undefined,
              schema: options.config.output_config?.schema,
            }
          : {
              type: "text",
              content: streamedText,
            };

        options.onComplete?.(result);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err);
          options.onError?.(err);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    execute,
    stop,
    isLoading,
    outputMode,
    streamedText,
    streamedObject,
    error,
  };
}

/**
 * Handle text streaming response
 */
async function handleTextStream(
  response: Response,
  onChunk?: (chunk: string) => void,
  setStreamedText?: React.Dispatch<React.SetStateAction<string>>
) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    accumulated += chunk;
    setStreamedText?.(accumulated);
    onChunk?.(chunk);
  }

  return accumulated;
}

/**
 * Handle structured object streaming response
 *
 * Vercel AI SDK's streamObject uses a specific protocol:
 * - Lines starting with "0:" contain text chunks
 * - Lines starting with "2:" contain object patches
 * - Lines starting with "d:" contain done signals
 */
async function handleStructuredStream(
  response: Response,
  onUpdate?: (partial: Record<string, unknown>) => void,
  setStreamedObject?: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>
) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentObject: Record<string, unknown> = {};

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete lines
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        // Parse Vercel AI SDK streaming format
        if (line.startsWith("0:")) {
          // Text content (reasoning/thinking) - ignore for now
          continue;
        } else if (line.startsWith("2:")) {
          // Object update
          const data = JSON.parse(line.slice(2));
          if (Array.isArray(data)) {
            // It's an array of patches
            for (const patch of data) {
              currentObject = applyObjectPatch(currentObject, patch);
            }
          } else {
            // Direct object replacement
            currentObject = data;
          }
          setStreamedObject?.({ ...currentObject });
          onUpdate?.({ ...currentObject });
        } else if (line.startsWith("d:")) {
          // Done signal
          continue;
        } else if (line.startsWith("e:")) {
          // Error
          const errorData = JSON.parse(line.slice(2));
          throw new Error(errorData.message || "Stream error");
        }
      } catch (parseError) {
        // Try parsing as raw JSON (fallback)
        try {
          const parsed = JSON.parse(line);
          currentObject = parsed;
          setStreamedObject?.({ ...currentObject });
          onUpdate?.({ ...currentObject });
        } catch {
          // Ignore unparseable lines
        }
      }
    }
  }

  return currentObject;
}

/**
 * Apply a JSON patch to an object
 * Supports simple path-based updates
 */
function applyObjectPatch(
  obj: Record<string, unknown>,
  patch: { path: string[]; value: unknown } | Record<string, unknown>
): Record<string, unknown> {
  if ("path" in patch && Array.isArray(patch.path)) {
    // Standard JSON patch format
    const result = { ...obj };
    let current: Record<string, unknown> = result;

    for (let i = 0; i < patch.path.length - 1; i++) {
      const key = patch.path[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current[key] = { ...(current[key] as Record<string, unknown>) };
      current = current[key] as Record<string, unknown>;
    }

    const lastKey = patch.path[patch.path.length - 1];
    current[lastKey] = patch.value;

    return result;
  }

  // Merge patch
  return { ...obj, ...patch };
}

/**
 * Hook for getting structured content from a message
 */
export function useStructuredContent(
  content: string | undefined,
  schema: Record<string, unknown> | undefined
): StructuredContent | null {
  if (!content || !schema) return null;

  try {
    const data = JSON.parse(content);
    return {
      type: "form",
      schema,
      data,
      is_complete: true,
    };
  } catch {
    return null;
  }
}
