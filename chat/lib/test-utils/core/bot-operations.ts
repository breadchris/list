/**
 * Bot operations - wrappers around existing bot-utils logic
 * Re-exports and extends bot utilities for test usage
 */

import {
  parseMentions,
  hasBotMentions,
  stripMentions,
  buildBotContext,
  formatContextForPrompt,
  parseBotDefinition,
  isBotDefinitionMessage,
  buildSystemPromptFromMessages,
  type ParsedMention,
  type ChatMessage,
  type BotContext,
} from "@/lib/bot-utils";

import {
  generateInvocationId,
  type BotInvocation,
  type InvocationStatus,
} from "@/lib/bot-queue";

import type { BotConfig } from "@/lib/bots.config";
import type { Message, Thread } from "./message-operations";
import { getThreadById, getMessagesForThread } from "./thread-operations";

// Re-export types and functions for convenience
export {
  parseMentions,
  hasBotMentions,
  stripMentions,
  buildBotContext,
  formatContextForPrompt,
  parseBotDefinition,
  isBotDefinitionMessage,
  buildSystemPromptFromMessages,
  generateInvocationId,
};

export type { ParsedMention, ChatMessage, BotContext, BotInvocation, InvocationStatus, BotConfig };

/**
 * Convert Message to ChatMessage format
 */
export function toChatMessage(message: Message): ChatMessage {
  return {
    id: message.id,
    username: message.username,
    content: message.content,
    timestamp: message.timestamp,
  };
}

/**
 * Build bot invocation parameters from a message
 */
export function buildBotInvocationParams(
  message: Message,
  threads: Thread[],
  messages: Message[],
  bot: BotConfig,
  threadId?: string
): {
  bot: BotConfig;
  prompt: string;
  trigger_message_id: string;
  existing_thread_id?: string;
  context_messages: Array<{ username: string; content: string }>;
} {
  const mentions = parseMentions(message.content);

  let threadMessages: ChatMessage[] = [];
  let parentMessage: ChatMessage | null = null;

  if (threadId) {
    const thread = getThreadById(threads, threadId);
    if (thread) {
      // Get messages in this thread
      const msgs = getMessagesForThread(threads, messages, threadId);
      threadMessages = msgs.map(toChatMessage);

      // Get parent message
      const parent = messages.find((m) => m.id === thread.parent_message_id);
      if (parent) {
        parentMessage = toChatMessage(parent);
      }
    }
  }

  const triggerChatMessage = toChatMessage(message);
  const botContext = buildBotContext(
    triggerChatMessage,
    threadMessages,
    parentMessage,
    bot,
    mentions
  );

  return {
    bot,
    prompt: `[${message.username}]: ${botContext.cleaned_content}`,
    trigger_message_id: message.id,
    existing_thread_id: threadId,
    context_messages: botContext.context_messages.map((m) => ({
      username: m.username,
      content: m.content,
    })),
  };
}

/**
 * Create bot invocation object
 */
export function createBotInvocation(params: {
  bot: BotConfig;
  prompt: string;
  trigger_message_id: string;
  existing_thread_id?: string;
  context_messages: Array<{ username: string; content: string }>;
}): BotInvocation {
  return {
    id: generateInvocationId(),
    bot: params.bot,
    prompt: params.prompt,
    trigger_message_id: params.trigger_message_id,
    existing_thread_id: params.existing_thread_id,
    context_messages: params.context_messages,
    status: "pending",
  };
}
