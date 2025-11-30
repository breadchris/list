"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Doc } from "yjs";
import {
  BotInvocationQueue,
  generateId,
  getCurrentTime,
  type BotInvocation,
} from "@/lib/bot-queue";
import type { BotConfig } from "@/lib/bots.config";
import { ObjectBotHandler } from "./object-bot-handler";

interface Message {
  id: string;
  username: string;
  timestamp: string;
  content: string;
  thread_ids?: string[];
}

interface Thread {
  id: string;
  parent_message_id: string;
  message_ids: string[];
}

interface YArray<T> {
  push: (items: T[]) => void;
  toArray: () => T[];
  delete: (index: number, length: number) => void;
  insert: (index: number, items: T[]) => void;
}

interface BotQueueContextValue {
  /**
   * Dispatch a bot invocation to the queue
   */
  dispatch: (params: {
    bot: BotConfig;
    prompt: string;
    trigger_message_id: string;
    existing_thread_id?: string;
    context_messages: Array<{ username: string; content: string }>;
  }) => string;
}

const BotQueueContext = createContext<BotQueueContextValue | null>(null);

interface BotQueueProviderProps {
  children: ReactNode;
  doc: Doc;
  messagesArray: YArray<Message>;
  threadsArray: YArray<Thread>;
}

/**
 * BotQueueProvider manages bot invocations with an event queue architecture.
 *
 * Key features:
 * - Parallel processing of multiple bot invocations
 * - Eager thread creation before processing starts
 * - Independent of React render cycles (no dependency array issues)
 */
