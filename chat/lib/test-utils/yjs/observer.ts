/**
 * Observer - Event tracking and JSON logging for test assertions
 * Records all Yjs changes as structured events
 */

import * as Y from "yjs";
import type { Message, Thread } from "../core/message-operations";
import type { BotConfig } from "@/lib/bots.config";
import type { DocumentManager } from "./document-manager";

export type EventType =
  | "message_added"
  | "message_updated"
  | "message_deleted"
  | "thread_added"
  | "thread_updated"
  | "thread_deleted"
  | "tag_added"
  | "tag_deleted"
  | "bot_added"
  | "bot_updated"
  | "bot_deleted";

export interface ObservedEvent {
  type: EventType;
  timestamp: string;
  data: any;
}

export interface MessageAddedEvent extends ObservedEvent {
  type: "message_added";
  data: {
    message: Message;
    index: number;
  };
}

export interface MessageUpdatedEvent extends ObservedEvent {
  type: "message_updated";
  data: {
    message: Message;
    index: number;
    changes: any;
  };
}

export interface ThreadAddedEvent extends ObservedEvent {
  type: "thread_added";
  data: {
    thread: Thread;
    index: number;
  };
}

export interface ThreadUpdatedEvent extends ObservedEvent {
  type: "thread_updated";
  data: {
    thread: Thread;
    index: number;
    changes: any;
  };
}

export type AnyEvent =
  | MessageAddedEvent
  | MessageUpdatedEvent
  | ThreadAddedEvent
  | ThreadUpdatedEvent
  | ObservedEvent;

/**
 * Observer - tracks and logs Yjs document events
 */
export class Observer {
  private events: ObservedEvent[] = [];
  private listeners: ((event: ObservedEvent) => void)[] = [];

  constructor(private docManager: DocumentManager) {
    this.setupObservers();
  }

  /**
   * Set up observers for all Yjs arrays
   */
  private setupObservers(): void {
    // Observe messages array
    this.docManager.messages.observe((event) => {
      this.handleArrayEvent("message", event);
    });

    // Observe threads array
    this.docManager.threads.observe((event) => {
      this.handleArrayEvent("thread", event);
    });

    // Observe tags array
    this.docManager.tags.observe((event) => {
      this.handleArrayEvent("tag", event);
    });

    // Observe bots array
    this.docManager.bots.observe((event) => {
      this.handleArrayEvent("bot", event);
    });
  }

  /**
   * Handle array change events
   */
  private handleArrayEvent(
    arrayName: "message" | "thread" | "tag" | "bot",
    event: Y.YArrayEvent<any>
  ): void {
    const changes = event.changes.delta;

    let index = 0;
    for (const change of changes) {
      if (change.retain) {
        index += change.retain;
      } else if (change.insert) {
        // Items were inserted
        for (const item of change.insert) {
          this.recordEvent({
            type: `${arrayName}_added` as EventType,
            timestamp: new Date().toISOString(),
            data: {
              [arrayName]: item,
              index,
            },
          });
          index++;
        }
      } else if (change.delete) {
        // Items were deleted
        for (let i = 0; i < change.delete; i++) {
          this.recordEvent({
            type: `${arrayName}_deleted` as EventType,
            timestamp: new Date().toISOString(),
            data: {
              index,
            },
          });
        }
      }
    }
  }

  /**
   * Record an event
   */
  private recordEvent(event: ObservedEvent): void {
    this.events.push(event);
    this.notifyListeners(event);
  }

  /**
   * Notify all listeners of an event
   */
  private notifyListeners(event: ObservedEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * Subscribe to events
   */
  subscribe(listener: (event: ObservedEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get all recorded events
   */
  getEvents(): ObservedEvent[] {
    return [...this.events];
  }

  /**
   * Get events of a specific type
   */
  getEventsByType(type: EventType): ObservedEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Clear all recorded events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Get events as JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.events, null, 2);
  }

  /**
   * Wait for a specific event type
   */
  async waitForEvent(
    type: EventType,
    timeoutMs = 5000
  ): Promise<ObservedEvent> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timeout waiting for event: ${type}`));
      }, timeoutMs);

      const unsubscribe = this.subscribe((event) => {
        if (event.type === type) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(event);
        }
      });
    });
  }

  /**
   * Print event log to stderr as JSON
   */
  printLog(): void {
    console.error(this.toJSON());
  }
}
