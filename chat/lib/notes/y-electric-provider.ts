import { ShapeStream, Message, ChangeMessage, ControlMessage } from "@electric-sql/client";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import * as awarenessProtocol from "y-protocols/awareness";
import { IndexeddbPersistence } from "y-indexeddb";

type EventHandler<T extends unknown[]> = (...args: T) => void;

interface ElectricProviderEvents {
  sync: [boolean];
  synced: [boolean];
  status: [{ connected: boolean }];
  "connection-close": [];
}

interface ElectricProviderOptions {
  /** Electric SQL service URL */
  electric_url: string;
  /** Electric source ID for authentication */
  source_id: string;
  /** Note content ID to sync */
  note_id: string;
  /** API endpoint for posting sync updates */
  api_endpoint: string;
  /** Debounce delay in ms (default: 500) */
  debounce_ms?: number;
}

interface ContentRow {
  id: string;
  type: string;
  data: string;
  metadata: string | null; // JSON string containing { yjs_state, client_id }
  group_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface NoteMetadata {
  yjs_state?: string; // base64 encoded Y.Doc state
  client_id?: string;
}

/**
 * ElectricProvider for single-row note sync.
 *
 * Stores the full Y.Doc state in content.metadata.yjs_state
 * instead of storing individual operations.
 */
export class ElectricProvider {
  doc: Y.Doc;
  awareness: Awareness;

  private options: ElectricProviderOptions;
  private contentStream: ShapeStream<ContentRow> | null = null;
  private clientId: string;
  private synced = false;
  private persistence: IndexeddbPersistence | null = null;
  private destroyed = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSyncedState: string | null = null;

  // Event emitter
  private eventHandlers: Map<string, Set<EventHandler<unknown[]>>> = new Map();

  constructor(doc: Y.Doc, options: ElectricProviderOptions) {
    this.doc = doc;
    this.options = options;
    this.clientId = crypto.randomUUID();
    this.awareness = new Awareness(doc);

    // Initialize persistence for offline support
    this.initPersistence();

    // Set up document update handler (debounced)
    this.doc.on("update", this.handleDocUpdate);

    // Connect to Electric SQL stream
    this.connect();
  }

  private async initPersistence() {
    this.persistence = new IndexeddbPersistence(
      `notes-${this.options.note_id}`,
      this.doc
    );

    await this.persistence.whenSynced;
  }

  private connect() {
    if (this.destroyed) return;

    // Create content shape stream for this specific note
    this.contentStream = new ShapeStream<ContentRow>({
      url: `${this.options.electric_url}/v1/shape`,
      params: {
        table: "content",
        source_id: this.options.source_id,
        where: `type = 'note' AND id = '${this.options.note_id}'`,
      },
    });

    this.contentStream.subscribe(this.handleContentMessages);
  }

  private handleContentMessages = (messages: Message<ContentRow>[]) => {
    if (this.destroyed) return;

    for (const message of messages) {
      if (message.headers.operation) {
        const changeMsg = message as ChangeMessage<ContentRow>;

        if (changeMsg.headers.operation === "insert" ||
            changeMsg.headers.operation === "update") {
          const row = changeMsg.value;

          // Parse metadata
          let metadata: NoteMetadata = {};
          if (row.metadata) {
            try {
              metadata = JSON.parse(row.metadata);
            } catch {
              // Ignore parse errors
            }
          }

          // Skip if this is our own update
          if (metadata.client_id === this.clientId) continue;

          // Apply the Yjs state if present
          if (metadata.yjs_state) {
            try {
              const update = this.base64ToUint8Array(metadata.yjs_state);
              Y.applyUpdate(this.doc, update, "electric");
              this.lastSyncedState = metadata.yjs_state;
            } catch (error) {
              console.error("[ElectricProvider] Failed to apply state:", error);
            }
          }
        }
      } else if ("control" in message.headers) {
        const controlMsg = message as ControlMessage;

        if (controlMsg.headers.control === "up-to-date") {
          if (!this.synced) {
            this.synced = true;
            this.emit("sync", true);
            this.emit("synced", true);
            this.emit("status", { connected: true });
          }
        }
      }
    }
  };

  private handleDocUpdate = (_update: Uint8Array, origin: unknown) => {
    // Skip updates from Electric (avoid loop)
    if (origin === "electric") return;

    // Debounce sync to avoid excessive updates
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    const debounceMs = this.options.debounce_ms ?? 500;
    this.debounceTimer = setTimeout(() => {
      this.syncToServer();
    }, debounceMs);
  };

  private async syncToServer() {
    if (this.destroyed || !this.synced) return;

    // Encode full document state
    const state = Y.encodeStateAsUpdate(this.doc);
    const encoded = this.uint8ArrayToBase64(state);

    // Skip if state hasn't changed
    if (encoded === this.lastSyncedState) return;

    try {
      await fetch(`${this.options.api_endpoint}/notes/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note_id: this.options.note_id,
          yjs_state: encoded,
          client_id: this.clientId,
        }),
      });

      this.lastSyncedState = encoded;
    } catch (error) {
      console.error("[ElectricProvider] Failed to sync:", error);
    }
  }

  // Base64 encoding/decoding utilities
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    const binary = Array.from(bytes)
      .map(byte => String.fromCharCode(byte))
      .join("");
    return btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Event emitter methods
  on<K extends keyof ElectricProviderEvents>(
    event: K,
    handler: EventHandler<ElectricProviderEvents[K]>
  ): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as EventHandler<unknown[]>);
  }

  off<K extends keyof ElectricProviderEvents>(
    event: K,
    handler: EventHandler<ElectricProviderEvents[K]>
  ): void {
    this.eventHandlers.get(event)?.delete(handler as EventHandler<unknown[]>);
  }

  private emit<K extends keyof ElectricProviderEvents>(
    event: K,
    ...args: ElectricProviderEvents[K]
  ): void {
    this.eventHandlers.get(event)?.forEach(handler => handler(...args));
  }

  destroy() {
    this.destroyed = true;

    // Cancel pending debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Clean up event listeners
    this.doc.off("update", this.handleDocUpdate);

    // Clean up awareness
    awarenessProtocol.removeAwarenessStates(
      this.awareness,
      [this.awareness.clientID],
      "disconnect"
    );

    // Clean up persistence
    if (this.persistence) {
      this.persistence.destroy();
    }

    // Clear stream
    this.contentStream = null;

    this.emit("connection-close");
    this.eventHandlers.clear();
  }
}
