import { experimental_useObject as useObject } from "@ai-sdk/react";
import { useState, useEffect, useCallback } from "react";
import { z } from "zod";
import { ContentRepository, Content } from "../components/ContentRepository";

// Build-time constant (injected by esbuild Define)
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

export interface BranchingMessage {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: string;
  parentId: string | null;
  branchLabel?: string;
  createdAt: number;
  followUpQuestions?: string[];
  isStreaming?: boolean;
  isCollapsed?: boolean;
}

export interface UseBranchingChatOptions {
  groupId: string;
  chatRootId: string | null; // Content item that is the root of this chat tree
  basePrompt?: string;
}

/**
 * Hook for branching chat with Vercel AI SDK streaming
 * Combines tree structure navigation with real-time AI streaming
 */
export function useBranchingChat(options: UseBranchingChatOptions) {
  const { groupId, chatRootId, basePrompt = "" } = options;

  const [messages, setMessages] = useState<BranchingMessage[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>(["root"]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  const repository = new ContentRepository();

  // Load message tree from Supabase
  const loadMessageTree = useCallback(async () => {
    if (!chatRootId) {
      setIsLoadingMessages(false);
      return;
    }

    try {
      setIsLoadingMessages(true);

      // Load all messages in the chat tree
      const contentItems = await repository.loadChatTree(chatRootId);

      // Convert to BranchingMessage format
      const branchingMessages: BranchingMessage[] = contentItems.map((item) => ({
        id: item.id,
        text: item.data,
        sender: item.metadata?.sender || "user",
        timestamp: item.created_at,
        parentId: item.parent_content_id,
        branchLabel: item.metadata?.branch_label,
        createdAt: item.metadata?.created_at_ms || new Date(item.created_at).getTime(),
        followUpQuestions: item.metadata?.follow_up_questions,
        isCollapsed: false,
      }));

      setMessages(branchingMessages);

      // Set current path to the longest branch (most recent conversation)
      if (branchingMessages.length > 0) {
        const path = findLongestPath(branchingMessages);
        setCurrentPath(path);
      }
    } catch (error) {
      console.error("Failed to load chat tree:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [chatRootId]);

  // Load messages on mount
  useEffect(() => {
    loadMessageTree();
  }, [loadMessageTree]);

  // Find the longest path in the message tree (most recent conversation)
  const findLongestPath = (msgs: BranchingMessage[]): string[] => {
    const paths: string[][] = [];

    const buildPath = (messageId: string | null): string[] => {
      if (!messageId || messageId === "root") return ["root"];

      const message = msgs.find((m) => m.id === messageId);
      if (!message) return ["root"];

      const parentPath = buildPath(message.parentId);
      return [...parentPath, message.id];
    };

    // Find all leaf nodes (messages with no children)
    const leafNodes = msgs.filter((m) =>
      !msgs.some((other) => other.parentId === m.id)
    );

    // Build paths for all leaf nodes
    leafNodes.forEach((leaf) => {
      paths.push(buildPath(leaf.id));
    });

    // Return the longest path
    return paths.length > 0
      ? paths.reduce((a, b) => (a.length > b.length ? a : b))
      : ["root"];
  };

  // Get siblings for a message (alternative branches at same point)
  const getSiblingsForMessage = (messageId: string): BranchingMessage[] => {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return [];

    return messages.filter(
      (m) => m.parentId === message.parentId && m.sender === message.sender
    ).sort((a, b) => a.createdAt - b.createdAt);
  };

  // Switch to a different branch
  const switchToBranch = (messageId: string) => {
    // Build path from root to this message and continue to end of branch
    const buildPathToEnd = (id: string | null): string[] => {
      if (!id || id === "root") return ["root"];

      const message = messages.find((m) => m.id === id);
      if (!message) return ["root"];

      const parentPath = buildPathToEnd(message.parentId);

      // Find children of this message
      const children = messages.filter((m) => m.parentId === id);

      if (children.length === 0) {
        // Leaf node
        return [...parentPath, id];
      }

      // Continue with most recent child
      const mostRecentChild = children.sort((a, b) => b.createdAt - a.createdAt)[0];
      return buildPathToEnd(mostRecentChild.id);
    };

    const newPath = buildPathToEnd(messageId);
    setCurrentPath(newPath);
  };

  // Build message history for AI context
  const buildMessageHistory = (): Array<{ role: "user" | "assistant"; content: string }> => {
    const history: Array<{ role: "user" | "assistant"; content: string }> = [];

    // Follow current path (excluding root)
    for (const messageId of currentPath) {
      if (messageId === "root") continue;

      const message = messages.find((m) => m.id === messageId);
      if (message) {
        history.push({
          role: message.sender,
          content: message.text,
        });
      }
    }

    return history;
  };

  const { object: currentResponse, submit, error } = useObject({
    api: `${BUILD_TIME_LAMBDA_ENDPOINT}/content`,
    schema: chatResponseSchema,
    body: {
      action: "chat-v2-stream",
    },
    onFinish: async ({ object: finishedObject }) => {
      if (!finishedObject || !groupId || !chatRootId) return;

      setIsLoading(false);

      try {
        // Get the last user message ID from current path
        const lastUserMessageId = currentPath[currentPath.length - 1];

        // Save assistant message to Supabase
        const assistantMessage = await repository.createChatMessage({
          groupId,
          parentContentId: lastUserMessageId === "root" ? chatRootId : lastUserMessageId,
          data: finishedObject.answer,
          metadata: {
            sender: "assistant",
            follow_up_questions: finishedObject.follow_up_questions,
            created_at_ms: Date.now(),
          },
        });

        // Add to messages array
        const newMessage: BranchingMessage = {
          id: assistantMessage.id,
          text: finishedObject.answer,
          sender: "assistant",
          timestamp: assistantMessage.created_at,
          parentId: lastUserMessageId === "root" ? chatRootId : lastUserMessageId,
          createdAt: Date.now(),
          followUpQuestions: finishedObject.follow_up_questions,
          isCollapsed: false,
        };

        setMessages((prev) => [...prev, newMessage]);
        setCurrentPath((prev) => [...prev, newMessage.id]);
      } catch (error) {
        console.error("Failed to save assistant message:", error);
      }
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !groupId || !chatRootId) return;

    const userMessage = input;
    setInput("");
    setIsLoading(true);

    try {
      // Get parent message ID (last message in current path)
      const parentMessageId = currentPath[currentPath.length - 1];

      // Save user message to Supabase
      const userMessageContent = await repository.createChatMessage({
        groupId,
        parentContentId: parentMessageId === "root" ? chatRootId : parentMessageId,
        data: userMessage,
        metadata: {
          sender: "user",
          created_at_ms: Date.now(),
        },
      });

      // Add to messages array
      const newUserMessage: BranchingMessage = {
        id: userMessageContent.id,
        text: userMessage,
        sender: "user",
        timestamp: userMessageContent.created_at,
        parentId: parentMessageId === "root" ? chatRootId : parentMessageId,
        createdAt: Date.now(),
        isCollapsed: false,
      };

      setMessages((prev) => [...prev, newUserMessage]);
      setCurrentPath((prev) => [...prev, newUserMessage.id]);

      // Build message history for AI
      const history = buildMessageHistory();

      // Submit to Lambda for streaming
      submit({
        action: "chat-v2-stream",
        messages: [
          ...history,
          { role: "user" as const, content: userMessage },
        ],
        ...(basePrompt && { base_prompt: basePrompt }),
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      setIsLoading(false);
    }
  };

  // Edit message (creates a new branch)
  const editMessage = async (messageId: string, newText: string) => {
    const originalMessage = messages.find((m) => m.id === messageId);
    if (!originalMessage || !groupId || !chatRootId) return;

    try {
      setIsLoading(true);

      // Get siblings to determine branch label
      const siblings = getSiblingsForMessage(messageId);
      const branchLabel = siblings.length === 1 ? "Branch 1" : `Branch ${siblings.length}`;

      // Label original as "Original" if not already labeled
      if (!originalMessage.branchLabel) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, branchLabel: "Original" } : m
          )
        );
      }

      // Create edited message as sibling
      const editedMessageContent = await repository.createChatMessage({
        groupId,
        parentContentId: originalMessage.parentId,
        data: newText,
        metadata: {
          sender: "user",
          branch_label: branchLabel,
          created_at_ms: Date.now(),
        },
      });

      const editedMessage: BranchingMessage = {
        id: editedMessageContent.id,
        text: newText,
        sender: "user",
        timestamp: editedMessageContent.created_at,
        parentId: originalMessage.parentId,
        branchLabel,
        createdAt: Date.now(),
        isCollapsed: false,
      };

      setMessages((prev) => [...prev, editedMessage]);

      // Switch to new branch (update path)
      const pathToParent = currentPath.slice(0, currentPath.indexOf(messageId));
      setCurrentPath([...pathToParent, editedMessage.id]);

      // Get AI response for edited message
      const historyUpToEdit = pathToParent
        .filter((id) => id !== "root")
        .map((id) => {
          const msg = messages.find((m) => m.id === id);
          return msg ? { role: msg.sender, content: msg.text } : null;
        })
        .filter((msg): msg is { role: "user" | "assistant"; content: string } => msg !== null);

      submit({
        action: "chat-v2-stream",
        messages: [
          ...historyUpToEdit,
          { role: "user" as const, content: newText },
        ],
        ...(basePrompt && { base_prompt: basePrompt }),
      });
    } catch (error) {
      console.error("Failed to edit message:", error);
      setIsLoading(false);
    }
  };

  return {
    messages,
    currentPath,
    input,
    handleInputChange,
    handleSubmit,
    currentResponse,
    isLoading,
    isLoadingMessages,
    error,
    getSiblingsForMessage,
    switchToBranch,
    editMessage,
    setMessages, // For UI state updates (collapse/expand)
  };
}
