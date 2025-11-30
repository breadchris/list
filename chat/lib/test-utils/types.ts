/**
 * Shared types for test utilities
 */

export type { Message, Thread } from "./core/message-operations";
export type { BotConfig } from "@/lib/bots.config";
export type {
  ParsedMention,
  ChatMessage,
  BotContext,
  BotInvocation,
  InvocationStatus,
} from "./core/bot-operations";
export type {
  EventType,
  ObservedEvent,
  MessageAddedEvent,
  MessageUpdatedEvent,
  ThreadAddedEvent,
  ThreadUpdatedEvent,
  AnyEvent,
} from "./yjs/observer";

/**
 * CLI command types
 */
export type CommandType =
  | "send-message"
  | "create-thread"
  | "add-tag"
  | "remove-tag"
  | "query"
  | "observe"
  | "get-state"
  | "wait-for-event"
  | "help";

export interface CommandResult {
  success: boolean;
  data?: any;
  error?: string;
  events?: ObservedEvent[];
}
