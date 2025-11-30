/**
 * Pure thread operations logic extracted from UI components
 */

import { generateId } from "@/lib/bot-queue";
import type { Message, Thread } from "./message-operations";

/**
 * Create a new thread
 */
export function createThread(parentMessageId: string): Thread {
  return {
    id: generateId(),
    parent_message_id: parentMessageId,
    message_ids: [],
  };
}

/**
 * Get thread by ID
 */
export function getThreadById(
  threads: Thread[],
  threadId: string
): Thread | undefined {
  return threads.find((t) => t.id === threadId);
}

/**
 * Get all threads for a specific parent message
 */
export function getThreadsForMessage(
  threads: Thread[],
  messageId: string
): Thread[] {
  return threads.filter((t) => t.parent_message_id === messageId);
}

/**
 * Get all messages in a thread
 */
export function getMessagesForThread(
  threads: Thread[],
  messages: Message[],
  threadId: string
): Message[] {
  const thread = getThreadById(threads, threadId);
  if (!thread) return [];

  return thread.message_ids
    .map((id) => messages.find((m) => m.id === id))
    .filter((m): m is Message => m !== undefined);
}

/**
 * Add message to thread
 */
export function addMessageToThread(
  threads: Thread[],
  threadId: string,
  messageId: string
): { threads: Thread[]; index: number } | null {
  const index = threads.findIndex((t) => t.id === threadId);
  if (index === -1) return null;

  const thread = threads[index];
  const updatedThread: Thread = {
    ...thread,
    message_ids: [...thread.message_ids, messageId],
  };

  return {
    threads: [
      ...threads.slice(0, index),
      updatedThread,
      ...threads.slice(index + 1),
    ],
    index,
  };
}

/**
 * Create thread and add to threads array
 */
export function addThread(
  threads: Thread[],
  parentMessageId: string
): { threads: Thread[]; thread: Thread } {
  const newThread = createThread(parentMessageId);
  return {
    threads: [...threads, newThread],
    thread: newThread,
  };
}