export function BotQueueProvider({
  children,
  doc,
  messagesArray,
  threadsArray,
}: BotQueueProviderProps) {
  // Singleton queue instance - stable across renders
  const queueRef = useRef<BotInvocationQueue | null>(null);
  if (!queueRef.current) {
    queueRef.current = new BotInvocationQueue();
  }
  const queue = queueRef.current;

  // Refs for Yjs arrays to avoid stale closures
  const messagesRef = useRef(messagesArray);
  const threadsRef = useRef(threadsArray);
  const docRef = useRef(doc);

  useEffect(() => {
    messagesRef.current = messagesArray;
    threadsRef.current = threadsArray;
    docRef.current = doc;
  }, [messagesArray, threadsArray, doc]);

  // State for active object bot invocations (processed via useObject hook)
  interface ActiveObjectInvocation {
    id: string;
    bot: BotConfig;
    prompt: string;
    threadId: string;
    context_messages: Array<{ username: string; content: string }>;
  }
  const [activeObjectInvocations, setActiveObjectInvocations] = useState<ActiveObjectInvocation[]>([]);

  /**
   * Add a message to a thread
   */
  const addMessageToThread = useCallback((messageId: string, threadId: string) => {
    const threadArray = threadsRef.current.toArray();
    const threadIndex = threadArray.findIndex((t) => t.id === threadId);
    if (threadIndex !== -1) {
      const thread = threadArray[threadIndex];
      const updatedThread: Thread = {
        ...thread,
        message_ids: [...thread.message_ids, messageId],
      };
      threadsRef.current.delete(threadIndex, 1);
      threadsRef.current.insert(threadIndex, [updatedThread]);
    }
  }, []);

  /**
   * Create a thread eagerly and update the trigger message
   */
  const createThread = useCallback((triggerMessageId: string): string => {
    const newThreadId = generateId();
    const newThread: Thread = {
      id: newThreadId,
      parent_message_id: triggerMessageId,
      message_ids: [],
    };

    docRef.current.transact(() => {
      threadsRef.current.push([newThread]);

      // Update trigger message's thread_ids
      const msgArray = messagesRef.current.toArray();
      const msgIndex = msgArray.findIndex((m) => m.id === triggerMessageId);
      if (msgIndex !== -1) {
        const msg = msgArray[msgIndex];
        const updatedMsg: Message = {
          ...msg,
          thread_ids: [...(msg.thread_ids || []), newThreadId],
        };
        messagesRef.current.delete(msgIndex, 1);
        messagesRef.current.insert(msgIndex, [updatedMsg]);
      }
    });

    return newThreadId;
  }, []);

  /**
   * Process a text bot invocation (streaming text response)
   */
  const processTextBot = useCallback(
    async (invocation: BotInvocation, threadId: string) => {
      const { bot, prompt, context_messages } = invocation;

      // Create placeholder message for the bot
      const botMessageId = generateId();
      const botMessage: Message = {
        id: botMessageId,
        username: bot.display_name,
        timestamp: getCurrentTime(),
        content: "",
      };

      // Add bot message to the document and thread
      docRef.current.transact(() => {
        messagesRef.current.push([botMessage]);
        addMessageToThread(botMessageId, threadId);
      });

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bot_id: bot.id,
            message: prompt,
            context: context_messages,
          }),
        });

        if (!response.ok) {
          throw new Error(`Bot API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let accumulatedContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;

          // Update the message content
          docRef.current.transact(() => {
            const msgArray = messagesRef.current.toArray();
            const msgIndex = msgArray.findIndex((m) => m.id === botMessageId);
            if (msgIndex !== -1) {
              const updatedMessage: Message = {
                ...msgArray[msgIndex],
                content: accumulatedContent,
              };
              messagesRef.current.delete(msgIndex, 1);
              messagesRef.current.insert(msgIndex, [updatedMessage]);
            }
          });
        }
      } catch (error) {
        console.error(`Bot ${bot.id} error:`, error);

        // Update message with error
        docRef.current.transact(() => {
          const msgArray = messagesRef.current.toArray();
          const msgIndex = msgArray.findIndex((m) => m.id === botMessageId);
          if (msgIndex !== -1) {
            const updatedMessage: Message = {
              ...msgArray[msgIndex],
              content: "[Error: Failed to get response]",
            };
            messagesRef.current.delete(msgIndex, 1);
            messagesRef.current.insert(msgIndex, [updatedMessage]);
          }
        });

        throw error;
      }
    },
    [addMessageToThread]
  );

  /**
   * Process a Claude Code bot invocation (calls lambda, returns TSX components)
   */
  const processClaudeBot = useCallback(
    async (invocation: BotInvocation, threadId: string) => {
      const { bot, prompt } = invocation;

      // Create a "thinking" message while Claude Code executes
      const thinkingMessageId = generateId();
      const thinkingMessage: Message = {
        id: thinkingMessageId,
        username: `${bot.display_name}:thinking`,
        timestamp: getCurrentTime(),
        content: "Executing Claude Code...",
      };

      docRef.current.transact(() => {
        messagesRef.current.push([thinkingMessage]);
        addMessageToThread(thinkingMessageId, threadId);
      });

      try {
        const response = await fetch("/api/claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
          throw new Error(`Claude API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Claude Code execution failed");
        }

        // Update thinking message to show completion
        docRef.current.transact(() => {
          const msgArray = messagesRef.current.toArray();
          const msgIndex = msgArray.findIndex((m) => m.id === thinkingMessageId);
          if (msgIndex !== -1) {
            const updatedMessage: Message = {
              ...msgArray[msgIndex],
              content: data.session_id
                ? `Execution complete (session: ${data.session_id.substring(0, 12)}...)`
                : "Execution complete",
            };
            messagesRef.current.delete(msgIndex, 1);
            messagesRef.current.insert(msgIndex, [updatedMessage]);
          }
        });

        // Create messages for each TSX variant
        const variants = data.variants || [];

        if (variants.length === 0) {
          // No TSX files generated, show message
          const noFilesMessageId = generateId();
          const noFilesMessage: Message = {
            id: noFilesMessageId,
            username: bot.display_name,
            timestamp: getCurrentTime(),
            content: "[No TSX components generated]",
          };

          docRef.current.transact(() => {
            messagesRef.current.push([noFilesMessage]);
            addMessageToThread(noFilesMessageId, threadId);
          });
        } else {
          // Create a message for each variant (same format as @code bot)
          for (const variant of variants) {
            const variantMessageId = generateId();
            const variantMessage: Message = {
              id: variantMessageId,
              username: bot.display_name,
              timestamp: getCurrentTime(),
              content: JSON.stringify({ name: variant.name, code: variant.code }),
            };

            docRef.current.transact(() => {
              messagesRef.current.push([variantMessage]);
              addMessageToThread(variantMessageId, threadId);
            });
          }
        }
      } catch (error) {
        console.error(`Claude bot error:`, error);

        // Update thinking message with error
        docRef.current.transact(() => {
          const msgArray = messagesRef.current.toArray();
          const msgIndex = msgArray.findIndex((m) => m.id === thinkingMessageId);
          if (msgIndex !== -1) {
            const updatedMessage: Message = {
              ...msgArray[msgIndex],
              content: `[Error: ${error instanceof Error ? error.message : "Failed to execute"}]`,
            };
            messagesRef.current.delete(msgIndex, 1);
            messagesRef.current.insert(msgIndex, [updatedMessage]);
          }
        });

        throw error;
      }
    },
    [addMessageToThread]
  );

  /**
   * Handle object bot completion - called from ObjectBotHandler
   */
  const handleObjectBotComplete = useCallback(
    (invocationId: string) => {
      queue.complete(invocationId);
      setActiveObjectInvocations((prev) =>
        prev.filter((inv) => inv.id !== invocationId)
      );
    },
    [queue]
  );

  /**
   * Handle object bot failure - called from ObjectBotHandler
   */
  const handleObjectBotFail = useCallback(
    (invocationId: string, error: string) => {
      queue.fail(invocationId, error);
      setActiveObjectInvocations((prev) =>
        prev.filter((inv) => inv.id !== invocationId)
      );
    },
    [queue]
  );

  /**
   * Process a single invocation
   */
  const processInvocation = useCallback(
    async (invocation: BotInvocation) => {
      const { bot, existing_thread_id, trigger_message_id } = invocation;

      // Determine thread: use existing or create new eagerly
      const threadId = existing_thread_id || createThread(trigger_message_id);

      // Mark as processing with the thread ID
      if (!queue.startProcessing(invocation.id, threadId)) {
        // Already being processed or invalid state
        return;
      }

      // Object bots are handled via React component with useObject hook
      if (bot.response_type === "object") {
        setActiveObjectInvocations((prev) => [
          ...prev,
          {
            id: invocation.id,
            bot,
            prompt: invocation.prompt,
            threadId,
            context_messages: invocation.context_messages,
          },
        ]);
        return; // Completion handled by ObjectBotHandler callbacks
      }

      try {
        if (bot.response_type === "claude") {
          await processClaudeBot(invocation, threadId);
        } else {
          await processTextBot(invocation, threadId);
        }
        queue.complete(invocation.id);
      } catch (error) {
        queue.fail(
          invocation.id,
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
    [queue, createThread, processTextBot, processClaudeBot]
  );

  // Processor loop - polls for pending invocations
  useEffect(() => {
    let mounted = true;

    const processPending = async () => {
      if (!mounted) return;

      const pending = queue.getPending();

      // Process all pending invocations in parallel
      await Promise.all(
        pending.map((invocation) => processInvocation(invocation))
      );

      // Cleanup old completed invocations periodically
      queue.cleanup(60000);
    };

    // Subscribe to invocation updates to trigger processing
    const unsubscribe = queue.subscribe((invocation) => {
      if (invocation.status === "pending") {
        // New invocation added, process it
        processPending();
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [queue, processInvocation]);

  // Dispatch function for enqueueing invocations
  const dispatch = useCallback(
    (params: {
      bot: BotConfig;
      prompt: string;
      trigger_message_id: string;
      existing_thread_id?: string;
      context_messages: Array<{ username: string; content: string }>;
    }) => {
      return queue.enqueue(params);
    },
    [queue]
  );

  const contextValue = useMemo(() => ({ dispatch }), [dispatch]);

  return (
    <BotQueueContext.Provider value={contextValue}>
      {children}
      {/* Render ObjectBotHandler for each active object invocation */}
      {activeObjectInvocations.map((inv) => (
        <ObjectBotHandler
          key={inv.id}
          invocationId={inv.id}
          bot={inv.bot}
          prompt={inv.prompt}
          threadId={inv.threadId}
          contextMessages={inv.context_messages}
          doc={doc}
          messagesArray={messagesArray}
          threadsArray={threadsArray}
          onComplete={() => handleObjectBotComplete(inv.id)}
          onFail={(error) => handleObjectBotFail(inv.id, error)}
        />
      ))}
    </BotQueueContext.Provider>
  );
}

/**
 * Hook to access the bot queue dispatch function
 */
export function useBotQueue() {
  const context = useContext(BotQueueContext);
  if (!context) {
    throw new Error("useBotQueue must be used within a BotQueueProvider");
  }
  return context;
}
