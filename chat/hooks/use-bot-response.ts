"use client";

import { useCallback, useRef } from "react";
import type { Doc } from "yjs";
import type { BotConfig } from "@/lib/bots.config";

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

interface BotInvocationParams {
  bot: BotConfig;
  triggerMessage: Message;
  threadId?: string;
  contextMessages: Array<{ username: string; content: string }>;
  cleanedContent: string;
}

/**
 * Hook for invoking bot responses with streaming
 *
 * This hook provides a function to invoke bots and stream their responses
 * directly into the Y-Sweet document for real-time collaboration.
 */
export function useBotResponse(
  doc: Doc,
  messagesArray: { push: (items: Message[]) => void; toArray: () => Message[]; delete: (index: number, length: number) => void; insert: (index: number, items: Message[]) => void },
  threadsArray: { push: (items: Thread[]) => void; toArray: () => Thread[]; delete: (index: number, length: number) => void; insert: (index: number, items: Thread[]) => void }
) {
  // Track active invocations to prevent duplicate calls
  const activeInvocations = useRef<Set<string>>(new Set());

  const generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  };

  const invokeBots = useCallback(
    async (invocations: BotInvocationParams[]) => {
      // Process all bot invocations in parallel
      const promises = invocations.map(async (params) => {
        const { bot, triggerMessage, threadId, contextMessages, cleanedContent } = params;

        // Create unique key for this invocation
        const invocationKey = `${bot.id}-${triggerMessage.id}`;

        // Prevent duplicate invocations
        if (activeInvocations.current.has(invocationKey)) {
          return;
        }
        activeInvocations.current.add(invocationKey);

        // Create placeholder message for the bot
        const botMessageId = generateId();
        const botMessage: Message = {
          id: botMessageId,
          username: bot.display_name,
          timestamp: getCurrentTime(),
          content: "",
        };

        // Add bot message to the document
        doc.transact(() => {
          messagesArray.push([botMessage]);

          if (threadId) {
            // Add message to existing thread
            const threadArray = threadsArray.toArray();
            const threadIndex = threadArray.findIndex((t) => t.id === threadId);
            if (threadIndex !== -1) {
              const thread = threadArray[threadIndex];
              const updatedThread: Thread = {
                ...thread,
                message_ids: [...thread.message_ids, botMessageId],
              };
              threadsArray.delete(threadIndex, 1);
              threadsArray.insert(threadIndex, [updatedThread]);
            }
          }
        });

        try {
          // Call the bot API
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              bot_id: bot.id,
              message: `[${triggerMessage.username}]: ${cleanedContent}`,
              context: contextMessages,
            }),
          });

          if (!response.ok) {
            throw new Error(`Bot API error: ${response.status}`);
          }

          // Stream the response
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error("No response body");
          }

          const decoder = new TextDecoder();
          let accumulatedContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode the chunk and accumulate
            const chunk = decoder.decode(value, { stream: true });
            accumulatedContent += chunk;

            // Update the message in the Y-Array
            doc.transact(() => {
              const msgArray = messagesArray.toArray();
              const msgIndex = msgArray.findIndex((m) => m.id === botMessageId);
              if (msgIndex !== -1) {
                const updatedMessage: Message = {
                  ...msgArray[msgIndex],
                  content: accumulatedContent,
                };
                messagesArray.delete(msgIndex, 1);
                messagesArray.insert(msgIndex, [updatedMessage]);
              }
            });
          }
        } catch (error) {
          console.error(`Bot ${bot.id} error:`, error);

          // Update message with error indicator
          doc.transact(() => {
            const msgArray = messagesArray.toArray();
            const msgIndex = msgArray.findIndex((m) => m.id === botMessageId);
            if (msgIndex !== -1) {
              const updatedMessage: Message = {
                ...msgArray[msgIndex],
                content: "[Error: Failed to get response]",
              };
              messagesArray.delete(msgIndex, 1);
              messagesArray.insert(msgIndex, [updatedMessage]);
            }
          });
        } finally {
          activeInvocations.current.delete(invocationKey);
        }
      });

      await Promise.all(promises);
    },
    [doc, messagesArray, threadsArray]
  );

  return { invokeBots };
}
