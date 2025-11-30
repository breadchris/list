import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";

/**
 * Wrapper to make YSweetProvider compatible with Plate.js YjsPlugin.
 *
 * This wrapper adapts Y-Sweet's provider to match Plate.js's UnifiedProvider interface
 * while ensuring that doc and awareness instances are the same references used by Y-Sweet.
 *
 * Key points:
 * - Uses provider's own awareness instance (not a copy)
 * - Accesses doc through awareness.doc (since YSweetProvider.doc is private)
 * - Catches errors on connect/disconnect (Y-Sweet manages connection lifecycle)
 */
export class YSweetProviderWrapper {
  private _isConnected = false;
  private _isSynced = false;

  readonly type = "ysweet";

  constructor(private provider: any) {
    // Track connection status from Y-Sweet provider events
    this.provider.on?.("connection-status", ({ status }: any) => {
      this._isConnected = status === "connected";
    });

    // Track sync status
    this.provider.on?.("sync", () => {
      this._isSynced = true;
    });

    // Initialize connection state from current provider status
    if (this.provider.status === "connected") {
      this._isConnected = true;
    }
  }

  /**
   * Returns the provider's awareness instance.
   * This is the SAME instance that Y-Sweet uses internally.
   */
  get awareness(): Awareness {
    return this.provider.awareness;
  }

  /**
   * Returns the Y.Doc instance via awareness.doc.
   * This is the SAME instance that Y-Sweet uses internally.
   * (YSweetProvider.doc is private, but awareness.doc provides access)
   */
  get document(): Y.Doc {
    return this.provider.awareness.doc;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get isSynced(): boolean {
    return this._isSynced;
  }

  /**
   * Delegate to Y-Sweet provider's connect, but catch errors.
   * Y-Sweet may already be connected via YDocProvider, so we ignore "already connected" errors.
   */
  connect(): void {
    // try {
    //   this.provider.connect?.();
    // } catch (e) {
    //   // Y-Sweet manages connection lifecycle via YDocProvider
    //   // Ignore errors if already connected
    // }
  }

  disconnect(): void {
    // try {
    //   this.provider.disconnect?.();
    // } catch (e) {
    //   // Ignore disconnect errors
    // }
  }

  destroy(): void {
    // try {
    //   this.provider.destroy?.();
    // } catch (e) {
    //   // Ignore destroy errors
    // }
  }
}
