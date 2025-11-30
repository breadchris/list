/**
 * Bot Utilities
 *
 * Functions for detecting @mentions and building context for bot responses.
 */

import { getBotByMention, type BotConfig, type ContextMode } from "./bots.config";

export interface ParsedMention {
  bot: BotConfig;
  /** The full @mention text (e.g., "@ai") */
  mention_text: string;
  /** Position in the original message */
  start_index: number;
  end_index: number;
}

export interface ChatMessage {
  id: string;
  username: string;
  content: string;
  timestamp: string;
}

export interface BotContext {
  /** The message that triggered the bot */
  trigger_message: ChatMessage;
  /** Previous messages for context (based on bot's context_mode) */
  context_messages: ChatMessage[];
  /** The content with @mention stripped out */
  cleaned_content: string;
}

/**
 * Regular expression to match @mentions
 * Matches @ followed by word characters (letters, numbers, underscore)
 */
const MENTION_REGEX = /@(\w+)/g;

/**
 * Parse a message for @mentions and return matching bots
 */
export function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(content)) !== null) {
    const mentionWord = match[1];
    const bot = getBotByMention(mentionWord);

    if (bot) {
      mentions.push({
        bot,
        mention_text: match[0],
        start_index: match.index,
        end_index: match.index + match[0].length,
      });
    }
  }

  return mentions;
}

/**
 * Check if a message contains any bot mentions
 */
export function hasBotMentions(content: string): boolean {
  return parseMentions(content).length > 0;
}

/**
 * Strip @mentions from message content
 */
export function stripMentions(content: string, mentions: ParsedMention[]): string {
  let result = content;

  // Sort by start index descending to avoid index shifting issues
  const sortedMentions = [...mentions].sort(
    (a, b) => b.start_index - a.start_index
  );

  for (const mention of sortedMentions) {
    result =
      result.slice(0, mention.start_index) +
      result.slice(mention.end_index);
  }

  // Clean up extra whitespace
  return result.replace(/\s+/g, " ").trim();
}

/**
 * Build context for a bot based on its context_mode setting
 */
export function buildBotContext(
  triggerMessage: ChatMessage,
  threadMessages: ChatMessage[],
  parentMessage: ChatMessage | null,
  bot: BotConfig,
  mentions: ParsedMention[]
): BotContext {
  const contextMessages: ChatMessage[] = [];

  switch (bot.context_mode) {
    case "none":
      // No context - just the trigger message
      break;

    case "thread":
      // Include parent message and all thread messages before the trigger
      if (parentMessage) {
        contextMessages.push(parentMessage);
      }
      for (const msg of threadMessages) {
        if (msg.id === triggerMessage.id) break;
        contextMessages.push(msg);
      }
      break;
  }

  // Apply max_context_messages limit if set
  const maxMessages = bot.max_context_messages;
  const limitedContext =
    maxMessages && contextMessages.length > maxMessages
      ? contextMessages.slice(-maxMessages)
      : contextMessages;

  return {
    trigger_message: triggerMessage,
    context_messages: limitedContext,
    cleaned_content: stripMentions(triggerMessage.content, mentions),
  };
}

/**
 * Format context messages for the AI prompt
 */
export function formatContextForPrompt(context: BotContext): string {
  const lines: string[] = [];

  if (context.context_messages.length > 0) {
    lines.push("Previous messages in this conversation:");
    for (const msg of context.context_messages) {
      lines.push(`[${msg.username}]: ${msg.content}`);
    }
    lines.push("");
  }

  lines.push(`[${context.trigger_message.username}]: ${context.cleaned_content}`);

  return lines.join("\n");
}

/**
 * Bot definition message pattern: @mention - Description
 * Allows leading/trailing whitespace for flexibility
 */
const BOT_DEFINITION_REGEX = /^\s*@(\w+)\s+-\s+(.+?)\s*$/;

/**
 * Parse a bot definition message
 * Returns null if message doesn't match pattern
 */
export function parseBotDefinition(content: string): {
  mention: string;
  description: string;
} | null {
  const match = content.match(BOT_DEFINITION_REGEX);
  if (!match) return null;

  return {
    mention: match[1],
    description: match[2].trim(),
  };
}

/**
 * Check if a message is a bot definition message
 */
export function isBotDefinitionMessage(content: string): boolean {
  return BOT_DEFINITION_REGEX.test(content);
}

/**
 * Build system prompt from thread messages
 * Concatenates all message content with double newlines
 */
export function buildSystemPromptFromMessages(messages: ChatMessage[]): string {
  if (messages.length === 0) {
    return "You are a helpful assistant.";
  }

  return messages.map(msg => msg.content).join("\n\n");
}
