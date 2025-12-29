"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { usePlaybackActions } from "./use-dj-actions";
import { usePlaybackState, useCurrentIndex, useHasNext } from "./use-dj-state";

// Chrome extension types for TypeScript
declare global {
  interface Window {
    chrome?: typeof chrome;
  }
}

declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      tab?: { id?: number };
      url?: string;
    }

    function sendMessage(
      extensionId: string,
      message: any,
      callback?: (response: any) => void
    ): void;

    const lastError: { message?: string } | undefined;

    function addListener(
      callback: (
        message: any,
        sender: MessageSender,
        sendResponse: (response?: any) => void
      ) => void
    ): void;

    function removeListener(
      callback: (
        message: any,
        sender: MessageSender,
        sendResponse: (response?: any) => void
      ) => void
    ): void;

    const onMessage: {
      addListener: typeof addListener;
      removeListener: typeof removeListener;
    };
  }
}

// Extension ID (stable when using key in manifest.json)
const EXTENSION_ID = "ibkpiakkaphbgmafokndbkllndmdaelg";

// Check if chrome extension messaging is available
const isChromeExtensionAvailable =
  typeof chrome !== "undefined" &&
  chrome.runtime &&
  typeof chrome.runtime.sendMessage === "function" &&
  chrome.runtime.onMessage != null;

// Types for extension messages
interface DJMessage {
  action: string;
  [key: string]: unknown;
}

interface DJResponse {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

interface UseExtensionPlayerOptions {
  enabled?: boolean;
  debug?: boolean;
}

interface UseExtensionPlayerReturn {
  // Methods to control the offscreen player
  init: () => Promise<boolean>;
  loadVideo: (url: string, startTime?: number) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (time: number) => Promise<void>;
  setRate: (rate: number) => Promise<void>;
  stop: () => Promise<void>;
  close: () => Promise<void>;

  // Status
  isAvailable: boolean;
  isReady: boolean;
  isInitialized: boolean;
}

/**
 * Send a message to the extension and wait for response
 */
async function sendToExtension(message: DJMessage): Promise<DJResponse> {
  if (!isChromeExtensionAvailable) {
    throw new Error("Chrome extension not available");
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(EXTENSION_ID, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response || { success: true });
    });
  });
}

/**
 * Hook to manage the Chrome extension offscreen player for reliable
 * video end detection in background tabs.
 *
 * The offscreen player runs a muted YouTube player that fires onEnded
 * reliably even when the main tab is backgrounded.
 *
 * Usage:
 * 1. Call init() to create the offscreen document
 * 2. Call loadVideo() when a new video starts (sync with ReactPlayer)
 * 3. Call play/pause/seek/setRate to keep offscreen in sync
 * 4. The hook automatically advances to next video when offscreen detects end
 */
