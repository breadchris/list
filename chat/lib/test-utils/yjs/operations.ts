/**
 * High-level operations layer - combines pure business logic with Yjs updates
 * These functions perform complete operations on the Yjs document
 */

import type { DocumentManager } from "./document-manager";
import type { BotConfig } from "@/lib/bots.config";
import {
  createMessage,
  addTagToMessage as addTagToMessagePure,
  removeTagFromMessage as removeTagFromMessagePure,
  addThreadIdToMessage as addThreadIdToMessagePure,
  type Message,
} from "../core/message-operations";
import {
  createThread,
  getThreadById,
  getThreadsForMessage,
  getMessagesForThread,
  type Thread,
} from "../core/thread-operations";
import {
  parseMentions,
  buildBotInvocationParams,
  createBotInvocation,
  type BotInvocation,
} from "../core/bot-operations";

/**
 * Send a message to the chat (main or thread)
 * Returns the created message and any bot invocations
 */
export function sendMessage(
  docManager: DocumentManager,
  username: string,
  content: string,
  options?: {
    threadId?: string;
    tags?: string[];
  }
): {
  message: Message;
  botInvocations: BotInvocation[];
} {
  const newMessage = createMessage(username, content, {
    tags: options?.tags,
  });

  const botInvocations: BotInvocation[] = [];

  // Perform Yjs transaction
  docManager.transact(() => {
    // Add message to messages array
    docManager.messages.push([newMessage]);

    // If in thread, add to thread's message_ids
    if (options?.threadId) {
      const threads = docManager.threads.toArray();
      const threadIndex = threads.findIndex((t) => t.id === options.threadId);

      if (threadIndex !== -1) {
        const thread = threads[threadIndex];
        const updatedThread: Thread = {
          ...thread,
          message_ids: [...thread.message_ids, newMessage.id],
        };

        docManager.threads.delete(threadIndex, 1);
        docManager.threads.insert(threadIndex, [updatedThread]);
      }
    }
  });

  // Check for bot mentions and create invocations
  const mentions = parseMentions(content);
  if (mentions.length > 0) {
    const messages = docManager.messages.toArray();
    const threads = docManager.threads.toArray();

    for (const mention of mentions) {
      const params = buildBotInvocationParams(
        newMessage,
        threads,
        messages,
        mention.bot,
        options?.threadId
      );

      const invocation = createBotInvocation(params);
      botInvocations.push(invocation);
    }
  }

  return { message: newMessage, botInvocations };
}

/**
 * Create a thread for a message
 * Returns the created thread
 */
export function createThreadForMessage(
  docManager: DocumentManager,
  messageId: string
): Thread | null {
  const messages = docManager.messages.toArray();
  const messageIndex = messages.findIndex((m) => m.id === messageId);

  if (messageIndex === -1) return null;

  const newThread = createThread(messageId);

  docManager.transact(() => {
    // Add thread to threads array
    docManager.threads.push([newThread]);

    // Update message to reference thread
    const message = messages[messageIndex];
    const updatedMessage: Message = {
      ...message,
      thread_ids: [...(message.thread_ids || []), newThread.id],
    };

    docManager.messages.delete(messageIndex, 1);
    docManager.messages.insert(messageIndex, [updatedMessage]);
  });

  return newThread;
}

/**
 * Add tag to a message
 */
export function addTagToMessage(
  docManager: DocumentManager,
  messageId: string,
  tag: string
): boolean {
  const messages = docManager.messages.toArray();
  const result = addTagToMessagePure(messages, messageId, tag);

  if (!result) return false;

  docManager.transact(() => {
    // Update message
    docManager.messages.delete(result.index, 1);
    docManager.messages.insert(result.index, [result.messages[result.index]]);

    // Add to global tags if new
    const tags = docManager.tags.toArray();
    if (!tags.includes(tag)) {
      docManager.tags.push([tag]);
    }
  });

  return true;
}

/**
 * Remove tag from a message
 */
export function removeTagFromMessage(
  docManager: DocumentManager,
  messageId: string,
  tag: string
): boolean {
  const messages = docManager.messages.toArray();
  const result = removeTagFromMessagePure(messages, messageId, tag);

  if (!result) return false;

  docManager.transact(() => {
    docManager.messages.delete(result.index, 1);
    docManager.messages.insert(result.index, [result.messages[result.index]]);
  });

  return true;
}

/**
 * Get current document state snapshot
 */
export function getDocumentState(docManager: DocumentManager): {
  messages: Message[];
  threads: Thread[];
  tags: string[];
  bots: BotConfig[];
} {
  return {
    messages: docManager.messages.toArray(),
    threads: docManager.threads.toArray(),
    tags: docManager.tags.toArray(),
    bots: docManager.bots.toArray(),
  };
}

/**
 * Query messages by criteria
 */
export function queryMessages(
  docManager: DocumentManager,
  criteria: {
    username?: string;
    contentContains?: string;
    hasTag?: string;
    inThread?: string;
  }
): Message[] {
  let messages = docManager.messages.toArray();

  if (criteria.username) {
    messages = messages.filter((m) => m.username === criteria.username);
  }

  if (criteria.contentContains) {
    messages = messages.filter((m) =>
      m.content.toLowerCase().includes(criteria.contentContains!.toLowerCase())
    );
  }

  if (criteria.hasTag) {
    messages = messages.filter((m) => m.tags?.includes(criteria.hasTag!));
  }

  if (criteria.inThread) {
    const threads = docManager.threads.toArray();
    const thread = getThreadById(threads, criteria.inThread);
    if (thread) {
      const threadMessageIds = new Set(thread.message_ids);
      messages = messages.filter((m) => threadMessageIds.has(m.id));
    } else {
      messages = [];
    }
  }

  return messages;
}

/**
 * Get thread with all its messages
 */
export function getThreadWithMessages(
  docManager: DocumentManager,
  threadId: string
): { thread: Thread; messages: Message[] } | null {
  const threads = docManager.threads.toArray();
  const messages = docManager.messages.toArray();

  const thread = getThreadById(threads, threadId);
  if (!thread) return null;

  const threadMessages = getMessagesForThread(threads, messages, threadId);

  return { thread, messages: threadMessages };
}
