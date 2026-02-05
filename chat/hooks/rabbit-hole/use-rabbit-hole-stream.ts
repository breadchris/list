import { useCallback, useState, useRef, useEffect } from "react";

interface UseRabbitHoleStreamOptions {
  onStreamComplete?: (content: string) => void;
  onStreamError?: (error: string) => void;
}

interface UseRabbitHoleStreamReturn {
  content: string;
  isStreaming: boolean;
  error: string | null;
  startStream: (query: string, context?: string, linkText?: string) => void;
  cancelStream: () => void;
}

export function useRabbitHoleStream(
  options: UseRabbitHoleStreamOptions = {}
): UseRabbitHoleStreamReturn {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { onStreamComplete, onStreamError } = options;

  // Use refs to always call the latest callbacks (avoids stale closure issues)
  const onStreamCompleteRef = useRef(onStreamComplete);
  const onStreamErrorRef = useRef(onStreamError);

  useEffect(() => {
    onStreamCompleteRef.current = onStreamComplete;
  }, [onStreamComplete]);

  useEffect(() => {
    onStreamErrorRef.current = onStreamError;
  }, [onStreamError]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const startStream = useCallback(
    async (query: string, context?: string, linkText?: string) => {
      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Reset state
      setContent("");
      setError(null);
      setIsStreaming(true);

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/rabbit-hole", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            context,
            link_text: linkText,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          setContent(accumulated);
        }

        setIsStreaming(false);
        onStreamCompleteRef.current?.(accumulated);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Stream was cancelled, don't treat as error
          setIsStreaming(false);
          return;
        }

        const errorMessage = err instanceof Error ? err.message : "Stream failed";
        setError(errorMessage);
        setIsStreaming(false);
        onStreamErrorRef.current?.(errorMessage);
      }
    },
    [] // No dependencies - uses refs for callbacks to avoid stale closures
  );

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  return {
    content,
    isStreaming,
    error,
    startStream,
    cancelStream,
  };
}
