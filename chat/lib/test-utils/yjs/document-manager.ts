/**
 * Document Manager - high-level interface for Yjs document operations
 * Provides typed access to Yjs arrays and transaction batching
 */

import * as Y from "yjs";
import type { Message, Thread } from "../core/message-operations";
import type { BotConfig } from "@/lib/bots.config";

/**
 * Yjs Array wrapper with type safety
 */
export class YjsArray<T> {
  constructor(private yArray: Y.Array<T>) {}

  /**
   * Get all items as a regular array
   */
  toArray(): T[] {
    return this.yArray.toArray();
  }

  /**
   * Push items to the end of the array
   */
  push(items: T[]): void {
    this.yArray.push(items);
  }

  /**
   * Insert items at a specific index
   */
  insert(index: number, items: T[]): void {
    this.yArray.insert(index, items);
  }

  /**
   * Delete items at a specific index
   */
  delete(index: number, length: number): void {
    this.yArray.delete(index, length);
  }

  /**
   * Get the length of the array
   */
  get length(): number {
    return this.yArray.length;
  }

  /**
   * Subscribe to changes
   */
  observe(callback: (event: Y.YArrayEvent<T>) => void): void {
    this.yArray.observe(callback);
  }

  /**
   * Unobserve changes
   */
  unobserve(callback: (event: Y.YArrayEvent<T>) => void): void {
    this.yArray.unobserve(callback);
  }
}

/**
 * Document Manager - provides typed access to Yjs document arrays
 */
export class DocumentManager {
  private messagesArray: YjsArray<Message>;
  private threadsArray: YjsArray<Thread>;
  private tagsArray: YjsArray<string>;
  private botsArray: YjsArray<BotConfig>;

  constructor(private doc: Y.Doc) {
    // Get or create typed arrays
    this.messagesArray = new YjsArray(doc.getArray<Message>("messages"));
    this.threadsArray = new YjsArray(doc.getArray<Thread>("threads"));
    this.tagsArray = new YjsArray(doc.getArray<string>("tags"));
    this.botsArray = new YjsArray(doc.getArray<BotConfig>("dynamicBots"));
  }

  /**
   * Get messages array
   */
  get messages(): YjsArray<Message> {
    return this.messagesArray;
  }

  /**
   * Get threads array
   */
  get threads(): YjsArray<Thread> {
    return this.threadsArray;
  }

  /**
   * Get tags array
   */
  get tags(): YjsArray<string> {
    return this.tagsArray;
  }

  /**
   * Get bots array
   */
  get bots(): YjsArray<BotConfig> {
    return this.botsArray;
  }

  /**
   * Execute operations in a transaction (atomic batch)
   */
  transact(fn: () => void): void {
    this.doc.transact(fn);
  }

  /**
   * Get the underlying Yjs document
   */
  getDoc(): Y.Doc {
    return this.doc;
  }

  /**
   * Subscribe to all document updates
   */
  onUpdate(callback: (update: Uint8Array, origin: any) => void): void {
    this.doc.on("update", callback);
  }

  /**
   * Unsubscribe from document updates
   */
  offUpdate(callback: (update: Uint8Array, origin: any) => void): void {
    this.doc.off("update", callback);
  }
}
