"use client";

import { useEffect, useRef } from "react";
import { useYDoc, useConnectionStatus } from "@y-sweet/react";
import * as Y from "yjs";
import { DEFAULT_VOLUME, DEFAULT_PLAYBACK_RATE } from "../constants";

// Initialize the default DJ state in the Y-Sweet document
export function useDjInitialization() {
  const doc = useYDoc();
  const connectionStatus = useConnectionStatus();
  const initialized = useRef(false);

  useEffect(() => {
    // Wait for connection to be established before initializing
    // This ensures remote state has synced before we check if doc is empty
    if (connectionStatus !== "connected") return;
    if (initialized.current || !doc) return;

    const rootMap = doc.getMap("djState");

    // Check if already initialized (now checks AFTER remote sync)
    if (rootMap.has("queue") && rootMap.has("playback")) {
      initialized.current = true;
      return;
    }

    doc.transact(() => {
      // Initialize queue as Y.Array
      if (!rootMap.has("queue")) {
        const queueArray = new Y.Array();
        rootMap.set("queue", queueArray);
      }

      // Initialize playback state as Y.Map
      if (!rootMap.has("playback")) {
        const playbackMap = new Y.Map();
        playbackMap.set("current_index", 0);
        playbackMap.set("is_playing", false);
        playbackMap.set("current_time", 0);
        playbackMap.set("volume", DEFAULT_VOLUME);
        playbackMap.set("playback_rate", DEFAULT_PLAYBACK_RATE);
        playbackMap.set("last_updated", Date.now());
        rootMap.set("playback", playbackMap);
      }
    });

    initialized.current = true;
  }, [doc, connectionStatus]);

  return { initialized: initialized.current };
}