export function useExtensionPlayer({
  enabled = true,
  debug = true,
}: UseExtensionPlayerOptions = {}): UseExtensionPlayerReturn {
  const [isReady, setIsReady] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Track video index for which we've already triggered end detection
  const handledEndForIndexRef = useRef<number | null>(null);

  // Get playback actions and state
  const { nextVideo, setIsPlaying } = usePlaybackActions();
  const playbackState = usePlaybackState();
  const currentIndex = useCurrentIndex();
  const hasNext = useHasNext();

  // Stable ref for callbacks used in message handler
  const callbacksRef = useRef({ nextVideo, setIsPlaying, hasNext });
  useEffect(() => {
    callbacksRef.current = { nextVideo, setIsPlaying, hasNext };
  }, [nextVideo, setIsPlaying, hasNext]);

  // Reset handled index when video changes
  useEffect(() => {
    handledEndForIndexRef.current = null;
  }, [currentIndex]);

  // Listen for messages from the extension
  useEffect(() => {
    if (!enabled || !isChromeExtensionAvailable) {
      return;
    }

    const handleMessage = (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      // Only handle DJ messages
      if (!message.action?.startsWith("dj-")) {
        return;
      }

      if (debug) {
        console.log("[ExtensionPlayer] Received message:", message.action, message);
      }

      switch (message.action) {
        case "dj-player-ready":
          setIsReady(true);
          break;

        case "dj-video-ended": {
          const videoIndex = message.video_index;

          // Prevent duplicate triggers for the same video
          if (handledEndForIndexRef.current === videoIndex) {
            if (debug) {
              console.log("[ExtensionPlayer] Ignoring duplicate end for index:", videoIndex);
            }
            return;
          }

          handledEndForIndexRef.current = videoIndex;

          if (debug) {
            console.log("[ExtensionPlayer] Video ended, advancing to next");
          }

          // Advance to next video or stop playback
          const { hasNext, nextVideo, setIsPlaying } = callbacksRef.current;
          if (hasNext) {
            nextVideo();
          } else {
            setIsPlaying(false);
          }
          break;
        }

        case "dj-time-update":
          // Optional: could use this to sync time if needed
          break;

        case "dj-state-changed":
          // Optional: could use this to sync state if needed
          break;

        case "dj-error":
          console.error("[ExtensionPlayer] Player error:", message.error);
          break;

        case "dj-log": {
          const prefix = `[Extension ${message.level}]`;
          const logFn = message.level === "error" ? console.error : message.level === "warn" ? console.warn : console.log;
          logFn(prefix, message.message);
          break;
        }
      }

      sendResponse({ received: true });
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [enabled, debug]);

  // Initialize the offscreen document
  const init = useCallback(async (): Promise<boolean> => {
    if (!enabled || !isChromeExtensionAvailable) {
      return false;
    }

    try {
      if (debug) {
        console.log("[ExtensionPlayer] Initializing offscreen document...");
      }

      const response = await sendToExtension({ action: "dj-init" });

      if (response.success) {
        setIsInitialized(true);
        if (debug) {
          console.log("[ExtensionPlayer] Offscreen document initialized");
        }
        return true;
      }

      console.error("[ExtensionPlayer] Failed to initialize:", response.error);
      return false;
    } catch (error) {
      console.error("[ExtensionPlayer] Error initializing:", error);
      return false;
    }
  }, [enabled, debug]);

  // Load a video in the offscreen player
  const loadVideo = useCallback(
    async (url: string, startTime = 0): Promise<void> => {
      if (!enabled || !isChromeExtensionAvailable) {
        return;
      }

      try {
        if (debug) {
          console.log("[ExtensionPlayer] Loading video:", url, "at", startTime);
        }

        await sendToExtension({
          action: "dj-load-video",
          url,
          start_time: startTime,
          video_index: currentIndex,
        });
      } catch (error) {
        console.error("[ExtensionPlayer] Error loading video:", error);
      }
    },
    [enabled, debug, currentIndex]
  );

  // Play
  const play = useCallback(async (): Promise<void> => {
    if (!enabled || !isChromeExtensionAvailable) {
      return;
    }

    try {
      await sendToExtension({ action: "dj-play" });
    } catch (error) {
      console.error("[ExtensionPlayer] Error playing:", error);
    }
  }, [enabled]);

  // Pause
  const pause = useCallback(async (): Promise<void> => {
    if (!enabled || !isChromeExtensionAvailable) {
      return;
    }

    try {
      await sendToExtension({ action: "dj-pause" });
    } catch (error) {
      console.error("[ExtensionPlayer] Error pausing:", error);
    }
  }, [enabled]);

  // Seek
  const seek = useCallback(
    async (time: number): Promise<void> => {
      if (!enabled || !isChromeExtensionAvailable) {
        return;
      }

      try {
        await sendToExtension({ action: "dj-seek", time });
      } catch (error) {
        console.error("[ExtensionPlayer] Error seeking:", error);
      }
    },
    [enabled]
  );

  // Set playback rate
  const setRate = useCallback(
    async (rate: number): Promise<void> => {
      if (!enabled || !isChromeExtensionAvailable) {
        return;
      }

      try {
        await sendToExtension({ action: "dj-set-rate", rate });
      } catch (error) {
        console.error("[ExtensionPlayer] Error setting rate:", error);
      }
    },
    [enabled]
  );

  // Stop
  const stop = useCallback(async (): Promise<void> => {
    if (!enabled || !isChromeExtensionAvailable) {
      return;
    }

    try {
      await sendToExtension({ action: "dj-stop" });
    } catch (error) {
      console.error("[ExtensionPlayer] Error stopping:", error);
    }
  }, [enabled]);

  // Close the offscreen document
  const close = useCallback(async (): Promise<void> => {
    if (!enabled || !isChromeExtensionAvailable) {
      return;
    }

    try {
      await sendToExtension({ action: "dj-close" });
      setIsInitialized(false);
      setIsReady(false);
    } catch (error) {
      console.error("[ExtensionPlayer] Error closing:", error);
    }
  }, [enabled]);

  return {
    init,
    loadVideo,
    play,
    pause,
    seek,
    setRate,
    stop,
    close,
    isAvailable: isChromeExtensionAvailable,
    isReady,
    isInitialized,
  };
}

/**
 * No-op implementation when extension player is disabled.
 */
export function useNoOpExtensionPlayer(): UseExtensionPlayerReturn {
  const noop = useCallback(async () => {}, []);
  const noopBool = useCallback(async () => false, []);
  const noopWithArg = useCallback(async (_: any) => {}, []);

  return {
    init: noopBool,
    loadVideo: noopWithArg,
    play: noop,
    pause: noop,
    seek: noopWithArg,
    setRate: noopWithArg,
    stop: noop,
    close: noop,
    isAvailable: false,
    isReady: false,
    isInitialized: false,
  };
}
