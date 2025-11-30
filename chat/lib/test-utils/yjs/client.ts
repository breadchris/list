/**
 * Yjs Client for connecting to Y-Sweet server from Node.js
 * Provides low-level Yjs document access without React dependencies
 */

import * as Y from "yjs";
import { WebSocket } from "ws";
import { createYjsProvider, YSweetProvider } from "@y-sweet/client";

export interface YSweetClientToken {
  url: string;
  baseUrl: string;
  docId: string;
  authorization: string;
}

export interface YSweetClientOptions {
  /** Y-Sweet auth endpoint URL (e.g., http://localhost:3000/api/y-sweet-auth) */
  auth_endpoint: string;
  /** Document ID to connect to */
  doc_id: string;
  /** Optional custom fetch function */
  fetch?: typeof fetch;
}

/**
 * Connect to Y-Sweet and get a Yjs document
 */
export async function connectToYSweet(
  options: YSweetClientOptions
): Promise<{ doc: Y.Doc; provider: YSweetProvider; disconnect: () => void }> {
  const doc = new Y.Doc();

  // Fetch auth token from the server
  const token = await fetchAuthToken(options);

  console.error(
    JSON.stringify({
      type: "yjs_connecting",
      doc_id: options.doc_id,
      url: token.url,
    })
  );

  // Create Y-Sweet provider using the official client
  const provider = createYjsProvider(doc, token, {
    WebSocketPolyfill: WebSocket as any,
  });

  // Set up connection promise
  const connected = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Connection timeout"));
    }, 10000);

    provider.on("sync", () => {
      clearTimeout(timeout);
      console.error(
        JSON.stringify({
          type: "yjs_connected",
          doc_id: options.doc_id,
        })
      );
      resolve();
    });

    provider.on("connection-error", (error: Error) => {
      clearTimeout(timeout);
      console.error(
        JSON.stringify({
          type: "yjs_connection_error",
          error: error.message,
        })
      );
      reject(error);
    });
  });

  // Wait for initial sync
  await connected;

  return {
    doc,
    provider,
    disconnect: () => {
      provider.disconnect();
      doc.destroy();
    },
  };
}

/**
 * Fetch auth token from Y-Sweet auth endpoint
 */
async function fetchAuthToken(
  options: YSweetClientOptions
): Promise<YSweetClientToken> {
  const fetchFn = options.fetch || fetch;

  const response = await fetchFn(options.auth_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ docId: options.doc_id }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Y-Sweet auth token: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}


/**
 * Helper to wait for initial sync to complete
 */
export async function waitForSync(doc: Y.Doc, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for initial sync"));
    }, timeoutMs);

    // Wait for first update
    const handler = () => {
      clearTimeout(timeout);
      doc.off("update", handler);
      resolve();
    };

    doc.on("update", handler);

    // If doc already has content, resolve immediately
    if (doc.store.clients.size > 0) {
      clearTimeout(timeout);
      doc.off("update", handler);
      resolve();
    }
  });
}
