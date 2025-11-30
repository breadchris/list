/**
 * Pure message operations logic extracted from UI components
 * These functions can be reused in both the UI and CLI test utility
 */

import { generateId, getCurrentTime } from "@/lib/bot-queue";

export interface Message {
  id: string;
  username: string;
  timestamp: string;
  content: string;
  thread_ids?: string[];
  tags?: string[];
}

export interface Thread {
  id: string;
  parent_message_id: string;
  message_ids: string[];
}

/**
 * Create a new message object
 */
export function createMessage(
  username: string,
  content: string,
  options?: {
    threadIds?: string[];
    tags?: string[];
  }
): Message {
  return {
    id: generateId(),
    username,
    timestamp: getCurrentTime(),
    content: content.trim(),
    thread_ids: options?.threadIds,
    tags: options?.tags,
  };
}

/**
 * Add message to messages array
 */
export function addMessage(
  messages: Message[],
  newMessage: Message
): Message[] {
  return [...messages, newMessage];
}

/**
 * Update message by ID
 */
export function updateMessage(
  messages: Message[],
  messageId: string,
  updates: Partial<Message>
): { messages: Message[]; index: number } | null {
  const index = messages.findIndex((m) => m.id === messageId);
  if (index === -1) return null;

  const updatedMessage = { ...messages[index], ...updates };
  return {
    messages: [
      ...messages.slice(0, index),
      updatedMessage,
      ...messages.slice(index + 1),
    ],
    index,
  };
}

/**
 * Get message by ID
 */
export function getMessageById(
  messages: Message[],
  messageId: string
): Message | undefined {
  return messages.find((m) => m.id === messageId);
}

/**
 * Add tag to message
 */
export function addTagToMessage(
  messages: Message[],
  messageId: string,
  tag: string
): { messages: Message[]; index: number } | null {
  const message = getMessageById(messages, messageId);
  if (!message) return null;

  const currentTags = message.tags || [];
  if (currentTags.includes(tag)) return null;

  return updateMessage(messages, messageId, {
    tags: [...currentTags, tag],
  });
}

/**
 * Remove tag from message
 */
export function removeTagFromMessage(
  messages: Message[],
  messageId: string,
  tag: string
): { messages: Message[]; index: number } | null {
  const message = getMessageById(messages, messageId);
  if (!message) return null;

  const currentTags = message.tags || [];
  if (!currentTags.includes(tag)) return null;

  return updateMessage(messages, messageId, {
    tags: currentTags.filter((t) => t !== tag),
  });
}

/**
 * Add thread ID to message's thread_ids array
 */
export function addThreadIdToMessage(
  messages: Message[],
  messageId: string,
  threadId: string
): { messages: Message[]; index: number } | null {
  const message = getMessageById(messages, messageId);
  if (!message) return null;

  const currentThreadIds = message.thread_ids || [];
  if (currentThreadIds.includes(threadId)) return null;

  return updateMessage(messages, messageId, {
    thread_ids: [...currentThreadIds, threadId],
  });
}
