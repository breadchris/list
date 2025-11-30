/**
 * Test Utilities - Main export file
 * Provides easy access to all test utility functions and types
 */

// Core operations
export {
  createMessage,
  addMessage,
  updateMessage,
  getMessageById,
  addTagToMessage as addTagToMessagePure,
  removeTagFromMessage as removeTagFromMessagePure,
  addThreadIdToMessage,
} from "./core/message-operations";

export {
  createThread,
  getThreadById,
  getThreadsForMessage,
  getMessagesForThread,
  addMessageToThread,
  addThread,
} from "./core/thread-operations";

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
  toChatMessage,
  buildBotInvocationParams,
  createBotInvocation,
} from "./core/bot-operations";

// Yjs client and document management
export { connectToYSweet, waitForSync } from "./yjs/client";
export { DocumentManager, YjsArray } from "./yjs/document-manager";
export { Observer } from "./yjs/observer";

// High-level operations
export {
  sendMessage,
  createThreadForMessage,
  addTagToMessage,
  removeTagFromMessage,
  getDocumentState,
  queryMessages,
  getThreadWithMessages,
} from "./yjs/operations";

// Types
export type {
  Message,
  Thread,
  BotConfig,
  ParsedMention,
  ChatMessage,
  BotContext,
  BotInvocation,
  InvocationStatus,
  EventType,
  ObservedEvent,
  MessageAddedEvent,
  MessageUpdatedEvent,
  ThreadAddedEvent,
  ThreadUpdatedEvent,
  AnyEvent,
  CommandType,
  CommandResult,
} from "./types";

export type { YSweetClientToken, YSweetClientOptions } from "./yjs/client";
