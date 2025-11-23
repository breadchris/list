/**
 * Bot Configuration Registry
 *
 * Define chatbots that respond to @mentions in threads.
 * To add a new bot, simply add a new entry to the `bots` array.
 */

export type ContextMode = "none" | "thread" | "full";

export interface BotConfig {
  /** Unique identifier for the bot */
  id: string;
  /** Trigger word without @ (e.g., "ai" for @ai) */
  mention: string;
  /** Display name shown as message author */
  display_name: string;
  /** System prompt defining bot personality and behavior */
  system_prompt: string;
  /** OpenAI model to use */
  model: string;
  /** How much context the bot receives:
   * - "none": Only the triggering message
   * - "thread": All messages in the current thread
   * - "full": All messages in thread + parent context
   */
  context_mode: ContextMode;
  /** Maximum number of context messages (optional) */
  max_context_messages?: number;
}

export const bots: BotConfig[] = [
  {
    id: "ai",
    mention: "ai",
    display_name: "AI",
    system_prompt: `You are a helpful AI assistant participating in a chat conversation.
Keep your responses concise and conversational - this is a chat, not an essay.
Be friendly but not overly enthusiastic. Match the tone of the conversation.
If you don't know something, say so briefly.`,
    model: "gpt-4o-mini",
    context_mode: "thread",
    max_context_messages: 20,
  },
];

/**
 * Find a bot by its @mention trigger
 */
export function getBotByMention(mention: string): BotConfig | undefined {
  return bots.find(
    (bot) => bot.mention.toLowerCase() === mention.toLowerCase()
  );
}

/**
 * Find a bot by its unique ID
 */
export function getBotById(id: string): BotConfig | undefined {
  return bots.find((bot) => bot.id === id);
}

/**
 * Get all registered bots
 */
export function getAllBots(): BotConfig[] {
  return bots;
}
