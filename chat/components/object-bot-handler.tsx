"use client";

import { useEffect, useRef, useCallback } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import type { Doc } from "yjs";
import { generateId, getCurrentTime } from "@/lib/bot-queue";
import type { BotConfig } from "@/lib/bots.config";
import { getBotSchema } from "@/lib/bot-schemas";
import { listItemsSchemaObject } from "@/lib/schema";

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

interface ObjectBotHandlerProps {
  invocationId: string;
  bot: BotConfig;
  prompt: string;
  threadId: string;
  contextMessages: Array<{ username: string; content: string }>;
  doc: Doc;
  messagesArray: YArray<Message>;
  threadsArray: YArray<Thread>;
  onComplete: () => void;
  onFail: (error: string) => void;
}

interface ObjectUpdateEvent extends CustomEvent {
  detail: {
    messageId: string;
    partialObject: Record<string, unknown>;
  };
}

/**
 * Component that handles object bot streaming using useObject.
 * Uses stability detection to avoid creating messages for partial array items.
 * Renders nothing - all output goes to Y.js messages.
 */
export function ObjectBotHandler({
  invocationId,
  bot,
  prompt,
  threadId,
  contextMessages,
  doc,
  messagesArray,
  threadsArray,
  onComplete,
  onFail,
}: ObjectBotHandlerProps) {
  const schemaConfig = getBotSchema(bot.schema_id || "list");
  const schema = schemaConfig?.schema || listItemsSchemaObject;

  const { object, submit, isLoading, error } = useObject({
    api: "/api/object",
    schema,
  });

  const hasSubmittedRef = useRef(false);
  const hasFailedRef = useRef(false);
  const reasoningMessageIdRef = useRef<string | null>(null);
  const lastReasoningContentRef = useRef("");
  const processedCountRef = useRef(0);
  const previousItemsStateRef = useRef<string[]>([]);
  const botBuilderMessageIdRef = useRef<string | null>(null);
  const chatMessageIdRef = useRef<string | null>(null);
  const lastChatContentRef = useRef("");

  // Helper to add message to thread
  const addMessageToThread = useCallback(
    (messageId: string) => {
      const threadArray = threadsArray.toArray();
      const threadIndex = threadArray.findIndex((t) => t.id === threadId);
      if (threadIndex !== -1) {
        const thread = threadArray[threadIndex];
        const updatedThread: Thread = {
          ...thread,
          message_ids: [...thread.message_ids, messageId],
        };
        threadsArray.delete(threadIndex, 1);
        threadsArray.insert(threadIndex, [updatedThread]);
      }
    },
    [threadsArray, threadId],
  );

  // Submit on mount
  useEffect(() => {
    if (hasSubmittedRef.current || hasFailedRef.current) return;

    if (!schemaConfig) {
      hasFailedRef.current = true;
      onFail(`Unknown schema: ${bot.schema_id}`);
      return;
    }

    hasSubmittedRef.current = true;
    submit({
      bot_id: bot.id,
      prompt,
      context_messages: contextMessages,
    });
  }, [
    bot.id,
    bot.schema_id,
    prompt,
    contextMessages,
    schemaConfig,
    onFail,
    submit,
  ]);

  // Handle error
  useEffect(() => {
    if (error && !hasFailedRef.current) {
      hasFailedRef.current = true;

      const errorMessageId = generateId();
      const errorMessage: Message = {
        id: errorMessageId,
        username: bot.display_name,
        timestamp: getCurrentTime(),
        content: "[Error: Failed to generate response]",
      };

      doc.transact(() => {
        messagesArray.push([errorMessage]);
        addMessageToThread(errorMessageId);
      });

      onFail(error.message || "Unknown error");
    }
  }, [error, bot.display_name, doc, messagesArray, addMessageToThread, onFail]);

  // Process streamed object
  useEffect(() => {
    if (!object || !schemaConfig) return;

    const schemaId = bot.schema_id;
    const typedObject = object as Record<string, unknown>;

    // Handle bot builder schema - create placeholder message and dispatch events
    if (schemaId === "bot") {
      // Create placeholder message on first update
      if (!botBuilderMessageIdRef.current) {
        const botMessageId = generateId();
        botBuilderMessageIdRef.current = botMessageId;

        const botMessage: Message = {
          id: botMessageId,
          username: bot.display_name,
          timestamp: getCurrentTime(),
          content: "", // Content will be rendered by BotBuilderHandler
        };

        doc.transact(() => {
          messagesArray.push([botMessage]);
          addMessageToThread(botMessageId);
        });
      }

      // Debug logging for bot builder updates
      const responseObj = typedObject.response as
        | Record<string, unknown>
        | undefined;
      console.log("Bot Builder Update:", {
        messageId: botBuilderMessageIdRef.current,
        step: responseObj?.step,
        hasMessage: !!responseObj?.message,
        messageLength:
          typeof responseObj?.message === "string"
            ? responseObj.message.length
            : 0,
        hasMention: !!responseObj?.bot_mention,
        hasDescription: !!responseObj?.bot_description,
        hasPersonality: Array.isArray(responseObj?.personality_lines)
          ? responseObj.personality_lines.length
          : 0,
        partialObject: typedObject,
      });

      // Dispatch objectUpdate event with message ID
      const event: ObjectUpdateEvent = new CustomEvent("objectUpdate", {
        detail: {
          messageId: botBuilderMessageIdRef.current,
          partialObject: typedObject,
        },
      });
      window.dispatchEvent(event);
    }

    // Handle chat schema - simple message response
    if (schemaId === "chat" && typedObject.response) {
      const responseObj = typedObject.response as Record<string, unknown>;
      const message = responseObj.message as string | undefined;

      if (message && message !== lastChatContentRef.current) {
        if (!chatMessageIdRef.current) {
          // Create new chat message
          const chatMessageId = generateId();
          chatMessageIdRef.current = chatMessageId;
          const chatMessage: Message = {
            id: chatMessageId,
            username: bot.display_name,
            timestamp: getCurrentTime(),
            content: message,
          };

          doc.transact(() => {
            messagesArray.push([chatMessage]);
            addMessageToThread(chatMessageId);
          });
        } else {
          // Update existing chat message with streaming content
          doc.transact(() => {
            const msgArray = messagesArray.toArray();
            const msgIndex = msgArray.findIndex(
              (m) => m.id === chatMessageIdRef.current,
            );
            if (msgIndex !== -1) {
              const updatedMessage: Message = {
                ...msgArray[msgIndex],
                content: message,
              };
              messagesArray.delete(msgIndex, 1);
              messagesArray.insert(msgIndex, [updatedMessage]);
            }
          });
        }
        lastChatContentRef.current = message;
      }
    }

    // Handle reasoning for code bot
    if (schemaId === "code" && typedObject.reasoning) {
      const reasoning = typedObject.reasoning as string;
      if (reasoning !== lastReasoningContentRef.current) {
        if (!reasoningMessageIdRef.current) {
          const reasoningMessageId = generateId();
          reasoningMessageIdRef.current = reasoningMessageId;
          const reasoningMessage: Message = {
            id: reasoningMessageId,
            username: `${bot.display_name}:thinking`,
            timestamp: getCurrentTime(),
            content: reasoning,
          };

          doc.transact(() => {
            messagesArray.push([reasoningMessage]);
            addMessageToThread(reasoningMessageId);
          });
        } else {
          doc.transact(() => {
            const msgArray = messagesArray.toArray();
            const msgIndex = msgArray.findIndex(
              (m) => m.id === reasoningMessageIdRef.current,
            );
            if (msgIndex !== -1) {
              const updatedMessage: Message = {
                ...msgArray[msgIndex],
                content: reasoning,
              };
              messagesArray.delete(msgIndex, 1);
              messagesArray.insert(msgIndex, [updatedMessage]);
            }
          });
        }
        lastReasoningContentRef.current = reasoning;
      }
    }

    // Get items array based on schema
    let items: Array<Record<string, unknown>> | undefined;
    if (schemaId === "code" && typedObject.variants) {
      items = typedObject.variants as Array<Record<string, unknown>>;
    } else if (schemaId === "list" && typedObject.items) {
      items = typedObject.items as Array<Record<string, unknown>>;
    } else if (schemaId === "calendar" && typedObject.events) {
      items = typedObject.events as Array<Record<string, unknown>>;
    }

    if (items && Array.isArray(items)) {
      // Stringify items to detect stability
      const currentItemsState = items.map((item) => JSON.stringify(item));
      const previousState = previousItemsStateRef.current;

      // Process items that are stable (unchanged from previous render) or loading is done
      for (let i = processedCountRef.current; i < items.length; i++) {
        const item = items[i];
        const currentState = currentItemsState[i];
        const previousState_i = previousState[i];

        // Item is stable if: content matches previous render OR loading is complete
        const isStable = !isLoading || currentState === previousState_i;

        if (isStable && item) {
          let messageContent: string | undefined;

          if (schemaId === "code") {
            const variant = item as { name?: string; code?: string };
            if (variant.name && variant.code) {
              messageContent = JSON.stringify({
                name: variant.name,
                code: variant.code,
              });
            }
          } else if (schemaId === "list") {
            const listItem = item as { content?: string };
            if (listItem.content) {
              messageContent = listItem.content;
            }
          } else if (schemaId === "calendar") {
            const event = item as {
              title?: string;
              date?: string;
              start_time?: string;
              end_time?: string;
              description?: string;
              location?: string;
            };
            if (event.title && event.date) {
              messageContent = JSON.stringify(event);
            }
          }

          if (messageContent) {
            const botMessageId = generateId();
            const botMessage: Message = {
              id: botMessageId,
              username: bot.display_name,
              timestamp: getCurrentTime(),
              content: messageContent,
            };

            doc.transact(() => {
              messagesArray.push([botMessage]);
              addMessageToThread(botMessageId);
            });

            processedCountRef.current = i + 1;
          }
        }
      }

      // Update previous state
      previousItemsStateRef.current = currentItemsState;
    }
  }, [
    object,
    bot.schema_id,
    bot.display_name,
    isLoading,
    schemaConfig,
    doc,
    messagesArray,
    addMessageToThread,
    invocationId,
  ]);

  // Handle completion
  useEffect(() => {
    if (
      !isLoading &&
      hasSubmittedRef.current &&
      !error &&
      !hasFailedRef.current &&
      object
    ) {
      onComplete();
    }
  }, [isLoading, error, object, onComplete]);

  return null;
}
