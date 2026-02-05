import { useState, useEffect, useCallback } from "react";
import { AIExtension } from "@blocknote/xl-ai";
import type { BlockNoteEditor } from "@blocknote/core";

type AIStatus = "thinking" | "ai-writing" | "user-input" | "user-reviewing" | "error" | "closed";

interface UseBlockNoteAIStatusResult {
  /** Whether AI is currently processing (thinking or writing) */
  isAIActive: boolean;
  /** Current AI status, null if closed */
  status: AIStatus | null;
  /** Cancel the current AI operation */
  cancel: () => void;
}

/**
 * Hook to track BlockNote AI extension status and provide cancel functionality
 */
export function useBlockNoteAIStatus(
  editor: BlockNoteEditor<any, any, any> | null
): UseBlockNoteAIStatusResult {
  const [status, setStatus] = useState<AIStatus | null>(null);

  useEffect(() => {
    if (!editor) {
      setStatus(null);
      return;
    }

    const aiExtension = editor.getExtension(AIExtension);
    if (!aiExtension) {
      setStatus(null);
      return;
    }

    // Get initial state - TanStack store uses .state property
    const initialState = aiExtension.store.state;
    if (initialState.aiMenuState === "closed") {
      setStatus(null);
    } else {
      setStatus(initialState.aiMenuState.status);
    }

    // Subscribe to state changes - TanStack store listener receives { prevVal, currentVal }
    const unsubscribe = aiExtension.store.subscribe(({ currentVal }) => {
      if (currentVal.aiMenuState === "closed") {
        setStatus(null);
      } else {
        setStatus(currentVal.aiMenuState.status);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [editor]);

  const cancel = useCallback(() => {
    if (!editor) return;

    const aiExtension = editor.getExtension(AIExtension);
    if (!aiExtension) return;

    // Only abort if there's an active request - use .state property
    const currentState = aiExtension.store.state;
    if (
      currentState.aiMenuState !== "closed" &&
      (currentState.aiMenuState.status === "thinking" || currentState.aiMenuState.status === "ai-writing")
    ) {
      aiExtension.abort("User cancelled");
      // Close the AI menu to fully reset editor state
      aiExtension.closeAIMenu();
    }
  }, [editor]);

  const isAIActive = status === "thinking" || status === "ai-writing";

  return {
    isAIActive,
    status,
    cancel,
  };
}
