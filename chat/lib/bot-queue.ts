/**
 * Bot Invocation Queue
 *
 * Event-driven architecture for processing bot invocations independently
 * of React's render cycle. Supports parallel processing and eager thread creation.
 */

import type { BotConfig } from "./bots.config";

export type InvocationStatus = "pending" | "processing" | "completed" | "failed";

export interface BotInvocation {
  /** Unique identifier for this invocation */
  id: string;
  /** The bot being invoked */
  bot: BotConfig;
  /** The prompt/content to send to the bot */
  prompt: string;
  /** ID of the message that triggered this invocation */
  trigger_message_id: string;
  /** Thread ID if invoked within an existing thread */
  existing_thread_id?: string;
  /** Thread ID created for this invocation's responses */
  created_thread_id?: string;
  /** Current status of the invocation */
  status: InvocationStatus;
  /** Error message if status is "failed" */
  error?: string;
  /** Context messages for bots with context_mode: "thread" */
  context_messages: Array<{ username: string; content: string }>;
}

export type InvocationListener = (invocation: BotInvocation) => void;

/**
 * Generate a unique ID for invocations
 */
export function generateInvocationId(): string {
  return `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique ID for messages/threads
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current time formatted for messages
 */
export function getCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

/**
 * BotInvocationQueue manages bot invocations independently of React lifecycle.
 *
 * Key features:
 * - Unique IDs prevent duplicate processing
 * - Parallel processing support
 * - Eager thread creation before processing starts
 * - Event-based updates via listeners
 */
export class BotInvocationQueue {
  private invocations: Map<string, BotInvocation> = new Map();
  private listeners: Set<InvocationListener> = new Set();
  private processingIds: Set<string> = new Set();

  /**
   * Subscribe to invocation updates
   */
  subscribe(listener: InvocationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of an invocation update
   */
  private notify(invocation: BotInvocation): void {
    this.listeners.forEach((listener) => listener(invocation));
  }

  /**
   * Enqueue a new bot invocation
   * Returns the invocation ID for tracking
   */
  enqueue(params: {
    bot: BotConfig;
    prompt: string;
    trigger_message_id: string;
    existing_thread_id?: string;
    context_messages: Array<{ username: string; content: string }>;
  }): string {
    const id = generateInvocationId();

    const invocation: BotInvocation = {
      id,
      bot: params.bot,
      prompt: params.prompt,
      trigger_message_id: params.trigger_message_id,
      existing_thread_id: params.existing_thread_id,
      context_messages: params.context_messages,
      status: "pending",
    };

    this.invocations.set(id, invocation);
    this.notify(invocation);

    return id;
  }

  /**
   * Get an invocation by ID
   */
  get(id: string): BotInvocation | undefined {
    return this.invocations.get(id);
  }

  /**
   * Get all pending invocations
   */
  getPending(): BotInvocation[] {
    return Array.from(this.invocations.values()).filter(
      (inv) => inv.status === "pending"
    );
  }

  /**
   * Check if an invocation is already being processed
   */
  isProcessing(id: string): boolean {
    return this.processingIds.has(id);
  }

  /**
   * Mark an invocation as processing and set its created thread ID
   */
  startProcessing(id: string, createdThreadId: string): boolean {
    const invocation = this.invocations.get(id);
    if (!invocation || invocation.status !== "pending") {
      return false;
    }

    // Prevent duplicate processing
    if (this.processingIds.has(id)) {
      return false;
    }

    this.processingIds.add(id);

    const updated: BotInvocation = {
      ...invocation,
      status: "processing",
      created_thread_id: createdThreadId,
    };

    this.invocations.set(id, updated);
    this.notify(updated);
    return true;
  }

  /**
   * Mark an invocation as completed
   */
  complete(id: string): void {
    const invocation = this.invocations.get(id);
    if (!invocation) return;

    this.processingIds.delete(id);

    const updated: BotInvocation = {
      ...invocation,
      status: "completed",
    };

    this.invocations.set(id, updated);
    this.notify(updated);
  }

  /**
   * Mark an invocation as failed
   */
  fail(id: string, error: string): void {
    const invocation = this.invocations.get(id);
    if (!invocation) return;

    this.processingIds.delete(id);

    const updated: BotInvocation = {
      ...invocation,
      status: "failed",
      error,
    };

    this.invocations.set(id, updated);
    this.notify(updated);
  }

  /**
   * Clean up completed/failed invocations older than maxAge
   */
  cleanup(maxAgeMs: number = 60000): void {
    const now = Date.now();
    const toRemove: string[] = [];

    this.invocations.forEach((inv, id) => {
      if (inv.status === "completed" || inv.status === "failed") {
        // Extract timestamp from ID
        const timestamp = parseInt(id.split("-")[1], 10);
        if (now - timestamp > maxAgeMs) {
          toRemove.push(id);
        }
      }
    });

    toRemove.forEach((id) => this.invocations.delete(id));
  }
}
